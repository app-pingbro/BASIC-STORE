/**
 * ============================================================
 * BASIC — Halaman Pembeli
 * Katalog · Detail Produk · Keranjang · Checkout · Konfirmasi · Status
 * ============================================================
 */

// ════════════════════════════════════════════════════════
// KATALOG
// ════════════════════════════════════════════════════════

/**
 * Muat katalog dengan pola "tampilkan dulu, segarkan kemudian".
 *
 * Urutan prioritas:
 * 1. Sudah ada di memori (pindah halaman) → render, tanpa jaringan sama sekali.
 * 2. Ada salinan di browser → render SEKETIKA, lalu segarkan diam-diam.
 * 3. Belum punya apa-apa → tampilkan kerangka, tunggu server.
 */
async function loadKatalog(paksa) {
  const grid = document.getElementById('katalogGrid');

  // 1. Sudah diambil dari server pada sesi ini → cukup gambar ulang, tanpa jaringan
  if (AppState.katalog.length && AppState.katalogSegar && !paksa) {
    tampilkanKatalog();
    return;
  }

  // 2. Sudah ada isinya dari cache browser (lihat hydrateDariCache di app.js)
  //    → tampilkan SEKETIKA, lalu segarkan diam-diam di latar belakang
  const adaIsiAwal = AppState.katalog.length > 0 && !paksa;
  if (adaIsiAwal) {
    tampilkanKatalog();
    tandaiMenyegarkan(true);
  } else {
    grid.innerHTML = skeletonCards(8);
  }

  const res = await Api.bootstrap();
  tandaiMenyegarkan(false);

  if (!res.success) {
    // Kalau layar sudah terisi dari cache, jangan dikosongkan hanya karena
    // penyegaran gagal — pembeli tetap bisa melihat dan berbelanja.
    if (adaIsiAwal) {
      showToast('Gagal menyegarkan katalog — menampilkan data terakhir.', 'warning');
      return;
    }
    grid.innerHTML = `<div class="empty-state">
      <p>${escapeHtml(res.message)}</p>
      <button class="btn btn-secondary mt-2" onclick="loadKatalog(true)">Coba Lagi</button>
    </div>`;
    return;
  }

  const katalogBaru = res.data.katalog || [];
  const configBaru = res.data.config || AppState.config;
  AppState.hero = res.data.hero || [];
  const berubah = JSON.stringify(katalogBaru) !== JSON.stringify(AppState.katalog);

  AppState.katalog = katalogBaru;
  AppState.config = configBaru;
  AppState.katalogSegar = true;
  KatalogCache.write(katalogBaru, configBaru, AppState.hero);

  // Hanya gambar ulang kalau memang ada perubahan — mencegah layar "berkedip"
  // saat isi katalognya ternyata sama persis dengan yang sudah tampil.
  if (!adaIsiAwal || berubah) tampilkanKatalog();
}

function tampilkanKatalog() {
  renderHero();
  renderFilterBar();
  renderKatalogGrid();
  document.getElementById('statTotalProduk').textContent = AppState.katalog.length;
  document.getElementById('statPO').textContent = AppState.katalog.filter(p => p.po).length;
}

// ════════════════════════════════════════════════════════
// HERO SLIDER
// ════════════════════════════════════════════════════════
//
// Slide datang dari backend (sheet HeroSlides). Tidak ada foto yang ditulis
// di dalam kode ini — kalau admin belum mengunggah apa pun, hero teks bawaan
// yang dipakai supaya halaman depan tidak pernah kosong.

const HeroState = { idx: 0, timer: null, sentuhX: null };
const HERO_JEDA = 5000;

function renderHero() {
  const c = document.getElementById('heroContainer');
  if (!c) return;

  const slides = AppState.hero || [];
  hentikanHeroOtomatis();

  if (!slides.length) { c.innerHTML = heroBawaan(); return; }

  HeroState.idx = 0;
  c.innerHTML = `
    <div class="hero-slider" id="heroSlider">
      <div class="hero-track" id="heroTrack" style="width:${slides.length * 100}%">
        ${slides.map(s => `
          <div class="hero-slide" style="width:${100 / slides.length}%">
            <img src="${escapeHtml(s.gambar)}" alt="${escapeHtml(s.judul || 'Banner BASIC')}"
                 loading="eager" decoding="async">
            ${(s.judul || s.subjudul) ? `
              <div class="hero-slide-teks">
                ${s.judul ? `<h1>${escapeHtml(s.judul)}</h1>` : ''}
                ${s.subjudul ? `<p>${escapeHtml(s.subjudul)}</p>` : ''}
                <button class="btn btn-primary mt-2" onclick="scrollToGrid()">Belanja Sekarang</button>
              </div>` : ''}
          </div>`).join('')}
      </div>

      ${slides.length > 1 ? `
        <button class="hero-nav prev" onclick="heroGeser(-1)" aria-label="Slide sebelumnya">‹</button>
        <button class="hero-nav next" onclick="heroGeser(1)" aria-label="Slide berikutnya">›</button>
        <div class="hero-dots" id="heroDots">
          ${slides.map((_, i) => `<button class="hero-dot ${i === 0 ? 'active' : ''}"
             onclick="heroKe(${i})" aria-label="Slide ${i + 1}"></button>`).join('')}
        </div>` : ''}
    </div>`;

  if (slides.length > 1) {
    mulaiHeroOtomatis();
    pasangGeserSentuh(document.getElementById('heroSlider'));
  }
}

