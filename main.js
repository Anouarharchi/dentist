const { app, BrowserWindow, ipcMain } = require('electron'); 
const path = require('path');
const fs = require('fs');
const db = require('./db.js'); // Database module

// ---------------------------
// Global variables
// ---------------------------
let mainWindow;
let currentUser = null;

// ---------------------------
// Ensure db and assets directories exist
// ---------------------------
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

// ---------------------------
// Create main window
// ---------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'));
}

// ---------------------------
// Login
// ---------------------------
ipcMain.handle('check-login', async (event, creds) => {
  try {
    console.log('Tentative login:', creds.username);
    const user = await db.checkLogin(creds.username, creds.password);
    if (user) {
      currentUser = user;
      console.log('Login réussi:', user.Login);
      return { success: true, user };
    } else {
      console.log('Login échoué pour:', creds.username);
      return { success: false, message: 'Identifiant ou mot de passe incorrect.' };
    }
  } catch (err) {
    console.error('Erreur login:', err);
    return { success: false, message: 'Erreur base de données.' };
  }
});

// ---------------------------
// Get current user
// ---------------------------
ipcMain.handle('get-current-user', async () => currentUser ? { ...currentUser } : null);

// ---------------------------
// Logout
// ---------------------------
ipcMain.on('logout', () => {
  currentUser = null;
  if (mainWindow) mainWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'));
});

// ---------------------------
// Delete photo
// ---------------------------  
ipcMain.handle('delete-photo', async (event, photoName) => {
  const filePath = path.join(__dirname, 'assets', photoName);
  try {
    await fs.promises.unlink(filePath);
    console.log('Deleted old photo:', filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Failed to delete photo:', err);
  }
  return true;
});

// ---------------------------
// Personnel CRUD
// ---------------------------
ipcMain.handle('get-personnels', () => db.getAllPersonnel());
ipcMain.handle('add-personnel', (event, p) => db.addPersonnel(p));
ipcMain.handle('update-personnel', (event, p) => db.updatePersonnel(p));
ipcMain.handle('delete-personnel', (event, id) => db.deletePersonnel(id));

// ---------------------------
// Patients & Appointments
// ---------------------------
ipcMain.handle('get-patients', () => db.getPatients());
ipcMain.handle('add-patient', (event, patient) => db.addPatient(patient));
ipcMain.handle('get-appointments-by-date', (event, date) => db.getAppointmentsByDate(date));
ipcMain.handle('add-appointment', (event, appt) => db.addAppointment(appt));

// ---------------------------
// Consultation
// ---------------------------
ipcMain.handle('add-consultation', (event, c) => db.addConsultation(c));
ipcMain.handle('get-consultations-by-patient', (event, IDP) => db.getConsultationsByPatient(IDP));

// ---------------------------
// Ordonnance
// ---------------------------
ipcMain.handle('add-ordonnance', (event, o) => db.addOrdonnance(o));

// ---------------------------
// Honoraire
// ---------------------------
ipcMain.handle('add-honoraire', (event, h) => db.addHonoraire(h));

// ---------------------------
// Reglement
// ---------------------------
ipcMain.handle('add-reglement', (event, r) => db.addReglement(r));

// ---------------------------
// Historique
// ---------------------------
ipcMain.handle('log-operation', (event, log) => db.addHistorique(log));
// ---------------------------
// Dashboard statistics
// ---------------------------  
ipcMain.handle('get-patients-count', async () => {
  const patients = await db.getPatients(); // your existing db function
  return patients.length;
});

ipcMain.handle('get-income', async () => {
  const honoraires = await db.getAllHonoraires();
  return honoraires.reduce((sum, h) => sum + h.Montant, 0);
});

// ---------------------------
// Save personnel photo (non-blocking)
// ---------------------------
ipcMain.handle('save-photo', async (event, { file, CIN }) => {
  if (!file) return null;
  try {
    const ext = path.extname(file);
    const destPath = path.join(__dirname, 'assets', `${CIN}${ext}`);
    await fs.promises.copyFile(file, destPath);
    return `${CIN}${ext}`;
  } catch (err) {
    console.error('Error saving photo:', err);
    return null;
  }
});

// ---------------------------
// Patients & Appointments
// ---------------------------

// Get appointments for a specific date

// Get appointments between two dates (for weekly view)
ipcMain.handle('get-appointments', (event, { startDate, endDate }) => {
  return db.getAppointmentsBetween(startDate, endDate);
});

// Get single appointment by ID
ipcMain.handle('get-appointment', (event, IDRv) => db.getAppointmentById(IDRv));

// Create new appointment
ipcMain.handle('create-appointment', (event, appt) => {
  // ensure TypePatient field is always present to avoid SQLITE_ERROR
  appt.TypePatient = appt.TypePatient || "";
  return db.addAppointment(appt);
});

// Update existing appointment
ipcMain.handle('update-appointment', (event, appt) => {
  appt.TypePatient = appt.TypePatient || "";
  return db.updateAppointment(appt);
});

// Delete appointment
ipcMain.handle('delete-appointment', (event, IDRv) => db.deleteAppointmentById(IDRv));

// ---------------------------
// Open dashboard based on role
// ---------------------------
ipcMain.on('open-dashboard', (event, role) => {
  if (!mainWindow) return;
  let page;
  switch (role) {
    case 'admin': page = path.join(__dirname, 'renderer', 'index.html'); break;
    case 'doctor': page = path.join(__dirname, 'renderer', 'doctor.html'); break;
    case 'secretary': page = path.join(__dirname, 'renderer', 'secretary.html'); break;
    case 'finance': page = path.join(__dirname, 'renderer', 'finance.html'); break;
    default: page = path.join(__dirname, 'renderer', 'gest.html');
  }
  mainWindow.loadFile(page);
});

// ---------------------------
// App ready
// ---------------------------
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
