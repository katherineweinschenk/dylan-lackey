import { initAnimation } from './animation.js';
import { publications } from './data/publications.js';
import { courses } from './data/syllabi.js';
import { shelf } from './data/shelf.js';

// ─── Animation ────────────────────────────────────────────
const anim = initAnimation(document.getElementById('webgl-container'));

// ─── Publications Grid ────────────────────────────────────
const pubGrid = document.getElementById('publications-grid');
publications.forEach((pub) => {
  const card = document.createElement('a');
  card.className = 'pub-card';
  card.href = pub.url;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';

  const labelLine = pub.journal
    ? `${pub.type} — ${pub.journal}`
    : pub.type;

  card.innerHTML = `
    <div class="pub-card-meta">
      <span class="pub-number">No. ${pub.id}</span>
      <span class="pub-year">${pub.year}</span>
    </div>
    <span class="pub-title">${pub.title}</span>
    <span class="pub-type">${labelLine}</span>
  `;
  pubGrid.appendChild(card);
});

// ─── Syllabi List ─────────────────────────────────────────
const sylList = document.getElementById('syllabi-list');
courses.forEach((course) => {
  const item = document.createElement('div');
  item.className = 'syllabus-item';

  const embedContent = course.pdfPath
    ? `<a class="syllabus-download-link cv-link" href="${course.pdfPath}" download>
        <span class="label">Download Syllabus</span>
        <span class="cv-arrow">↓</span>
       </a>`
    : `<div class="syllabus-no-pdf">PDF not yet available</div>`;

  item.innerHTML = `
    <div class="syllabus-header">
      <div class="syllabus-meta">
        <span class="syllabus-code label">${course.code}</span>
        <span class="syllabus-title">${course.title}</span>
        <span class="syllabus-semester label">${course.semester}</span>
      </div>
      <span class="syllabus-toggle">+</span>
    </div>
    <div class="syllabus-embed">${embedContent}</div>
  `;

  const header = item.querySelector('.syllabus-header');
  let iframeLoaded = false;
  header.addEventListener('click', () => {
    const isOpen = item.classList.toggle('open');
    const embed = item.querySelector('.syllabus-embed');
    if (isOpen && course.pdfPath) {
      // Lazy-load iframe on first open (desktop only — hidden via CSS on mobile)
      if (!iframeLoaded) {
        const iframe = document.createElement('iframe');
        iframe.src = course.pdfPath;
        iframe.title = `${course.title} Syllabus`;
        embed.prepend(iframe);
        iframeLoaded = true;
      }
      requestAnimationFrame(() => {
        embed.style.maxHeight = embed.scrollHeight + 'px';
      });
    } else {
      embed.style.maxHeight = '';
    }
  });

  sylList.appendChild(item);
});

// ─── Currently Shelf ──────────────────────────────────────
const infoTitle = document.getElementById('shelf-info-title');
const infoCreator = document.getElementById('shelf-info-creator');

const shelfRows = [
  document.getElementById('shelf-row-0'),
  document.getElementById('shelf-row-1'),
  document.getElementById('shelf-row-2'),
];

const CARD_GAP = 8;
const PARALLAX = [1.0, 0.85, 0.7];
const AUTO_SPEED = 0.4;

// Distribute cards round-robin across rows
const rowItems = [[], [], []];
shelf.forEach((item, i) => rowItems[i % 3].push(item));

// Build card elements and track per-row state
const rowCardEls = [[], [], []];
const rowOffsets = [0, 0, 0]; // current scroll offset per row
const rowVelocity = [0, 0, 0];

rowItems.forEach((items, rowIdx) => {
  const rowEl = shelfRows[rowIdx];
  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'shelf-card';

    const spine = document.createElement('div');
    spine.className = 'shelf-spine';

    const cover = document.createElement('div');
    cover.className = 'shelf-cover';
    cover.innerHTML = `
      <span class="cover-title">${item.title}</span>
      ${item.creator ? `<span class="cover-creator">${item.creator}</span>` : ''}
    `;

    card.appendChild(spine);
    card.appendChild(cover);

    card.addEventListener('mouseenter', () => {
      infoTitle.textContent = item.title;
      infoCreator.textContent = item.creator;
    });
    card.addEventListener('mouseleave', () => {
      infoTitle.textContent = '';
      infoCreator.textContent = '';
    });

    rowEl.appendChild(card);
    rowCardEls[rowIdx].push(card);
  });
});

