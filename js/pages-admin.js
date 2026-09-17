/**
 * ============================================================
 * BASIC — Panel Admin
 * Login · Dashboard · Produk & Stok · Pre-Order · Pesanan
 * ============================================================
 */

// ════════════════════════════════════════════════════════
// LOGIN & SESI
// ════════════════════════════════════════════════════════

function toggleAdminSidebar() { document.getElementById('adminSidebar').classList.toggle('show'); }
function closeAdminSidebar() { document.getElementById('adminSidebar').classList.remove('show'); }

async function handleAdminLogin(e) {
  if (e) e.preventDefault();

  const email = document.getElementById('adminEmailInput').value.trim();
  const pin = document.getElementById('adminPinInput').value.trim();
  const msg = document.getElementById('adminLoginMsg');
  msg.hidden = true;

  if (!email || !pin) {
    msg.textContent = 'Isi email dan PIN admin.';
    msg.hidden = false;
    return;
  }

  const pulihkan = busyButton(document.getElementById('btnAdminLogin'), 'Memeriksa akses...');
  const res = await Api.adminLogin(email, pin);
  pulihkan();

  if (!res.success) {
    msg.textContent = res.message;
    msg.hidden = false;
    return;
  }

  AppState.adminToken = res.data.token;
  AppState.adminInfo = res.data;
  document.getElementById('adminNamaLabel').textContent = res.data.nama || res.data.email;
  document.getElementById('adminPinInput').value = '';

  showToast(`Selamat datang, ${res.data.nama || res.data.email}!`, 'success');
  location.hash = '#/admin/dashboard';
}

async function handleAdminLogout() {
  const token = AppState.adminToken;
  AppState.adminToken = null;
  AppState.adminInfo = null;
  if (token) Api.adminLogout(token); // tidak perlu ditunggu
  showToast('Berhasil keluar dari dashboard admin.', 'info');
  location.hash = '#/katalog';
}

/**
 * Tangani respons admin yang gagal karena sesi habis.
 * Mengembalikan true bila sesi bermasalah (pemanggil harus berhenti).
 */
function sesiBermasalah(res) {
  if (res.success) return false;
  if (/sesi admin/i.test(res.message || '')) {
    AppState.adminToken = null;
    AppState.adminInfo = null;
    showToast('Sesi admin berakhir. Silakan login kembali.', 'warning');
    location.hash = '#/admin';
    return true;
  }
  return false;
}

// ════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════

/**
 * Muat Chart.js hanya ketika dashboard admin benar-benar dibuka.
 * Pembeli tidak pernah menyentuh halaman ini, jadi mereka tidak perlu
 * menunggu unduhan pustaka grafiknya.
 */
let _chartJsPromise = null;

function loadChartJs() {
  if (typeof Chart !== 'undefined') return Promise.resolve();
  if (_chartJsPromise) return _chartJsPromise;

  _chartJsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => {
      _chartJsPromise = null; // biar bisa dicoba lagi nanti
      reject(new Error('Pustaka grafik gagal dimuat.'));
    };
    document.head.appendChild(s);
  });
  return _chartJsPromise;
}

