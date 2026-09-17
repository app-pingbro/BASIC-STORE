/**
 * ============================================================
 * BASIC — Lapisan API (fetch ke Google Apps Script)
 * ============================================================
 *
 * Aturan penting arsitektur ini:
 * 1. POST WAJIB memakai Content-Type "text/plain;charset=utf-8".
 *    Kalau memakai "application/json", browser mengirim permintaan
 *    preflight OPTIONS lebih dulu — dan Apps Script tidak bisa
 *    menjawabnya, sehingga semua POST gagal dengan error CORS.
 * 2. Token admin dikirim di dalam BODY, bukan di header. Menambah
 *    header khusus (mis. Authorization) juga memicu preflight.
 * 3. Jangan pakai mode 'no-cors' — responsnya jadi opaque & tak terbaca.
 */

/** Apakah GAS_URL sudah diisi dengan bentuk yang benar? */
function apiSiap() {
  return typeof GAS_URL === 'string' &&
         GAS_URL.indexOf('script.google.com') !== -1 &&
         GAS_URL.endsWith('/exec');
}

function peringatanUrlBelumDiisi() {
  return {
    success: false, data: null, gagalKoneksi: true,
    message: 'URL backend belum diisi. Buka file js/config.js lalu isi GAS_URL dengan URL /exec dari Apps Script Anda.'
  };
}

/**
 * Status kesehatan backend.
 *
 * Ada karena satu masalah nyata: katalog disimpan di browser dan tetap tampil
 * walau backend mati, sehingga kegagalan bisa tersembunyi sampai seseorang
 * mencoba login admin — satu-satunya halaman yang tidak punya cadangan.
 * Sekarang kegagalan koneksi apa pun memunculkan spanduk yang menetap.
 */
const BackendHealth = {
  sehat: null,          // null = belum diketahui
  pesanTerakhir: '',

  tandaiSehat() {
    if (this.sehat === false) this.render(true);
    this.sehat = true;
  },

  tandaiGagal(pesan) {
    this.pesanTerakhir = pesan;
    if (this.sehat !== false) { this.sehat = false; this.render(false); }
  },

  render(sehat) {
    let bar = document.getElementById('backendBanner');
    if (sehat) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'backendBanner';
      bar.className = 'backend-banner';
      document.body.appendChild(bar);
    }
    bar.innerHTML =
      `<span><strong>Backend tidak bisa dihubungi.</strong> ${escapeHtml(this.pesanTerakhir)}</span>
       <a class="btn btn-sm btn-secondary" href="#/diagnostik">Jalankan Diagnostik</a>`;
  }
};

/**
 * Terjemahkan kegagalan HTTP menjadi penyebab yang bisa ditindaklanjuti.
 * Tanpa ini, pengguna hanya melihat angka seperti "404" tanpa tahu artinya.
 */
function jelaskanStatus(status, metode) {
  if (status === 404) {
    return 'Endpoint Apps Script menjawab 404 (tidak ditemukan). Dua sebab tersering: ' +
           '(a) deployment masih memakai versi kode lama — perbaiki lewat Deploy → Manage deployments → Edit → Version: New version; ' +
           'atau (b) URL /exec di js/config.js sudah tidak berlaku, biasanya karena pernah menekan ' +
           '"New deployment" yang membuat URL baru. Buka halaman Diagnostik untuk memastikan.';
  }
  if (status === 401 || status === 403) {
    return 'Akses ke Apps Script ditolak (' + status + '). Pada Deploy → Manage deployments, ' +
           'pastikan "Who has access" diatur ke "Anyone", bukan "Only myself".';
  }
  if (status >= 500) {
    return 'Apps Script mengalami error internal (' + status + '). Cek Executions di editor Apps Script ' +
           'untuk melihat baris mana yang gagal.';
  }
  return 'Server menjawab dengan status ' + status + ' pada permintaan ' + metode + '.';
}

/** Ubah error jaringan/parsing menjadi kalimat yang bisa dimengerti. */
function pesanErrorRamah(err) {
  const m = String((err && err.message) || err);
  if (m.includes('Failed to fetch') || m.includes('NetworkError') || m.includes('Load failed')) {
    return 'Tidak bisa terhubung ke server. Cek koneksi internet, dan pastikan Web App Apps Script ' +
           'sudah di-deploy dengan akses "Anyone".';
  }
  if (m.includes('Unexpected token') || m.includes('JSON') || m.includes('<')) {
    return 'Server mengirim HTML, bukan data JSON. Ini tanda khas deployment masih memakai kode versi lama ' +
           '(versi HtmlService). Buat versi baru: Deploy → Manage deployments → Edit → Version: New version.';
  }
  return m;
}

/** Bungkus hasil fetch yang gagal menjadi jawaban seragam. */
function jawabanGagal(pesan) {
  BackendHealth.tandaiGagal(pesan);
  return { success: false, data: null, gagalKoneksi: true, message: pesan };
}

/**
 * Permintaan GET — untuk data publik (katalog, detail produk, status pesanan).
 */
async function apiGet(action, params) {
  if (!apiSiap()) return peringatanUrlBelumDiisi();
  try {
    const qs = new URLSearchParams(Object.assign({ action: action }, params || {}));
    const res = await fetch(`${GAS_URL}?${qs.toString()}`, { method: 'GET' });
    if (!res.ok) return jawabanGagal(jelaskanStatus(res.status, 'GET'));

    const teks = await res.text();
    let json;
    try { json = JSON.parse(teks); }
    catch (e) { return jawabanGagal(pesanErrorRamah(new Error('Unexpected token'))); }

    BackendHealth.tandaiSehat();
    return json;
  } catch (err) {
    return jawabanGagal(pesanErrorRamah(err));
  }
}