// Position all cards in a row based on offset
function layoutRow(rowIdx) {
  const cards = rowCardEls[rowIdx];
  if (!cards.length) return;
  const rowEl = shelfRows[rowIdx];
  const rowH = rowEl.offsetHeight;
  const cardH = rowH * 0.88;
  // aspect-ratio 2/3 → width = cardH * 2/3
  const cardW = cardH * (2 / 3);
  const stride = cardW + CARD_GAP;
  const totalW = cards.length * stride;
  const offset = rowOffsets[rowIdx] % totalW;

  cards.forEach((card, i) => {
    let x = i * stride - offset;
    // Wrap: keep cards filling the visible area on both sides
    if (x < -(cardW + CARD_GAP)) x += totalW;
    if (x > rowEl.offsetWidth + CARD_GAP) x -= totalW;
    card.style.left = `${x}px`;
    card.style.width = `${cardW}px`;
  });
}

let shelfRafId = null;
let shelfActive = false;

function shelfTick() {
  if (!shelfActive) return;
  rowOffsets.forEach((_, rowIdx) => {
    // Auto-scroll + velocity decay
    rowOffsets[rowIdx] += AUTO_SPEED * PARALLAX[rowIdx] + rowVelocity[rowIdx] * PARALLAX[rowIdx];
    rowVelocity[rowIdx] *= 0.92;
    layoutRow(rowIdx);
  });
  shelfRafId = requestAnimationFrame(shelfTick);
}

function startShelf() {
  if (shelfActive) return;
  shelfActive = true;
  shelfTick();
}

function stopShelf() {
  shelfActive = false;
  if (shelfRafId) {
    cancelAnimationFrame(shelfRafId);
    shelfRafId = null;
  }
}

// Drag interaction
const shelfEl = document.getElementById('shelf-carousel');
let isDragging = false;
let dragStartX = 0;
let lastDragX = 0;
let dragDelta = 0;

shelfEl.addEventListener('pointerdown', (e) => {
  isDragging = true;
  dragStartX = e.clientX;
  lastDragX = e.clientX;
  dragDelta = 0;
  shelfEl.setPointerCapture(e.pointerId);
});

shelfEl.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  dragDelta = lastDragX - e.clientX;
  lastDragX = e.clientX;
  rowOffsets.forEach((_, rowIdx) => {
    rowOffsets[rowIdx] += dragDelta * PARALLAX[rowIdx];
    layoutRow(rowIdx);
  });
});

shelfEl.addEventListener('pointerup', (e) => {
  if (!isDragging) return;
  isDragging = false;
  // Pass drag velocity to auto-scroll
  rowVelocity.forEach((_, i) => { rowVelocity[i] = dragDelta * 0.5; });
});

shelfEl.addEventListener('pointercancel', () => {
  isDragging = false;
});

// ─── Navigation / Router ──────────────────────────────────
const pages = ['home', 'publications', 'syllabi', 'shelf'];
const overlays = {};
const navItems = {};
const titleBlock = document.getElementById('title-block');

pages.forEach((p) => {
  overlays[p] = document.getElementById(`page-${p}`);
});

document.querySelectorAll('.nav-item').forEach((el) => {
  const page = el.dataset.page;
  navItems[page] = el;
});

function navigateTo(page) {
  pages.forEach((p) => {
    const isActive = p === page;
    overlays[p].classList.toggle('hidden', !isActive);
    navItems[p]?.classList.toggle('active', isActive);
  });

  // On non-home pages, dim the animation and hide the about block
  if (page === 'home') {
    anim.setOpacity(1);
    titleBlock.style.opacity = '1';
  } else {
    anim.setOpacity(0.15);
    titleBlock.style.opacity = '0';
  }

  // Start/stop shelf animation
  if (page === 'shelf') {
    startShelf();
  } else {
    stopShelf();
  }

  // Push to hash without triggering the hashchange handler again
  const newHash = page === 'home' ? '#home' : `#${page}`;
  if (window.location.hash !== newHash) {
    history.replaceState(null, '', newHash);
  }
}

document.querySelectorAll('.nav-item').forEach((el) => {
  el.addEventListener('click', () => navigateTo(el.dataset.page));
});

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '') || 'home';
  if (pages.includes(hash)) navigateTo(hash);
});

// Initial page load
const initPage = window.location.hash.replace('#', '') || 'home';
navigateTo(pages.includes(initPage) ? initPage : 'home');