/** Tampilan bawaan saat belum ada slide — halaman depan tidak pernah kosong. */
function heroBawaan() {
  return `
    <div class="hero reg-mark">
      <div class="hero-eyebrow"><span class="dot"></span><span class="label">Drop Aktif // Komunitas Sablon Bali</span></div>
      <h1>HEAVY<br>PLASTISOL<span>//</span><br>300GSM ARCHIVE</h1>
      <p class="desc">Merchandise resmi komunitas sablon Bali. Cetakan plastisol tebal,
        katun combed premium, edisi terbatas — reguler &amp; pre-order.</p>
      <div class="hero-actions">
        <button class="btn btn-primary" onclick="scrollToGrid()">Belanja Sekarang</button>
        <a href="#/status" class="btn btn-secondary">Cek Status Pesanan</a>
      </div>
    </div>`;
}

function heroKe(i) {
  const slides = AppState.hero || [];
  if (!slides.length) return;
  HeroState.idx = (i + slides.length) % slides.length;

  const track = document.getElementById('heroTrack');
  if (track) track.style.transform = `translateX(-${HeroState.idx * (100 / slides.length)}%)`;

  document.querySelectorAll('.hero-dot')
    .forEach((d, n) => d.classList.toggle('active', n === HeroState.idx));

  mulaiHeroOtomatis(); // setiap interaksi menyetel ulang hitungan mundur
}

/** Geser slide. Otomatis selalu maju ke kanan (arah +1). */
function heroGeser(arah) { heroKe(HeroState.idx + arah); }

function mulaiHeroOtomatis() {
  hentikanHeroOtomatis();
  const slides = AppState.hero || [];
  if (slides.length < 2) return;
  HeroState.timer = setInterval(() => heroGeser(1), HERO_JEDA);
}

function hentikanHeroOtomatis() {
  if (HeroState.timer) { clearInterval(HeroState.timer); HeroState.timer = null; }
}

/** Geser dengan jari di layar sentuh. */
function pasangGeserSentuh(el) {
  if (!el) return;
  el.addEventListener('touchstart', e => {
    HeroState.sentuhX = e.touches[0].clientX;
    hentikanHeroOtomatis();
  }, { passive: true });

  el.addEventListener('touchend', e => {
    if (HeroState.sentuhX === null) return;
    const selisih = e.changedTouches[0].clientX - HeroState.sentuhX;
    HeroState.sentuhX = null;
    if (Math.abs(selisih) > 40) heroGeser(selisih < 0 ? 1 : -1);
    else mulaiHeroOtomatis();
  }, { passive: true });

  // Berhenti saat kursor menyapu hero supaya tidak berpindah ketika dibaca
  el.addEventListener('mouseenter', hentikanHeroOtomatis);
  el.addEventListener('mouseleave', mulaiHeroOtomatis);
}

/** Penanda halus bahwa data sedang disegarkan di latar belakang. */
function tandaiMenyegarkan(aktif) {
  const label = document.getElementById('jumlahProdukLabel');
  if (!label) return;
  if (aktif) label.dataset.menyegarkan = '1';
  else delete label.dataset.menyegarkan;
  label.style.opacity = aktif ? '0.45' : '';
}

function renderFilterBar() {
  const kategoris = ['Semua'].concat(
    Array.from(new Set(AppState.katalog.map(p => p.kategori).filter(Boolean)))
  );
  document.getElementById('filterBar').innerHTML = kategoris.map(k =>
    `<button class="filter-chip ${k === AppState.filterKategori ? 'active' : ''}"
       onclick="setFilterKategori('${escapeJs(k)}')">${escapeHtml(k)}</button>`
  ).join('');
}

function setFilterKategori(kategori) {
  AppState.filterKategori = kategori;
  renderFilterBar();
  renderKatalogGrid();
}

