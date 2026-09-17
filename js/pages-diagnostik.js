/**
 * ============================================================
 * BASIC — Halaman Diagnostik Backend
 * ============================================================
 *
 * Tujuannya satu: mengubah pesan seperti "404" menjadi jawaban yang bisa
 * ditindaklanjuti. Halaman ini menguji GET dan POST secara terpisah, karena
 * pola kegagalannya memberi tahu penyebabnya:
 *
 *   GET ✓  POST ✗  → deployment memakai versi kode lama (belum punya doPost)
 *   GET ✗  POST ✗  → URL /exec salah, deployment dihapus, atau akses bukan "Anyone"
 *   GET ✓  POST ✓  → backend sehat; kegagalan login berarti soal email/PIN
 *
 * Versi backend juga ditampilkan, supaya ketahuan kalau deployment ternyata
 * masih melayani kode lama meski editornya sudah berisi kode baru.
 */

const VERSI_BACKEND_DIHARAPKAN = '2.2.0';

function renderDiagnostik() {
  const c = document.getElementById('diagnostikContainer');

  const urlTampil = (typeof GAS_URL === 'string' && GAS_URL) ? GAS_URL : '(kosong)';
  const urlValid = apiSiap();

  c.innerHTML = `
    <div class="summary-box mb-2">
      <div class="card-strip"><span>// KONFIGURASI</span><span>js/config.js</span></div>
      <div class="card-body">
        <div class="diag-row">
          <span class="label">URL Backend</span>
          <code class="diag-url">${escapeHtml(urlTampil)}</code>
        </div>
        <div class="diag-row">
          <span class="label">Bentuk URL</span>
          <span class="badge ${urlValid ? 'badge-success' : 'badge-error'}">
            ${urlValid ? 'VALID' : 'TIDAK VALID'}
          </span>
        </div>
        ${urlValid ? '' : `<p class="form-error mt-1">
          URL harus berasal dari script.google.com dan berakhiran <code>/exec</code>.
          Perbaiki di <code>js/config.js</code>, lalu commit &amp; push ulang.
        </p>`}
      </div>
    </div>

    <button class="btn btn-primary btn-block" id="btnJalankanDiag" onclick="jalankanDiagnostik()">
      Jalankan Tes Koneksi
    </button>

    <div id="diagHasil" class="mt-3"></div>`;

  // Langsung jalankan supaya pengguna tidak perlu klik dua kali
  if (urlValid) jalankanDiagnostik();
}

async function jalankanDiagnostik() {
  const box = document.getElementById('diagHasil');
  const pulihkan = busyButton(document.getElementById('btnJalankanDiag'), 'Menguji...');
  box.innerHTML = skeletonBlock(160);

  if (!apiSiap()) {
    pulihkan();
    box.innerHTML = `<div class="form-error">URL backend belum valid — perbaiki dulu di js/config.js.</div>`;
    return;
  }

  const [get, post] = await Promise.all([ujiEndpoint('GET'), ujiEndpoint('POST')]);
  pulihkan();

  box.innerHTML = `
    ${kartuHasilUji(get)}
    ${kartuHasilUji(post)}
    ${kartuVonis(get, post)}`;
}

function kartuHasilUji(h) {
  const badge = h.ok ? 'badge-success' : 'badge-error';
  const label = h.ok ? 'BERHASIL' : 'GAGAL';
  return `
    <div class="summary-box mb-2">
      <div class="card-strip">
        <span>// UJI ${h.metode}</span>
        <span class="badge ${badge}">${label}</span>
      </div>
      <div class="card-body">
        <div class="diag-row"><span class="label">Status HTTP</span><span class="mono">${h.status === null ? 'tidak ada jawaban' : h.status}</span></div>
        <div class="diag-row"><span class="label">Waktu</span><span class="mono">${h.ms} ms</span></div>
        ${h.data && h.data.versi ? `
          <div class="diag-row"><span class="label">Versi Backend</span>
            <span class="mono">${escapeHtml(h.data.versi)}
              ${h.data.versi !== VERSI_BACKEND_DIHARAPKAN
                ? `<span class="badge badge-warning">HARUSNYA ${VERSI_BACKEND_DIHARAPKAN}</span>` : ''}
            </span></div>` : ''}
        ${h.data && h.data.setupSelesai === false
          ? `<p class="form-error mt-1">${escapeHtml(h.data.catatan || 'Database belum siap.')}</p>` : ''}
        ${h.data && h.data.jumlahAdminAktif !== null && h.data.jumlahAdminAktif !== undefined
          ? `<div class="diag-row"><span class="label">Admin Aktif</span><span class="mono">${h.data.jumlahAdminAktif}</span></div>` : ''}
        ${h.catatan ? `<p class="form-error mt-1">${escapeHtml(h.catatan)}</p>` : ''}
        ${!h.ok && h.isi ? `<details class="mt-1"><summary class="label">Lihat jawaban mentah</summary>
          <pre class="diag-pre">${escapeHtml(h.isi)}</pre></details>` : ''}
      </div>
    </div>`;
}

/** Apakah jawaban server berupa HTML, bukan JSON? */
function jawabanBerupaHtml(h) {
  const s = safeTrim(h.isi).toLowerCase();
  return s.startsWith('<!doctype') || s.startsWith('<html') || s.startsWith('<h1') || s.startsWith('<');
}
function safeTrim(v) { return String(v == null ? '' : v).trim(); }

