'use strict';

/* ==========================================================
   SAKUKU — Konstanta & fungsi bantuan (util)
   ========================================================== */

const STORAGE_KEYS = {
  EXPENSES: 'sakuku_expenses',
  BOOKMARKS: 'sakuku_bookmarks',
  HIGH_SCORE: 'sakuku_quiz_highscore',
  ACTIVE_TAB: 'sakuku_active_tab',
};

const EXPENSE_CATEGORIES = [
  'Makanan & Minuman',
  'Transportasi',
  'Hiburan',
  'Tagihan',
  'Belanja',
  'Pendidikan',
  'Lainnya',
];

const $ = (sel, scope = document) => scope.querySelector(sel);
const $all = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

const rupiah = (angka) => 'Rp' + Math.round(angka || 0).toLocaleString('id-ID');

// Menggunakan API UUID standar (Best Practice) atau fallback ke acak sederhana
const buatId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
};

function formatTanggal(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function bacaLocalStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Gagal membaca "${key}" dari localStorage:`, err);
    return fallback;
  }
}

function simpanLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Gagal menyimpan "${key}" ke localStorage:`, err);
  }
}

/* ==========================================================
   STATE APLIKASI
   ========================================================== */

let expenses = bacaLocalStorage(STORAGE_KEYS.EXPENSES, []);
let bookmarks = bacaLocalStorage(STORAGE_KEYS.BOOKMARKS, []);
let pendingDelete = null; 

/* ==========================================================
   NAVIGASI TAB
   ========================================================== */

function pindahTab(nama) {
  $all('.tab-btn').forEach((btn) => {
    const aktif = btn.dataset.tab === nama;
    btn.classList.toggle('is-active', aktif);
    btn.setAttribute('aria-selected', aktif ? 'true' : 'false');
  });
  $all('[data-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.panel !== nama);
  });
  simpanLocalStorage(STORAGE_KEYS.ACTIVE_TAB, nama);
}

function initTabs() {
  $all('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => pindahTab(btn.dataset.tab));
  });
  const tabTersimpan = bacaLocalStorage(STORAGE_KEYS.ACTIVE_TAB, 'expense');
  pindahTab(tabTersimpan);
}

/* ==========================================================
   MODAL — Fokus Trap (Aksesibilitas)
   ========================================================== */

let previouslyFocusedElement = null;

function bukaModal(modalEl) {
  previouslyFocusedElement = document.activeElement;
  modalEl.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  
  // Arahkan fokus ke input atau tombol pertama untuk memandu Screen Reader
  const focusable = modalEl.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable) {
    setTimeout(() => focusable.focus(), 50);
  }
}

function tutupModal(modalEl) {
  modalEl.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  
  // Kembalikan fokus ke elemen sebelumnya (tombol Edit/Delete) 
  if (previouslyFocusedElement) {
    previouslyFocusedElement.focus();
  }
}

function bukaKonfirmasiHapus(pesan, onConfirm) {
  $('#modal-confirm-message').textContent = pesan;
  pendingDelete = onConfirm;
  bukaModal($('#modal-confirm'));
}

function initModal() {
  $all('.modal').forEach((modal) => {     modal.addEventListener('click', (e) => {       if (e.target === modal) tutupModal(modal);     });   });$all('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', () => {
      const modal = el.closest('.modal');
      if (modal) tutupModal(modal);
    });
  });
  $('#modal-confirm-btn').addEventListener('click', () => {
    if (typeof pendingDelete === 'function') pendingDelete();
    pendingDelete = null;
    tutupModal($('#modal-confirm'));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $all('.modal:not(.hidden)').forEach((modal) => tutupModal(modal));
    }
  });
}