function renderKatalogGrid() {
  const list = AppState.filterKategori === 'Semua'
    ? AppState.katalog
    : AppState.katalog.filter(p => p.kategori === AppState.filterKategori);

  document.getElementById('jumlahProdukLabel').textContent = `${list.length} ITEM`;
  const grid = document.getElementById('katalogGrid');

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state">Belum ada produk pada kategori ini.</div>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const badge = p.status === 'Habis'
      ? '<span class="badge badge-habis">[HABIS]</span>'
      : p.tipeJual === 'PO'
        ? '<span class="badge badge-po">[PRE-ORDER]</span>'
        : '<span class="badge badge-live">[LIVE]</span>';
    const harga = p.po ? p.po.hargaPO : p.harga;
    const media = p.fotoUtama
      ? `<img src="${escapeHtml(p.fotoUtama)}" alt="${escapeHtml(p.nama)}" loading="lazy"
             onerror="this.parentNode.innerHTML='<div class=\\'no-photo\\'>NO<br>SUBSTRATE<br>INDEXED</div>'">`
      : `<div class="no-photo">NO<br>SUBSTRATE<br>INDEXED</div>`;

    return `<a class="produk-card" href="#/produk/${encodeURIComponent(p.produkId)}">
      <div class="produk-media">${media}${badge}</div>
      <div class="produk-info">
        <div class="produk-kategori">${escapeHtml(p.kategori || '-')}</div>
        <div class="produk-nama">${escapeHtml(p.nama)}</div>
        <div class="produk-meta"><span class="produk-harga">${formatRupiah(harga)}</span></div>
      </div>
    </a>`;
  }).join('');
}

