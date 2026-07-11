'use strict';

/* =========================================================
   0. Helpers
   ========================================================= */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =========================================================
   Reveal on scroll (defined early — renderCatalog calls it)
   ========================================================= */
let revealObserver;
function observeReveals(scope = document) {
  if (reduceMotion) { $$('.reveal', scope).forEach(el => el.classList.add('in')); return; }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('in'); revealObserver.unobserve(en.target); }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
  }
  $$('.reveal:not(.in)', scope).forEach(el => revealObserver.observe(el));
}

/* =========================================================
   1. Live "Royal Time" clock (Moscow)
   ========================================================= */
(function clock() {
  const el = $('#clock');
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Europe/Moscow'
  });
  const tick = () => { el.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 1000);
})();

/* =========================================================
   2. Sticky nav state
   ========================================================= */
(function stickyNav() {
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();

/* =========================================================
   3. Hero scroll-scrub video
   The watch disassembles as the tall .hero wrapper scrolls
   past. currentTime is eased toward a scroll-derived target
   so seeking stays smooth at 60fps.
   ========================================================= */
(function scrubHero() {
  const hero = $('.hero');
  const video = $('#heroVideo');
  const overlay = $('.hero__overlay');
  const scrollHint = $('.hero__scroll');
  const cta = $('#heroCta');
  const playBtn = $('#heroPlay');
  if (!hero || !video) return;

  // Reduced motion: no scrub, just gentle looping ambience.
  if (reduceMotion) {
    video.setAttribute('loop', '');
    video.play().catch(() => {});
    return;
  }

  // Touch devices: finger-scroll scrubbing is janky and seeking is slow on
  // mobile decoders, so play the disassembly forward once on tap instead.
  const isTouch = window.matchMedia('(max-width: 760px)').matches
    || window.matchMedia('(pointer: coarse)').matches;
  if (isTouch) {
    hero.classList.add('is-tap');
    const label = playBtn && playBtn.querySelector('.hero__play-label');

    const play = () => {
      hero.classList.add('overlay-hidden', 'is-playing');
      cta.classList.remove('is-on');
      try { video.currentTime = 0; } catch (_) {}
      video.play().catch(() => {});
    };

    video.addEventListener('ended', () => {
      hero.classList.remove('is-playing');   // button reappears as "Replay"
      cta.classList.add('is-on');
      if (label) label.textContent = 'Replay';
    });

    if (playBtn) playBtn.addEventListener('click', play);
    return;
  }

  let duration = 0;
  let target = 0;   // desired currentTime
  let current = 0;  // eased currentTime
  let ready = false;

  const markReady = () => {
    if (ready) return;
    if (isFinite(video.duration) && video.duration > 0) {
      duration = video.duration;
      ready = true;
      onScroll(); // sync to current scroll position immediately
    }
  };
  // metadata may already be present (local file loads instantly), so poll too
  ['loadedmetadata', 'durationchange', 'canplay', 'loadeddata'].forEach(ev =>
    video.addEventListener(ev, markReady)
  );
  // "Warm up" the decoder — some browsers refuse to seek an untouched video.
  video.play().then(() => video.pause()).catch(() => {});
  video.load();
  const readyPoll = setInterval(() => { markReady(); if (ready) clearInterval(readyPoll); }, 120);

  const progress = () => {
    const total = hero.offsetHeight - window.innerHeight;
    return total > 0 ? clamp(-hero.getBoundingClientRect().top / total, 0, 1) : 0;
  };

  const onScroll = () => {
    const p = progress();
    if (ready) target = p * duration;

    // Overlay fades out over the first third of the scrub.
    const fade = clamp(1 - p / 0.34, 0, 1);
    overlay.style.opacity = fade;
    overlay.style.transform = `translateY(${(1 - fade) * -40}px)`;
    if (scrollHint) scrollHint.style.opacity = fade;

    // End-state CTA appears once the watch is fully apart.
    cta.classList.toggle('is-on', p > 0.9);
  };

  // Smoothly ease the video toward the target frame.
  const render = () => {
    if (ready) {
      current += (target - current) * 0.12;
      if (Math.abs(target - current) < 0.001) current = target;
      // seeking guard avoids stacking seeks on slow decoders
      if (video.readyState >= 1 && !video.seeking && Math.abs(video.currentTime - current) > 0.01) {
        video.currentTime = current;
      }
    }
    requestAnimationFrame(render);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();
  requestAnimationFrame(render);
})();

/* =========================================================
   4. Catalog data + rendering
   Prices are illustrative placeholders — swap for real ones.
   Replace the generated watch SVG with <img> product photos
   by setting `photo` on an item (see render below).
   ========================================================= */
const ON_REQUEST = 'on request';
const CATALOG = [
  { brand: 'Rolex',              model: 'Submariner Date',   ref: '126610LN', price: '1,690,000', hue: 140, badge: 'In stock' },
  { brand: 'Patek Philippe',     model: 'Nautilus',          ref: '5711/1A',  price: ON_REQUEST,  hue: 210, badge: 'To order' },
  { brand: 'Audemars Piguet',    model: 'Royal Oak',         ref: '15500ST',  price: '3,200,000', hue: 205, badge: 'In stock' },
  { brand: 'Omega',              model: 'Speedmaster',       ref: '310.30.42',price: '690,000',   hue: 0,   badge: 'In stock' },
  { brand: 'Cartier',            model: 'Santos de Cartier', ref: 'WSSA0018', price: '820,000',   hue: 45,  badge: 'In stock' },
  { brand: 'Hublot',             model: 'Big Bang Unico',    ref: '441.NX',   price: '1,250,000', hue: 20,  badge: 'In stock' },
  { brand: 'IWC',                model: 'Portugieser',       ref: 'IW371620', price: '980,000',   hue: 220, badge: 'In stock' },
  { brand: 'Vacheron Constantin',model: 'Overseas',          ref: '4500V',    price: ON_REQUEST,  hue: 200, badge: 'To order' },
  { brand: 'Cartier',            model: 'Tank Louis',        ref: 'WGTA0067', price: '1,040,000', hue: 40,  badge: 'In stock' },
];

/* Reusable dial illustration — placeholder until real photos exist. */
function watchSVG(hue) {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const r1 = i % 3 === 0 ? 60 : 66, r2 = 74;
    const x1 = 100 + Math.sin(a) * r1, y1 = 100 - Math.cos(a) * r1;
    const x2 = 100 + Math.sin(a) * r2, y2 = 100 - Math.cos(a) * r2;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--gold)" stroke-width="${i % 3 === 0 ? 2 : 1}" opacity="0.85"/>`;
  }).join('');
  return `
  <svg viewBox="0 0 200 200" width="70%" role="img" aria-label="Watch dial illustration" style="--h:${hue}">
    <defs>
      <radialGradient id="dial${hue}" cx="42%" cy="34%" r="75%">
        <stop offset="0%" stop-color="hsl(${hue} 16% 20%)"/>
        <stop offset="100%" stop-color="hsl(${hue} 22% 8%)"/>
      </radialGradient>
    </defs>
    <circle cx="100" cy="100" r="90" fill="none" stroke="var(--gold)" stroke-width="3" opacity="0.9"/>
    <circle cx="100" cy="100" r="82" fill="url(#dial${hue})" stroke="var(--gold)" stroke-width="0.6" opacity="0.9"/>
    ${ticks}
    <line x1="100" y1="100" x2="100" y2="52" stroke="#ECE7DC" stroke-width="3.4" stroke-linecap="round"/>
    <line x1="100" y1="100" x2="134" y2="118" stroke="#ECE7DC" stroke-width="2.6" stroke-linecap="round"/>
    <line x1="100" y1="100" x2="82" y2="132" stroke="var(--gold)" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="100" cy="100" r="4" fill="var(--gold)"/>
    <rect x="120" y="94" width="16" height="12" fill="hsl(${hue} 12% 12%)" stroke="var(--gold)" stroke-width="0.6"/>
  </svg>`;
}

