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
  updatePatient: (p) => ipcRenderer.invoke('update-patient', p), // <-- هذا كان ناقص
  getPatientForDoc: (id) => ipcRenderer.invoke('get-patient-for-doc', id),

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
  getPatientByCIN: (cin) => ipcRenderer.invoke('get-patient-by-cin', cin),
  updateConsultation: (c) => ipcRenderer.invoke('update-consultation', c),
  deleteConsultation: (id) => ipcRenderer.invoke('delete-consultation', id),
  getConsultationById: (id) => ipcRenderer.invoke('get-consultation-by-id', id),
  getConsultations: () => ipcRenderer.invoke('get-consultations'),
  getConsultationFile: (fileName) => ipcRenderer.invoke('get-consultation-file', fileName),  // ---------------------------
  // New CIN-based ordonnance functions
  addOrdonnanceByCIN: (data) => ipcRenderer.invoke('add-ordonnance-by-cin', data),
  updateOrdonnanceByCIN: (data) => ipcRenderer.invoke('update-ordonnance-by-cin', data),
  getOrdonnancesByPatientCIN: (cin) => ipcRenderer.invoke('get-ordonnances-by-patient-cin', cin),
  getPatientLatestConsultation: (cin) => ipcRenderer.invoke('get-patient-latest-consultation', cin),
  getOrCreateCurrentConsultation: (cin, medecinName) => ipcRenderer.invoke('get-or-create-current-consultation', { cin, medecinName }),
  
  // Existing functions (make sure they're there)
  getOrdonnances: () => ipcRenderer.invoke('get-ordonnances'),
  getOrdonnanceById: (id) => ipcRenderer.invoke('get-ordonnance-by-id', id),
  updateOrdonnance: (data) => ipcRenderer.invoke('update-ordonnance', data),
  deleteOrdonnance: (id) => ipcRenderer.invoke('delete-ordonnance', id),

  // Appointments advanced
  getAppointments: ({ startDate, endDate }) => ipcRenderer.invoke('get-appointments', { startDate, endDate }),
  getAppointment: (IDRv) => ipcRenderer.invoke('get-appointment', IDRv),
  createAppointment: (appt) => ipcRenderer.invoke('create-appointment', appt),
  updateAppointment: (appt) => ipcRenderer.invoke('update-appointment', appt),
  deleteAppointment: (IDRv) => ipcRenderer.invoke('delete-appointment', IDRv),

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
  getSuiviDocs: () => ipcRenderer.invoke('get-suivi-docs'),

  // ---------------------------
  // Historique / Logging
  // ---------------------------
  logOperation: (log) => ipcRenderer.invoke('log-operation', log),

  // ---------------------------
  // Dashboard Cards
  // ---------------------------
  getPatientsCount: () => ipcRenderer.invoke('get-patients-count'), // Returns total number of patients
  getIncome: () => ipcRenderer.invoke('get-income')                // Returns total income
});
