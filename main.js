const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./db.js'); // Base de données

// ---------------------------
// Variables globales
// ---------------------------
let mainWindow;
let currentUser = null;

// ---------------------------
// Vérifier et créer dossier db et assets si manquant
// ---------------------------
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

// ---------------------------
// Fonction pour créer la fenêtre principale
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
// ✅ Login utilisateur
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
// Récupérer utilisateur actuel
// ---------------------------
ipcMain.handle('get-current-user', async () => {
  try {
    return currentUser ? { ...currentUser } : null;
  } catch (err) {
    console.error('Erreur get-current-user:', err);
    throw err;
  }
});

// ---------------------------
// Déconnexion
// ---------------------------
ipcMain.on('logout', () => {
  currentUser = null;
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'));
  }
});

// ---------------------------
// 🧩 CRUD Personnel
// ---------------------------
ipcMain.handle('get-personnels', async () => {
  try {
    return await db.getAllPersonnel();
  } catch (err) {
    console.error('Erreur get-personnels:', err);
    throw err;
  }
});

ipcMain.handle('add-personnel', async (event, p) => {
  try {
    return await db.addPersonnel(p);
  } catch (err) {
    console.error('Erreur add-personnel:', err);
    throw err;
  }
});

ipcMain.handle('update-personnel', async (event, p) => {
  try {
    return await db.updatePersonnel(p);
  } catch (err) {
    console.error('Erreur update-personnel:', err);
    throw err;
  }
});

ipcMain.handle('delete-personnel', async (event, id) => {
  try {
    return await db.deletePersonnel(id);
  } catch (err) {
    console.error('Erreur delete-personnel:', err);
    throw err;
  }
});

// ---------------------------
// 🧩 Patients & Appointments
// ---------------------------
ipcMain.handle('get-patients', async () => {
  try {
    return await db.getPatients();
  } catch (err) {
    console.error('Erreur get-patients:', err);
    throw err;
  }
});

ipcMain.handle('add-patient', async (event, patient) => {
  try {
    return await db.addPatient(patient);
  } catch (err) {
    console.error('Erreur add-patient:', err);
    throw err;
  }
});

ipcMain.handle('get-appointments-by-date', async (event, date) => {
  try {
    return await db.getAppointmentsByDate(date);
  } catch (err) {
    console.error('Erreur get-appointments-by-date:', err);
    throw err;
  }
});

ipcMain.handle('add-appointment', async (event, appt) => {
  try {
    return await db.addAppointment(appt);
  } catch (err) {
    console.error('Erreur add-appointment:', err);
    throw err;
  }
});

// ---------------------------
// 🧩 Consultation
// ---------------------------
ipcMain.handle('add-consultation', async (event, c) => {
  try {
    return await db.addConsultation(c);
  } catch (err) {
    console.error('Erreur add-consultation:', err);
    throw err;
  }
});

ipcMain.handle('get-consultations-by-patient', async (event, IDP) => {
  try {
    return await db.getConsultationsByPatient(IDP);
  } catch (err) {
    console.error('Erreur get-consultations-by-patient:', err);
    throw err;
  }
});

// ---------------------------
// 🧩 Ordonnance
// ---------------------------
ipcMain.handle('add-ordonnance', async (event, o) => {
  try {
    return await db.addOrdonnance(o);
  } catch (err) {
    console.error('Erreur add-ordonnance:', err);
    throw err;
  }
});

// ---------------------------
// 🧩 Honoraire
// ---------------------------
ipcMain.handle('add-honoraire', async (event, h) => {
  try {
    return await db.addHonoraire(h);
  } catch (err) {
    console.error('Erreur add-honoraire:', err);
    throw err;
  }
});

// ---------------------------
// 🧩 Reglement
// ---------------------------
ipcMain.handle('add-reglement', async (event, r) => {
  try {
    return await db.addReglement(r);
  } catch (err) {
    console.error('Erreur add-reglement:', err);
    throw err;
  }
});

// ---------------------------
// 🧩 Historique
// ---------------------------
// 🩵 FIXED HERE: replaced db.addHistoriqueDate with db.addHistorique
ipcMain.handle('log-operation', async (event, log) => {
  try {
    return await db.addHistorique(log); // 🩵 corrected function name
  } catch (err) {
    console.error('Erreur log-operation:', err);
    throw err;
  }
});

// ---------------------------
// 🖼 Sauvegarde photo personnel
// ---------------------------
ipcMain.handle('save-photo', async (event, { file, CIN }) => {
  try {
    if (!file || !CIN) throw new Error("Fichier ou CIN manquant.");
    const ext = path.extname(file);
    const destPath = path.join(assetsDir, CIN + ext);
    fs.copyFileSync(file, destPath);
    console.log('Photo sauvegardée:', destPath);
    return CIN + ext;
  } catch (err) {
    console.error('Erreur save-photo:', err);
    throw err;
  }
});

// ---------------------------
// 🪟 Ouvrir page selon rôle
// ---------------------------
ipcMain.on('open-dashboard', (event, role) => {
  if (!mainWindow) return;
  let page;
  switch (role) {
    case 'admin':
      page = path.join(__dirname, 'renderer', 'admin.html');
      break;
    case 'doctor':
      page = path.join(__dirname, 'renderer', 'doctor.html');
      break;
    case 'secretary':
      page = path.join(__dirname, 'renderer', 'secretary.html');
      break;
    case 'finance':
      page = path.join(__dirname, 'renderer', 'finance.html');
      break;
    default:
      page = path.join(__dirname, 'renderer', 'dashboard.html');
  }
  mainWindow.loadFile(page);
});

// ---------------------------
// 🏁 Lancement de l’app
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
