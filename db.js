const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'clinic.db');
const db = new sqlite3.Database(dbPath);
// After creating the HistoriqueDate table
db.serialize(() => {
  // Check if Action column exists
  db.get("PRAGMA table_info(HistoriqueDate)", (err, row) => {
    if (err) return console.error(err);
    
    db.all("PRAGMA table_info(HistoriqueDate)", (err, columns) => {
      if (err) return console.error(err);

      const hasAction = columns.some(col => col.name === "Action");
      if (!hasAction) {
        db.run("ALTER TABLE HistoriqueDate ADD COLUMN Action TEXT", (err) => {
          if (err) console.error("Erreur ajout colonne Action:", err);
          else console.log("✅ Colonne Action ajoutée à HistoriqueDate");
        });
      }
    });
  });
});

// ---------------------------
// 🧱 Create tables if not exist
// ---------------------------
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS Patients (
    IDP INTEGER PRIMARY KEY AUTOINCREMENT,
    Nom TEXT, Prenom TEXT, CIN TEXT, DateNaissance TEXT,
    Tel TEXT, Email TEXT, Adresse TEXT, Ville TEXT,
    Allergies TEXT, Remarques TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS RendezVous (
    IDRv INTEGER PRIMARY KEY AUTOINCREMENT,
    IDP INTEGER, DateRv TEXT, HeureRv TEXT, Statut TEXT,
    TypePatient TEXT, NomPrenom TEXT, Email TEXT,
    FOREIGN KEY(IDP) REFERENCES Patients(IDP)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Personnel (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Mie TEXT, Nom TEXT, Prenom TEXT, Tel TEXT, Mail TEXT,
    Adresse TEXT, Photo_FileData BLOB, Photo_FileName TEXT, Photo_FileType TEXT,
    Type TEXT, Specialite TEXT, Login TEXT UNIQUE, MotPasse TEXT,
    DateEntree TEXT, Droit TEXT, CIN TEXT, NbreEntree INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Consultation (
    IDC INTEGER PRIMARY KEY AUTOINCREMENT,
    IDP INTEGER, CIN TEXT, Motif TEXT, Diagnostic TEXT,
    Observations TEXT, Remarques TEXT, NomMedecin TEXT,
    PiècesJointes_FileData BLOB, PiècesJointes_FileName TEXT, PiècesJointes_FileType TEXT,
    FOREIGN KEY(IDP) REFERENCES Patients(IDP)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Ordonnance (
    IDR INTEGER PRIMARY KEY AUTOINCREMENT,
    IDC INTEGER, IDP INTEGER,
    Medicament1 TEXT, Posologie1 TEXT, Duree1 TEXT,
    Medicament2 TEXT, Posologie2 TEXT, Duree2 TEXT,
    Medicament3 TEXT, Posologie3 TEXT, Duree3 TEXT,
    Remarques TEXT,
    FOREIGN KEY(IDC) REFERENCES Consultation(IDC),
    FOREIGN KEY(IDP) REFERENCES Patients(IDP)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Honoraire (
    IDH INTEGER PRIMARY KEY AUTOINCREMENT,
    IDC INTEGER, IDP INTEGER, Montant REAL, TypePrestation TEXT,
    FOREIGN KEY(IDC) REFERENCES Consultation(IDC),
    FOREIGN KEY(IDP) REFERENCES Patients(IDP)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Reglement (
    IDR INTEGER PRIMARY KEY AUTOINCREMENT,
    IDP INTEGER, DateReglement TEXT, Montant REAL,
    Tel TEXT, Email TEXT, Adresse TEXT, ModePaiement TEXT,
    Solde REAL, Ville TEXT, CodePostal TEXT, Statut TEXT,
    Remarques TEXT, NomMedecin TEXT, Allergies TEXT,
    PiècesJointes_FileData BLOB, PiècesJointes_FileName TEXT, PiècesJointes_FileType TEXT,
    FOREIGN KEY(IDP) REFERENCES Patients(IDP)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS HistoriqueDate (
    IDDate INTEGER PRIMARY KEY AUTOINCREMENT,
    Date_E TEXT, Mat INTEGER, Action TEXT,
    FOREIGN KEY(Mat) REFERENCES Personnel(ID)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Suivi_doc (
    IDSuivi INTEGER PRIMARY KEY AUTOINCREMENT,
    RefDocument TEXT, Fournisseur TEXT, Date_S TEXT, Date_R TEXT,
    Mode_R TEXT, Montant REAL, Saisie TEXT, Compatibilite TEXT,
    ImageDoc_FileData BLOB, ImageDoc_FileName TEXT, ImageDoc_FileType TEXT,
    ImageJustificatif_FileData BLOB, ImageJustificatif_FileName TEXT, ImageJustificatif_FileType TEXT,
    Observation TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Approvisionnement (
    ID_App INTEGER PRIMARY KEY AUTOINCREMENT,
    DateApp TEXT, Fournisseur TEXT, IFF TEXT, Produit TEXT, Quantite INTEGER, PrixUnitaire REAL
  )`);

  // Default admin user
  db.get(`SELECT * FROM Personnel WHERE Login = 'admin'`, (err, row) => {
    if (!row) {
      db.run(`INSERT INTO Personnel (
        Mie, Nom, Prenom, Tel, Mail, Adresse,
        Photo_FileData, Photo_FileName, Photo_FileType,
        Type, Specialite, Login, MotPasse, DateEntree,
        Droit, CIN, NbreEntree
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['M.', 'Admin', 'Zehri', '0600000000', 'admin@clinic.com', 'HQ',
       null, null, null, 'Admin', 'General', 'admin', 'zehri',
       new Date().toISOString().split('T')[0], 'admin', 'XX0000', 0]);
      console.log('✅ Default admin user created.');
    }
  });
});

// =====================
// 📋 Functions
// =====================

// --- Patients ---
function getPatients() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM Patients', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
function addPatient(p) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO Patients 
      (Nom, Prenom, CIN, DateNaissance, Tel, Email, Adresse, Ville, Allergies, Remarques)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [p.Nom, p.Prenom, p.CIN, p.DateNaissance, p.Tel, p.Email, p.Adresse, p.Ville, p.Allergies, p.Remarques];
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

// --- Appointments ---
function getAppointmentsByDate(date) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM RendezVous WHERE DateRv = ?', [date], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
function addAppointment(appt) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO RendezVous (IDP, DateRv, HeureRv, Statut, TypePatient, NomPrenom, Email) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [appt.IDP, appt.DateRv, appt.HeureRv, appt.Statut, appt.TypePatient, appt.NomPrenom, appt.Email];
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

// --- Personnel ---
function checkLogin(login, pass) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Personnel WHERE Login = ? AND MotPasse = ?', [login, pass], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}
function getAllPersonnel() {
  return new Promise((resolve, reject) => {
    // Add RowNum for sequential display
    db.all('SELECT *, ROW_NUMBER() OVER (ORDER BY ID) AS RowNum FROM Personnel WHERE Login != "admin"', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
function addPersonnel(p) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO Personnel 
      (Mie, Nom, Prenom, Tel, Mail, Adresse, Type, Specialite, Login, MotPasse, DateEntree, Droit, CIN, Photo_FileData, Photo_FileName, Photo_FileType)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      p.Mie, p.Nom, p.Prenom, p.Tel, p.Mail, p.Adresse, p.Type, p.Specialite, 
      p.Login, p.MotPasse, p.DateEntree, p.Droit, p.CIN, 
      p.Photo_FileData || null, p.Photo_FileName || null, p.Photo_FileType || null
    ];
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}
function updatePersonnel(p) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE Personnel SET Mie=?, Nom=?, Prenom=?, Tel=?, Mail=?, Adresse=?, Type=?, Specialite=?, MotPasse=?, Droit=?, CIN=? WHERE ID=?`;
    const params = [p.Mie, p.Nom, p.Prenom, p.Tel, p.Mail, p.Adresse, p.Type, p.Specialite, p.MotPasse, p.Droit, p.CIN, p.ID];
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(true);
    });
  });
}
function deletePersonnel(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM Personnel WHERE ID = ?', [id], (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

// --- Consultation ---
function addConsultation(c) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO Consultation 
      (IDP, CIN, Motif, Diagnostic, Observations, Remarques, NomMedecin, PiècesJointes_FileData, PiècesJointes_FileName, PiècesJointes_FileType)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [c.IDP, c.CIN, c.Motif, c.Diagnostic, c.Observations, c.Remarques, c.NomMedecin, c.PiècesJointes_FileData, c.PiècesJointes_FileName, c.PiècesJointes_FileType];
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}
function getConsultationsByPatient(IDP) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM Consultation WHERE IDP = ?', [IDP], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// --- Ordonnance ---
function addOrdonnance(o) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO Ordonnance 
      (IDC, IDP, Medicament1, Posologie1, Duree1, Medicament2, Posologie2, Duree2, Medicament3, Posologie3, Duree3, Remarques)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [o.IDC, o.IDP, o.Medicament1, o.Posologie1, o.Duree1, o.Medicament2, o.Posologie2, o.Duree2, o.Medicament3, o.Posologie3, o.Duree3, o.Remarques];
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

// --- Honoraire ---
function addHonoraire(h) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO Honoraire (IDC, IDP, Montant, TypePrestation) VALUES (?, ?, ?, ?)`;
    const params = [h.IDC, h.IDP, h.Montant, h.TypePrestation];
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

// --- Reglement ---
function addReglement(r) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO Reglement
      (IDP, DateReglement, Montant, Tel, Email, Adresse, ModePaiement, Solde, Ville, CodePostal, Statut, Remarques, NomMedecin, Allergies, PiècesJointes_FileData, PiècesJointes_FileName, PiècesJointes_FileType)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [r.IDP, r.DateReglement, r.Montant, r.Tel, r.Email, r.Adresse, r.ModePaiement, r.Solde, r.Ville, r.CodePostal, r.Statut, r.Remarques, r.NomMedecin, r.Allergies, r.PiècesJointes_FileData, r.PiècesJointes_FileName, r.PiècesJointes_FileType];
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

// --- Historique ---
function addHistorique(entry) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO HistoriqueDate (Mat, Date_E, Action) VALUES (?, ?, ?)`;
    db.run(sql, [entry.Mat, entry.Date_E, entry.Action], function(err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
}
function addHistoriqueDate(log) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO HistoriqueDate (Date_E, Mat, Action) VALUES (?, ?, ?)`;
    const params = [log.Date_E, log.Mat, log.Action || ''];
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

// =====================
// 📦 Exports
// =====================
module.exports = {
  getPatients,
  addPatient,
  getAppointmentsByDate,
  addAppointment,
  checkLogin,
  getAllPersonnel,
  addPersonnel,
  updatePersonnel,
  deletePersonnel,
  addConsultation,
  getConsultationsByPatient,
  addOrdonnance,
  addHonoraire,
  addReglement,
  addHistorique,
  addHistoriqueDate
};