function initKategoriSelect() {
  const isiOpsi = (select, sertakanSemua) => {
    if (sertakanSemua) {
      const opt = document.createElement('option');
      opt.value = 'all';
      opt.textContent = 'Semua kategori';
      select.appendChild(opt);
    }
    EXPENSE_CATEGORIES.forEach((kategori) => {
      const opt = document.createElement('option');
      opt.value = kategori;
      opt.textContent = kategori;
      select.appendChild(opt);
    });
  };
  isiOpsi($('#expense-category'), false);
  isiOpsi($('#expense-filter-category'), true);
  isiOpsi($('#edit-expense-category'), false);
}

/* ==========================================================
   FITUR 1 — EXPENSE TRACKER
   ========================================================== */

function tambahExpense(data) {
  expenses.push({ id: buatId(), createdAt: Date.now(), ...data });
  simpanLocalStorage(STORAGE_KEYS.EXPENSES, expenses);
  renderExpenses();
}

function updateExpense(id, data) {
  expenses = expenses.map((t) => (t.id === id ? { ...t, ...data } : t));
  simpanLocalStorage(STORAGE_KEYS.EXPENSES, expenses);
  renderExpenses();
}

function hapusExpense(id) {
  expenses = expenses.filter((t) => t.id !== id);
  simpanLocalStorage(STORAGE_KEYS.EXPENSES, expenses);
  renderExpenses();
}

function ambilExpenseTersaring() {
  const kataKunci = $('#expense-search').value.trim().toLowerCase();
  const tipe = $('#expense-filter-type').value;
  const kategori = $('#expense-filter-category').value;
  const urutan = $('#expense-sort').value;

  let hasil = expenses.filter((t) => {
    const cocokKata = t.title.toLowerCase().includes(kataKunci);
    const cocokTipe = tipe === 'all' || t.type === tipe;
    const cocokKategori = kategori === 'all' || t.category === kategori;
    return cocokKata && cocokTipe && cocokKategori;
  });

  switch (urutan) {
    case 'oldest':
      hasil.sort((a, b) => new Date(a.date) - new Date(b.date) || a.createdAt - b.createdAt);
      break;
    case 'amount-desc':
      hasil.sort((a, b) => b.amount - a.amount);
      break;
    case 'amount-asc':
      hasil.sort((a, b) => a.amount - b.amount);
      break;
    default: // 'newest'
      hasil.sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);
  }
  return hasil;
}

function renderRingkasanExpense() {
  const totalMasuk = expenses.filter((t) => t.type === 'income').reduce((jumlah, t) => jumlah + t.amount, 0);
  const totalKeluar = expenses.filter((t) => t.type === 'expense').reduce((jumlah, t) => jumlah + t.amount, 0);
  $('#summary-income').textContent = rupiah(totalMasuk);
  $('#summary-expense').textContent = rupiah(totalKeluar);
  $('#summary-balance').textContent = rupiah(totalMasuk - totalKeluar);
}

function buatBadgeTipe(tipe) {
  const label = tipe === 'income' ? 'Pemasukan' : 'Pengeluaran';
  const warna = tipe === 'income' ? 'bg-sage/15 text-sage' : 'bg-clay/15 text-clay';
  return `<span class="badge ${warna}">${label}</span>`;
}

function renderExpenses() {
  renderRingkasanExpense();

  const list = $('#expense-list');
  const data = ambilExpenseTersaring();
  list.innerHTML = '';

  $('#expense-empty').classList.toggle('hidden', expenses.length !== 0);
  $('#expense-empty-filtered').classList.toggle('hidden', !(expenses.length > 0 && data.length === 0));

  // Menggunakan DocumentFragment untuk performa DOM yang lebih optimal
  const fragment = document.createDocumentFragment();

  data.forEach((t) => {
    const baris = document.createElement('div');
    baris.className = 'expense-row';
    baris.innerHTML = `
      <div class="min-w-0 flex-1">
        <p class="font-medium text-ink truncate">${escapeHTML(t.title)}</p>
        <p class="text-sm text-ink/60">${escapeHTML(t.category)} · ${formatTanggal(t.date)}</p>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        ${buatBadgeTipe(t.type)}
        <span class="font-display text-base ${t.type === 'income' ? 'text-sage' : 'text-clay'}">
          ${t.type === 'income' ? '+' : '-'}${rupiah(t.amount)}
        </span>
        <button type="button" class="icon-btn" data-action="edit-expense" data-id="${t.id}" aria-label="Ubah transaksi ${escapeHTML(t.title)}">
          <i class="ti ti-pencil" aria-hidden="true"></i>
        </button>
        <button type="button" class="icon-btn" data-action="delete-expense" data-id="${t.id}" aria-label="Hapus transaksi ${escapeHTML(t.title)}">
          <i class="ti ti-trash" aria-hidden="true"></i>
        </button>
      </div>`;
    fragment.appendChild(baris);
  });
  
  list.appendChild(fragment);
}