function cardHTML(item) {
  return `
  <article class="card reveal" data-brand="${item.brand}">
    <div class="card__media">
      <span class="card__badge">${item.badge}</span>
      ${watchSVG(item.hue)}
    </div>
    <div class="card__body">
      <span class="card__brand">${item.brand}</span>
      <h3 class="card__model">${item.model}</h3>
      <span class="card__ref">Ref. ${item.ref}</span>
      <div class="card__foot">
        <span class="card__price">${item.price === ON_REQUEST ? '' : '<small>from</small> ₽ '}${item.price}</span>
        <a class="card__link" href="#request">Enquire</a>
      </div>
    </div>
  </article>`;
}

(function renderCatalog() {
  const grid = $('#grid');
  const filters = $('#filters');
  if (!grid || !filters) return;

  const brands = ['All', ...new Set(CATALOG.map(i => i.brand))];
  filters.innerHTML = brands
    .map((b, i) => `<button class="filter${i === 0 ? ' is-active' : ''}" role="tab" data-brand="${b}">${b}</button>`)
    .join('');

  const paint = (brand) => {
    const items = brand === 'All' ? CATALOG : CATALOG.filter(i => i.brand === brand);
    grid.innerHTML = items.map(cardHTML).join('');
    observeReveals(grid);
  };
  paint('All');

  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter');
    if (!btn) return;
    $$('.filter', filters).forEach(f => f.classList.remove('is-active'));
    btn.classList.add('is-active');
    paint(btn.dataset.brand);
  });

  // Datalist hints for the request form.
  const dl = $('#modelHints');
  if (dl) dl.innerHTML = CATALOG.map(i => `<option value="${i.brand} ${i.model}"></option>`).join('');
})();

