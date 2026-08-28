// Typed-reply state machine. A new chip click bumps the run id, which silently
// cancels any in-flight typing — no AbortController ceremony needed.

const EMAIL = 'hello@billyfrazier.is';

// EDIT ME (Billy): tune these replies to taste.
const REPLIES = {
  intro: {
    text: 'Fumbling forward through work and life while sharing notes with the rest of the class.',
    chips: [],
  },
  help: {
    text: 'I write and speak about careers for people who suspect everyone else got a manual. Twenty-odd years of fumbling, five career stages, an unreasonable number of lessons learned the hard way — all yours to borrow.',
    chips: [{ label: "Let's talk →", href: `mailto:${EMAIL}` }],
  },
  book: {
    text: "I wrote Fumbling Forward, a memoir-meets-career-guide. My mom says it's very good, and she's only slightly biased.",
    chips: [{ label: 'Get the book →', href: 'https://www.fumblingbook.com/' }],
  },
  substack: {
    text: 'Fumbling Forward, the newsletter: career notes from someone still taking them. Free, occasionally useful, reliably honest.',
    chips: [{ label: 'Subscribe →', href: 'https://fumblingforward.substack.com/' }],
  },
  contact: {
    text: `Talks, projects, questions, gentle corrections — I read everything, usually twice, the second time worrying about it. Write me: ${EMAIL}`,
    chips: [{ label: 'Copy email', action: 'copy' }, { label: 'Open mail app →', href: `mailto:${EMAIL}` }],
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let run = 0;

export function initTyper({ headlineEl, cursorEl, followupEl, chipButtons, resetBtn, onProgress }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    || new URLSearchParams(location.search).has('instant'); // dev: settled-state screenshots

  async function copyEmail(btn) {
    try {
      await navigator.clipboard.writeText(EMAIL);
      const old = btn.textContent;
      btn.textContent = 'Copied ✓';
      btn.classList.add('chip--copied');
      setTimeout(() => { btn.textContent = old; btn.classList.remove('chip--copied'); }, 1500);
    } catch {
      // Clipboard denied: the email is already visible in the reply text.
    }
  }

  function renderFollowups(reply) {
    followupEl.replaceChildren(...reply.chips.map((c) => {
      const el = document.createElement(c.href ? 'a' : 'button');
      el.className = 'chip';
      el.textContent = c.label;
      if (c.href) el.href = c.href;
      if (c.action === 'copy') el.addEventListener('click', () => copyEmail(el));
      return el;
    }));
  }

  async function typeReply(key) {
    const id = ++run;
    const reply = REPLIES[key];
    followupEl.replaceChildren();
    headlineEl.textContent = '';
    cursorEl.hidden = false;
    if (reduced) {
      headlineEl.textContent = reply.text;
      onProgress?.(1);
      renderFollowups(reply);
      return;
    }
    for (let i = 0; i < reply.text.length; i++) {
      if (id !== run) return; // superseded
      headlineEl.textContent += reply.text[i];
      onProgress?.((i + 1) / reply.text.length);
      await sleep(/[.,—!?:]/.test(reply.text[i]) ? 160 : 20 + Math.random() * 22);
    }
    renderFollowups(reply);
  }

  for (const btn of chipButtons) {
    btn.addEventListener('click', () => typeReply(btn.dataset.reply));
  }
  resetBtn.addEventListener('click', () => typeReply('intro'));

  typeReply('intro');
}