/**
 * Permintaan POST — untuk menulis data & seluruh aksi admin.
 */
async function apiPost(action, data, token) {
  if (!apiSiap()) return peringatanUrlBelumDiisi();
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      // ⚠️ JANGAN diganti ke application/json — memicu CORS preflight yang ditolak GAS
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, data: data || {}, token: token || '' })
    });
    if (!res.ok) return jawabanGagal(jelaskanStatus(res.status, 'POST'));

    const teks = await res.text();
    let json;
    try { json = JSON.parse(teks); }
    catch (e) { return jawabanGagal(pesanErrorRamah(new Error('Unexpected token'))); }

    BackendHealth.tandaiSehat();
    return json;
  } catch (err) {
    return jawabanGagal(pesanErrorRamah(err));
  }
}

/**
 * Uji mentah untuk halaman Diagnostik.
 * Mengembalikan detail apa adanya (status, potongan isi) tanpa diterjemahkan,
 * supaya penyebab sebenarnya terlihat alih-alih tertutup pesan ramah.
 */
async function ujiEndpoint(metode) {
  const mulai = Date.now();
  const hasil = { metode: metode, ok: false, status: null, ms: 0, isi: '', catatan: '' };
  try {
    const res = metode === 'GET'
      ? await fetch(`${GAS_URL}?action=ping`, { method: 'GET' })
      : await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'ping', data: {}, token: '' })
        });

    hasil.status = res.status;
    hasil.ms = Date.now() - mulai;
    const teks = await res.text();
    hasil.isi = teks.slice(0, 400);

    if (!res.ok) { hasil.catatan = jelaskanStatus(res.status, metode); return hasil; }
    try {
      const json = JSON.parse(teks);
      hasil.ok = !!json.success;
      hasil.data = json.data || null;
      if (!hasil.ok) hasil.catatan = json.message || 'Backend menjawab tetapi menandai gagal.';
    } catch (e) {
      hasil.catatan = pesanErrorRamah(new Error('Unexpected token'));
    }
  } catch (err) {
    hasil.ms = Date.now() - mulai;
    hasil.catatan = pesanErrorRamah(err);
  }
  return hasil;
}

// ── Pembungkus per-aksi (agar pemanggilan di halaman tetap ringkas) ──

const Api = {
  // Publik
  bootstrap:     ()               => apiGet('bootstrap'),
  katalog:       ()               => apiGet('katalog'),
  produk:        (id)             => apiGet('produk', { id: id }),
  statusPesanan: (nomor)          => apiGet('statusPesanan', { nomor: nomor }),
  checkout:      (buyer, items)   => apiPost('checkout', { buyer: buyer, items: items }),
  uploadBukti:   (nomor, b64, nama, mime) =>
                    apiPost('uploadBukti', { nomorPesanan: nomor, fileBase64: b64, fileName: nama, mimeType: mime }),

  // Admin — autentikasi
  adminLogin:  (email, pin) => apiPost('adminLogin', { email: email, pin: pin }),
  adminLogout: (token)      => apiPost('adminLogout', {}, token),

  // Admin — hero slider
  heroList:   (t)           => apiPost('adminHeroList', {}, t),
  saveHero:   (t, d)        => apiPost('adminSaveHero', d, t),
  deleteHero: (t, id)       => apiPost('adminDeleteHero', { slideId: id }, t),
  toggleHero: (t, id, s)    => apiPost('adminToggleHero', { slideId: id, statusBaru: s }, t),
  moveHero:   (t, id, arah) => apiPost('adminMoveHero', { slideId: id, arah: arah }, t),

  // Admin — email berwenang
  emailList:   (t)          => apiPost('adminEmailList', {}, t),
  saveEmail:   (t, d)       => apiPost('adminSaveEmail', d, t),
  toggleEmail: (t, em, s)   => apiPost('adminToggleEmail', { email: em, statusBaru: s }, t),
  deleteEmail: (t, em)      => apiPost('adminDeleteEmail', { email: em }, t),

  // Admin — data
  dashboard:     (t)            => apiPost('adminDashboard', {}, t),
  produkList:    (t)            => apiPost('adminProdukList', {}, t),
  saveProduk:    (t, d)         => apiPost('adminSaveProduk', d, t),
  toggleProduk:  (t, id, s)     => apiPost('adminToggleProduk', { produkId: id, statusBaru: s }, t),
  varianList:    (t, produkId)  => apiPost('adminVarianList', { produkId: produkId }, t),
  saveVarian:    (t, d)         => apiPost('adminSaveVarian', d, t),
  adjustStok:    (t, id, delta) => apiPost('adminAdjustStok', { varianId: id, delta: delta }, t),
  deleteVarian:  (t, id)        => apiPost('adminDeleteVarian', { varianId: id }, t),
  poList:        (t)            => apiPost('adminPOList', {}, t),
  savePO:        (t, d)         => apiPost('adminSavePO', d, t),
  closePO:       (t, poId)      => apiPost('adminClosePO', { poId: poId }, t),
  pesananList:   (t, filter)    => apiPost('adminPesananList', { filterStatus: filter }, t),
  pesananDetail: (t, nomor)     => apiPost('adminPesananDetail', { nomorPesanan: nomor }, t),
  verifikasi:    (t, nomor, ok) => apiPost('adminVerifikasiBayar', { nomorPesanan: nomor, disetujui: ok }, t),
  updateStatus:  (t, nomor, s)  => apiPost('adminUpdateStatus', { nomorPesanan: nomor, statusBaru: s }, t)
};