/* =========================================================
   5. Brand marquee (duplicated track for seamless loop)
   ========================================================= */
(function marquee() {
  const track = $('#marqueeTrack');
  if (!track) return;
  const names = ['Rolex','Patek Philippe','Audemars Piguet','Omega','Cartier','Hublot','IWC','Jaeger-LeCoultre','Vacheron Constantin','Breitling','Panerai','Zenith','Tudor','Longines'];
  const row = names.map(n => `<span class="marquee__item">${n}</span>`).join('');
  track.innerHTML = row + row; // two copies -> -50% loop
})();

/* =========================================================
   6. Trigger reveals for static (non-catalog) sections
   ========================================================= */
observeReveals();

/* =========================================================
   7. Count-up stats
   ========================================================= */
(function counters() {
  const nums = $$('.stat__num');
  if (!nums.length) return;
  if (reduceMotion) {
    nums.forEach(n => n.textContent = (+n.dataset.count).toLocaleString('en-US') + (n.dataset.suffix || ''));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const end = +el.dataset.count;
      const suffix = el.dataset.suffix || '';
      const dur = 1400;
      let start;
      const step = (t) => {
        if (!start) start = t;
        const p = clamp((t - start) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(end * eased).toLocaleString('en-US') + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      io.unobserve(el);
    });
  }, { threshold: 0.6 });
  nums.forEach(n => io.observe(n));
})();

/* =========================================================
   8. Request form (no backend — graceful confirmation)
   ========================================================= */
(function requestForm() {
  const form = $('#requestForm');
  const note = $('#formNote');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#fName').value.trim();
    const phone = $('#fPhone').value.trim();
    if (!name || phone.replace(/\D/g, '').length < 10) {
      note.textContent = 'Please enter your name and a valid phone number.';
      note.style.color = '#d98b6b';
      return;
    }
    note.style.color = 'var(--gold)';
    note.textContent = `${name}, your request has been received. A consultant will be in touch within one business day.`;
    form.reset();
  });
})();