function validasiExpenseForm(form) {
  const errorEl = form.querySelector('.form-error');
  const title = form.title.value.trim();
  const category = form.category.value;
  const type = form.type.value;
  const date = form.date.value;
  const amount = parseFloat(form.amount.value);

  if (!title || !category || !date) {
    errorEl.textContent = 'Semua kolom wajib diisi.';
    return null;
  }
  if (isNaN(amount) || amount <= 0) {
    errorEl.textContent = 'Jumlah harus berupa angka lebih dari 0.';
    return null;
  }
  errorEl.textContent = '';
  return { title, category, type, date, amount };
}

function initFormExpense() {
  const form = $('#form-expense');
  $('#expense-date').valueAsDate = new Date();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = validasiExpenseForm(form);
    if (!data) return;
    tambahExpense(data);
    form.reset();
    $('#expense-date').valueAsDate = new Date();
  });
}

function bukaEditExpense(id) {
  const t = expenses.find((x) => x.id === id);
  if (!t) return;
  const modal = $('#modal-expense-edit');
  $('#edit-expense-id').value = t.id;
  modal.querySelector('#edit-expense-title').value = t.title;
  modal.querySelector('#edit-expense-category').value = t.category;
  modal.querySelector('#edit-expense-type').value = t.type;
  modal.querySelector('#edit-expense-amount').value = t.amount;
  modal.querySelector('#edit-expense-date').value = t.date;
  modal.querySelector('.form-error').textContent = '';
  bukaModal(modal);
}

function initFormEditExpense() {
  const form = $('#form-expense-edit');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = validasiExpenseForm(form);
    if (!data) return;
    updateExpense($('#edit-expense-id').value, data);
    tutupModal($('#modal-expense-edit'));
  });
}

function initDaftarExpenseEvents() {
  $('#expense-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit-expense') {
      bukaEditExpense(id);
    } else if (btn.dataset.action === 'delete-expense') {
      const t = expenses.find((x) => x.id === id);
      if (t) bukaKonfirmasiHapus(`Hapus transaksi "${t.title}"?`, () => hapusExpense(id));
    }
  });
}

function initFilterExpense() {
  ['#expense-search', '#expense-filter-type', '#expense-filter-category', '#expense-sort'].forEach((sel) => {
    $(sel).addEventListener('input', renderExpenses);
  });
}

/* ==========================================================
   FITUR 2 — BOOKMARK MANAGER
   ========================================================== */

function isURLValid(url) {
  return /^https?:\/\/.+/i.test(url.trim());
}

function tambahBookmark(data) {
  bookmarks.push({ id: buatId(), createdAt: Date.now(), ...data });
  simpanLocalStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);
  renderBookmarks();
}

function updateBookmark(id, data) {
  bookmarks = bookmarks.map((b) => (b.id === id ? { ...b, ...data } : b));
  simpanLocalStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);
  renderBookmarks();
}

function hapusBookmark(id) {
  bookmarks = bookmarks.filter((b) => b.id !== id);
  simpanLocalStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);
  renderBookmarks();
}

