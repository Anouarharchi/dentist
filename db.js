const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'clinic.db');
const db = new sqlite3.Database(dbPath);
// ADD THESE LINES TO PREVENT SQLITE_BUSY ERRORS:
db.configure("busyTimeout", 5000); // 5 second timeout
db.exec("PRAGMA journal_mode = WAL;", (err) => {
  if (err) console.error("Failed to set WAL mode:", err);
  else console.log("WAL mode enabled");
});
// ===============================
// 🧱 Check & Create HistoriqueDate Column
// ===============================
db.serialize(() => {
  db.get("PRAGMA table_info(HistoriqueDate)", (err) => {
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

// ===============================
// 🧱 Create Tables If Not Exists
// ===============================
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
    TypePatient TEXT, NomPrenom TEXT, Email TEXT, CIN TEXT,
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
    ConsultationID TEXT UNIQUE,
    DateCreation DATETIME DEFAULT CURRENT_TIMESTAMP,  
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

  // Default admin
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

// ===============================
// 📌 PATIENT FUNCTIONS
// ===============================
function updatePatientInDB(p) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE Patients SET 
        Nom=?, Prenom=?, CIN=?, DateNaissance=?, Tel=?, Email=?, Adresse=?,
        Ville=?, Allergies=?, Remarques=? WHERE IDP=?`;
    const params = [
      p.Nom, p.Prenom, p.CIN, p.DateNaissance, p.Tel, p.Email,
      p.Adresse, p.Ville, p.Allergies, p.Remarques, p.IDP
    ];
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

function getAllPatients() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM Patients", [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function getPatientById(id) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM Patients WHERE IDP = ?", [id], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

function getPatients() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM Patients", [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
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
      if (err) reject(err); else resolve(this.lastID);
    });
  });
}

function getPatientByCIN(cin) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM Patients WHERE CIN = ?`;
    db.get(sql, [cin], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

function getPatientForDoc(idp) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Patients WHERE IDP=?', [idp], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

// ======================================
// 📌 APPOINTMENTS
// ======================================
function getAppointmentsByDate(date) {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM RendezVous WHERE DateRv=?", [date], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function getAppointmentsBetween(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM RendezVous WHERE DateRv BETWEEN ? AND ? ORDER BY DateRv, HeureRv`;
    db.all(sql, [startDate, endDate], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function getAppointmentById(IDRv) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM RendezVous WHERE IDRv=?", [IDRv], (err, row) => {
      if (err) reject(err); else resolve(row || null);
    });
  });
}

function addAppointment(appt) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO RendezVous 
      (IDP, DateRv, HeureRv, Statut, TypePatient, NomPrenom, Email, CIN)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      appt.IDP || null,
      appt.DateRv || new Date().toISOString().split('T')[0],
      appt.HeureRv || "08:00",
      appt.Statut || "Planifié",
      appt.TypePatient || "",
      appt.NomPrenom || "",
      appt.Email || "",
      appt.CIN || ""
    ];
    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(this.lastID);
    });
  });
}

function updateAppointment(appt) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE RendezVous SET 
      IDP=?, DateRv=?, HeureRv=?, Statut=?, TypePatient=?, NomPrenom=?,
      Email=?, CIN=? WHERE IDRv=?`;
    const params = [
      appt.IDP || null,
      appt.DateRv || new Date().toISOString().split('T')[0],
      appt.HeureRv || "08:00",
      appt.Statut || "Planifié",
      appt.TypePatient || "",
      appt.NomPrenom || "",
      appt.Email || "",
      appt.CIN || "",
      appt.IDRv
    ];
    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(true);
    });
  });
}

function deleteAppointmentById(IDRv) {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM RendezVous WHERE IDRv=?", [IDRv], function(err) {
      if (err) reject(err); else resolve(true);
    });
  });
}

function getRendezVousToday() {
  const today = new Date().toISOString().split("T")[0];
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM RendezVous WHERE DateRv=?", [today], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

// ======================================
// 📌 PERSONNEL
// ======================================
function checkLogin(login, pass) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM Personnel WHERE Login=? AND MotPasse=?", [login, pass], (err, row) => {
      if (err) reject(err); else resolve(row || null);
    });
  });
}

function getAllPersonnel() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT *, ROW_NUMBER() OVER (ORDER BY ID) AS RowNum 
            FROM Personnel WHERE Login != "admin"`, [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function addPersonnel(p) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO Personnel 
      (Mie, Nom, Prenom, Tel, Mail, Adresse, Type, Specialite,
       Login, MotPasse, DateEntree, Droit, CIN,
       Photo_FileData, Photo_FileName, Photo_FileType)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      p.Mie, p.Nom, p.Prenom, p.Tel, p.Mail, p.Adresse, p.Type, p.Specialite,
      p.Login, p.MotPasse, p.DateEntree, p.Droit, p.CIN,
      p.Photo_FileData || null, p.Photo_FileName || null, p.Photo_FileType || null
    ];
    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(this.lastID);
    });
  });
}

