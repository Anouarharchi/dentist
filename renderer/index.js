// =========================
// 📦 Load the sidebar menu
// =========================
fetch('menu.html')
  .then(res => res.text())
  .then(html => {
    document.getElementById('sidebar-container').innerHTML = html;

    // Sidebar item click
    document.querySelectorAll('.menu li').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.menu li').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const page = item.dataset.page;
        loadPage(page);
      });
    });

    // Default page
    loadPage('dashboard.html');
  });

// =========================
// 🧭 Load content by page
// =========================
function loadPage(page) {
  fetch(page)
    .then(res => res.text())
    .then(html => {
      document.getElementById('main-content').innerHTML = html;
      if (page === 'dashboard.html') initDashboard();
      // Add other pages here later
    });
}

// =========================
// 🧠 Dashboard logic
// =========================
async function initDashboard() {
  let currentUser = await window.electronAPI.getCurrentUser();
  if (!currentUser) {
    alert('Utilisateur non connecté !');
    window.electronAPI.logout();
    return;
  }

  const addBtn = document.getElementById('add');
  const refreshBtn = document.getElementById('refresh');
  const logoutBtn = document.getElementById('logout');
  const addModal = document.getElementById('addModal');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  // =========================
  // 👥 Load personnels
  // =========================
  async function loadPersonnels() {
    const tbody = document.querySelector('#table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const personnels = await window.electronAPI.getPersonnels();
    if (!Array.isArray(personnels)) return;

    for (const [index, p] of personnels.entries()) {
      const tr = document.createElement('tr');
      const rowId = index + 1;

      tr.innerHTML = `
        <td>${rowId}</td>
        <td>${p.Nom}</td>
        <td>${p.Prenom}</td>
        <td>${p.Type}</td>
        <td>${p.Droit}</td>
        <td>${p.Login}</td>
        <td>${p.CIN}</td>
        <td class="photo-cell">Chargement...</td>
        <td>
          <button class="edit-btn" data-id="${p.ID}">Modifier</button>
          <button class="delete-btn" data-id="${p.ID}">Supprimer</button>
        </td>
      `;

      tbody.appendChild(tr);

      // Load photo asynchronously
      findPhotoPath(p).then(found => {
        const cell = tr.querySelector('.photo-cell');
        if (found)
          cell.innerHTML = `<img src="${found}" width="60" height="60" alt="Photo de ${p.Nom}">`;
        else
          cell.textContent = '—';
      });
    }

    // Rebind edit/delete after DOM update
    tbody.querySelectorAll('.edit-btn').forEach(btn =>
      btn.addEventListener('click', e => editPersonnel(parseInt(e.target.dataset.id)))
    );
    tbody.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', e => deletePersonnel(parseInt(e.target.dataset.id)))
    );
  }

  // =========================
  // 🧰 Modal helpers
  // =========================
  function closeModal() {
    addModal.style.display = 'none';
    resetModalFields();
  }

  function resetModalFields() {
    [
      'nom', 'prenom', 'tel', 'mail', 'adresse',
      'type', 'specialite', 'cin', 'login',
      'motPasse', 'droit', 'photo'
    ].forEach(f => {
      const el = document.getElementById(f);
      if (!el) return;
      if (el.tagName === 'SELECT') el.value = 'user';
      else el.value = '';
    });
    const photoPreview = document.getElementById('photoPreview');
    if (photoPreview) {
      photoPreview.src = '';
      photoPreview.style.display = 'none';
    }
  }

  // =========================
  // ➕ Add personnel
  // =========================
  async function addPersonnel() {
    const p = {
      Nom: document.getElementById('nom').value.trim(),
      Prenom: document.getElementById('prenom').value.trim(),
      Tel: document.getElementById('tel').value.trim(),
      Mail: document.getElementById('mail').value.trim(),
      Adresse: document.getElementById('adresse').value.trim(),
      Type: document.getElementById('type').value.trim() || 'Employé',
      Specialite: document.getElementById('specialite').value.trim(),
      CIN: document.getElementById('cin').value.trim(),
      Login: document.getElementById('login').value.trim(),
      MotPasse: document.getElementById('motPasse').value.trim(),
      Droit: document.getElementById('droit').value,
      DateEntree: new Date().toISOString().split('T')[0],
      Photo: ''
    };
    const photoFile = document.getElementById('photo').files[0];

    if (!p.Nom || !p.Prenom || !p.Login || !p.MotPasse)
      return alert("Nom, Prénom, Login et Mot de passe sont obligatoires !");

    try {
      if (photoFile)
        p.Photo = await window.electronAPI.savePhoto({ file: photoFile.path, CIN: p.CIN });

      await window.electronAPI.addPersonnel(p);
      await window.electronAPI.logOperation({
        Mat: currentUser.ID,
        Date_E: new Date().toISOString(),
        Action: `Ajout personnel ${p.Nom} ${p.Prenom}`
      });

      await loadPersonnels();
      closeModal();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'ajout.");
    }
  }

  // =========================
  // 🔍 Find existing photo
  // =========================
async function findPhotoPath(p) {
  const baseFromPhoto = p.Photo ? `../assets/${p.Photo}` : null;
  const exts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

  const loadTest = src =>
    new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(src + '?t=' + Date.now());
      img.onerror = () => rej();
      img.src = `${src}?t=${Date.now()}`;
    });

  if (baseFromPhoto) {
    try { return await loadTest(baseFromPhoto); } catch {}
  }

  for (const ext of exts) {
    const candidate = `../assets/${p.CIN}${ext}`;
    try { return await loadTest(candidate); } catch {}
  }

  return null;
}


  // =========================
  // ✏️ Edit personnel
  // =========================
  window.editPersonnel = async id => {
    try {
      const personnels = await window.electronAPI.getPersonnels();
      const p = personnels.find(x => x.ID === id);
      if (!p) return alert("Personnel introuvable.");

      const keyMap = {
        nom: 'Nom', prenom: 'Prenom', tel: 'Tel', mail: 'Mail',
        adresse: 'Adresse', type: 'Type', specialite: 'Specialite',
        cin: 'CIN', login: 'Login', motPasse: 'MotPasse', droit: 'Droit'
      };

      Object.keys(keyMap).forEach(f => {
        const el = document.getElementById(f);
        if (el) el.value = p[keyMap[f]] || '';
      });

      const photoPreview = document.getElementById('photoPreview');
      if (photoPreview) {
        photoPreview.style.display = 'none';
        photoPreview.src = '';
        const found = await findPhotoPath(p);
        if (found) {
          photoPreview.src = found;
          photoPreview.style.display = 'block';
        }
      }

      const photoInput = document.getElementById('photo');
      if (photoInput) {
        photoInput.value = '';
        photoInput.onchange = () => {
          const file = photoInput.files[0];
          if (file && photoPreview) {
            const url = URL.createObjectURL(file);
            photoPreview.src = url;
            photoPreview.style.display = 'block';
          }
        };
      }

      addModal.style.display = 'block';

      saveBtn.onclick = async () => {
        try {
          const photoFile = document.getElementById('photo').files[0];
          const updatedP = {
            ...p,
            Nom: document.getElementById('nom').value.trim(),
            Prenom: document.getElementById('prenom').value.trim(),
            Tel: document.getElementById('tel').value.trim(),
            Mail: document.getElementById('mail').value.trim(),
            Adresse: document.getElementById('adresse').value.trim(),
            Type: document.getElementById('type').value.trim() || 'Employé',
            Specialite: document.getElementById('specialite').value.trim(),
            CIN: document.getElementById('cin').value.trim(),
            Login: document.getElementById('login').value.trim(),
            MotPasse: document.getElementById('motPasse').value.trim(),
            Droit: document.getElementById('droit').value
          };

          if (photoFile) {
            if (p.Photo) {
              try { await window.electronAPI.deletePhoto(p.Photo); } catch {}
            }
            updatedP.Photo = await window.electronAPI.savePhoto({
              file: photoFile.path,
              CIN: updatedP.CIN
            });
          } else {
            updatedP.Photo = p.Photo;
          }

          await window.electronAPI.updatePersonnel(updatedP);
          await window.electronAPI.logOperation({
            Mat: currentUser.ID,
            Date_E: new Date().toISOString(),
            Action: `Modification personnel ID ${p.ID}`
          });

          await loadPersonnels();
          closeModal();
        } catch (err) {
          console.error('Erreur lors de la modification:', err);
          alert("Erreur lors de la modification.");
        }
      };
    } catch (err) {
      console.error('Erreur dans editPersonnel:', err);
      alert('Erreur interne, regarde الكونسول.');
    }
  };

  // =========================
  // 🗑️ Delete personnel
  // =========================
  window.deletePersonnel = async id => {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    try {
      // Get personnel first to remove photo if exists
      const personnels = await window.electronAPI.getPersonnels();
      const p = personnels.find(x => x.ID === id);

      if (p) {
        const exts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        for (const ext of exts) {
          const photoName = `${p.CIN}${ext}`;
          try { await window.electronAPI.deletePhoto(photoName); } catch {}
        }
      }

      await window.electronAPI.deletePersonnel(id);
      await window.electronAPI.logOperation({
        Mat: currentUser.ID,
        Date_E: new Date().toISOString(),
        Action: `Suppression personnel ID ${id}`
      });

      await loadPersonnels();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression.");
    }
  };

  // =========================
  // 🔗 Event bindings
  // =========================
  refreshBtn.addEventListener('click', loadPersonnels);
  logoutBtn.addEventListener('click', () => window.electronAPI.logout());
  addBtn.addEventListener('click', () => {
    resetModalFields();
    saveBtn.onclick = addPersonnel;
    addModal.style.display = 'block';
  });
  cancelBtn.addEventListener('click', closeModal);

  // Initial load
  await loadPersonnels();
}