function ambilBookmarkTersaring() {
  const kataKunci = $('#bookmark-search').value.trim().toLowerCase();
  const urutan = $('#bookmark-sort').value;

  let hasil = bookmarks.filter((b) =>
    b.title.toLowerCase().includes(kataKunci) ||
    b.url.toLowerCase().includes(kataKunci) ||
    b.category.toLowerCase().includes(kataKunci)
  );

  switch (urutan) {
    case 'title-desc':
      hasil.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case 'newest':
      hasil.sort((a, b) => b.createdAt - a.createdAt);
      break;
    default: // 'title-asc'
      hasil.sort((a, b) => a.title.localeCompare(b.title));
  }
  return hasil;
}

function renderBookmarks() {
  const list = $('#bookmark-list');
  const data = ambilBookmarkTersaring();
  list.innerHTML = '';

  $('#bookmark-empty').classList.toggle('hidden', bookmarks.length !== 0);
  $('#bookmark-empty-filtered').classList.toggle('hidden', !(bookmarks.length > 0 && data.length === 0));

  // Menggunakan DocumentFragment
  const fragment = document.createDocumentFragment();

  data.forEach((b) => {
    const kartu = document.createElement('div');
    kartu.className = 'bookmark-card';
    kartu.innerHTML = `
      <div class="min-w-0 flex-1">
        <a href="${escapeHTML(b.url)}" target="_blank" rel="noopener noreferrer"
           class="font-medium text-tarum hover:underline truncate block">${escapeHTML(b.title)}</a>
        <p class="text-sm text-ink/60 truncate">${escapeHTML(b.url)}</p>
        ${b.note ? `<p class="text-sm text-ink/70 mt-1">${escapeHTML(b.note)}</p>` : ''}
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <span class="badge bg-tarum/10 text-tarum">${escapeHTML(b.category)}</span>
        <button type="button" class="icon-btn" data-action="edit-bookmark" data-id="${b.id}" aria-label="Ubah tautan ${escapeHTML(b.title)}">
          <i class="ti ti-pencil" aria-hidden="true"></i>
        </button>
        <button type="button" class="icon-btn" data-action="delete-bookmark" data-id="${b.id}" aria-label="Hapus tautan ${escapeHTML(b.title)}">
          <i class="ti ti-trash" aria-hidden="true"></i>
        </button>
      </div>`;
    fragment.appendChild(kartu);
  });

  list.appendChild(fragment);
}

function validasiBookmarkForm(form) {
  const errorEl = form.querySelector('.form-error');
  const title = form.title.value.trim();
  const url = form.url.value.trim();
  const category = form.category.value.trim();
  const note = form.note.value.trim();

  if (!title || !url || !category) {
    errorEl.textContent = 'Nama, URL, dan kategori wajib diisi.';
    return null;
  }
  if (!isURLValid(url)) {
    errorEl.textContent = 'URL harus diawali dengan http:// atau https://';
    return null;
  }
  errorEl.textContent = '';
  return { title, url, category, note };
}

function initFormBookmark() {
  const form = $('#form-bookmark');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = validasiBookmarkForm(form);
    if (!data) return;
    tambahBookmark(data);
    form.reset();
  });
}

function bukaEditBookmark(id) {
  const b = bookmarks.find((x) => x.id === id);
  if (!b) return;
  const modal = $('#modal-bookmark-edit');
  $('#edit-bookmark-id').value = b.id;
  modal.querySelector('#edit-bookmark-title').value = b.title;
  modal.querySelector('#edit-bookmark-url').value = b.url;
  modal.querySelector('#edit-bookmark-category').value = b.category;
  modal.querySelector('#edit-bookmark-note').value = b.note || '';
  modal.querySelector('.form-error').textContent = '';
  bukaModal(modal);
}

function initFormEditBookmark() {
  const form = $('#form-bookmark-edit');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = validasiBookmarkForm(form);
    if (!data) return;
    updateBookmark($('#edit-bookmark-id').value, data);
    tutupModal($('#modal-bookmark-edit'));
  });
}

