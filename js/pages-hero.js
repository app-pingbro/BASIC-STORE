/**
 * ============================================================
 * BASIC — Admin: Kelola Hero / Banner
 * ============================================================
 *
 * Semua foto hero disimpan di Google Drive dan dicatat di sheet HeroSlides.
 * Tidak ada foto yang ditulis di dalam kode frontend, sehingga admin bisa
 * mengganti tampilan halaman depan tanpa menyentuh source code.
 */

let HeroFotoBaru = null;   // { base64, dataUrl, mime, name } — foto yang baru dipilih
let AdminHeroCache = [];

async function loadAdminHero() {
  const c = document.getElementById('adminHeroContainer');
  c.innerHTML = skeletonBlock(220);

  const res = await Api.heroList(AppState.adminToken);
  if (sesiBermasalah(res)) return;
  if (!res.success) { c.innerHTML = `<div class="empty-state">${escapeHtml(res.message)}</div>`; return; }

  const slides = res.data;
  const jumlahAktif = slides.filter(s => s.aktif).length;

  const kartu = slides.map((s, i) => `
    <div class="hero-admin-item ${s.aktif ? '' : 'nonaktif'}">
      <div class="hero-admin-thumb">
        <img src="${escapeHtml(s.gambar)}" alt="${escapeHtml(s.judul || 'Slide ' + (i + 1))}" loading="lazy">
        <span class="hero-admin-urut">${i + 1}</span>
      </div>
      <div class="hero-admin-info">
        <div class="nm">${escapeHtml(s.judul || '(tanpa judul)')}</div>
        <div class="text-muted small">${escapeHtml(s.subjudul || '—')}</div>
        <span class="badge ${s.aktif ? 'badge-success' : 'badge-habis'} mt-1">${escapeHtml(s.status)}</span>
      </div>
      <div class="hero-admin-aksi">
        <div class="hero-admin-urutan">
          <button class="btn btn-sm btn-secondary" ${i === 0 ? 'disabled' : ''}
            onclick="pindahHero('${escapeJs(s.slideId)}','naik')" title="Naikkan urutan">↑</button>
          <button class="btn btn-sm btn-secondary" ${i === slides.length - 1 ? 'disabled' : ''}
            onclick="pindahHero('${escapeJs(s.slideId)}','turun')" title="Turunkan urutan">↓</button>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="openHeroModal('${escapeJs(s.slideId)}')">Edit</button>
        <button class="btn btn-sm btn-secondary"
          onclick="ubahStatusHero('${escapeJs(s.slideId)}','${s.aktif ? 'Nonaktif' : 'Aktif'}')">
          ${s.aktif ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
        <button class="btn btn-sm btn-danger" onclick="konfirmasiHapusHero('${escapeJs(s.slideId)}')">Hapus</button>
      </div>
    </div>`).join('');

  AdminHeroCache = slides;

  c.innerHTML = `
    <div class="flex-between mb-2">
      <h3 style="font-size:1.1rem;">Kelola Hero / Banner</h3>
      <button class="btn btn-primary btn-sm" onclick="openHeroModal('')">+ Tambah Slide</button>
    </div>
    <p class="text-muted small mb-2">
      Urutan di daftar ini menentukan urutan tampil di halaman depan.
      Slide berstatus <strong>Nonaktif</strong> tetap tersimpan tetapi tidak ditampilkan ke pembeli.
      ${jumlahAktif === 0 ? '<br><strong>Belum ada slide aktif</strong> — halaman depan memakai tampilan teks bawaan.' : ''}
    </p>
    <div class="hero-admin-list">
      ${kartu || '<div class="empty-state">Belum ada slide. Tambahkan foto pertama Anda.</div>'}
    </div>`;
}

