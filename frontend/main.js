
const hero           = document.getElementById('hero');
const topbar         = document.getElementById('topbar');
const resultsMain    = document.getElementById('resultsMain');
const resultsSection = document.getElementById('resultsSection');
const searchInput    = document.getElementById('searchInput');
const searchInputTop = document.getElementById('searchInputTop');
const spinner        = document.getElementById('loadingSpinner');
const spinnerTop     = document.getElementById('loadingSpinnerTop');
const acDrop         = document.getElementById('acDrop');
const acDropTop      = document.getElementById('acDropTop');

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showSpinner(on) {
  if (spinner)    spinner.classList.toggle('show', on);
  if (spinnerTop) spinnerTop.classList.toggle('show', on);
}

function enterSearchMode() {

  if (hero) {
    hero.style.display = 'none';
  }
  if (topbar) topbar.classList.remove('hidden');
  if (resultsMain) resultsMain.classList.remove('hidden');
}

function enterHomeMode() {
  if (hero) {
    hero.style.display = '';
  }
  if (topbar)      topbar.classList.add('hidden');
  if (resultsMain) resultsMain.classList.add('hidden');
  if (resultsSection) resultsSection.innerHTML = '';
  if (searchInput)    searchInput.value = '';
  if (searchInputTop) searchInputTop.value = '';
}

function renderResults(query, results) {
  if (!results || !results.length) {
    resultsSection.innerHTML = `
      <div class="msg">
        <div class="msg-icon">O</div>
        <p>No results for <strong>"${esc(query)}"</strong></p>
        <p class="hint">Try different keywords.</p>
      </div>`;
    return;
  }

  const meta = `<div class="result-meta">
    About ${results.length} result${results.length !== 1 ? 's' : ''} for
    <strong>"${esc(query)}"</strong>
  </div>`;

  const cards = results.map((r, i) => `
    <li class="card" style="animation-delay:${i * 0.05}s">
      <div class="card-url">${esc(r.url)}</div>
      <a class="card-title" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>
      ${r.categories && r.categories.length
        ? `<div class="card-cats">${r.categories.slice(0,3).map(c=>`<span class="cat">${esc(c)}</span>`).join('')}</div>`
        : ''}
      <p class="card-snippet">${r.snippet}</p>
      <span class="card-score">relevance ${r.bm25Score.toFixed(3)}</span>
    </li>`).join('');

  resultsSection.innerHTML = meta + `<ol class="results">${cards}</ol>`;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function renderError(msg) {
  resultsSection.innerHTML = `<div class="msg-error">${esc(msg)}</div>`;
}

async function doSearch(query) {
  query = query.trim();
  if (!query) return;

  if (searchInput)    searchInput.value = query;
  if (searchInputTop) searchInputTop.value = query;

  history.pushState({}, '', '/?q=' + encodeURIComponent(query));

  enterSearchMode();
  resultsSection.innerHTML = '';
  showSpinner(true);

  try {
    const r    = await fetch('/api/search?q=' + encodeURIComponent(query) + '&limit=10');
    const data = await r.json();
    if (data.error) renderError(data.error);
    else renderResults(query, data.results);
  } catch (err) {
    renderError('Request failed: ' + err.message);
  } finally {
    showSpinner(false);
  }
}

let acTimer  = null;
let acItems  = [];
let acActive = -1;
let acQuery  = '';

function renderDrop(drop, items, q) {
  acItems = items; acActive = -1; acQuery = q;

  if (!items.length) { drop.classList.remove('open'); return; }

  drop.innerHTML = items.map((item, i) => {
    const lo = item.toLowerCase();
    const qi = lo.indexOf(q.toLowerCase());
    let lbl  = esc(item);
    if (qi !== -1) {
      lbl = esc(item.slice(0, qi))
          + '<span class="ac-match">' + esc(item.slice(qi, qi + q.length)) + '</span>'
          + esc(item.slice(qi + q.length));
    }
    return `<div class="ac-item" data-val="${esc(item)}">
      <span class="ac-icon">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="11" cy="11" r="7.5"/><line x1="20" y1="20" x2="15.8" y2="15.8"/>
        </svg>
      </span>${lbl}
    </div>`;
  }).join('');

  drop.querySelectorAll('.ac-item').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      const val = el.dataset.val;
      if (searchInput)    searchInput.value = val;
      if (searchInputTop) searchInputTop.value = val;
      drop.classList.remove('open');
      doSearch(val);
    });
  });

  drop.classList.add('open');
}

function setActive(drop, input, idx) {
  const els   = [...drop.querySelectorAll('.ac-item')];
  const total = els.length;
  els.forEach(e => e.classList.remove('active'));
  acActive = ((idx % (total + 1)) + total + 1) % (total + 1) - 1;
  if (acActive >= 0) {
    els[acActive].classList.add('active');
    input.value = els[acActive].dataset.val;
  } else {
    input.value = acQuery;
  }
}

async function fetchSuggestions(q, drop) {
  try {
    showSpinner(true);
    const r = await fetch('/api/suggest?q=' + encodeURIComponent(q));
    const d = await r.json();
    renderDrop(drop, d.suggestions || [], q);
  } catch {
    drop.classList.remove('open');
  } finally {
    showSpinner(false);
  }
}

function bindInput(input, drop) {
  if (!input || !drop) return;

  input.addEventListener('input', () => {
    const q = input.value.trim();
    acQuery = q;
    clearTimeout(acTimer);
    if (q.length < 2) { drop.classList.remove('open'); return; }
    acTimer = setTimeout(() => fetchSuggestions(q, drop), 220);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      drop.classList.remove('open');
      doSearch(input.value);
      return;
    }
    if (!drop.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(drop, input, acActive + 1); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(drop, input, acActive - 1); }
    if (e.key === 'Escape')    { drop.classList.remove('open'); input.value = acQuery; }
  });
}

bindInput(searchInput,    acDrop);
bindInput(searchInputTop, acDropTop);

document.addEventListener('click', e => {
  if (!e.target.closest('.ac-wrap')) {
    if (acDrop)    acDrop.classList.remove('open');
    if (acDropTop) acDropTop.classList.remove('open');
  }
});

document.querySelectorAll('.logo, .topbar-logo').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    history.pushState({}, '', '/');
    enterHomeMode();
    setTimeout(() => searchInput && searchInput.focus(), 50);
  });
});

window.addEventListener('popstate', () => {
  const q = new URLSearchParams(window.location.search).get('q') || '';
  if (q) {
    if (searchInput)    searchInput.value = q;
    if (searchInputTop) searchInputTop.value = q;
    doSearch(q);
  } else {
    enterHomeMode();
  }
});

(function init() {
  const q = new URLSearchParams(window.location.search).get('q') || '';
  if (q) {
    if (searchInput)    searchInput.value = q;
    if (searchInputTop) searchInputTop.value = q;
    doSearch(q);
  }
})();