function initDaftarBookmarkEvents() {
  $('#bookmark-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit-bookmark') {
      bukaEditBookmark(id);
    } else if (btn.dataset.action === 'delete-bookmark') {
      const b = bookmarks.find((x) => x.id === id);
      if (b) bukaKonfirmasiHapus(`Hapus tautan "${b.title}"?`, () => hapusBookmark(id));
    }
  });
}

function initFilterBookmark() {
  ['#bookmark-search', '#bookmark-sort'].forEach((sel) => {
    $(sel).addEventListener('input', renderBookmarks);
  });
}

/* ==========================================================
   FITUR 3 — KUIS INTERAKTIF
   ========================================================== */

const QUIZ_QUESTIONS = [
  {
    question: 'Tag HTML apa yang digunakan untuk membuat tautan (hyperlink)?',
    options: ['<link>', '<a>', '<href>', '<nav>'],
    jawaban: 1,
  },
  {
    question: 'Properti CSS apa yang digunakan untuk mengubah warna teks?',
    options: ['background-color', 'text-color', 'color', 'font-color'],
    jawaban: 2,
  },
  {
    question: 'Method array JavaScript mana yang mengembalikan array baru hasil transformasi tiap elemen?',
    options: ['forEach()', 'filter()', 'reduce()', 'map()'],
    jawaban: 3,
  },
  {
    question: 'Apa fungsi utama localStorage pada browser?',
    options: [
      'Mengirim data ke server',
      'Menyimpan data di sisi klien agar tetap ada setelah refresh',
      'Menjalankan animasi CSS',
      'Mengatur tata letak halaman',
    ],
    jawaban: 1,
  },
  {
    question: 'Method JavaScript mana yang mengambil satu elemen pertama yang cocok dengan sebuah CSS selector?',
    options: ['getElementById()', 'querySelectorAll()', 'querySelector()', 'getElementsByClassName()'],
    jawaban: 2,
  },
  {
    question: 'Apa kepanjangan dari DOM?',
    options: ['Document Object Model', 'Data Object Management', 'Display Output Mode', 'Document Oriented Markup'],
    jawaban: 0,
  },
];

const DURASI_PER_SOAL = 15; // detik

let kuis = {
  urutan: [],
  index: 0,
  skor: 0,
  terjawab: false,
  timerId: null,
  sisaWaktu: DURASI_PER_SOAL,
};

function acakArray(arr) {
  const hasil = [...arr];
  for (let i = hasil.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [hasil[i], hasil[j]] = [hasil[j], hasil[i]];
  }
  return hasil;
}

function ambilHighScore() {
  return bacaLocalStorage(STORAGE_KEYS.HIGH_SCORE, 0);
}

function tampilkanLayarKuis(nama) {
  ['start', 'question', 'result'].forEach((n) => {
    $(`#quiz-screen-${n}`).classList.toggle('hidden', n !== nama);
  });
}

function perbaruiTampilanHighScoreAwal() {
  const hs = ambilHighScore();
  $('#quiz-highscore-display').textContent =
    hs > 0 ? `Rekor terbaikmu: ${hs} / ${QUIZ_QUESTIONS.length}` : 'Belum ada rekor. Yuk mulai!';
}

function mulaiKuis() {
  kuis = {
    urutan: acakArray(QUIZ_QUESTIONS),
    index: 0,
    skor: 0,
    terjawab: false,
    timerId: null,
    sisaWaktu: DURASI_PER_SOAL,
  };
  tampilkanLayarKuis('question');
  tampilkanSoal();
}