async function loadAdminDashboard() {
  const c = document.getElementById('adminDashboardContainer');
  c.innerHTML = skeletonBlock(140);

  const res = await Api.dashboard(AppState.adminToken);
  if (sesiBermasalah(res)) return;
  if (!res.success) { c.innerHTML = `<div class="empty-state">${escapeHtml(res.message)}</div>`; return; }

  const d = res.data;
  c.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="v">${formatRupiah(d.totalPenjualan)}</div><div class="l">Total Penjualan</div></div>
      <div class="kpi-card"><div class="v">${d.totalPesanan}</div><div class="l">Total Pesanan</div></div>
      <div class="kpi-card"><div class="v">${d.pesananBaru}</div><div class="l">Pesanan Baru</div></div>
      <div class="kpi-card"><div class="v">${d.menungguVerifikasi}</div><div class="l">Menunggu Verifikasi</div></div>
      <div class="kpi-card"><div class="v">${d.sudahBayar}</div><div class="l">Sudah Bayar</div></div>
    </div>
    <div class="dash-grid">
      <div class="card">
        <div class="card-strip">Penjualan 14 Hari Terakhir</div>
        <div class="card-body"><canvas id="chartSales" height="150"></canvas></div>
      </div>
      <div class="stack gap-md">
        <div class="card">
          <div class="card-strip">Produk Terlaris</div>
          <div class="card-body"><canvas id="chartTop" height="170"></canvas></div>
        </div>
        <div class="insight-panel">
          <span class="label-lg" style="color:var(--c-primary);">// Insight</span>
          <ul>${d.insights.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
        </div>
      </div>
    </div>`;

  // Angka KPI & insight sudah tampil di atas. Grafik menyusul begitu pustaka
  // Chart.js selesai diunduh — admin tidak menunggu layar kosong.
  try {
    await loadChartJs();
    renderSalesChart(d.salesByDay);
    renderTopProductChart(d.produkTerlaris);
  } catch (e) {
    document.querySelectorAll('#chartSales, #chartTop').forEach(el => {
      el.outerHTML = `<p class="text-muted small text-center">Grafik tidak bisa dimuat (butuh koneksi internet).</p>`;
    });
  }
}

function renderSalesChart(salesByDay) {
  const ctx = document.getElementById('chartSales');
  if (!ctx || typeof Chart === 'undefined') return;
  if (AppState.charts.sales) AppState.charts.sales.destroy();

  AppState.charts.sales = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(salesByDay),
      datasets: [{
        label: 'Penjualan',
        data: Object.values(salesByDay),
        borderColor: '#E4002B',
        backgroundColor: 'rgba(228,0,43,0.15)',
        fill: true, tension: 0.15, pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => formatRupiah(c.parsed.y) } }
      },
      scales: {
        x: { ticks: { color: '#71717A', font: { family: 'Space Mono', size: 9 } }, grid: { color: '#27272A' } },
        y: { ticks: { color: '#71717A', font: { family: 'Space Mono', size: 9 } }, grid: { color: '#27272A' } }
      }
    }
  });
}

function renderTopProductChart(produkTerlaris) {
  const ctx = document.getElementById('chartTop');
  if (!ctx || typeof Chart === 'undefined') return;
  if (AppState.charts.top) AppState.charts.top.destroy();

  AppState.charts.top = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: produkTerlaris.map(p => p.nama),
      datasets: [{ label: 'Terjual', data: produkTerlaris.map(p => p.jumlah), backgroundColor: '#E4002B' }]
    },
    options: {
      indexAxis: 'y', responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#71717A', font: { family: 'Space Mono', size: 9 } }, grid: { color: '#27272A' } },
        y: { ticks: { color: '#D4D4D8', font: { family: 'Space Mono', size: 9 } }, grid: { display: false } }
      }
    }
  });
}

// ════════════════════════════════════════════════════════
// KELOLA PRODUK & STOK
// ════════════════════════════════════════════════════════

let AdminProdukCache = [];

async function loadAdminProduk() {
  const c = document.getElementById('adminProdukContainer');
  c.innerHTML = skeletonBlock(200);

  const res = await Api.produkList(AppState.adminToken);
  if (sesiBermasalah(res)) return;
  if (!res.success) { c.innerHTML = `<div class="empty-state">${escapeHtml(res.message)}</div>`; return; }

  AdminProdukCache = res.data;
  drawAdminProdukTable();
}

function drawAdminProdukTable() {
  const rows = AdminProdukCache.map(p => `
    <tr>
      <td>${escapeHtml(p.NamaProduk)}</td>
      <td>${escapeHtml(p.Kategori || '-')}</td>
      <td>${formatRupiah(p.Harga)}</td>
      <td><span class="badge ${p.TipeJual === 'PO' ? 'badge-po' : 'badge-live'}">${escapeHtml(p.TipeJual)}</span></td>
      <td>${p.totalStok}</td>
      <td><span class="badge ${p.Status === 'Tersedia' ? 'badge-success' : p.Status === 'Habis' ? 'badge-warning' : 'badge-habis'}">${escapeHtml(p.Status)}</span></td>
      <td><div class="row-actions">
        <button class="btn btn-sm btn-secondary" onclick="openProdukModal('${escapeJs(p.ProdukID)}')">Edit</button>
        <button class="btn btn-sm btn-secondary" onclick="openStokModal('${escapeJs(p.ProdukID)}')">Stok</button>
        <button class="btn btn-sm btn-danger" onclick="konfirmasiToggleProduk('${escapeJs(p.ProdukID)}','${p.Status === 'Tidak Aktif' ? 'Tersedia' : 'Tidak Aktif'}')">
          ${p.Status === 'Tidak Aktif' ? 'Aktifkan' : 'Nonaktifkan'}
        </button>
      </div></td>
    </tr>`).join('');

  document.getElementById('adminProdukContainer').innerHTML = `
    <div class="flex-between mb-2">
      <h3 style="font-size:1.1rem;">Kelola Produk</h3>
      <button class="btn btn-primary btn-sm" onclick="openProdukModal('')">+ Produk Baru</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Nama</th><th>Kategori</th><th>Harga</th><th>Tipe</th><th>Stok</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7" class="text-center text-muted">Belum ada produk.</td></tr>'}</tbody>
    </table></div>`;
}

function konfirmasiToggleProduk(produkId, statusBaru) {
  openModal('Konfirmasi',
    `<p>Ubah status produk menjadi <strong>${escapeHtml(statusBaru)}</strong>?</p>
     ${statusBaru === 'Tidak Aktif' ? '<p class="text-muted small mt-1">Produk yang dinonaktifkan tidak lagi tampil di katalog pembeli.</p>' : ''}`,
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button>
     <button class="btn btn-primary" onclick="doToggleProduk('${escapeJs(produkId)}','${escapeJs(statusBaru)}')">Konfirmasi</button>`);
}