function updatePersonnel(p) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE Personnel SET 
      Mie=?, Nom=?, Prenom=?, Tel=?, Mail=?, Adresse=?, Type=?, 
      Specialite=?, MotPasse=?, Droit=?, CIN=? WHERE ID=?`;
    const params = [
      p.Mie, p.Nom, p.Prenom, p.Tel, p.Mail, p.Adresse,
      p.Type, p.Specialite, p.MotPasse, p.Droit, p.CIN, p.ID
    ];
    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(true);
    });
  });
}

function deletePersonnel(id) {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM Personnel WHERE ID=?", [id], function(err) {
      if (err) reject(err); else resolve(true);
    });
  });
}

// ======================================
// 📌 CONSULTATIONS
// ======================================
function getConsultations() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM Consultation", [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function getConsultationById(IDC) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM Consultation WHERE IDC = ?`;
    db.get(sql, [IDC], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}


function addConsultation(c) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO Consultation 
      (IDP, CIN, Motif, Diagnostic, Observations, Remarques, NomMedecin,
       PiècesJointes_FileData, PiècesJointes_FileName, PiècesJointes_FileType)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      c.IDP, c.CIN, c.Motif, c.Diagnostic, c.Observations,
      c.Remarques, c.NomMedecin, c.PiècesJointes_FileData,
      c.PiècesJointes_FileName, c.PiècesJointes_FileType
    ];

    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(this.lastID);
    });
  });
}

function getConsultationsByPatient(IDP) {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM Consultation WHERE IDP=?", [IDP], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function updateConsultation(c) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE Consultation SET 
      IDP=?, CIN=?, Motif=?, Diagnostic=?, Observations=?, 
      Remarques=?, NomMedecin=?, PiècesJointes_FileData=?,
      PiècesJointes_FileName=?, PiècesJointes_FileType=? WHERE IDC=?`;

    const params = [
      c.IDP, c.CIN, c.Motif, c.Diagnostic, c.Observations,
      c.Remarques, c.NomMedecin, c.PiècesJointes_FileData,
      c.PiècesJointes_FileName, c.PiècesJointes_FileType, c.IDC
    ];

    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(true);
    });
  });
}

function deleteConsultation(IDC) {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM Consultation WHERE IDC=?", [IDC], function(err) {
      if (err) reject(err); else resolve(true);
    });
  });
}



// ======================================
// 📌 BASIC ORDONNANCE FUNCTIONS (Add these)
// ======================================

function getOrdonnances() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM Ordonnance", [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function getOrdonnanceById(IDR) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM Ordonnance WHERE IDR=?", [IDR], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

function addOrdonnance(data) {
  const sql = `
    INSERT INTO Ordonnance
    (IDC, IDP, Medicament1, Posologie1, Duree1,
     Medicament2, Posologie2, Duree2,
     Medicament3, Posologie3, Duree3, Remarques)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  return new Promise((resolve, reject) => {
    db.run(sql, [
      data.IDC, data.IDP,
      data.M1, data.P1, data.D1,
      data.M2, data.P2, data.D2,
      data.M3, data.P3, data.D3,
      data.Remarques
    ], function (err) {
      if (err) reject(err); else resolve({ IDR: this.lastID });
    });
  });
}