/** Simpulkan penyebab dari pola GET/POST — ini inti gunanya halaman ini. */
function kartuVonis(get, post) {
  let judul, isi, kelas;

  // Kasus khusus yang harus diperiksa lebih dulu: server menjawab 200 tetapi
  // isinya HTML. Itu bukan soal izin akses — itu deployment era HtmlService
  // yang masih dilayani, dan sarannya berbeda dari kegagalan koneksi biasa.
  if (!get.ok && jawabanBerupaHtml(get) && get.status === 200) {
    return `
      <div class="card" style="border-color: var(--c-primary);">
        <div class="card-strip"><span>// KESIMPULAN</span>
          <span class="badge badge-error">Deployment memakai kode versi lama</span></div>
        <div class="card-body"><p class="small" style="line-height:1.8;">
          Server menjawab dengan HTML, bukan JSON. Backend versi sekarang tidak pernah mengirim HTML —
          jadi yang sedang dilayani adalah <strong>snapshot kode lama</strong> dari masa aplikasi ini
          masih memakai HtmlService.
          <br><br>Perbaiki: <em>Deploy → Manage deployments → ikon pensil → Version:
          <strong>New version</strong> → Deploy</em>. Pastikan juga isi editor Apps Script sudah
          berisi <code>Kode.gs</code> terbaru sebelum membuat versi baru.
        </p></div>
      </div>`;
  }

  if (get.ok && post.ok) {
    const versiCocok = get.data && get.data.versi === VERSI_BACKEND_DIHARAPKAN;
    if (!versiCocok) {
      kelas = 'badge-warning';
      judul = 'Backend hidup, tetapi versinya lama';
      isi = `Deployment menjawab dengan versi <strong>${escapeHtml((get.data && get.data.versi) || '?')}</strong>,
             padahal frontend ini mengharapkan <strong>${VERSI_BACKEND_DIHARAPKAN}</strong>.
             Artinya kode terbaru sudah ada di editor tetapi belum dipublikasikan.
             Perbaiki: <em>Deploy → Manage deployments → ikon pensil → Version: New version → Deploy</em>.`;
    } else {
      kelas = 'badge-success';
      judul = 'Backend sehat';
      isi = `GET dan POST dua-duanya berhasil, versi backend sudah sesuai.
             Kalau login admin masih ditolak, berarti masalahnya bukan koneksi melainkan
             email atau PIN — pastikan email Anda terdaftar dan berstatus Aktif di
             <em>Pengaturan Admin</em>, dan PIN-nya <code>112233</code>.`;
    }
  } else if (get.ok && !post.ok) {
    kelas = 'badge-error';
    judul = 'Inilah penyebab 404 saat login';
    isi = `Permintaan GET berhasil tetapi POST gagal. Login admin memakai POST, jadi inilah yang gagal.
           Pola ini hampir selalu berarti <strong>deployment masih memakai snapshot kode lama</strong>
           yang belum memiliki fungsi <code>doPost</code>. Menempel kode baru di editor tidak mengubah
           apa yang dilayani — deployment tetap menyajikan versi lama sampai dibuatkan versi baru.
           <br><br>Perbaiki: <em>Deploy → Manage deployments → ikon pensil → Version: <strong>New version</strong> → Deploy</em>.
           Jangan memakai "New deployment", karena itu membuat URL <code>/exec</code> baru.`;
  } else if (!get.ok && !post.ok) {
    const status404 = get.status === 404 || post.status === 404;
    kelas = 'badge-error';
    judul = status404 ? 'URL backend tidak ditemukan' : 'Backend tidak bisa dihubungi';
    isi = status404
      ? `GET dan POST sama-sama menjawab 404. Berarti URL <code>/exec</code> di <code>js/config.js</code>
         tidak menunjuk ke deployment yang hidup. Penyebab tersering: pernah menekan
         <em>New deployment</em>, yang membuat URL baru, sementara config.js masih memegang URL lama.
         <br><br>Perbaiki: buka <em>Deploy → Manage deployments</em>, salin URL <code>/exec</code>
         yang aktif, tempel ke <code>js/config.js</code>, lalu commit &amp; push ulang ke GitHub.`
      : `Browser tidak mendapat jawaban yang bisa dibaca. Periksa <em>Deploy → Manage deployments</em>:
         <strong>Execute as</strong> harus <em>Me</em>, dan <strong>Who has access</strong> harus
         <em>Anyone</em>. Kalau disetel "Only myself", permintaan dari situs akan selalu ditolak.`;
  } else {
    kelas = 'badge-warning';
    judul = 'Hasil tidak lazim';
    isi = `POST berhasil tetapi GET gagal — kombinasi yang jarang terjadi.
           Kirimkan tangkapan layar halaman ini supaya bisa ditelusuri lebih lanjut.`;
  }

  return `
    <div class="card" style="border-color: var(--c-primary);">
      <div class="card-strip"><span>// KESIMPULAN</span><span class="badge ${kelas}">${judul}</span></div>
      <div class="card-body"><p class="small" style="line-height:1.8;">${isi}</p></div>
    </div>`;
}