async function doToggleProduk(produkId, statusBaru) {
  const res = await Api.toggleProduk(AppState.adminToken, produkId, statusBaru);
  closeModal();
  if (sesiBermasalah(res)) return;
  showToast(res.message, res.success ? 'success' : 'danger');
  if (res.success) loadAdminProduk();
}

// ── Modal tambah/edit produk ──

let ProdukFotoBaru = [];
let ProdukFotoExisting = [];

function openProdukModal(produkId) {
  const p = produkId ? AdminProdukCache.find(x => x.ProdukID === produkId) : null;
  ProdukFotoBaru = [];
  ProdukFotoExisting = p ? (p.fotoIds || []).slice() : [];

  const fotoPreview = p && p.fotoUrls && p.fotoUrls.length
    ? p.fotoUrls.map((u, i) => `<img src="${escapeHtml(u)}" alt="Foto ${i + 1}">`).join('')
    : '';

  openModal(p ? 'Edit Produk' : 'Produk Baru', `
    <div class="form-field"><label for="fNama">Nama Produk <span class="req">*</span></label>
      <input type="text" id="fNama" value="${escapeHtml(p ? p.NamaProduk : '')}"></div>
    <div class="form-field"><label for="fDeskripsi">Deskripsi</label>
      <textarea id="fDeskripsi">${escapeHtml(p ? p.Deskripsi : '')}</textarea></div>
    <div class="form-field"><label for="fKategori">Kategori</label>
      <input type="text" id="fKategori" value="${escapeHtml(p ? p.Kategori : '')}" placeholder="Kaos, Hoodie, Totebag..."></div>
    <div class="form-field"><label for="fHarga">Harga (Rp) <span class="req">*</span></label>
      <input type="number" id="fHarga" value="${p ? p.Harga : ''}" min="0"></div>
    <div class="form-field"><label for="fTipeJual">Tipe Jual</label>
      <select id="fTipeJual">
        <option value="Reguler" ${p && p.TipeJual === 'Reguler' ? 'selected' : ''}>Reguler</option>
        <option value="PO" ${p && p.TipeJual === 'PO' ? 'selected' : ''}>Pre-Order</option>
      </select></div>
    <div class="form-field"><label for="fStatus">Status</label>
      <select id="fStatus">
        <option ${p && p.Status === 'Tersedia' ? 'selected' : ''}>Tersedia</option>
        <option ${p && p.Status === 'Habis' ? 'selected' : ''}>Habis</option>
        <option ${p && p.Status === 'Tidak Aktif' ? 'selected' : ''}>Tidak Aktif</option>
      </select></div>
    <div class="form-field"><label for="fFoto">Tambah Foto Produk (bisa pilih beberapa)</label>
      <input type="file" id="fFoto" accept="image/*" multiple onchange="pilihFotoProduk(this)">
      <span class="form-hint">Gambar otomatis dikompres agar unggahan cepat. Foto lama tetap dipertahankan.</span></div>
    <div class="foto-strip" id="fotoPreviewRow">${fotoPreview}</div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Batal</button>
    <button class="btn btn-primary" id="btnSaveProduk" onclick="saveProdukForm('${escapeJs(produkId || '')}')">Simpan</button>
  `);
}

async function pilihFotoProduk(input) {
  const files = Array.from(input.files || []);
  const row = document.getElementById('fotoPreviewRow');

  for (const file of files) {
    if (!cekUkuranFile(file)) continue;
    try {
      const hasil = await compressImage(file);
      ProdukFotoBaru.push({ data: hasil.base64, name: hasil.name, mime: hasil.mime });
      const img = document.createElement('img');
      img.src = hasil.dataUrl;
      img.alt = 'Foto baru';
      row.appendChild(img);
    } catch (e) {
      showToast(e.message, 'danger');
    }
  }
  input.value = '';
}

