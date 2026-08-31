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
    text: 'I write and speak about creating your own career, whatever that means to you.',
    chips: [{ label: "Let's talk →", href: `mailto:${EMAIL}` }],
  },
  book: {
    text: 'I wrote Fumbling Forward, part memoir and part career how-to told with a big ’ol heaping of humor told in five parts:',
    items: [
      'Eating Sh!t (working in customer service)',
      'Studying Hard (working through college)',
      'Flying Solo (working as a freelancer)',
      'Teaming Up (working with business partners)',
      'Selling Out (working in corporate America)',
    ],
    chips: [{ label: 'Get the book →', href: 'https://www.fumblingbook.com/' }],
  },
  substack: {
    text: 'Fumbling Forward, the newsletter: career notes from someone still taking them. Free, occasionally useful, reliably honest.',
    chips: [{ label: 'Subscribe →', href: 'https://fumblingforward.substack.com/' }],
  },
  contact: {
    text: `Talks? Projects? Questions? I (usually) read everything, and I'm chronically online. Write me: ${EMAIL}`,
    chips: [{ label: 'Copy email', action: 'copy' }, { label: 'Open mail app →', href: `mailto:${EMAIL}` }],
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let run = 0;

export function initTyper({ headlineEl, cursorEl, listEl, followupEl, chipButtons, resetBtn, onProgress }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    || new URLSearchParams(location.search).has('instant'); // dev: settled-state screenshots

  async function copyEmail(btn) {
    try {
      await navigator.clipboard.writeText(EMAIL);
      const old = btn.textContent;
      btn.textContent = 'Copied ✓';
      setTimeout(() => { btn.textContent = old; }, 1500);
    } catch {
      // Clipboard denied: the email is already visible in the reply text.
    }
  }

  function renderFollowups(reply) {
    followupEl.replaceChildren(...reply.chips.map((c) => {
      const el = document.createElement(c.href ? 'a' : 'button');
      el.className = 'chip chip--cta';
      el.textContent = c.label;
      if (c.href) el.href = c.href;
      if (c.action === 'copy') el.addEventListener('click', () => copyEmail(el));
      return el;
    }));
  }

  // Longer replies type faster, so a five-part list doesn't outstay its welcome.
  function speedFor(total) {
    return total > 140 ? { base: 9, jitter: 9, pause: 90 } : { base: 20, jitter: 22, pause: 160 };
  }

  async function typeInto(el, text, id, speed, progress) {
    const node = document.createTextNode('');
    el.appendChild(node);
    el.appendChild(cursorEl); // cursor follows whatever line is being typed
    for (let i = 0; i < text.length; i++) {
      if (id !== run) return false;
      node.data += text[i];
      progress?.();
      await sleep(/[.,—!?:]/.test(text[i]) ? speed.pause : speed.base + Math.random() * speed.jitter);
    }
    return true;
  }

  async function typeReply(key) {
    const id = ++run;
    const reply = REPLIES[key];
    const items = reply.items ?? [];
    followupEl.replaceChildren();
    listEl.replaceChildren();
    headlineEl.textContent = '';
    cursorEl.hidden = false;

    if (reduced) {
      headlineEl.textContent = reply.text;
      for (const item of items) {
        const li = document.createElement('li');
        li.textContent = item;
        listEl.appendChild(li);
      }
      onProgress?.(1);
      renderFollowups(reply);
      return;
    }

    const total = reply.text.length + items.reduce((n, s) => n + s.length, 0);
    const speed = speedFor(total);
    let typed = 0;
    const tick = () => onProgress?.(++typed / total);

    if (!(await typeInto(headlineEl, reply.text, id, speed, tick))) return;
    for (const item of items) {
      if (id !== run) return;
      const li = document.createElement('li');
      listEl.appendChild(li);
      if (!(await typeInto(li, item, id, speed, tick))) return;
    }
    renderFollowups(reply);
  }

  for (const btn of chipButtons) {
    btn.addEventListener('click', () => typeReply(btn.dataset.reply));
  }
  resetBtn.addEventListener('click', () => typeReply('intro'));

  typeReply('intro');
}
