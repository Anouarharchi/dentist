const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ---------------------------
  // Personnel CRUD
  // ---------------------------
  getPersonnels: () => ipcRenderer.invoke('get-personnels'),
  addPersonnel: (p) => ipcRenderer.invoke('add-personnel', p),
  updatePersonnel: (p) => ipcRenderer.invoke('update-personnel', p),
  deletePersonnel: (id) => ipcRenderer.invoke('delete-personnel', id),
  deletePhoto: (photoName) => ipcRenderer.invoke('delete-photo', photoName),

  // ---------------------------
  // Patients
  // ---------------------------
  getPatients: () => ipcRenderer.invoke('get-patients'),
  addPatient: (p) => ipcRenderer.invoke('add-patient', p),

  // ---------------------------
  // Appointments
  // ---------------------------
  getAppointmentsByDate: (date) => ipcRenderer.invoke('get-appointments-by-date', date),
  addAppointment: (appt) => ipcRenderer.invoke('add-appointment', appt),

  // ---------------------------
  // Consultation
  // ---------------------------
  addConsultation: (c) => ipcRenderer.invoke('add-consultation', c),
  getConsultationsByPatient: (IDP) => ipcRenderer.invoke('get-consultations-by-patient', IDP),

  // ---------------------------
  // Ordonnance
  // ---------------------------
  addOrdonnance: (o) => ipcRenderer.invoke('add-ordonnance', o),

  // ---------------------------
  // Honoraire
  // ---------------------------
  addHonoraire: (h) => ipcRenderer.invoke('add-honoraire', h),

  // ---------------------------
  // Reglement
  // ---------------------------
  addReglement: (r) => ipcRenderer.invoke('add-reglement', r),

  // ---------------------------
  // Login / Current User
  // ---------------------------
  checkLogin: (creds) => ipcRenderer.invoke('check-login', creds),
  getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
  logout: () => ipcRenderer.send('logout'),

  // ---------------------------
  // Dashboard navigation
  // ---------------------------
  openDashboard: (role) => ipcRenderer.send('open-dashboard', role),

  // ---------------------------
  // Photos
  // ---------------------------
  savePhoto: ({ file, CIN }) => ipcRenderer.invoke('save-photo', { file, CIN }),

  // ---------------------------
  // Historique / Logging
  // ---------------------------
  logOperation: (log) => ipcRenderer.invoke('log-operation', log)
});