async function saveProdukForm(produkId) {
  const nama = document.getElementById('fNama').value.trim();
  const harga = Number(document.getElementById('fHarga').value);
  if (!nama || !harga) { showToast('Nama dan harga wajib diisi.', 'warning'); return; }

  const pulihkan = busyButton(document.getElementById('btnSaveProduk'), 'Menyimpan...');

  const res = await Api.saveProduk(AppState.adminToken, {
    ProdukID: produkId || '',
    NamaProduk: nama,
    Deskripsi: document.getElementById('fDeskripsi').value.trim(),
    Kategori: document.getElementById('fKategori').value.trim(),
    Harga: harga,
    TipeJual: document.getElementById('fTipeJual').value,
    Status: document.getElementById('fStatus').value,
    fotoExisting: ProdukFotoExisting,
    fotoBaru: ProdukFotoBaru
  });

  pulihkan();
  if (sesiBermasalah(res)) return;
  if (!res.success) { showToast(res.message, 'danger'); return; }

  closeModal();
  showToast('Produk berhasil disimpan.', 'success');
  loadAdminProduk();
}

// ── Modal stok / varian ──

async function openStokModal(produkId) {
  const ref = AdminProdukCache.find(p => p.ProdukID === produkId);
  openModal(`Stok — ${ref ? ref.NamaProduk : ''}`, skeletonBlock(120), `
    <button class="btn btn-secondary" onclick="closeModal()">Tutup</button>
    <button class="btn btn-primary" onclick="openTambahVarianForm('${escapeJs(produkId)}')">+ Varian</button>`);

  const res = await Api.varianList(AppState.adminToken, produkId);
  if (sesiBermasalah(res)) return;
  if (!res.success) { setModalBody(`<div class="empty-state">${escapeHtml(res.message)}</div>`); return; }

  const rows = res.data.map(v => `
    <tr>
      <td>${escapeHtml(v.Ukuran)}</td>
      <td>${escapeHtml(v.Warna)}</td>
      <td><div class="qty-control" style="width:118px;">
        <button onclick="adjustStokInline('${escapeJs(v.VarianID)}', -1, '${escapeJs(produkId)}')">−</button>
        <input type="text" value="${v.Stok}" readonly>
        <button onclick="adjustStokInline('${escapeJs(v.VarianID)}', 1, '${escapeJs(produkId)}')">+</button>
      </div></td>
      <td><button class="btn btn-sm btn-danger" onclick="hapusVarian('${escapeJs(v.VarianID)}','${escapeJs(produkId)}')">Hapus</button></td>
    </tr>`).join('');

  setModalBody(`<div class="table-wrap"><table style="min-width:420px;">
    <thead><tr><th>Ukuran</th><th>Warna</th><th>Stok</th><th></th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" class="text-center text-muted">Belum ada varian.</td></tr>'}</tbody>
  </table></div>`);
}

async function adjustStokInline(varianId, delta, produkId) {
  const res = await Api.adjustStok(AppState.adminToken, varianId, delta);
  if (sesiBermasalah(res)) return;
  if (!res.success) { showToast(res.message, 'danger'); return; }
  openStokModal(produkId);
  loadAdminProduk();
}

async function hapusVarian(varianId, produkId) {
  const res = await Api.deleteVarian(AppState.adminToken, varianId);
  if (sesiBermasalah(res)) return;
  showToast(res.message, res.success ? 'success' : 'danger');
  if (res.success) { openStokModal(produkId); loadAdminProduk(); }
}

function openTambahVarianForm(produkId) {
  openModal('Tambah Varian', `
    <div class="form-field"><label for="vUkuran">Ukuran <span class="req">*</span></label>
      <input type="text" id="vUkuran" placeholder="S / M / L / XL"></div>
    <div class="form-field"><label for="vWarna">Warna</label>
      <input type="text" id="vWarna" placeholder="Hitam / Putih"></div>
    <div class="form-field"><label for="vStok">Stok Awal</label>
      <input type="number" id="vStok" value="0" min="0"></div>
  `, `
    <button class="btn btn-secondary" onclick="openStokModal('${escapeJs(produkId)}')">Batal</button>
    <button class="btn btn-primary" id="btnSaveVarian" onclick="saveTambahVarian('${escapeJs(produkId)}')">Simpan</button>
  `);
}

async function saveTambahVarian(produkId) {
  const ukuran = document.getElementById('vUkuran').value.trim();
  if (!ukuran) { showToast('Ukuran wajib diisi.', 'warning'); return; }

  const pulihkan = busyButton(document.getElementById('btnSaveVarian'), 'Menyimpan...');
  const res = await Api.saveVarian(AppState.adminToken, {
    ProdukID: produkId,
    Ukuran: ukuran,
    Warna: document.getElementById('vWarna').value.trim() || '-',
    Stok: Number(document.getElementById('vStok').value) || 0
  });
  pulihkan();

  if (sesiBermasalah(res)) return;
  showToast(res.message, res.success ? 'success' : 'danger');
  if (res.success) { openStokModal(produkId); loadAdminProduk(); }
}