function scrollToGrid() {
  document.getElementById('gridAnchor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ════════════════════════════════════════════════════════
// DETAIL PRODUK
// ════════════════════════════════════════════════════════

async function renderDetailProduk(produkId) {
  const container = document.getElementById('pdpContainer');
  AppState.selectedVarian = null;
  AppState.qty = 1;

  // Foto, nama, dan harga sudah kita punya dari katalog — tampilkan lebih dulu
  // supaya halaman langsung terisi, sementara varian & deskripsi menyusul.
  const ringkas = AppState.katalog.find(p => p.produkId === produkId);
  const adaTampilanAwal = !!ringkas;
  if (ringkas) {
    drawPDP({
      produkId: ringkas.produkId,
      nama: ringkas.nama,
      deskripsi: '',
      kategori: ringkas.kategori,
      harga: ringkas.harga,
      fotos: ringkas.fotoUtama ? [ringkas.fotoUtama] : [],
      tipeJual: ringkas.tipeJual,
      status: ringkas.status,
      varian: [],
      po: ringkas.po,
      _memuat: true
    });
  } else {
    container.innerHTML = skeletonBlock(420);
  }

  const res = await Api.produk(produkId);
  if (!res.success) {
    // Kalau foto/nama/harga sudah tampil dari katalog, jangan dihapus hanya
    // karena pengambilan varian gagal — cukup beri tahu dan sediakan tombol ulang.
    if (adaTampilanAwal) {
      const tombol = container.querySelector('.pdp-info .btn-primary');
      if (tombol) {
        tombol.textContent = 'Muat Ulang Pilihan Ukuran';
        tombol.disabled = false;
        tombol.setAttribute('onclick', `renderDetailProduk('${escapeJs(produkId)}')`);
      }
      showToast(res.message, 'warning');
      return;
    }
    container.innerHTML = `<div class="empty-state">
      <p>${escapeHtml(res.message)}</p>
      <a class="btn btn-secondary mt-2" href="#/katalog">Kembali ke Katalog</a>
    </div>`;
    return;
  }

  AppState.currentProduk = res.data;
  drawPDP(res.data);
}

function drawPDP(p) {
  const isPO = p.tipeJual === 'PO';
  const harga = isPO && p.po ? p.po.hargaPO : p.harga;
  const fotos = p.fotos && p.fotos.length ? p.fotos : [];

  const mainMedia = fotos.length
    ? `<img id="pdpMainImg" src="${escapeHtml(fotos[0])}" alt="${escapeHtml(p.nama)}">`
    : `<div class="no-photo" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">NO SUBSTRATE INDEXED</div>`;

  const thumbsHtml = fotos.length > 1
    ? `<div class="pdp-thumbs">${fotos.map((f, i) =>
        `<div class="pdp-thumb ${i === 0 ? 'active' : ''}" onclick="switchPdpThumb(${i})">
           <img src="${escapeHtml(f)}" alt="">
         </div>`).join('')}</div>`
    : '';

  let poBox = '';
  if (isPO && p.po) {
    const pct = p.po.kuotaPO > 0 ? Math.min(100, (p.po.jumlahMasuk / p.po.kuotaPO) * 100) : 0;
    poBox = `<div class="po-info-box">
      <div class="flex-between">
        <span class="label-lg" style="color:#5B8DEF;">[ PRE-ORDER ]</span>
        <span class="mono">Sisa ${p.po.sisaKuota}/${p.po.kuotaPO}</span>
      </div>
      <div class="po-progress"><div style="width:${pct}%;"></div></div>
      <div class="text-muted">Tutup: ${formatTanggal(p.po.tanggalTutup)}</div>
    </div>`;
  } else if (isPO && !p.po) {
    poBox = `<div class="form-error">Periode Pre-Order untuk produk ini sedang tidak dibuka.</div>`;
  }

  const varianArea = !isPO
    ? `<div class="field-group">
         <label class="label">Pilih Ukuran / Varian</label>
         <div class="swatch-row" id="varianSwatchRow">
           ${p._memuat
             ? `<div class="skeleton" style="height:42px;width:120px;"></div>
                <div class="skeleton" style="height:42px;width:120px;"></div>`
             : p.varian.length
               ? p.varian.map(v => `<button class="swatch" data-vid="${escapeHtml(v.varianId)}"
                   onclick="selectVarian('${escapeJs(v.varianId)}')" ${v.stok <= 0 ? 'disabled' : ''}>
                   ${escapeHtml(v.ukuran)} / ${escapeHtml(v.warna)}${v.stok <= 0 ? ' (Habis)' : ''}
                 </button>`).join('')
               : '<span class="text-muted">Belum ada varian tersedia.</span>'}
         </div>
       </div>`
    : `<div class="form-hint">Pre-Order dihitung per unit dari kuota batch — tidak perlu memilih stok varian.</div>`;

  const bisaBeli = p._memuat ? false
    : isPO ? !!(p.po && p.po.sisaKuota > 0)
    : p.varian.some(v => v.stok > 0);
  const labelTombol = p._memuat ? 'Memuat pilihan…' : bisaBeli ? 'Tambah ke Keranjang' : 'Stok Habis';

  document.getElementById('pdpContainer').innerHTML = `
    <div class="pdp-grid">
      <div class="pdp-gallery">
        <div class="pdp-media-main">${mainMedia}</div>
        ${thumbsHtml}
      </div>
      <div class="pdp-info">
        <div><span class="badge ${isPO ? 'badge-po' : 'badge-live'}">${isPO ? '[PRE-ORDER]' : '[LIVE]'}</span></div>
        <h1 class="pdp-title">${escapeHtml(p.nama)}</h1>
        <div class="pdp-price">${formatRupiah(harga)}</div>
        <p class="pdp-desc">${escapeHtml(p.deskripsi || '')}</p>
        ${poBox}
        ${varianArea}
        <div class="field-group">
          <label class="label" for="qtyInput">Jumlah</label>
          <div class="qty-control">
            <button type="button" onclick="changeQty(-1)" aria-label="Kurangi">−</button>
            <input type="text" id="qtyInput" inputmode="numeric" autocomplete="off" value="1" onchange="setQty(this.value)">
            <button type="button" onclick="changeQty(1)" aria-label="Tambah">+</button>
          </div>
        </div>
        <button class="btn btn-primary btn-block" onclick="handleAddToCart()" ${bisaBeli ? '' : 'disabled'}>
          ${labelTombol}
        </button>
      </div>
    </div>`;
}

function switchPdpThumb(i) {
  const p = AppState.currentProduk;
  document.querySelectorAll('.pdp-thumb').forEach((el, idx) => el.classList.toggle('active', idx === i));
  document.getElementById('pdpMainImg').src = p.fotos[i];
}

function selectVarian(varianId) {
  AppState.selectedVarian = varianId;
  document.querySelectorAll('#varianSwatchRow .swatch')
    .forEach(el => el.classList.toggle('active', el.dataset.vid === varianId));
}

function changeQty(delta) {
  setQty(Number(document.getElementById('qtyInput').value) + delta);
}

function setQty(v) {
  const n = Math.max(1, parseInt(v, 10) || 1);
  AppState.qty = n;
  document.getElementById('qtyInput').value = n;
}

function handleAddToCart() {
  const p = AppState.currentProduk;
  if (!p) return;
  const isPO = p.tipeJual === 'PO';

  if (!isPO && !AppState.selectedVarian) {
    showToast('Pilih ukuran/varian terlebih dahulu.', 'warning');
    return;
  }

  let varianObj = null;
  let stokTersedia;
  if (isPO) {
    stokTersedia = p.po ? p.po.sisaKuota : 0;
  } else {
    varianObj = p.varian.find(v => v.varianId === AppState.selectedVarian);
    stokTersedia = varianObj ? varianObj.stok : 0;
  }

  // Hitung juga yang sudah ada di keranjang agar tidak melebihi stok
  const kunci = cart.key(p.produkId, isPO ? null : AppState.selectedVarian);
  const sudahDiKeranjang = cart.items
    .filter(i => cart.key(i.produkId, i.varianId) === kunci)
    .reduce((s, i) => s + i.jumlah, 0);

  if (AppState.qty + sudahDiKeranjang > stokTersedia) {
    const sisa = Math.max(0, stokTersedia - sudahDiKeranjang);
    showToast(sisa === 0
      ? 'Semua stok yang tersedia sudah ada di keranjang Anda.'
      : `Hanya tersisa ${sisa} unit lagi yang bisa ditambahkan.`, 'warning');
    return;
  }

  cart.add({
    produkId: p.produkId,
    varianId: isPO ? null : varianObj.varianId,
    nama: p.nama,
    ukuran: isPO ? '-' : varianObj.ukuran,
    warna: isPO ? '-' : varianObj.warna,
    tipeJual: p.tipeJual,
    harga: isPO && p.po ? p.po.hargaPO : p.harga,
    jumlah: AppState.qty
  });

  showToast(`${p.nama} ditambahkan ke keranjang.`, 'success');
}

// ════════════════════════════════════════════════════════
// KERANJANG
// ════════════════════════════════════════════════════════

function renderKeranjang() {
  const container = document.getElementById('cartContainer');
  if (!container) return;
  document.getElementById('cartCountLabel').textContent = `${cart.count()} ITEM`;

  if (!cart.items.length) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-2 5h13"/></svg>
      <p>Keranjang masih kosong.</p>
      <a class="btn btn-primary mt-2" href="#/katalog">Mulai Belanja</a>
    </div>`;
    return;
  }

  const itemsHtml = cart.items.map(it => {
    const ref = AppState.katalog.find(p => p.produkId === it.produkId);
    const foto = ref ? ref.fotoUtama : '';
    const vid = escapeJs(it.varianId || '');
    const pid = escapeJs(it.produkId);
    return `<div class="cart-item">
      <div class="thumb">${foto ? `<img src="${escapeHtml(foto)}" alt="">` : ''}</div>
      <div>
        <div class="nm">${escapeHtml(it.nama)}</div>
        <div class="attrs">${escapeHtml(it.ukuran)} / ${escapeHtml(it.warna)}${it.tipeJual === 'PO' ? ' // PO' : ''}</div>
        <div class="qty-mini">
          <button onclick="cart.updateQty('${pid}','${vid}', ${it.jumlah - 1})" aria-label="Kurangi">−</button>
          <span class="mono">${it.jumlah}</span>
          <button onclick="cart.updateQty('${pid}','${vid}', ${it.jumlah + 1})" aria-label="Tambah">+</button>
        </div>
      </div>
      <div>
        <div class="price">${formatRupiah(it.harga * it.jumlah)}</div>
        <button class="remove-btn" onclick="cart.remove('${pid}','${vid}')">Hapus</button>
      </div>
    </div>`;
  }).join('');

  const ongkir = AppState.config.ongkir || 0;
  container.innerHTML = `
    <div class="card">${itemsHtml}</div>
    <div class="summary-box mt-3">
      <div class="card-body">
        <div class="cart-summary-row"><span>Subtotal</span><span>${formatRupiah(cart.total())}</span></div>
        <div class="cart-summary-row"><span>Ongkos Kirim</span><span>${formatRupiah(ongkir)}</span></div>
        <div class="cart-summary-row total"><span>Total</span><span>${formatRupiah(cart.total() + ongkir)}</span></div>
      </div>
    </div>
    <div class="sticky-bottom-bar">
      <a class="btn btn-secondary" href="#/katalog">Lanjut Belanja</a>
      <a class="btn btn-primary btn-block" href="#/checkout">Checkout &rarr;</a>
    </div>`;
}

// ════════════════════════════════════════════════════════
// CHECKOUT (3 langkah)
// ════════════════════════════════════════════════════════

const CheckoutState = { step: 1, buyer: {} };

function initCheckout() {
  if (!cart.items.length) {
    showToast('Keranjang kosong, tidak bisa checkout.', 'warning');
    location.hash = '#/katalog';
    return;
  }
  CheckoutState.step = 1;
  CheckoutState.buyer = Draft.load();
  drawCheckoutStep();
}

function updateStepperUI() {
  document.querySelectorAll('.step').forEach(el => {
    const n = Number(el.dataset.step);
    el.classList.toggle('active', n === CheckoutState.step);
    el.classList.toggle('done', n < CheckoutState.step);
  });
}

function drawCheckoutStep() {
  updateStepperUI();
  const container = document.getElementById('checkoutContainer');
  const b = CheckoutState.buyer;

  if (CheckoutState.step === 1) {
    container.innerHTML = `
      <div class="form-field"><label for="ckNama">Nama Lengkap <span class="req">*</span></label>
        <input type="text" id="ckNama" value="${escapeHtml(b.nama || '')}" placeholder="Nama penerima"></div>
      <div class="form-field"><label for="ckWA">Nomor WhatsApp <span class="req">*</span></label>
        <input type="tel" id="ckWA" value="${escapeHtml(b.whatsapp || '')}" placeholder="08xx xxxx xxxx"></div>
      <div class="form-field"><label for="ckEmail">Email (untuk notifikasi pesanan)</label>
        <input type="email" id="ckEmail" value="${escapeHtml(b.email || '')}" placeholder="nama@email.com"></div>
      <div class="sticky-bottom-bar">
        <button class="btn btn-primary btn-block" onclick="goCheckoutStep(2)">Lanjut ke Pengiriman &rarr;</button>
      </div>`;

  } else if (CheckoutState.step === 2) {
    container.innerHTML = `
      <div class="form-field"><label for="ckAlamat">Alamat Lengkap Pengiriman <span class="req">*</span></label>
        <textarea id="ckAlamat" placeholder="Jl. Contoh No. 1, Denpasar, Bali 80111">${escapeHtml(b.alamat || '')}</textarea></div>
      <div class="form-hint">Ongkos kirim flat ${formatRupiah(AppState.config.ongkir)} ditetapkan admin komunitas.</div>
      <div class="sticky-bottom-bar">
        <button class="btn btn-secondary" onclick="goCheckoutStep(1)">&larr; Kembali</button>
        <button class="btn btn-primary btn-block" onclick="goCheckoutStep(3)">Lanjut ke Pembayaran &rarr;</button>
      </div>`;

  } else {
    const metodeList = (AppState.config.banks || []).map(x => 'Transfer ' + x.bank);
    if (!metodeList.length) metodeList.push('Transfer Bank');
    const ongkir = AppState.config.ongkir || 0;

    container.innerHTML = `
      <div class="form-field">
        <label>Metode Pembayaran <span class="req">*</span></label>
        <div class="radio-row" id="metodeRow">
          ${metodeList.map(m => `
            <label class="radio-card ${b.metodeBayar === m ? 'active' : ''}" onclick="selectMetodeBayar(this,'${escapeJs(m)}')">
              <input type="radio" name="metodeBayar" ${b.metodeBayar === m ? 'checked' : ''}> ${escapeHtml(m)}
            </label>`).join('')}
        </div>
      </div>
      <div class="summary-box">
        <div class="card-strip"><span>Ringkasan Pesanan</span><span>${cart.count()} ITEM</span></div>
        <div class="card-body">
          ${cart.items.map(it => `<div class="cart-summary-row">
            <span>${escapeHtml(it.nama)} (${escapeHtml(it.ukuran)}) x${it.jumlah}</span>
            <span>${formatRupiah(it.harga * it.jumlah)}</span></div>`).join('')}
          <div class="cart-summary-row"><span>Ongkos Kirim</span><span>${formatRupiah(ongkir)}</span></div>
          <div class="cart-summary-row total"><span>Total Bayar</span><span>${formatRupiah(cart.total() + ongkir)}</span></div>
        </div>
      </div>
      <div class="sticky-bottom-bar">
        <button class="btn btn-secondary" onclick="goCheckoutStep(2)">&larr; Kembali</button>
        <button class="btn btn-primary btn-block" id="btnSubmitOrder" onclick="submitCheckout()">Buat Pesanan</button>
      </div>`;
  }
}

function selectMetodeBayar(el, m) {
  CheckoutState.buyer.metodeBayar = m;
  document.querySelectorAll('#metodeRow .radio-card').forEach(x => x.classList.remove('active'));
  el.classList.add('active');
  const radio = el.querySelector('input');
  if (radio) radio.checked = true;
}

function goCheckoutStep(n) {
  if (CheckoutState.step === 1) {
    const nama = document.getElementById('ckNama').value.trim();
    const wa = document.getElementById('ckWA').value.trim();
    if (!nama || !wa) { showToast('Nama dan WhatsApp wajib diisi.', 'warning'); return; }
    CheckoutState.buyer.nama = nama;
    CheckoutState.buyer.whatsapp = wa;
    CheckoutState.buyer.email = document.getElementById('ckEmail').value.trim();
  } else if (CheckoutState.step === 2) {
    const alamat = document.getElementById('ckAlamat').value.trim();
    if (!alamat) { showToast('Alamat pengiriman wajib diisi.', 'warning'); return; }
    CheckoutState.buyer.alamat = alamat;
  }
  Draft.save(CheckoutState.buyer);
  CheckoutState.step = n;
  drawCheckoutStep();
}

async function submitCheckout() {
  if (!CheckoutState.buyer.metodeBayar) {
    showToast('Pilih metode pembayaran.', 'warning');
    return;
  }
  const pulihkan = busyButton(document.getElementById('btnSubmitOrder'), 'Memproses...');

  const res = await Api.checkout(CheckoutState.buyer, cart.items);
  pulihkan();

  if (!res.success) { showToast(res.message, 'danger'); return; }

  AppState.lastOrder = res.data;
  cart.clear();
  Draft.clear();
  // Stok baru saja berkurang di server → buang salinan lama supaya angka stok
  // yang ditampilkan setelah ini benar-benar terbaru.
  AppState.katalog = [];
  KatalogCache.clear();

  renderKonfirmasi(res.data);
  location.hash = '#/konfirmasi';
  showToast('Pesanan berhasil dibuat!', 'success');
}

// ════════════════════════════════════════════════════════
// KONFIRMASI PESANAN + UPLOAD BUKTI
// ════════════════════════════════════════════════════════

function renderKonfirmasi(order) {
  const container = document.getElementById('konfirmasiContainer');

  if (!order) {
    container.innerHTML = `<div class="empty-state">
      <p>Tidak ada pesanan yang baru dibuat pada sesi ini.</p>
      <a class="btn btn-primary mt-2" href="#/status">Cek Status Pesanan</a>
    </div>`;
    return;
  }

  const banksHtml = (order.banks || []).map(b => `
    <div class="bank-card">
      <div>
        <div class="b-name">${escapeHtml(b.bank)}</div>
        <div class="b-no mono">${escapeHtml(b.rekening)}</div>
        <div class="text-muted" style="font-size:10px;">a.n. ${escapeHtml(b.atasNama)}</div>
      </div>
      <button class="copy-btn" onclick="copyToClipboard('${escapeJs(b.rekening)}')">Salin</button>
    </div>`).join('');

  container.innerHTML = `
    <div class="confirm-banner reg-mark mt-3">
      <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
      <div>
        <h3 style="font-size:1.1rem;">Pesanan Diterima</h3>
        <p class="text-muted mt-1 small">Simpan nomor pesanan ini untuk melacak status &amp; mengunggah bukti transfer.</p>
      </div>
    </div>

    <div class="order-code-box">
      <span>${escapeHtml(order.nomorPesanan)}</span>
      <button class="copy-btn" onclick="copyToClipboard('${escapeJs(order.nomorPesanan)}')">Salin</button>
    </div>

    <div class="summary-box mb-2">
      <div class="card-strip">Rincian Pembayaran</div>
      <div class="card-body">
        <div class="cart-summary-row"><span>Subtotal</span><span>${formatRupiah(order.totalHarga)}</span></div>
        <div class="cart-summary-row"><span>Ongkos Kirim</span><span>${formatRupiah(order.ongkir)}</span></div>
        <div class="cart-summary-row total"><span>Total Bayar</span><span>${formatRupiah(order.totalBayar)}</span></div>
      </div>
    </div>

    <div class="section-head"><h2 style="font-size:1rem;">Transfer Ke</h2></div>
    ${banksHtml}

    <div class="section-head"><h2 style="font-size:1rem;">Unggah Bukti Pembayaran</h2></div>
    ${blokUploadBukti(order.nomorPesanan, 'konfirmasi')}

    <a class="btn btn-secondary btn-block mt-2" href="#/status">Cek Status Pesanan</a>`;
}

/** Blok dropzone upload yang dipakai ulang di halaman konfirmasi & status. */
function blokUploadBukti(nomorPesanan, ctx) {
  return `
    <div class="dropzone" onclick="document.getElementById('fileBukti_${ctx}').click()">
      <svg viewBox="0 0 24 24"><path d="M12 4v12m0-12l4 4m-4-4l-4 4M4 20h16"/></svg>
      <span>Klik untuk memilih foto bukti transfer (JPG/PNG)</span>
      <input type="file" id="fileBukti_${ctx}" accept="image/*" hidden
             onchange="pilihBukti(this,'${escapeJs(ctx)}')">
      <img id="buktiPreview_${ctx}" class="preview-thumb" hidden alt="Pratinjau bukti">
    </div>
    <button class="btn btn-primary btn-block mt-2" id="btnUploadBukti_${ctx}"
            onclick="submitBuktiBayar('${escapeJs(nomorPesanan)}','${escapeJs(ctx)}')" disabled>
      Unggah Bukti Pembayaran
    </button>`;
}

const BuktiTerpilih = {};

async function pilihBukti(input, ctx) {
  const file = input.files[0];
  if (!file) return;
  if (!cekUkuranFile(file)) { input.value = ''; return; }

  try {
    const hasil = await compressImage(file);
    BuktiTerpilih[ctx] = hasil;
    const img = document.getElementById('buktiPreview_' + ctx);
    img.src = hasil.dataUrl;
    img.hidden = false;
    document.getElementById('btnUploadBukti_' + ctx).disabled = false;
  } catch (e) {
    showToast(e.message, 'danger');
    input.value = '';
  }
}

async function submitBuktiBayar(nomorPesanan, ctx) {
  const berkas = BuktiTerpilih[ctx];
  if (!berkas) { showToast('Pilih file bukti pembayaran dahulu.', 'warning'); return; }

  const btn = document.getElementById('btnUploadBukti_' + ctx);
  const pulihkan = busyButton(btn, 'Mengunggah...');

  const res = await Api.uploadBukti(nomorPesanan, berkas.base64, berkas.name, berkas.mime);
  pulihkan();

  if (!res.success) { showToast(res.message, 'danger'); return; }

  showToast('Bukti pembayaran terunggah. Menunggu verifikasi admin.', 'success');
  btn.textContent = 'Bukti Terunggah ✓';
  btn.disabled = true;
  delete BuktiTerpilih[ctx];

  if (ctx === 'status') cariStatusPesanan();
}

// ════════════════════════════════════════════════════════
// CEK STATUS PESANAN
// ════════════════════════════════════════════════════════

function renderStatusForm(nomorAwal) {
  document.getElementById('statusContainer').innerHTML = `
    <div class="form-field"><label for="statusInput">Nomor Pesanan</label>
      <input type="text" id="statusInput" placeholder="cth. BSC-260913-1234" value="${escapeHtml(nomorAwal || '')}"></div>
    <button class="btn btn-primary btn-block" onclick="cariStatusPesanan()">Cari Pesanan</button>
    <div id="statusResult" class="mt-3"></div>`;

  const input = document.getElementById('statusInput');
  input.addEventListener('keydown', e => { if (e.key === 'Enter') cariStatusPesanan(); });
  if (nomorAwal) cariStatusPesanan();
}

async function cariStatusPesanan() {
  const nomor = document.getElementById('statusInput').value.trim();
  if (!nomor) { showToast('Masukkan nomor pesanan.', 'warning'); return; }

  const box = document.getElementById('statusResult');
  box.innerHTML = skeletonBlock(220);

  const res = await Api.statusPesanan(nomor);
  if (!res.success) {
    box.innerHTML = `<div class="empty-state">${escapeHtml(res.message)}</div>`;
    return;
  }
  drawStatusResult(res.data);
}

function drawStatusResult(o) {
  const langkah = ['Baru', 'Diproses', 'Dikirim', 'Selesai'];
  const idxSekarang = langkah.indexOf(o.statusPesanan);
  const dibatalkan = o.statusPesanan === 'Dibatalkan';

  const timelineHtml = dibatalkan
    ? `<div class="tl-item current"><div class="tl-dot"></div><div class="tl-content"><div class="t">Dibatalkan</div></div></div>`
    : langkah.map((s, i) => {
        const cls = i < idxSekarang ? 'done' : i === idxSekarang ? 'current' : '';
        return `<div class="tl-item ${cls}"><div class="tl-dot"></div>
          <div class="tl-content"><div class="t">${s}</div></div></div>`;
      }).join('');

  const badgeBayar = o.statusPembayaran === 'Terverifikasi' ? 'badge-success'
    : o.statusPembayaran === 'Menunggu Verifikasi' ? 'badge-warning' : 'badge-error';

  const itemsHtml = o.items.map(it => `<div class="cart-summary-row">
    <span>${escapeHtml(it.nama)} (${escapeHtml(it.ukuran)}/${escapeHtml(it.warna)}) x${it.jumlah}</span>
    <span>${formatRupiah(it.subtotal)}</span></div>`).join('');

  const buktiHtml = o.buktiUrl
    ? `<div class="section-head"><h2 style="font-size:1rem;">Bukti Terunggah</h2></div>
       <img src="${escapeHtml(o.buktiUrl)}" class="preview-thumb" alt="Bukti pembayaran">`
    : '';

  const uploadHtml = o.statusPembayaran !== 'Terverifikasi'
    ? `<div class="section-head"><h2 style="font-size:1rem;">${o.buktiUrl ? 'Ganti' : 'Unggah'} Bukti Bayar</h2></div>
       ${blokUploadBukti(o.nomorPesanan, 'status')}`
    : '';

  document.getElementById('statusResult').innerHTML = `
    <div class="order-code-box">
      <span>${escapeHtml(o.nomorPesanan)}</span>
      <span class="badge ${badgeBayar}">${escapeHtml(o.statusPembayaran)}</span>
    </div>
    <div class="summary-box mb-2">
      <div class="card-strip"><span>Item Pesanan</span><span>${formatTanggal(o.tanggal)}</span></div>
      <div class="card-body">
        ${itemsHtml}
        <div class="cart-summary-row"><span>Ongkos Kirim</span><span>${formatRupiah(o.ongkir)}</span></div>
        <div class="cart-summary-row total"><span>Total Bayar</span><span>${formatRupiah(o.totalBayar)}</span></div>
      </div>
    </div>
    <div class="section-head"><h2 style="font-size:1rem;">Lacak Pesanan</h2></div>
    <div class="timeline mt-2">${timelineHtml}</div>
    ${buktiHtml}
    ${uploadHtml}`;
}