function openHeroModal(slideId) {
  const s = slideId ? AdminHeroCache.find(x => x.slideId === slideId) : null;
  HeroFotoBaru = null;

  openModal(s ? 'Edit Slide Hero' : 'Tambah Slide Hero', `
    <div class="form-field">
      <label for="hFoto">Foto Banner ${s ? '' : '<span class="req">*</span>'}</label>
      <input type="file" id="hFoto" accept="image/*" onchange="pilihFotoHero(this)">
      <span class="form-hint">Disarankan bentuk memanjang (mis. 1600×900). Gambar otomatis dikompres.</span>
    </div>
    <div class="hero-modal-preview" id="hPreview">
      ${s ? `<img src="${escapeHtml(s.gambar)}" alt="Foto saat ini">` : '<span class="text-muted small">Belum ada foto dipilih</span>'}
    </div>
    <div class="form-field mt-2"><label for="hJudul">Judul (opsional)</label>
      <input type="text" id="hJudul" value="${escapeHtml(s ? s.judul : '')}" placeholder="mis. Drop Terbaru"></div>
    <div class="form-field"><label for="hSub">Subjudul (opsional)</label>
      <input type="text" id="hSub" value="${escapeHtml(s ? s.subjudul : '')}" placeholder="mis. Koleksi plastisol 300gsm"></div>
    <div class="form-field"><label for="hStatus">Status</label>
      <select id="hStatus">
        <option ${!s || s.aktif ? 'selected' : ''}>Aktif</option>
        <option ${s && !s.aktif ? 'selected' : ''}>Nonaktif</option>
      </select></div>
  `, `
    <button class="btn btn-secondary" onclick="tryCloseModal()">Batal</button>
    <button class="btn btn-primary" id="btnSaveHero" onclick="saveHeroForm('${escapeJs(slideId || '')}')">Simpan</button>
  `, { jaga: true, cekTambahan: () => HeroFotoBaru !== null });
}

async function pilihFotoHero(input) {
  const file = input.files[0];
  if (!file) return;
  if (!cekUkuranFile(file)) { input.value = ''; return; }

  try {
    // Banner tampil melebar, jadi lebar maksimumnya lebih besar dari foto produk
    const hasil = await compressImage(file, 1600, 0.85);
    HeroFotoBaru = hasil;
    document.getElementById('hPreview').innerHTML =
      `<img src="${hasil.dataUrl}" alt="Pratinjau foto baru">`;
  } catch (e) {
    showToast(e.message, 'danger');
    input.value = '';
  }
}

async function saveHeroForm(slideId) {
  if (!slideId && !HeroFotoBaru) {
    showToast('Pilih foto banner terlebih dahulu.', 'warning');
    return;
  }

  const pulihkan = busyButton(document.getElementById('btnSaveHero'), 'Menyimpan...');
  const res = await Api.saveHero(AppState.adminToken, {
    slideId: slideId || '',
    judul: document.getElementById('hJudul').value.trim(),
    subjudul: document.getElementById('hSub').value.trim(),
    status: document.getElementById('hStatus').value,
    fileBase64: HeroFotoBaru ? HeroFotoBaru.base64 : '',
    fileName: HeroFotoBaru ? HeroFotoBaru.name : '',
    mimeType: HeroFotoBaru ? HeroFotoBaru.mime : ''
  });
  pulihkan();

  if (sesiBermasalah(res)) return;
  if (!res.success) { showToast(res.message, 'danger'); return; }

  closeModal();
  HeroFotoBaru = null;
  showToast('Slide hero disimpan.', 'success');
  segarkanHero();
}

async function pindahHero(slideId, arah) {
  const res = await Api.moveHero(AppState.adminToken, slideId, arah);
  if (sesiBermasalah(res)) return;
  if (!res.success) { showToast(res.message, 'danger'); return; }
  segarkanHero();
}

async function ubahStatusHero(slideId, statusBaru) {
  const res = await Api.toggleHero(AppState.adminToken, slideId, statusBaru);
  if (sesiBermasalah(res)) return;
  showToast(res.message, res.success ? 'success' : 'danger');
  if (res.success) segarkanHero();
}

function konfirmasiHapusHero(slideId) {
  openModal('Hapus Slide',
    '<p>Hapus slide ini dari hero?</p><p class="text-muted small mt-1">Foto tetap ada di Google Drive, hanya dilepas dari daftar slide.</p>',
    `<button class="btn btn-secondary" onclick="closeModal()">Batal</button>
     <button class="btn btn-danger" onclick="hapusHero('${escapeJs(slideId)}')">Hapus</button>`);
}

async function hapusHero(slideId) {
  const res = await Api.deleteHero(AppState.adminToken, slideId);
  closeModal();
  if (sesiBermasalah(res)) return;
  showToast(res.message, res.success ? 'success' : 'danger');
  if (res.success) segarkanHero();
}

/**
 * Muat ulang daftar admin DAN buang salinan katalog di browser,
 * supaya perubahan hero langsung terlihat saat admin membuka halaman depan.
 */
function segarkanHero() {
  loadAdminHero();
  AppState.katalogSegar = false;
  KatalogCache.clear();
}