// ════════════════════════════════════════════════════════
// KELOLA PRE-ORDER
// ════════════════════════════════════════════════════════

let AdminPOCache = [];

async function loadAdminPO() {
  const c = document.getElementById('adminPOContainer');
  c.innerHTML = skeletonBlock(200);

  const [resPO, resProduk] = await Promise.all([
    Api.poList(AppState.adminToken),
    Api.produkList(AppState.adminToken)
  ]);

  if (sesiBermasalah(resPO)) return;
  if (!resPO.success) { c.innerHTML = `<div class="empty-state">${escapeHtml(resPO.message)}</div>`; return; }
  if (resProduk.success) AdminProdukCache = resProduk.data;

  AdminPOCache = resPO.data;
  drawAdminPOTable();
}

function drawAdminPOTable() {
  const rows = AdminPOCache.map(po => {
    const pct = po.KuotaPO > 0 ? Math.round((po.JumlahMasuk / po.KuotaPO) * 100) : 0;
    return `<tr>
      <td>${escapeHtml(po.NamaProduk)}</td>
      <td>${formatRupiah(po.HargaPO)}</td>
      <td>${po.JumlahMasuk}/${po.KuotaPO} <span class="text-muted">(${pct}%)</span></td>
      <td>${formatTanggal(po.TanggalTutup)}</td>
      <td><span class="badge ${po.StatusPO === 'Dibuka' ? 'badge-success' : 'badge-habis'}">${escapeHtml(po.StatusPO)}</span></td>
      <td><div class="row-actions">
        <button class="btn btn-sm btn-secondary" onclick="openPOModal('${escapeJs(po.POID)}')">Edit</button>
        ${po.StatusPO === 'Dibuka'
          ? `<button class="btn btn-sm btn-danger" onclick="konfirmasiTutupPO('${escapeJs(po.POID)}')">Tutup</button>` : ''}
      </div></td>
    </tr>`;
  }).join('');

  document.getElementById('adminPOContainer').innerHTML = `
    <div class="flex-between mb-2">
      <h3 style="font-size:1.1rem;">Kelola Pre-Order</h3>
      <button class="btn btn-primary btn-sm" onclick="openPOModal('')">+ Pre-Order Baru</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Produk</th><th>Harga PO</th><th>Kuota Masuk</th><th>Tutup</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="text-center text-muted">Belum ada Pre-Order.</td></tr>'}</tbody>
    </table></div>`;
}

