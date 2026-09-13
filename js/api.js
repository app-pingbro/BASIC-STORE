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

/** Apakah GAS_URL sudah diisi? */
function apiSiap() {
  return typeof GAS_URL === 'string' &&
         GAS_URL.indexOf('script.google.com') !== -1 &&
         GAS_URL.endsWith('/exec');
}

function peringatanUrlBelumDiisi() {
  return {
    success: false,
    data: null,
    message: 'URL backend belum diisi. Buka file js/config.js lalu isi GAS_URL dengan URL /exec dari Apps Script Anda.'
  };
}

/**
 * Permintaan GET — untuk data publik (katalog, detail produk, status pesanan).
 * @param {string} action  nama action di doGet()
 * @param {object} params  parameter tambahan (opsional)
 */
async function apiGet(action, params) {
  if (!apiSiap()) return peringatanUrlBelumDiisi();
  try {
    const qs = new URLSearchParams(Object.assign({ action: action }, params || {}));
    const res = await fetch(`${GAS_URL}?${qs.toString()}`, { method: 'GET' });
    if (!res.ok) throw new Error('Server menjawab dengan status ' + res.status);
    return await res.json();
  } catch (err) {
    return { success: false, data: null, message: pesanErrorRamah(err) };
  }
}

/**
 * Permintaan POST — untuk menulis data & seluruh aksi admin.
 * @param {string} action  nama action di doPost()
 * @param {object} data    muatan data
 * @param {string} token   token sesi admin (opsional, untuk aksi admin)
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
    if (!res.ok) throw new Error('Server menjawab dengan status ' + res.status);
    return await res.json();
  } catch (err) {
    return { success: false, data: null, message: pesanErrorRamah(err) };
  }
}

/** Ubah error teknis jadi kalimat yang bisa dimengerti pengguna. */
function pesanErrorRamah(err) {
  const m = String(err && err.message || err);
  if (m.includes('Failed to fetch') || m.includes('NetworkError') || m.includes('Load failed')) {
    return 'Tidak bisa terhubung ke server. Cek koneksi internet Anda, ' +
           'dan pastikan Web App Apps Script sudah di-deploy dengan akses "Anyone".';
  }
  if (m.includes('Unexpected token') || m.includes('JSON')) {
    return 'Jawaban server tidak dikenali. Biasanya ini berarti URL /exec salah, ' +
           'atau deployment belum diperbarui setelah kode diubah.';
  }
  return m;
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
