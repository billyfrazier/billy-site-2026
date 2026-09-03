// Boot: wire the typed UI immediately, pull in the 3D chunk one frame after
// first paint (the scene is the page's subject — no idle-waiting).
import { initTyper } from './typer.js';

const stage = document.getElementById('stage');
const progressBar = document.querySelector('.progress > i');
const progressWrap = document.querySelector('.progress');

function setProgress(f) {
  progressBar.style.width = `${Math.round(f * 100)}%`;
}

initTyper({
  headlineEl: document.getElementById('headline'),
  cursorEl: document.getElementById('cursor'),
  listEl: document.getElementById('replylist'),
  followupEl: document.getElementById('followup'),
  chipButtons: document.querySelectorAll('.chip[data-reply]'),
  resetBtn: document.getElementById('reset'),
  onProgress: setProgress,
});

// Hamburger → site menu. Closes on Escape or a click anywhere outside it.
const menuBtn = document.getElementById('menu-btn');
const menu = document.getElementById('site-menu');
function setMenu(open) {
  menu.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
}
menuBtn.addEventListener('click', () => setMenu(menu.hidden));
addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
addEventListener('pointerdown', (e) => {
  if (!menu.hidden && !menu.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
});

requestAnimationFrame(() => {
  import('./scene.js')
    .then((m) => m.initScene({
      stage,
      motionChip: document.getElementById('motion-chip'),
      onProgress: (f) => {
        progressWrap.classList.toggle('is-loading', f < 1);
        if (f < 1) setProgress(f);
      },
    }))
    .catch(() => { /* shell + chips still fully work */ });
});
