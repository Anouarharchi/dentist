export function initPatients() {
  /* ========= Advanced Utilities ========= */
  function escapeHtml(s) { 
    if (!s && s !== 0) return ''; 
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); 
  }
  
  function qs(sel, ctx = document) { return ctx.querySelector(sel); }
  function qsa(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }
  
  function downloadFile(filename, content, type = 'text/csv') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}-circle"></i>
      <span>${message}</span>
    `;
    
    const container = qs('#toastContainer');
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ========= Advanced State Management ========= */
  let patients = [];
  let filtered = [];
  let sortState = { col: 'Nom', dir: 'asc' };
  let page = 1;
  const PAGE_SIZE = 12;
  let currentFilters = {
    search: '',
    city: '',
    hasCIN: 'all'
  };

  /* ========= DOM Elements ========= */
  const elements = {
    tbody: qs("#patientsTbody"),
    statusText: qs("#statusText"),
    totalCount: qs("#totalCount"),
    searchBox: qs("#searchBox"),
    clearSearch: qs("#clearSearch"),
    pagination: qs("#pagination"),
    rangeDisplay: qs("#rangeDisplay"),
    emptyState: qs("#emptyState"),
    modalRoot: qs("#modalRoot"),
    toggleThemeBtn: qs("#toggleTheme"),
    newPatientBtn: qs("#newPatientBtn"),
    exportCsvBtn: qs("#exportCsv"),
    filterCity: qs("#filterCity"),
    filterCIN: qs("#filterCIN"),
    advancedFilters: qs("#advancedFilters")
  };

  /* ========= Advanced Theme Management ========= */
  function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    const isDark = saved === 'dark';
    document.documentElement.classList.toggle('dark-theme', isDark);
    document.documentElement.classList.toggle('light-theme', !isDark);
    elements.toggleThemeBtn.innerHTML = isDark 
      ? '<i class="fas fa-sun"></i> Mode Clair' 
      : '<i class="fas fa-moon"></i> Mode Sombre';
  }

  elements.toggleThemeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark-theme');
    document.documentElement.classList.toggle('dark-theme', !isDark);
    document.documentElement.classList.toggle('light-theme', isDark);
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
    elements.toggleThemeBtn.innerHTML = isDark 
      ? '<i class="fas fa-moon"></i> Mode Sombre' 
      : '<i class="fas fa-sun"></i> Mode Clair';
  });

  /* ========= Advanced Data Management ========= */
  async function fetchPatients() {
    elements.statusText.textContent = 'Chargement des patients…';
    elements.statusText.parentElement.querySelector('.status-dot').classList.add('loading');
    
    try {
      const rows = await window.electronAPI.getPatients();
      patients = Array.isArray(rows) ? rows : [];
      
      // Update filter options
      updateFilterOptions();
      
      applyFilterAndSort();
      elements.statusText.textContent = `Chargé: ${patients.length} patients`;
      elements.totalCount.textContent = patients.length;
      
      showToast(`${patients.length} patients chargés avec succès`, 'success');
    } catch (err) {
      console.error('fetchPatients error', err);
      elements.statusText.textContent = 'Erreur de chargement';
      showToast('Erreur lors du chargement des patients', 'error');
    } finally {
      elements.statusText.parentElement.querySelector('.status-dot').classList.remove('loading');
    }
  }

  function updateFilterOptions() {
    // Update city filter options
    const cities = [...new Set(patients.map(p => p.Ville).filter(Boolean))];
    if (elements.filterCity) {
      elements.filterCity.innerHTML = '<option value="">Toutes les villes</option>' +
        cities.map(city => `<option value="${city}">${city}</option>`).join('');
    }
  }

  /* ========= Advanced Filtering & Sorting ========= */
  function applyFilterAndSort() {
    const searchTerm = (elements.searchBox.value || '').trim().toLowerCase();
    const cityFilter = elements.filterCity ? elements.filterCity.value : '';
    const cinFilter = elements.filterCIN ? elements.filterCIN.value : 'all';

    filtered = patients.filter(p => {
      // Search filter
      if (searchTerm && !(
        (p.Nom || '').toString().toLowerCase().includes(searchTerm) ||
        (p.Prenom || '').toString().toLowerCase().includes(searchTerm) ||
        (p.CIN || '').toString().toLowerCase().includes(searchTerm) ||
        (p.Tel || '').toString().toLowerCase().includes(searchTerm) ||
        (p.Ville || '').toString().toLowerCase().includes(searchTerm)
      )) return false;

      // City filter
      if (cityFilter && p.Ville !== cityFilter) return false;

      // CIN filter
      if (cinFilter === 'with' && !p.CIN) return false;
      if (cinFilter === 'without' && p.CIN) return false;

      return true;
    });

    // Advanced sorting
    const col = sortState.col;
    const dir = sortState.dir === 'asc' ? 1 : -1;
    
    filtered.sort((a, b) => {
      let A = (a[col] || '').toString().toLowerCase();
      let B = (b[col] || '').toString().toLowerCase();
      
      // Special handling for numeric fields
      if (col === 'IDP') {
        A = parseInt(a[col]) || 0;
        B = parseInt(b[col]) || 0;
        return (A - B) * dir;
      }
      
      // Special handling for dates
      if (col === 'DateNaissance') {
        A = new Date(a[col] || '1900-01-01');
        B = new Date(b[col] || '1900-01-01');
        return (A - B) * dir;
      }
      
      if (A < B) return -1 * dir;
      if (A > B) return 1 * dir;
      return 0;
    });

    const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > maxPage) page = maxPage;

    renderTable();
    renderPagination();
    updateStats();
  }

  function updateStats() {
    const stats = {
      total: patients.length,
      filtered: filtered.length,
      withCIN: patients.filter(p => p.CIN).length,
      withoutCIN: patients.filter(p => !p.CIN).length
    };
    
    // You can display these stats in your UI
    console.log('Patient Stats:', stats);
  }

  /* ========= Advanced Table Rendering ========= */
  function renderTable() {
    const start = (page - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);
    elements.rangeDisplay.textContent = `${start + 1} - ${Math.min(start + PAGE_SIZE, filtered.length)} / ${filtered.length}`;

    if (pageRows.length === 0) {
      elements.tbody.innerHTML = '';
      elements.emptyState.style.display = filtered.length ? 'none' : 'block';
      return;
    } else {
      elements.emptyState.style.display = 'none';
    }

    elements.tbody.innerHTML = pageRows.map(p => `
      <tr data-id="${p.IDP}" class="patient-row">
        <td>
          <div class="patient-name">
            <strong>${escapeHtml(p.Nom)}</strong>
          </div>
        </td>
        <td>${escapeHtml(p.Prenom)}</td>
        <td>
          ${p.CIN ? `<span class="cin-badge">${escapeHtml(p.CIN)}</span>` : '<span class="no-cin">—</span>'}
        </td>
        <td>
          ${p.Tel ? `
            <div class="phone-cell">
              <i class="fas fa-phone"></i>
              <a href="tel:${p.Tel}" class="phone-link">${escapeHtml(p.Tel)}</a>
            </div>
          ` : '<span class="no-phone">—</span>'}
        </td>
        <td>
          ${p.Ville ? `<span class="city-tag">${escapeHtml(p.Ville)}</span>` : '<span class="no-city">—</span>'}
        </td>
        <td>
          <div class="action-buttons">
            <button class="action-btn view" data-action="view" title="Voir détails">
              <i class="fas fa-eye"></i>
            </button>
            <button class="action-btn appointment" data-action="appointment" title="Nouveau rendez-vous">
              <i class="fas fa-calendar-plus"></i>
            </button>
            <button class="action-btn edit" data-action="edit" title="Modifier">
              <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn history" data-action="history" title="Historique">
              <i class="fas fa-history"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Add event listeners
    qsa('.patient-row', elements.tbody).forEach(row => {
      row.addEventListener('click', (e) => {
        if (!e.target.closest('.action-btn')) {
          // Row click - open patient details
          const id = row.dataset.id;
          const patient = patients.find(p => String(p.IDP) === String(id));
          if (patient) openPatientModal(patient, 'view');
        }
      });
    });

    qsa('.action-btn', elements.tbody).forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onRowAction(e);
      });
    });
  }

  function renderPagination() {
    const count = filtered.length;
    const maxPage = Math.max(1, Math.ceil(count / PAGE_SIZE));
    
    elements.pagination.innerHTML = `
      <div class="pagination-info">
        Page ${page} sur ${maxPage} • ${count} patients
      </div>
      <div class="pagination-controls">
        <button class="page-btn first" ${page === 1 ? 'disabled' : ''}>
          <i class="fas fa-angle-double-left"></i>
        </button>
        <button class="page-btn prev" ${page === 1 ? 'disabled' : ''}>
          <i class="fas fa-angle-left"></i>
        </button>
        <div class="page-numbers"></div>
        <button class="page-btn next" ${page === maxPage ? 'disabled' : ''}>
          <i class="fas fa-angle-right"></i>
        </button>
        <button class="page-btn last" ${page === maxPage ? 'disabled' : ''}>
          <i class="fas fa-angle-double-right"></i>
        </button>
      </div>
    `;

    const pageNumbers = elements.pagination.querySelector('.page-numbers');
    const range = 5;
    let startPage = Math.max(1, page - Math.floor(range / 2));
    let endPage = Math.min(maxPage, startPage + range - 1);
    startPage = Math.max(1, endPage - range + 1);

    for (let i = startPage; i <= endPage; i++) {
      const btn = document.createElement('button');
      btn.className = `page-btn ${i === page ? 'active' : ''}`;
      btn.textContent = i;
      btn.addEventListener('click', () => {
        page = i;
        applyFilterAndSort();
      });
      pageNumbers.appendChild(btn);
    }

    // Add event listeners for control buttons
    elements.pagination.querySelector('.first').addEventListener('click', () => { page = 1; applyFilterAndSort(); });
    elements.pagination.querySelector('.prev').addEventListener('click', () => { page = Math.max(1, page - 1); applyFilterAndSort(); });
    elements.pagination.querySelector('.next').addEventListener('click', () => { page = Math.min(maxPage, page + 1); applyFilterAndSort(); });
    elements.pagination.querySelector('.last').addEventListener('click', () => { page = maxPage; applyFilterAndSort(); });
  }

  /* ========= Advanced Event Handlers ========= */
  function onRowAction(e) {
    const btn = e.target.closest('.action-btn');
    if (!btn) return;

    const tr = btn.closest('tr');
    const id = tr.dataset.id;
    const action = btn.dataset.action;
    const patient = patients.find(p => String(p.IDP) === String(id));
    
    if (!patient) return;

    switch (action) {
      case 'view':
        openPatientModal(patient, 'view');
        break;
      case 'edit':
        openPatientModal(patient, 'edit');
        break;
      case 'appointment':
        openAppointmentModal(patient);
        break;
      case 'history':
        openPatientHistory(patient);
        break;
    }
  }

  /* ========= Advanced Modal System ========= */
  function openPatientModal(patient = null, mode = 'edit') {
    const isEdit = mode === 'edit';
    const isNew = !patient;
    
    const modalHTML = `
      <div class="modal-overlay active">
        <div class="modal patient-modal">
          <div class="modal-header">
            <h2 class="modal-title">
              <i class="fas fa-${isNew ? 'plus' : isEdit ? 'edit' : 'eye'}"></i>
              ${isNew ? 'Nouveau Patient' : isEdit ? 'Modifier Patient' : 'Détails Patient'}
            </h2>
            <button class="modal-close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <form id="patientForm" class="advanced-form">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Nom *</label>
                  <input type="text" class="form-control" name="Nom" value="${patient ? escapeHtml(patient.Nom) : ''}" 
                         ${!isEdit ? 'readonly' : ''} required>
                </div>
                <div class="form-group">
                  <label class="form-label">Prénom *</label>
                  <input type="text" class="form-control" name="Prenom" value="${patient ? escapeHtml(patient.Prenom) : ''}" 
                         ${!isEdit ? 'readonly' : ''} required>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">CIN</label>
                  <input type="text" class="form-control" name="CIN" value="${patient ? escapeHtml(patient.CIN || '') : ''}" 
                         ${!isEdit ? 'readonly' : ''}>
                </div>
                <div class="form-group">
                  <label class="form-label">Date de Naissance</label>
                  <input type="date" class="form-control" name="DateNaissance" value="${patient ? escapeHtml(patient.DateNaissance || '') : ''}" 
                         ${!isEdit ? 'readonly' : ''}>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Téléphone</label>
                  <input type="tel" class="form-control" name="Tel" value="${patient ? escapeHtml(patient.Tel || '') : ''}" 
                         ${!isEdit ? 'readonly' : ''}>
                </div>
                <div class="form-group">
                  <label class="form-label">Email</label>
                  <input type="email" class="form-control" name="Email" value="${patient ? escapeHtml(patient.Email || '') : ''}" 
                         ${!isEdit ? 'readonly' : ''}>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Ville</label>
                  <input type="text" class="form-control" name="Ville" value="${patient ? escapeHtml(patient.Ville || '') : ''}" 
                         ${!isEdit ? 'readonly' : ''}>
                </div>
                <div class="form-group">
                  <label class="form-label">Adresse</label>
                  <input type="text" class="form-control" name="Adresse" value="${patient ? escapeHtml(patient.Adresse || '') : ''}" 
                         ${!isEdit ? 'readonly' : ''}>
                </div>
              </div>
              
              <div class="form-group">
                <label class="form-label">Allergies</label>
                <textarea class="form-control" name="Allergies" rows="2" ${!isEdit ? 'readonly' : ''}>${patient ? escapeHtml(patient.Allergies || '') : ''}</textarea>
              </div>
              
              <div class="form-group">
                <label class="form-label">Remarques</label>
                <textarea class="form-control" name="Remarques" rows="3" ${!isEdit ? 'readonly' : ''}>${patient ? escapeHtml(patient.Remarques || '') : ''}</textarea>
              </div>
            </form>
            
            ${!isNew && !isEdit ? `
              <div class="patient-stats">
                <h3>Statistiques du Patient</h3>
                <div class="stats-grid">
                  <div class="stat-item">
                    <i class="fas fa-calendar-check"></i>
                    <span>Rendez-vous: <strong>0</strong></span>
                  </div>
                  <div class="stat-item">
                    <i class="fas fa-stethoscope"></i>
                    <span>Consultations: <strong>0</strong></span>
                  </div>
                  <div class="stat-item">
                    <i class="fas fa-file-medical"></i>
                    <span>Ordonnances: <strong>0</strong></span>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn secondary" id="cancelBtn">Annuler</button>
            ${isEdit ? `
              <button type="button" class="btn primary" id="saveBtn">
                <i class="fas fa-save"></i> ${isNew ? 'Créer Patient' : 'Mettre à jour'}
              </button>
            ` : `
              <button type="button" class="btn primary" id="editBtn">
                <i class="fas fa-edit"></i> Modifier
              </button>
            `}
          </div>
        </div>
      </div>
    `;

    elements.modalRoot.innerHTML = modalHTML;
    elements.modalRoot.style.display = 'block';

    const modal = elements.modalRoot.querySelector('.modal-overlay');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('#cancelBtn');
    const saveBtn = modal.querySelector('#saveBtn');
    const editBtn = modal.querySelector('#editBtn');
    const form = modal.querySelector('#patientForm');

    function closeModal() {
      modal.classList.remove('active');
      setTimeout(() => {
        elements.modalRoot.innerHTML = '';
        elements.modalRoot.style.display = 'none';
      }, 300);
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        const formData = new FormData(form);
        const patientData = Object.fromEntries(formData.entries());
        
        if (isNew) {
          patientData.IDP = null;
        } else {
          patientData.IDP = patient.IDP;
        }

        try {
          if (isNew) {
            await window.electronAPI.addPatient(patientData);
            showToast('Patient créé avec succès', 'success');
          } else {
            await window.electronAPI.updatePatient(patientData);
            showToast('Patient mis à jour avec succès', 'success');
          }
          closeModal();
          await fetchPatients(); // Refresh the list
        } catch (err) {
          console.error('Error saving patient:', err);
          showToast('Erreur lors de la sauvegarde', 'error');
        }
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        closeModal();
        openPatientModal(patient, 'edit');
      });
    }
  }

  function openAppointmentModal(patient) {
    // Advanced appointment modal implementation
    const modalHTML = `
      <div class="modal-overlay active">
        <div class="modal appointment-modal">
          <div class="modal-header">
            <h2 class="modal-title">
              <i class="fas fa-calendar-plus"></i>
              Nouveau Rendez-vous
            </h2>
            <button class="modal-close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <form id="appointmentForm" class="advanced-form">
              <div class="patient-info-card">
                <h4>Patient</h4>
                <p><strong>${escapeHtml(patient.Nom)} ${escapeHtml(patient.Prenom)}</strong></p>
                <p>CIN: ${patient.CIN || 'Non renseigné'} | Tél: ${patient.Tel || 'Non renseigné'}</p>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Date du RDV *</label>
                  <input type="date" class="form-control" name="DateRv" required 
                         value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                  <label class="form-label">Heure *</label>
                  <input type="time" class="form-control" name="HeureRv" required value="09:00">
                </div>
              </div>
              
              <div class="form-group">
                <label class="form-label">Type de patient</label>
                <select class="form-control" name="TypePatient">
                  <option value="Nouveau">Nouveau patient</option>
                  <option value="Régulier">Patient régulier</option>
                  <option value="Urgence">Urgence</option>
                  <option value="Contrôle">Contrôle</option>
                </select>
              </div>
              
              <div class="form-group">
                <label class="form-label">Statut</label>
                <select class="form-control" name="Statut">
                  <option value="Planifié">Planifié</option>
                  <option value="Confirmé">Confirmé</option>
                  <option value="Annulé">Annulé</option>
                </select>
              </div>
              
              <div class="form-group">
                <label class="form-label">Notes additionnelles</label>
                <textarea class="form-control" name="Notes" rows="3" placeholder="Notes optionnelles..."></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn secondary" id="cancelBtn">Annuler</button>
            <button type="button" class="btn success" id="saveBtn">
              <i class="fas fa-save"></i> Créer Rendez-vous
            </button>
          </div>
        </div>
      </div>
    `;

    elements.modalRoot.innerHTML = modalHTML;
    elements.modalRoot.style.display = 'block';

    const modal = elements.modalRoot.querySelector('.modal-overlay');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('#cancelBtn');
    const saveBtn = modal.querySelector('#saveBtn');
    const form = modal.querySelector('#appointmentForm');

    function closeModal() {
      modal.classList.remove('active');
      setTimeout(() => {
        elements.modalRoot.innerHTML = '';
        elements.modalRoot.style.display = 'none';
      }, 300);
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    saveBtn.addEventListener('click', async () => {
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const formData = new FormData(form);
      const appointmentData = {
        IDP: patient.IDP,
        NomPrenom: `${patient.Nom} ${patient.Prenom}`,
        CIN: patient.CIN,
        Email: patient.Email,
        ...Object.fromEntries(formData.entries())
      };

      try {
        await window.electronAPI.addAppointment(appointmentData);
        showToast('Rendez-vous créé avec succès', 'success');
        closeModal();
      } catch (err) {
        console.error('Error creating appointment:', err);
        showToast('Erreur lors de la création du rendez-vous', 'error');
      }
    });
  }

  function openPatientHistory(patient) {
    // Advanced patient history modal
    showToast('Fonctionnalité historique en développement', 'info');
  }

  /* ========= Advanced Export Functionality ========= */
  function exportToCSV() {
    const cols = ['IDP', 'Nom', 'Prenom', 'CIN', 'DateNaissance', 'Tel', 'Email', 'Ville', 'Adresse', 'Allergies', 'Remarques'];
    const headers = ['ID', 'Nom', 'Prénom', 'CIN', 'Date Naissance', 'Téléphone', 'Email', 'Ville', 'Adresse', 'Allergies', 'Remarques'];
    
    const rows = patients.map(p => 
      cols.map(c => `"${(p[c] || '').toString().replace(/"/g, '""')}"`).join(',')
    );
    
    const csv = [headers.join(','), ...rows].join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    downloadFile(`patients_export_${timestamp}.csv`, csv);
    showToast('Export CSV généré avec succès', 'success');
  }

  function exportToJSON() {
    const data = {
      exportDate: new Date().toISOString(),
      totalPatients: patients.length,
      patients: patients
    };
    
    const json = JSON.stringify(data, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    downloadFile(`patients_export_${timestamp}.json`, json, 'application/json');
    showToast('Export JSON généré avec succès', 'success');
  }

  /* ========= Event Listeners ========= */
  let searchTimer = null;
  elements.searchBox.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      page = 1;
      applyFilterAndSort();
    }, 300);
  });

  elements.clearSearch.addEventListener('click', () => {
    elements.searchBox.value = '';
    if (elements.filterCity) elements.filterCity.value = '';
    if (elements.filterCIN) elements.filterCIN.value = 'all';
    page = 1;
    applyFilterAndSort();
  });

  elements.newPatientBtn.addEventListener('click', () => openPatientModal(null, 'edit'));

  elements.exportCsvBtn.addEventListener('click', exportToCSV);

  // Add advanced filter listeners
  if (elements.filterCity) {
    elements.filterCity.addEventListener('change', () => {
      page = 1;
      applyFilterAndSort();
    });
  }

  if (elements.filterCIN) {
    elements.filterCIN.addEventListener('change', () => {
      page = 1;
      applyFilterAndSort();
    });
  }

  // Advanced sorting
  qsa('thead th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (!col) return;

      if (sortState.col === col) {
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.col = col;
        sortState.dir = 'asc';
      }

      // Update UI indicators
      qsa('thead th').forEach(t => {
        t.classList.remove('asc', 'desc');
        if (t.dataset.col === sortState.col) {
          t.classList.add(sortState.dir);
        }
      });

      applyFilterAndSort();
    });
  });

  /* ========= Keyboard Shortcuts ========= */
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'n':
          e.preventDefault();
          openPatientModal(null, 'edit');
          break;
        case 'f':
          e.preventDefault();
          elements.searchBox.focus();
          break;
        case 'e':
          e.preventDefault();
          exportToCSV();
          break;
      }
    }
  });

  /* ========= Auto-refresh with Smart Polling ========= */
  let pollTimer = null;
  function startPolling() {
    pollTimer = setInterval(async () => {
      // Only refresh if modal is not open and page is visible
      if (elements.modalRoot.style.display === 'none' && document.visibilityState === 'visible') {
        await fetchPatients();
      }
    }, 30000); // Every 30 seconds
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // Smart polling based on visibility
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      startPolling();
    }
  });

  /* ========= Initialization ========= */
  function init() {
    initTheme();
    fetchPatients();
    startPolling();
    
    // Add advanced filters to UI if they don't exist
    if (!elements.advancedFilters) {
      const toolbar = elements.searchBox.closest('.toolbar');
      if (toolbar) {
        const filtersHTML = `
          <div class="advanced-filters" id="advancedFilters" style="display: flex; gap: 10px; align-items: center;">
            <select class="form-control small" id="filterCity" style="width: 150px;">
              <option value="">Toutes les villes</option>
            </select>
            <select class="form-control small" id="filterCIN" style="width: 140px;">
              <option value="all">Tous CIN</option>
              <option value="with">Avec CIN</option>
              <option value="without">Sans CIN</option>
            </select>
          </div>
        `;
        toolbar.insertAdjacentHTML('beforeend', filtersHTML);
        
        // Update DOM references
        elements.filterCity = qs('#filterCity');
        elements.filterCIN = qs('#filterCIN');
        elements.advancedFilters = qs('#advancedFilters');
        
        // Add event listeners for new filters
        elements.filterCity.addEventListener('change', () => {
          page = 1;
          applyFilterAndSort();
        });
        
        elements.filterCIN.addEventListener('change', () => {
          page = 1;
          applyFilterAndSort();
        });
      }
    }
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', stopPolling);

  // Initialize the module
  init();
}