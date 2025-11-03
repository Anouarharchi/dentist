const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Personnel
  getPersonnels: () => ipcRenderer.invoke('get-personnels'),
  addPersonnel: (p) => ipcRenderer.invoke('add-personnel', p),
  updatePersonnel: (p) => ipcRenderer.invoke('update-personnel', p),
  deletePersonnel: (id) => ipcRenderer.invoke('delete-personnel', id),

  // Login / current user
  checkLogin: (creds) => ipcRenderer.invoke('check-login', creds),
  getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
  logout: () => ipcRenderer.send('logout'),

  // Dashboard navigation
  openDashboard: (role) => ipcRenderer.send('open-dashboard', role),

  // Photos
  savePhoto: ({ file, CIN }) => ipcRenderer.invoke('save-photo', { file, CIN }),

  // Historique
  logOperation: (log) => ipcRenderer.invoke('log-operation', log)
});
