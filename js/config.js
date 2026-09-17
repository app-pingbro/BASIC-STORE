/**
 * ============================================================
 * BASIC — Konfigurasi Frontend
 * ============================================================
 *
 * ⚠️  WAJIB DIISI SEBELUM DEPLOY KE GITHUB PAGES ⚠️
 *
 * Tempel URL Web App Google Apps Script Anda di bawah ini.
 * URL-nya berakhiran "/exec" dan didapat dari:
 *   Apps Script → Deploy → New deployment → Web app → Deploy → Copy URL
 *
 * Contoh bentuk URL yang benar:
 *   https://script.google.com/macros/s/AKfycbxXXXXXXXXXXXXXXXXXXXXX/exec
 *
 * Kalau nilai di bawah masih "GANTI_DENGAN_URL_EXEC_ANDA",
 * situs akan tampil tapi datanya kosong dan muncul peringatan.
 */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwtJMzLnJxN3TDxZB891O5YfoVYn0pwzcr0VTnlAmLOU9d2iuPP--U9cJhCLNuyhQbG/exec';

/** Batas ukuran file yang boleh diunggah pembeli/admin (sebelum dikompres). */
const MAX_UPLOAD_MB = 10;

/** Lebar maksimum gambar setelah dikompres di browser (piksel). */
const IMAGE_MAX_WIDTH = 1600;

/** Kualitas kompresi JPEG (0–1). 0.82 = seimbang antara tajam & ringan. */
const IMAGE_QUALITY = 0.82;
