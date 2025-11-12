// =========================
// 📦 Load the sidebar menu
// =========================
fetch('menu.html')
  .then(res => res.text())
  .then(html => {
    document.getElementById('sidebar-container').innerHTML = html;

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

      // Initialize the JS logic for each page
      switch(page) {
        case 'dashboard.html':
          import('./dashboard.js').then(module => module.initDashboard());
          break;
        // Add other pages later:
        // case 'patients.html': import('./patients.js').then(m => m.initPatients());
      }
    });
}