function tampilkanSoal() {
  clearInterval(kuis.timerId);
  kuis.terjawab = false;
  kuis.sisaWaktu = DURASI_PER_SOAL;

  const soal = kuis.urutan[kuis.index];
  $('#quiz-progress').textContent = `Soal ${kuis.index + 1} dari ${kuis.urutan.length}`;
  $('#quiz-question-text').textContent = soal.question;
  $('#quiz-feedback').textContent = '';
  $('#quiz-feedback').className = 'quiz-feedback';
  $('#btn-quiz-next').disabled = true;

  const optionsEl = $('#quiz-options-list');
  optionsEl.innerHTML = '';
  soal.options.forEach((opsi, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quiz-option';
    btn.textContent = opsi;
    btn.dataset.index = String(i);
    btn.addEventListener('click', () => jawabSoal(i));
    optionsEl.appendChild(btn);
  });

  perbaruiTimerBar();
  kuis.timerId = setInterval(() => {
    kuis.sisaWaktu -= 1;
    perbaruiTimerBar();
    if (kuis.sisaWaktu <= 0) {
      clearInterval(kuis.timerId);
      if (!kuis.terjawab) jawabSoal(null); // waktu habis sebelum menjawab
    }
  }, 1000);
}

function perbaruiTimerBar() {
  const persen = Math.max(0, (kuis.sisaWaktu / DURASI_PER_SOAL) * 100);
  $('#quiz-timer-bar').style.width = `${persen}%`;
  $('#quiz-timer-text').textContent = `${Math.max(0, kuis.sisaWaktu)} dtk`;
}

function jawabSoal(indexTerpilih) {
  if (kuis.terjawab) return;
  kuis.terjawab = true;
  clearInterval(kuis.timerId);

  const soal = kuis.urutan[kuis.index];
  const benar = indexTerpilih === soal.jawaban;
  if (benar) kuis.skor += 1;

  $all('.quiz-option').forEach((btn, i) => {
    btn.disabled = true;
    if (i === soal.jawaban) btn.classList.add('is-correct');
    else if (i === indexTerpilih) btn.classList.add('is-wrong');
  });

  const feedbackEl = $('#quiz-feedback');
  if (indexTerpilih === null) {
    feedbackEl.textContent = `Waktu habis. Jawaban benar: ${soal.options[soal.jawaban]}`;
    feedbackEl.classList.add('is-wrong');
  } else {
    feedbackEl.textContent = benar ? 'Benar!' : `Kurang tepat. Jawaban benar: ${soal.options[soal.jawaban]}`;
    feedbackEl.classList.add(benar ? 'is-correct' : 'is-wrong');
  }

  $('#btn-quiz-next').disabled = false;
  $('#btn-quiz-next').focus(); // Memandu fokus ke tombol next (Aksesibilitas)
}

function soalBerikutnya() {
  kuis.index += 1;
  if (kuis.index >= kuis.urutan.length) {
    selesaiKuis();
  } else {
    tampilkanSoal();
  }
}

function selesaiKuis() {
  clearInterval(kuis.timerId);
  const highScoreLama = ambilHighScore();
  const rekorBaru = kuis.skor > highScoreLama;
  if (rekorBaru) simpanLocalStorage(STORAGE_KEYS.HIGH_SCORE, kuis.skor);

  $('#quiz-result-score').textContent = `${kuis.skor} / ${kuis.urutan.length}`;
  $('#quiz-result-message').textContent = rekorBaru
    ? 'Rekor tertinggi baru! Mantap.'
    : `Rekor tertinggi saat ini: ${Math.max(highScoreLama, kuis.skor)} / ${kuis.urutan.length}`;

  tampilkanLayarKuis('result');
  perbaruiTampilanHighScoreAwal();
  
  // Arahkan fokus kembali ke tombol mulai ulang
  $('#btn-quiz-restart').focus();
}

function initQuiz() {
  perbaruiTampilanHighScoreAwal();
  $('#btn-quiz-start').addEventListener('click', mulaiKuis);
  $('#btn-quiz-next').addEventListener('click', soalBerikutnya);
  $('#btn-quiz-restart').addEventListener('click', () => tampilkanLayarKuis('start'));
}

/* ==========================================================
   INISIALISASI APLIKASI
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initModal();
  initKategoriSelect();

  initFormExpense();
  initFormEditExpense();
  initDaftarExpenseEvents();
  initFilterExpense();
  renderExpenses();

  initFormBookmark();
  initFormEditBookmark();
  initDaftarBookmarkEvents();
  initFilterBookmark();
  renderBookmarks();

  initQuiz();
});