function updateOrdonnance(o) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE Ordonnance SET 
      IDC=?, IDP=?, Medicament1=?, Posologie1=?, Duree1=?,
      Medicament2=?, Posologie2=?, Duree2=?,
      Medicament3=?, Posologie3=?, Duree3=?, Remarques=? WHERE IDR=?`;

    const params = [
      o.IDC, o.IDP, o.Medicament1, o.Posologie1, o.Duree1,
      o.Medicament2, o.Posologie2, o.Duree2,
      o.Medicament3, o.Posologie3, o.Duree3,
      o.Remarques, o.IDR
    ];

    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(true);
    });
  });
}

function deleteOrdonnance(IDR) {
  return new Promise((resolve, reject) => {
    const maxRetries = 3;
    let retries = 0;
    
    function attemptDelete() {
      db.run("DELETE FROM Ordonnance WHERE IDR=?", [IDR], function(err) {
        if (err) {
          if (err.code === 'SQLITE_BUSY' && retries < maxRetries) {
            retries++;
            console.log(`Database busy, retrying delete (${retries}/${maxRetries})...`);
            setTimeout(attemptDelete, 100 * retries); // Exponential backoff
            return;
          }
          reject(err);
        } else {
          resolve(true);
        }
      });
    }
    
    attemptDelete();
  });
}
// ======================================
// 📌 ENHANCED ORDONNANCE LOGIC
// ======================================

/**
 * Get or create a consultation for a patient's current visit
 * @param {string} patientCIN - Patient's CIN
 * @param {string} medecinName - Doctor's name creating the prescription
 * @returns {Promise} Consultation ID
 */
function getOrCreateCurrentConsultation(patientCIN, medecinName) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Find patient by CIN
      const patient = await getPatientByCIN(patientCIN);
      if (!patient) {
        return reject(new Error(`Patient avec CIN ${patientCIN} non trouvé`));
      }

      const today = new Date().toISOString().split('T')[0];
      
      // 2. Look for today's consultation for this patient
      const existingConsultation = await new Promise((resolve, reject) => {
        db.get(
          `SELECT * FROM Consultation 
           WHERE IDP = ? AND date(IDC) = date(?) 
           ORDER BY IDC DESC LIMIT 1`,
          [patient.IDP, today],
          (err, row) => {
            if (err) reject(err); else resolve(row);
          }
        );
      });

      if (existingConsultation) {
        // Return existing consultation for today
        resolve(existingConsultation.IDC);
      } else {
        // 3. Create a new consultation for today
        const newConsultation = {
          IDP: patient.IDP,
          CIN: patientCIN,
          Motif: "Consultation médicale",
          Diagnostic: "",
          Observations: "",
          Remarques: `Consultation du ${today}`,
          NomMedecin: medecinName
        };

        const newConsultationId = await addConsultation(newConsultation);
        resolve(newConsultationId);
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Add prescription using patient CIN instead of IDs
 * @param {Object} data - Prescription data with patient CIN
 */
function addOrdonnanceByCIN(data) {
  return new Promise(async (resolve, reject) => {
    try {
      // Validate required fields
      if (!data.patientCIN) {
        return reject(new Error("CIN du patient est requis"));
      }
      if (!data.medecinName) {
        return reject(new Error("Nom du médecin est requis"));
      }

      // Get or create consultation for this patient
      const consultationId = await getOrCreateCurrentConsultation(
        data.patientCIN, 
        data.medecinName
      );

      // Get patient ID for the prescription
      const patient = await getPatientByCIN(data.patientCIN);

      // Create prescription linked to the consultation
      const sql = `
        INSERT INTO Ordonnance
        (IDC, IDP, Medicament1, Posologie1, Duree1,
         Medicament2, Posologie2, Duree2,
         Medicament3, Posologie3, Duree3, Remarques)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(sql, [
        consultationId, patient.IDP,
        data.M1, data.P1, data.D1,
        data.M2, data.P2, data.D2,
        data.M3, data.P3, data.D3,
        data.Remarques
      ], function (err) {
        if (err) reject(err); 
        else resolve({ 
          IDR: this.lastID,
          IDC: consultationId,
          IDP: patient.IDP
        });
      });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Update prescription using patient CIN
 * @param {Object} data - Prescription data with patient CIN
 */
function updateOrdonnanceByCIN(data) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!data.patientCIN) {
        return reject(new Error("CIN du patient est requis"));
      }

      // Get patient ID
      const patient = await getPatientByCIN(data.patientCIN);
      if (!patient) {
        return reject(new Error(`Patient avec CIN ${data.patientCIN} non trouvé`));
      }

      const sql = `UPDATE Ordonnance SET 
        IDP=?, Medicament1=?, Posologie1=?, Duree1=?,
        Medicament2=?, Posologie2=?, Duree2=?,
        Medicament3=?, Posologie3=?, Duree3=?, Remarques=? 
        WHERE IDR=?`;

      const params = [
        patient.IDP,
        data.Medicament1, data.Posologie1, data.Duree1,
        data.Medicament2, data.Posologie2, data.Duree2,
        data.Medicament3, data.Posologie3, data.Duree3,
        data.Remarques, data.IDR
      ];

      db.run(sql, params, function(err) {
        if (err) reject(err); else resolve(true);
      });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get prescriptions by patient CIN
 * @param {string} patientCIN 
 */
