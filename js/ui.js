/**
 * ============================================================
 * BASIC — Utilitas UI (toast, modal, format, kompresi gambar)
 * ============================================================
 */

// ── Format ──────────────────────────────────────────────

function formatRupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID');
}

function formatTanggal(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Untuk nilai yang disisipkan ke dalam atribut onclick="...('NILAI')" */
function escapeJs(str) {
  return String(str == null ? '' : str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ── Toast ───────────────────────────────────────────────

function showToast(message, type) {
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = 'toast ' + (type || 'info');
  el.innerHTML = `<span class="dot"></span><span>${escapeHtml(message)}</span>`;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 200ms ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }, 3600);
}

// ── Modal ───────────────────────────────────────────────

function openModal(title, bodyHtml, footHtml) {
  document.getElementById('genericModalTitle').textContent = title;
  document.getElementById('genericModalBody').innerHTML = bodyHtml;
  document.getElementById('genericModalFoot').innerHTML = footHtml || '';
  document.getElementById('genericModal').hidden = false;
}

function setModalBody(html) { document.getElementById('genericModalBody').innerHTML = html; }
function setModalFoot(html) { document.getElementById('genericModalFoot').innerHTML = html; }
function closeModal() { document.getElementById('genericModal').hidden = true; }

// ── Loading ─────────────────────────────────────────────

function hideLoadingOverlay() {
  const ov = document.getElementById('loadingOverlay');
  if (!ov) return;
  ov.style.opacity = '0';
  setTimeout(() => ov.hidden = true, 250);
}

function skeletonCards(n) {
  let html = '';
  for (let i = 0; i < n; i++) {
    html += `<div class="produk-card">
      <div class="produk-media skeleton"></div>
      <div class="produk-info">
        <div class="skeleton" style="height:12px;width:80%;"></div>
        <div class="skeleton mt-1" style="height:10px;width:40%;"></div>
      </div></div>`;
  }
  return html;
}

function skeletonBlock(height) {
  return `<div class="skeleton" style="height:${height || 200}px;margin-top:1rem;"></div>`;
}

/** Tampilkan spinner di dalam tombol, kembalikan fungsi untuk memulihkannya. */
function busyButton(btn, teksSibuk) {
  if (!btn) return () => {};
  const asli = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-inline"></span> ${escapeHtml(teksSibuk || 'Memproses...')}`;
  return () => { btn.disabled = false; btn.innerHTML = asli; };
}

// ── Salin ke clipboard ──────────────────────────────────

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast('Disalin ke clipboard.', 'success');
  } catch (e) {
    showToast('Gagal menyalin — silakan salin manual.', 'warning');
  }
}

// ── Kompresi gambar di browser ──────────────────────────
//
// Penting untuk arsitektur ini: file dikirim ke Apps Script sebagai
// teks base64 di dalam body POST. Base64 membengkakkan ukuran ~33%,
// jadi foto 8MB dari kamera HP bisa gagal terkirim. Kompresi di sisi
// browser membuat unggahan cepat dan andal tanpa mengorbankan kejernihan.

function compressImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File harus berupa gambar (JPG/PNG).'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File gambar tidak bisa dibaca.'));
      img.onload = () => {
        const skala = Math.min(1, (maxWidth || IMAGE_MAX_WIDTH) / img.width);
        const w = Math.round(img.width * skala);
        const h = Math.round(img.height * skala);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        // Latar putih agar PNG transparan tidak jadi hitam saat dijadikan JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', quality || IMAGE_QUALITY);
        resolve({
          base64: dataUrl.split(',')[1],
          dataUrl: dataUrl,
          mime: 'image/jpeg',
          name: (file.name || 'gambar').replace(/\.[^.]+$/, '') + '.jpg'
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Validasi ukuran file sebelum diproses. */
function cekUkuranFile(file) {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    showToast(`Ukuran file maksimal ${MAX_UPLOAD_MB}MB.`, 'warning');
    return false;
  }
  return true;
}
