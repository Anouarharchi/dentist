const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./db.js');

// ======================================================
// GLOBALS
// ======================================================
let mainWindow;
let currentUser = null;

// Ensure folders exist
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

// ======================================================
// CREATE MAIN WINDOW
// ======================================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,   // ← Hides the menu bar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,

    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'));
}

// ======================================================
// AUTHENTICATION
// ======================================================

// Login
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

// Get current logged user
ipcMain.handle('get-current-user', async () => currentUser ? { ...currentUser } : null);

// Logout
ipcMain.on('logout', () => {
  currentUser = null;
  if (mainWindow) mainWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'));
});

// ======================================================
// PHOTO HANDLING
// ======================================================
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

// ======================================================
// PERSONNEL CRUD
// ======================================================
ipcMain.handle('get-personnels', () => db.getAllPersonnel());
ipcMain.handle('add-personnel', (event, p) => db.addPersonnel(p));
ipcMain.handle('update-personnel', (event, p) => db.updatePersonnel(p));
ipcMain.handle('delete-personnel', (event, id) => db.deletePersonnel(id));

// ======================================================
// PATIENTS & APPOINTMENTS — PART 1
// ======================================================
ipcMain.handle('get-patients', async () => {
  return await db.getPatients();
});

ipcMain.handle('add-patient', (event, patient) => db.addPatient(patient));

ipcMain.handle('get-appointments-by-date', (event, date) => db.getAppointmentsByDate(date));

ipcMain.handle('add-appointment', (event, appt) => db.addAppointment(appt));

// ======================================================
// CONSULTATION
// ======================================================
ipcMain.handle('add-consultation', async (event, c) => {
  try {
    // If a file was sent as base64, save it to assets
    if (c.PiècesJointes_FileData && c.PiècesJointes_FileName) {
      try {
        const base64 = c.PiècesJointes_FileData;
        const originalName = c.PiècesJointes_FileName;

        // Get extension
        const ext = path.extname(originalName) || '';

        // CIN sanitizing
        const safeCIN = (c.CIN || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '');

        // ✅ CLEAN FILENAME (NO TIMESTAMP)
        const filename = `${safeCIN}-consultation${ext}`;

        const destPath = path.join(__dirname, 'assets', filename);

        // Write file
        const buffer = Buffer.from(base64, 'base64');
        await fs.promises.writeFile(destPath, buffer);

        // Update payload to save filename in DB
        c.PiècesJointes_FileName = filename;
        c.PiècesJointes_FileType = c.PiècesJointes_FileType || '';
        c.PiècesJointes_FileData = null;

      } catch (err) {
        console.error('Failed to save consultation attachment:', err);

        // continue without attachment
        c.PiècesJointes_FileData = null;
        c.PiècesJointes_FileName = null;
        c.PiècesJointes_FileType = null;
      }
    }

    // Continue saving consultation
    return await db.addConsultation(c);

  } catch (err) {
    console.error('add-consultation error:', err);
    throw err;
  }
});

ipcMain.handle('get-consultations', async () => {
  try {
    return await db.getConsultations();
  } catch (err) {
    console.error('get-consultations error:', err);
    throw err;
  }
});

ipcMain.handle('get-consultations-by-patient', (event, IDP) => db.getConsultationsByPatient(IDP));
ipcMain.handle('update-consultation', async (event, c) => {
  try {
    // If a new file is provided
    if (c.PiècesJointes_FileData && c.PiècesJointes_FileName) {
      try {
        // Delete old file if exists
        if (c.OldFileName) {
          const oldPath = path.join(__dirname, 'assets', c.OldFileName);
          try { 
            await fs.promises.unlink(oldPath); 
          } catch(e) { 
            /* ignore missing file */ 
          }
        }

        // Get extension
        const originalName = c.PiècesJointes_FileName;
        const ext = path.extname(originalName) || '';

        // Clean CIN
        const safeCIN = (c.CIN || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '');

        // ✅ CLEAN FILENAME (NO TIMESTAMP)
        const filename = `${safeCIN}-consultation${ext}`;

        // Save to assets
        const destPath = path.join(__dirname, 'assets', filename);
        const buffer = Buffer.from(c.PiècesJointes_FileData, 'base64');
        await fs.promises.writeFile(destPath, buffer);

        // Update payload
        c.PiècesJointes_FileName = filename;
        c.PiècesJointes_FileType = c.PiècesJointes_FileType || '';
        c.PiècesJointes_FileData = null;

      } catch (err) {
        console.error('Failed to save new attachment on update:', err);
        c.PiècesJointes_FileData = null;
      }
    }

    // Continue updating DB
    return await db.updateConsultation(c);

  } catch (err) {
    console.error('update-consultation error:', err);
    throw err;
  }
});

ipcMain.handle('delete-consultation', async (event, IDC) => {
  try {
    return await db.deleteConsultation(IDC);
  } catch (err) {
    console.error('delete-consultation error:', err);
    throw err;
  }
});

ipcMain.handle('get-patient-by-cin', async (event, cin) => {
  try {
    return await db.getPatientByCIN(cin);
  } catch (err) {
    console.error('Error get-patient-by-cin:', err);
    return null;
  }
});

ipcMain.handle('get-consultation-by-id', async (event, IDC) => {
  try {
    return await db.getConsultationById(IDC);
  } catch (err) {
    console.error('get-consultation-by-id error:', err);
    return null;
  }
});