function getOrdonnancesByPatientCIN(patientCIN) {
  return new Promise(async (resolve, reject) => {
    try {
      const patient = await getPatientByCIN(patientCIN);
      if (!patient) {
        return reject(new Error(`Patient avec CIN ${patientCIN} non trouvé`));
      }

      const sql = `
        SELECT o.*, c.DateCreation as DateConsultation, c.NomMedecin
        FROM Ordonnance o
        JOIN Consultation c ON o.IDC = c.IDC
        WHERE o.IDP = ?
        ORDER BY c.DateCreation DESC
      `;

      db.all(sql, [patient.IDP], (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get patient's latest consultation
 * @param {string} patientCIN 
 */
function getPatientLatestConsultation(patientCIN) {
  return new Promise(async (resolve, reject) => {
    try {
      const patient = await getPatientByCIN(patientCIN);
      if (!patient) {
        return resolve(null);
      }

      const sql = `
        SELECT * FROM Consultation 
        WHERE IDP = ? 
        ORDER BY IDC DESC 
        LIMIT 1
      `;

      db.get(sql, [patient.IDP], (err, row) => {
        if (err) reject(err); else resolve(row);
      });

    } catch (error) {
      reject(error);
    }
  });
}

// ======================================
// 📌 HONORAIRES
// ======================================
function addHonoraire(h) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO Honoraire (IDC, IDP, Montant, TypePrestation)
                 VALUES (?, ?, ?, ?)`;

    db.run(sql, [h.IDC, h.IDP, h.Montant, h.TypePrestation], function(err) {
      if (err) reject(err); else resolve(this.lastID);
    });
  });
}

function getAllHonoraires() {
  return new Promise((resolve, reject) => {
    db.all("SELECT Montant FROM Honoraire", [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

// ======================================
// 📌 REGLEMENT
// ======================================
function addReglement(r) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO Reglement
      (IDP, DateReglement, Montant, Tel, Email, Adresse, ModePaiement,
      Solde, Ville, CodePostal, Statut, Remarques, NomMedecin, Allergies,
      PiècesJointes_FileData, PiècesJointes_FileName, PiècesJointes_FileType)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      r.IDP, r.DateReglement, r.Montant, r.Tel, r.Email, r.Adresse,
      r.ModePaiement, r.Solde, r.Ville, r.CodePostal, r.Statut,
      r.Remarques, r.NomMedecin, r.Allergies,
      r.PiècesJointes_FileData, r.PiècesJointes_FileName, r.PiècesJointes_FileType
    ];

    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(this.lastID);
    });
  });
}

// ======================================
// 📌 HISTORIQUE
// ======================================
function addHistorique(entry) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO HistoriqueDate (Mat, Date_E, Action)
                 VALUES (?, ?, ?)`;
    db.run(sql, [entry.Mat, entry.Date_E, entry.Action], function(err) {
      if (err) reject(err); else resolve(this.lastID);
    });
  });
}

function addHistoriqueDate(log) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO HistoriqueDate (Date_E, Mat, Action)
                 VALUES (?, ?, ?)`;
    const params = [log.Date_E, log.Mat, log.Action || ""];
    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(this.lastID);
    });
  });
}

// ======================================
// 📌 SUIVI DOC
// ======================================
function addSuiviDoc(data) {
  const sql = `
    INSERT INTO Suivi_doc
    (RefDocument, Fournisseur, Date_S, Date_R, Mode_R, Montant, Saisie, Compatibilite,
     ImageDoc_FileData, ImageDoc_FileName, ImageDoc_FileType,
     ImageJustificatif_FileData, ImageJustificatif_FileName, ImageJustificatif_FileType,
     Observation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  return new Promise((resolve, reject) => {
    db.run(sql, [
      data.Ref, data.Fournisseur, data.DateS, data.DateR, data.ModeR,
      data.Montant, data.Saisie, data.Compatibilite,
      data.Img1Data, data.Img1Name, data.Img1Type,
      data.Img2Data, data.Img2Name, data.Img2Type,
      data.Observation
    ], function(err) {
      if (err) reject(err); else resolve({ IDSuivi: this.lastID });
    });
  });
}

// ======================================
// 📦 EXPORTS
// ======================================
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

  addHonoraire,
  addReglement,
  addHistorique,
  addHistoriqueDate,
  getAllHonoraires,
  getAppointmentsBetween,
  getAppointmentById,
  updateAppointment,
  deleteAppointmentById,
  updatePatientInDB,
  getPatientById,
  getConsultationById,
  getConsultations,
  addSuiviDoc,
  getRendezVousToday,
  getAllPatients,
  getPatientForDoc,
  getPatientByCIN,
  deleteConsultation,
  updateConsultation,
  addOrdonnanceByCIN,
  updateOrdonnanceByCIN,
  getOrdonnancesByPatientCIN,
  getPatientLatestConsultation,
  getOrCreateCurrentConsultation,
   getOrdonnances,
  getOrdonnanceById,
  addOrdonnance,
  updateOrdonnance,
  deleteOrdonnance
};
