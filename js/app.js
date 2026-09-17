/**
 * ============================================================
 * BASIC — Router & Inisialisasi
 * ============================================================
 *
 * Navigasi memakai hash routing (#/katalog, #/produk/ID, ...).
 * Keuntungannya dibanding SPA versi 1 di dalam GAS:
 * - Tombol back/forward browser bekerja normal
 * - Link produk bisa dibagikan & dibuka langsung
 * - Tetap 1 halaman statis, cocok untuk GitHub Pages (tanpa server)
 */

const RUTE = {
  'katalog':         { page: 'page-katalog',         shell: 'buyer' },
  'produk':          { page: 'page-detail',          shell: 'buyer' },
  'keranjang':       { page: 'page-keranjang',       shell: 'buyer' },
  'checkout':        { page: 'page-checkout',        shell: 'buyer' },
  'konfirmasi':      { page: 'page-konfirmasi',      shell: 'buyer' },
  'status':          { page: 'page-status',          shell: 'buyer' },
  // Diagnostik sengaja berada di shell pembeli (tanpa login): halaman ini justru
  // dibutuhkan saat login admin tidak bisa dilakukan.
  'diagnostik':      { page: 'page-diagnostik',      shell: 'buyer' },
  'admin':           { page: 'page-admin',           shell: 'admin-login' },
  'admin/dashboard': { page: 'page-admin-dashboard', shell: 'admin' },
  'admin/produk':    { page: 'page-admin-produk',    shell: 'admin' },
  'admin/po':        { page: 'page-admin-po',        shell: 'admin' },
  'admin/pesanan':   { page: 'page-admin-pesanan',   shell: 'admin' },
  'admin/hero':      { page: 'page-admin-hero',      shell: 'admin' },
  'admin/pengaturan':{ page: 'page-admin-pengaturan',shell: 'admin' }
};

const JUDUL_ADMIN = {
  'admin/dashboard': 'Dashboard',
  'admin/produk': 'Kelola Produk',
  'admin/po': 'Kelola Pre-Order',
  'admin/pesanan': 'Kelola Pesanan',
  'admin/hero': 'Kelola Hero',
  'admin/pengaturan': 'Pengaturan Admin'
};

/** Pecah hash menjadi { rute, param }. Contoh: "#/produk/abc" → { rute:'produk', param:'abc' } */
function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const bagian = raw.split('/').filter(Boolean);

  if (!bagian.length) return { rute: 'katalog', param: '' };

  // Rute admin bertingkat dua: admin/dashboard, admin/produk, ...
  if (bagian[0] === 'admin' && bagian[1]) {
    const gabung = 'admin/' + bagian[1];
    if (RUTE[gabung]) return { rute: gabung, param: bagian[2] || '' };
    return { rute: 'admin', param: '' };
  }

  const rute = bagian[0];
  return RUTE[rute] ? { rute: rute, param: bagian[1] || '' } : { rute: 'katalog', param: '' };
}

function router() {
  let { rute, param } = parseHash();
  let cfg = RUTE[rute];

  // Penjaga: halaman admin (selain login) wajib punya sesi aktif
  if (cfg.shell === 'admin' && !AppState.adminToken) {
    rute = 'admin';
    cfg = RUTE[rute];
    location.replace('#/admin');
  }

  // Atur shell mana yang tampil
  const buyer = cfg.shell === 'buyer';
  document.getElementById('buyerShell').hidden = !buyer;
  document.getElementById('adminShell').hidden = buyer;
  document.getElementById('adminApp').hidden = cfg.shell !== 'admin';

  // Tampilkan hanya halaman yang aktif
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(cfg.page);
  if (target) target.classList.add('active');

  // Sorot menu admin yang aktif
  if (cfg.shell === 'admin') {
    document.querySelectorAll('.admin-nav a')
      .forEach(a => a.classList.toggle('active', a.dataset.page === rute));
    document.getElementById('adminPageTitle').textContent = JUDUL_ADMIN[rute] || '';
    closeAdminSidebar();
  }

  window.scrollTo(0, 0);

  // Muat data halaman
  switch (rute) {
    case 'katalog':    loadKatalog(); break;
    case 'produk':     renderDetailProduk(decodeURIComponent(param)); break;
    case 'keranjang':  renderKeranjang(); break;
    case 'checkout':   initCheckout(); break;
    case 'konfirmasi': renderKonfirmasi(AppState.lastOrder); break;
    case 'status':     renderStatusForm(param ? decodeURIComponent(param) : ''); break;
    case 'diagnostik': renderDiagnostik(); break;
    case 'admin':      document.getElementById('adminEmailInput').focus({ preventScroll: true }); break;
    case 'admin/dashboard':  loadAdminDashboard(); break;
    case 'admin/produk':     loadAdminProduk(); break;
    case 'admin/po':         loadAdminPO(); break;
    case 'admin/pesanan':    loadAdminPesanan(); break;
    case 'admin/hero':       loadAdminHero(); break;
    case 'admin/pengaturan': loadAdminPengaturan(); break;
  }
}

// ════════════════════════════════════════════════════════
// INISIALISASI
// ════════════════════════════════════════════════════════

window.addEventListener('hashchange', router);

/**
 * Isi AppState dari salinan katalog di browser SEBELUM router dijalankan.
 *
 * Ini penting untuk halaman yang dibuka langsung (tautan produk yang dibagikan,
 * atau keranjang yang di-bookmark): tanpa ini, halaman-halaman tersebut mulai
 * dengan data kosong dan harus menunggu server, padahal salinannya sudah ada.
 */
function hydrateDariCache() {
  const cache = KatalogCache.read();
  if (!cache) return;
  AppState.katalog = cache.katalog;
  AppState.config = cache.config || AppState.config;
  AppState.hero = cache.hero || [];
  AppState.katalogSegar = false; // tetap perlu disegarkan di latar belakang
}

document.addEventListener('DOMContentLoaded', () => {
  cart.updateBadge();
  hydrateDariCache();

  document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);

  // Tutup modal saat klik latar gelap atau tekan Esc
  // Klik latar & Escape TIDAK lagi langsung menutup — keduanya lewat penjaga
  // yang meminta konfirmasi kalau ada isian yang belum disimpan.
  document.getElementById('genericModal').addEventListener('click', e => {
    if (e.target.id === 'genericModal') tryCloseModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('confirmExitModal').hidden) { batalKeluarModal(); return; }
    if (!document.getElementById('genericModal').hidden) tryCloseModal();
  });

  // Peringatan bila GAS_URL belum diisi (kesalahan paling umum saat deploy)
  if (!apiSiap()) {
    showToast('URL backend belum diisi di js/config.js — data tidak akan muncul.', 'danger');
  }

  if (!location.hash) location.replace('#/katalog');
  router();

  // Lepas layar loading SEKARANG, jangan menunggu jawaban server.
  // Kerangka halaman (header, hero, menu) sudah siap dan bisa dibaca;
  // bagian katalog mengisi dirinya sendiri lewat kerangka/cache.
  hideLoadingOverlay();
});