function konfirmasiTutupPO(poId) {
  openModal('Tutup Pre-Order',
    '<p>Tutup Pre-Order ini secara manual? Pembeli tidak bisa lagi memesan produk tersebut.</p>',
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button>
     <button class="btn btn-danger" onclick="doTutupPO('${escapeJs(poId)}')">Tutup PO</button>`);
}

async function doTutupPO(poId) {
  const res = await Api.closePO(AppState.adminToken, poId);
  closeModal();
  if (sesiBermasalah(res)) return;
  showToast(res.message, res.success ? 'success' : 'danger');
  if (res.success) loadAdminPO();
}

function openPOModal(poId) {
  const po = poId ? AdminPOCache.find(x => x.POID === poId) : null;
  const tgl = d => {
    if (!d) return '';
    const dt = new Date(d);
    return isNaN(dt) ? '' : dt.toISOString().slice(0, 10);
  };

  const opsiProduk = AdminProdukCache.map(p =>
    `<option value="${escapeHtml(p.ProdukID)}" ${po && po.ProdukID === p.ProdukID ? 'selected' : ''}>${escapeHtml(p.NamaProduk)}</option>`
  ).join('');

  openModal(po ? 'Edit Pre-Order' : 'Pre-Order Baru', `
    <div class="form-field"><label for="poProduk">Produk <span class="req">*</span></label>
      <select id="poProduk">${opsiProduk || '<option value="">(belum ada produk)</option>'}</select>
      <span class="form-hint">Produk yang dipilih otomatis diubah menjadi tipe Pre-Order.</span></div>
    <div class="form-field"><label for="poHarga">Harga PO (Rp) <span class="req">*</span></label>
      <input type="number" id="poHarga" value="${po ? po.HargaPO : ''}" min="0"></div>
    <div class="form-field"><label for="poKuota">Kuota PO <span class="req">*</span></label>
      <input type="number" id="poKuota" value="${po ? po.KuotaPO : ''}" min="1"></div>
    <div class="form-field"><label for="poMulai">Tanggal Mulai</label>
      <input type="date" id="poMulai" value="${tgl(po ? po.TanggalMulai : new Date())}"></div>
    <div class="form-field"><label for="poTutup">Tanggal Tutup</label>
      <input type="date" id="poTutup" value="${tgl(po ? po.TanggalTutup : '')}"></div>
    <div class="form-field"><label for="poStatus">Status</label>
      <select id="poStatus">
        ${['Dibuka', 'Ditutup', 'Produksi', 'Selesai'].map(s =>
          `<option ${po && po.StatusPO === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Batal</button>
    <button class="btn btn-primary" id="btnSavePO" onclick="savePOForm('${escapeJs(poId || '')}')">Simpan</button>
  `);
}

async function savePOForm(poId) {
  const produkId = document.getElementById('poProduk').value;
  const harga = Number(document.getElementById('poHarga').value);
  const kuota = Number(document.getElementById('poKuota').value);
  if (!produkId || !harga || !kuota) { showToast('Lengkapi produk, harga, dan kuota PO.', 'warning'); return; }

  const pulihkan = busyButton(document.getElementById('btnSavePO'), 'Menyimpan...');
  const res = await Api.savePO(AppState.adminToken, {
    POID: poId || '',
    ProdukID: produkId,
    HargaPO: harga,
    KuotaPO: kuota,
    TanggalMulai: document.getElementById('poMulai').value,
    TanggalTutup: document.getElementById('poTutup').value,
    StatusPO: document.getElementById('poStatus').value
  });
  pulihkan();

  if (sesiBermasalah(res)) return;
  showToast(res.message, res.success ? 'success' : 'danger');
  if (res.success) { closeModal(); loadAdminPO(); }
}

// ════════════════════════════════════════════════════════
// KELOLA PESANAN & VERIFIKASI
// ════════════════════════════════════════════════════════

let FilterPesananAktif = 'Semua';

async function loadAdminPesanan(filter) {
  FilterPesananAktif = filter || 'Semua';
  const c = document.getElementById('adminPesananContainer');
  c.innerHTML = skeletonBlock(200);

  const res = await Api.pesananList(AppState.adminToken, FilterPesananAktif);
  if (sesiBermasalah(res)) return;
  if (!res.success) { c.innerHTML = `<div class="empty-state">${escapeHtml(res.message)}</div>`; return; }

  const filters = ['Semua', 'Baru', 'Diproses', 'Dikirim', 'Selesai', 'Menunggu Verifikasi', 'Terverifikasi'];
  const rows = res.data.map(p => `
    <tr>
      <td class="mono">${escapeHtml(p.nomorPesanan)}</td>
      <td>${formatTanggal(p.tanggal)}</td>
      <td>${escapeHtml(p.namaPembeli)}</td>
      <td>${formatRupiah(p.totalBayar)}</td>
      <td><span class="badge ${p.statusPembayaran === 'Terverifikasi' ? 'badge-success' : p.statusPembayaran === 'Menunggu Verifikasi' ? 'badge-warning' : 'badge-error'}">${escapeHtml(p.statusPembayaran)}</span></td>
      <td><span class="badge">${escapeHtml(p.statusPesanan)}</span></td>
      <td><button class="btn btn-sm btn-secondary" onclick="openPesananDetail('${escapeJs(p.nomorPesanan)}')">Detail</button></td>
    </tr>`).join('');

  c.innerHTML = `
    <h3 class="mb-2" style="font-size:1.1rem;">Kelola Pesanan</h3>
    <div class="filter-bar" style="position:static;">
      ${filters.map(f => `<button class="filter-chip ${f === FilterPesananAktif ? 'active' : ''}"
         onclick="loadAdminPesanan('${escapeJs(f)}')">${f}</button>`).join('')}
    </div>
    <div class="table-wrap mt-2"><table>
      <thead><tr><th>No. Pesanan</th><th>Tanggal</th><th>Pembeli</th><th>Total</th><th>Bayar</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7" class="text-center text-muted">Tidak ada pesanan.</td></tr>'}</tbody>
    </table></div>`;
}

async function openPesananDetail(nomorPesanan) {
  openModal(`Pesanan ${nomorPesanan}`, skeletonBlock(200), '');

  const res = await Api.pesananDetail(AppState.adminToken, nomorPesanan);
  if (sesiBermasalah(res)) return;
  if (!res.success) { setModalBody(`<div class="empty-state">${escapeHtml(res.message)}</div>`); return; }

  const o = res.data;
  const itemsHtml = o.items.map(it => `<div class="cart-summary-row">
    <span>${escapeHtml(it.NamaProduk)} (${escapeHtml(it.Ukuran)}/${escapeHtml(it.Warna)}) x${it.Jumlah}</span>
    <span>${formatRupiah(it.Subtotal)}</span></div>`).join('');

  const buktiHtml = o.buktiUrl
    ? `<img src="${escapeHtml(o.buktiUrl)}" class="preview-thumb" style="max-width:100%;" alt="Bukti pembayaran">`
    : '<p class="text-muted small">Belum ada bukti pembayaran diunggah.</p>';

  const waLink = o.WhatsApp
    ? `https://wa.me/${String(o.WhatsApp).replace(/[^0-9]/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(
        `Halo ${o.NamaPembeli}, pesanan Anda ${o.NomorPesanan} di BASIC:`)}`
    : '';

  setModalBody(`
    <div class="summary-box mb-2">
      <div class="card-strip"><span>Pembeli</span><span>${formatTanggal(o.Tanggal)}</span></div>
      <div class="card-body small">
        <strong>${escapeHtml(o.NamaPembeli)}</strong><br>
        ${escapeHtml(o.WhatsApp)} ${o.Email ? '· ' + escapeHtml(o.Email) : ''}<br>
        <span class="text-muted">${escapeHtml(o.Alamat)}</span><br>
        <span class="text-muted">Metode: ${escapeHtml(o.MetodeBayar || '-')}</span>
        ${waLink ? `<div class="mt-2"><a class="btn btn-sm btn-secondary" href="${escapeHtml(waLink)}" target="_blank" rel="noopener">Hubungi via WhatsApp</a></div>` : ''}
      </div>
    </div>
    <div class="summary-box mb-2">
      <div class="card-strip">Item</div>
      <div class="card-body">
        ${itemsHtml}
        <div class="cart-summary-row"><span>Ongkos Kirim</span><span>${formatRupiah(o.Ongkir)}</span></div>
        <div class="cart-summary-row total"><span>Total Bayar</span><span>${formatRupiah(o.TotalBayar)}</span></div>
      </div>
    </div>
    <div class="section-head" style="padding-top:0;"><h2 style="font-size:0.9rem;">Bukti Pembayaran</h2></div>
    ${buktiHtml}`);

  setModalFoot(`
    ${o.StatusPembayaran === 'Menunggu Verifikasi' ? `
      <button class="btn btn-secondary btn-sm" onclick="verifikasiPembayaran('${escapeJs(o.NomorPesanan)}', false)">Tolak</button>
      <button class="btn btn-primary btn-sm" onclick="verifikasiPembayaran('${escapeJs(o.NomorPesanan)}', true)">Verifikasi Bayar</button>` : ''}
    <select id="statusPesananSelect" style="width:auto;min-width:130px;">
      ${['Baru', 'Diproses', 'Dikirim', 'Selesai', 'Dibatalkan'].map(s =>
        `<option ${o.StatusPesanan === s ? 'selected' : ''}>${s}</option>`).join('')}
    </select>
    <button class="btn btn-primary btn-sm" onclick="updateStatusPesanan('${escapeJs(o.NomorPesanan)}')">Update Status</button>`);
}

async function verifikasiPembayaran(nomorPesanan, disetujui) {
  const res = await Api.verifikasi(AppState.adminToken, nomorPesanan, disetujui);
  closeModal();
  if (sesiBermasalah(res)) return;
  showToast(res.message, res.success ? 'success' : 'danger');
  loadAdminPesanan(FilterPesananAktif);
}

async function updateStatusPesanan(nomorPesanan) {
  const statusBaru = document.getElementById('statusPesananSelect').value;
  const res = await Api.updateStatus(AppState.adminToken, nomorPesanan, statusBaru);
  closeModal();
  if (sesiBermasalah(res)) return;
  showToast(res.message, res.success ? 'success' : 'danger');
  loadAdminPesanan(FilterPesananAktif);
}

// ════════════════════════════════════════════════════════
// PENGATURAN ADMIN — EMAIL YANG BERWENANG LOGIN
// ════════════════════════════════════════════════════════
//
// Daftar ini hidup di sheet Admin dan divalidasi di server saat login.
// Tampilan di sini hanya jendela ke data itu — menonaktifkan email di layar
// tidak berarti apa-apa sampai server menyimpannya.

async function loadAdminPengaturan() {
  const c = document.getElementById('adminPengaturanContainer');
  c.innerHTML = skeletonBlock(200);

  const res = await Api.emailList(AppState.adminToken);
  if (sesiBermasalah(res)) return;
  if (!res.success) { c.innerHTML = `<div class="empty-state">${escapeHtml(res.message)}</div>`; return; }

  const rows = res.data.map(a => `
    <tr>
      <td class="mono">${escapeHtml(a.email)}${a.iniSaya ? ' <span class="badge">ANDA</span>' : ''}</td>
      <td>${escapeHtml(a.nama || '-')}</td>
      <td><span class="badge ${a.aktif ? 'badge-success' : 'badge-habis'}">${escapeHtml(a.status)}</span></td>
      <td><div class="row-actions">
        <button class="btn btn-sm btn-secondary" onclick="openEmailModal('${escapeJs(a.email)}','${escapeJs(a.nama || '')}','${escapeJs(a.status)}')">Edit</button>
        <button class="btn btn-sm btn-secondary" ${a.iniSaya ? 'disabled title="Tidak bisa mengubah akun sendiri"' : ''}
          onclick="ubahStatusEmail('${escapeJs(a.email)}','${a.aktif ? 'Nonaktif' : 'Aktif'}')">
          ${a.aktif ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
        <button class="btn btn-sm btn-danger" ${a.iniSaya ? 'disabled title="Tidak bisa menghapus akun sendiri"' : ''}
          onclick="konfirmasiHapusEmail('${escapeJs(a.email)}')">Hapus</button>
      </div></td>
    </tr>`).join('');

  c.innerHTML = `
    <div class="flex-between mb-2">
      <h3 style="font-size:1.1rem;">Pengaturan Admin — Email Berwenang</h3>
      <button class="btn btn-primary btn-sm" onclick="openEmailModal('','','Aktif')">+ Tambah Email</button>
    </div>
    <p class="text-muted small mb-2">
      Hanya email pada daftar ini yang boleh masuk ke panel admin, dan hanya yang berstatus Aktif.
      Pemeriksaannya dilakukan di server saat login.
    </p>
    <div class="table-wrap"><table>
      <thead><tr><th>Email</th><th>Nama</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" class="text-center text-muted">Belum ada email admin.</td></tr>'}</tbody>
    </table></div>
    <div class="insight-panel mt-3">
      <span class="label-lg" style="color:var(--c-primary);">// Catatan</span>
      <ul>
        <li>Anda tidak bisa menonaktifkan atau menghapus akun Anda sendiri — pengaman agar tidak terkunci di luar.</li>
        <li>Admin aktif terakhir juga tidak bisa dihapus, dengan alasan yang sama.</li>
        <li>Semua admin memakai PIN yang sama (lihat sheet <code>AppConfig</code> → <code>adminPin</code>).</li>
      </ul>
    </div>`;
}

function openEmailModal(emailLama, nama, status) {
  const judul = emailLama ? 'Edit Email Admin' : 'Tambah Email Admin';
  openModal(judul, `
    <div class="form-field"><label for="emEmail">Email <span class="req">*</span></label>
      <input type="email" id="emEmail" value="${escapeHtml(emailLama)}" placeholder="nama@email.com"></div>
    <div class="form-field"><label for="emNama">Nama</label>
      <input type="text" id="emNama" value="${escapeHtml(nama)}" placeholder="Nama admin"></div>
    <div class="form-field"><label for="emStatus">Status</label>
      <select id="emStatus">
        <option ${status === 'Aktif' ? 'selected' : ''}>Aktif</option>
        <option ${status !== 'Aktif' ? 'selected' : ''}>Nonaktif</option>
      </select></div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Batal</button>
    <button class="btn btn-primary" id="btnSaveEmail" onclick="saveEmailForm('${escapeJs(emailLama)}')">Simpan</button>
  `);
}

async function saveEmailForm(emailLama) {
  const email = document.getElementById('emEmail').value.trim();
  if (!email || email.indexOf('@') === -1) { showToast('Masukkan email yang valid.', 'warning'); return; }

  const pulihkan = busyButton(document.getElementById('btnSaveEmail'), 'Menyimpan...');
  const res = await Api.saveEmail(AppState.adminToken, {
    emailLama: emailLama,
    email: email,
    nama: document.getElementById('emNama').value.trim(),
    status: document.getElementById('emStatus').value
  });
  pulihkan();

  if (sesiBermasalah(res)) return;
  showToast(res.message, res.success ? 'success' : 'danger');
  if (res.success) { closeModal(); loadAdminPengaturan(); }
}

async function ubahStatusEmail(email, statusBaru) {
  const res = await Api.toggleEmail(AppState.adminToken, email, statusBaru);
  if (sesiBermasalah(res)) return;
  showToast(res.message, res.success ? 'success' : 'danger');
  if (res.success) loadAdminPengaturan();
}

function konfirmasiHapusEmail(email) {
  openModal('Hapus Email Admin',
    `<p>Hapus <strong>${escapeHtml(email)}</strong> dari daftar admin?</p>
     <p class="text-muted small mt-1">Email ini tidak akan bisa masuk ke panel admin lagi.</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button>
     <button class="btn btn-danger" onclick="hapusEmail('${escapeJs(email)}')">Hapus</button>`);
}

async function hapusEmail(email) {
  const res = await Api.deleteEmail(AppState.adminToken, email);
  closeModal();
  if (sesiBermasalah(res)) return;
  showToast(res.message, res.success ? 'success' : 'danger');
  if (res.success) loadAdminPengaturan();
}