ipcMain.handle('get-consultation-file', async (event, fileName) => {
  try {
    const assetsPath = path.join(__dirname, 'assets');
    
    // Check if assets directory exists
    try {
      await fs.promises.access(assetsPath);
    } catch {
      return { exists: false, error: 'Assets directory not found' };
    }

    const filePath = path.join(assetsPath, fileName);
    
    // Check if file exists
    try {
      await fs.promises.access(filePath);
    } catch {
      return { exists: false, error: 'File not found' };
    }

    const fileStats = await fs.promises.stat(filePath);
    const extension = path.extname(fileName).toLowerCase().replace('.', '');
    
    return {
      exists: true,
      name: fileName,
      path: filePath,
      url: `file://${filePath}`,
      extension: extension,
      size: fileStats.size
    };
  } catch (error) {
    console.error('Error finding consultation file:', error);
    return { exists: false, error: error.message };
  }
});

// ======================================================
// ENHANCED ORDONNANCE FUNCTIONS (CIN-BASED) - FIXED VERSION
// ======================================================

// Get or create current consultation for a patient
ipcMain.handle('get-or-create-current-consultation', async (event, { cin, medecinName }) => {
  try {
    return await db.getOrCreateCurrentConsultation(cin, medecinName);
  } catch (error) {
    console.error('Error in get-or-create-current-consultation:', error);
    throw error;
  }
});

// Add ordonnance using CIN - FIXED VERSION
ipcMain.handle('add-ordonnance-by-cin', async (event, data) => {
  try {
    console.log('Received ordonnance data:', data);
    
    // Use the enhanced function that handles consultation_ref properly
    const result = await db.addOrdonnanceByCIN(data);
    console.log('Ordonnance created successfully:', result);
    return result;

  } catch (error) {
    console.error('Error in add-ordonnance-by-cin:', error);
    throw error;
  }
});

// Update ordonnance using CIN
ipcMain.handle('update-ordonnance-by-cin', async (event, data) => {
  try {
    const result = await db.updateOrdonnanceByCIN(data);
    return result;
  } catch (error) {
    console.error('Error in update-ordonnance-by-cin:', error);
    throw error;
  }
});

// Get ordonnances by patient CIN
ipcMain.handle('get-ordonnances-by-patient-cin', async (event, cin) => {
  try {
    return await db.getOrdonnancesByPatientCIN(cin);
  } catch (error) {
    console.error('Error in get-ordonnances-by-patient-cin:', error);
    throw error;
  }
});

// Get patient's latest consultation
ipcMain.handle('get-patient-latest-consultation', async (event, cin) => {
  try {
    return await db.getPatientLatestConsultation(cin);
  } catch (error) {
    console.error('Error in get-patient-latest-consultation:', error);
    throw error;
  }
});

// ======================================================
// EXISTING ORDONNANCE FUNCTIONS
// ======================================================
ipcMain.handle('add-ordonnance', (event, o) => db.addOrdonnance(o));
ipcMain.handle('get-ordonnances', () => db.getOrdonnances());
ipcMain.handle('get-ordonnance-by-id', (event, id) => db.getOrdonnanceById(id));
ipcMain.handle('update-ordonnance', (event, o) => db.updateOrdonnance(o));
ipcMain.handle('delete-ordonnance', (event, id) => db.deleteOrdonnance(id));

// ======================================================
// HONORAIRE
// ======================================================
ipcMain.handle('add-honoraire', (event, h) => db.addHonoraire(h));

// ======================================================
// REGLEMENT
// ======================================================
ipcMain.handle('add-reglement', (event, r) => db.addReglement(r));

// ======================================================
// HISTORIQUE
// ======================================================
ipcMain.handle('log-operation', (event, log) => db.addHistorique(log));

// ======================================================
// DASHBOARD STATISTICS
// ======================================================
ipcMain.handle('get-patients-count', async () => {
  const patients = await db.getPatients();
  return patients.length;
});

ipcMain.handle('get-income', async () => {
  const honoraires = await db.getAllHonoraires();
  return honoraires.reduce((sum, h) => sum + h.Montant, 0);
});

// ======================================================
// PATIENTS & APPOINTMENTS — PART 2 (UPDATED SYSTEM)
// ======================================================

// Update patient
ipcMain.handle('update-patient', async (event, patient) => {
  try {
    return await db.updatePatientInDB(patient);
  } catch (err) {
    console.error('Failed to update patient:', err);
    throw err;
  }
});

// Weekly view
ipcMain.handle('get-appointments', (event, { startDate, endDate }) =>
  db.getAppointmentsBetween(startDate, endDate)
);

// Single appointment
ipcMain.handle('get-appointment', (event, IDRv) =>
  db.getAppointmentById(IDRv)
);

// Create appointment (with TypePatient fallback)
ipcMain.handle('create-appointment', (event, appt) => {
  appt.TypePatient = appt.TypePatient || "";
  return db.addAppointment(appt);
});

// For doctor page
ipcMain.handle("get-patient-for-doc", async (event, idp) => {
  return await db.getPatientForDoc(idp);
});

// Update appointment
ipcMain.handle('update-appointment', (event, appt) => {
  appt.TypePatient = appt.TypePatient || "";
  return db.updateAppointment(appt);
});

// Delete appointment
ipcMain.handle('delete-appointment', (event, IDRv) =>
  db.deleteAppointmentById(IDRv)
);

// Add this to your main.js if it doesn't exist
ipcMain.handle('get-suivi-docs', () => {
  // You need to implement this function in db.js or return empty array for now
  return [];
});

// ======================================================
// OPEN DASHBOARD BASED ON ROLE
// ======================================================
ipcMain.on('open-dashboard', (event, role) => {
  if (!mainWindow) return;

  let page;

  switch (role) {
    case 'admin': page = 'index.html'; break;
    case 'doctor': page = 'doctor.html'; break;
    case 'secretary': page = 'secretary.html'; break;
    case 'finance': page = 'finance.html'; break;
    default: page = 'gest.html';
  }

  mainWindow.loadFile(path.join(__dirname, 'renderer', page));
});

// ======================================================
// APP
// ======================================================
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});