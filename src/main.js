import { initAnimation } from './animation.js';
import { publications } from './data/publications.js';
import { courses } from './data/syllabi.js';

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

// ─── Navigation / Router ──────────────────────────────────
const pages = ['home', 'publications', 'syllabi'];
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
