/* Talon Insights catalogue v1.2.0
   Brand filter (tabs + mobile dropdown), 12-per-page pagination (slider-style arrows), article count,
   empty state, ?brand= and ?page= deep links. Brand is read from a hidden .in-slug
   element bound to the CMS Brand slug (the Brand reference cannot bind to attributes). */
(function () {
  var root = document.querySelector('.in-catalog');
  if (!root) return;
  var grid = root.querySelector('.in-grid');
  if (!grid) return;
  var PER_PAGE = 12;

  var css =
    '.in-feature .w-dyn-list,.in-feature .w-dyn-items{display:contents}' +
    '.in-grid .w-dyn-empty,.in-feature .w-dyn-empty{display:none}' +
    '.in-grid .w-dyn-item{min-width:0}' +
    '[data-brand=scaffolding]{--in-b:#ff5a5f}' +
    '[data-brand=roofing]{--in-b:#8a93ff}' +
    '[data-brand=environmental]{--in-b:#ffb800}' +
    '[data-brand=compliance]{--in-b:#3ad452}' +
    '.in-catalog .sv-card-brand{color:var(--in-b,#e6ebf2)}' +
    '.in-grid .hv-ins-title,.in-feat-title{transition:color .3s}' +
    '.in-grid .hv-ins-card:hover .hv-ins-title,.in-grid .hv-ins-card:focus-visible .hv-ins-title,.in-feat:hover .in-feat-title,.in-feat:focus-visible .in-feat-title{color:var(--in-b,#e6ebf2)}' +
    '.in-grid .hv-ins-img,.in-feat-img{transition:transform .8s cubic-bezier(.22,1,.36,1)}' +
    '.in-grid .hv-ins-card:hover .hv-ins-img,.in-feat:hover .in-feat-img{transform:scale(1.03)}' +
    '.in-feat-rt::after{content:" min read"}' +
    '.in-feat-cta{color:var(--in-b,#e6ebf2);transition:transform .4s}' +
    '.in-feat:hover .in-feat-cta{transform:translateX(6px)}' +
    '.in-catalog .sv-filter{position:relative}' +
    '.in-catalog .sv-tab{cursor:pointer;transition:opacity .3s,background-color .3s,color .3s}' +
    '.in-catalog .sv-tab:hover,.in-catalog .sv-tab:focus-visible{opacity:1}' +
    '.in-catalog .sv-tab.is-active{opacity:1;background:var(--_v2-theme---v2-ink,#e6ebf2);color:var(--_v2-theme---v2-bg,#0b0f14);border-color:transparent}' +
    '.in-catalog .sv-select{display:none;align-items:center;gap:10px;cursor:pointer;width:100%;justify-content:space-between}' +
    '.in-catalog .sv-select-chev{display:inline-block;width:8px;height:8px;margin-top:-4px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);transition:transform .3s}' +
    '.in-catalog .sv-select[aria-expanded=true] .sv-select-chev{transform:rotate(-135deg);margin-top:4px}' +
    '.in-menu{display:none;position:absolute;z-index:20;left:0;right:0;top:calc(100% + 6px);margin:0;padding:6px;list-style:none;background:var(--_v2-theme---v2-bg,#0b0f14);border:1px solid rgba(230,235,242,.18);border-radius:10px}' +
    '.in-menu.is-open{display:block}' +
    '.in-menu-item{display:flex;align-items:center;gap:10px;padding:12px;border-radius:6px;cursor:pointer;color:var(--_v2-theme---v2-ink,#e6ebf2)}' +
    '.in-menu-item:hover,.in-menu-item:focus-visible,.in-menu-item.is-active{background:rgba(230,235,242,.1)}' +
    '.in-empty{grid-column:1/-1;padding:64px 0;text-align:center;opacity:.7}' +
    '.in-catalog [data-pager]{justify-content:center;margin-top:72px}' +
    '.in-catalog [data-pager] .sv-btn{cursor:pointer;transition:opacity .3s}' +
    '.in-catalog [data-pager] .sv-btn[aria-disabled=true]{opacity:.3;pointer-events:none}' +
    '@media (max-width:767px){.in-catalog .sv-select{display:flex}.in-catalog .sv-tabs{display:none}.in-catalog [data-pager]{margin-top:48px}}' +
    '@media (prefers-reduced-motion:reduce){.in-grid .hv-ins-img,.in-feat-img,.in-grid .hv-ins-title,.in-feat-title,.in-feat-cta{transition:none}}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  /* Brand slug -> data-brand on every card (grid and featured) */
  function brandOf(card) {
    var s = card.querySelector('.in-slug');
    var t = s ? (s.textContent || '').trim().toLowerCase() : '';
    return t.replace(/^talon-/, '');
  }
  [].slice.call(document.querySelectorAll('.in-grid .hv-ins-card, .in-feat')).forEach(function (c) {
    var b = brandOf(c);
    if (b) c.setAttribute('data-brand', b);
  });

  var tabs = [].slice.call(root.querySelectorAll('.sv-tab'));
  var select = root.querySelector('.sv-select');
  var label = root.querySelector('.sv-select-label');
  var count = root.querySelector('.in-count');
  var filterWrap = root.querySelector('.sv-filter');
  var bar = root.querySelector('.sv-bar');
  var items = [].slice.call(grid.querySelectorAll('.w-dyn-item'));
  var valid = tabs.map(function (t) { return t.getAttribute('data-filter'); });
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var state = { f: 'all', p: 1 };

  function tabText(t) {
    var n = t.cloneNode(true);
    [].slice.call(n.querySelectorAll('.ct-chip-dot')).forEach(function (d) { d.parentNode.removeChild(d); });
    return (n.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function tabDot(t) { return t.querySelector('.ct-chip-dot'); }

  /* Dropdown menu built from the tabs */
  var menu = null;
  if (select && filterWrap) {
    menu = document.createElement('ul');
    menu.className = 'in-menu';
    menu.setAttribute('role', 'listbox');
    tabs.forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'in-menu-item';
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '0');
      li.setAttribute('data-filter', t.getAttribute('data-filter'));
      var d = tabDot(t);
      if (d) li.appendChild(d.cloneNode(true));
      var s = document.createElement('span');
      s.textContent = tabText(t);
      li.appendChild(s);
      menu.appendChild(li);
    });
    filterWrap.appendChild(menu);
  }
  function openMenu(on) {
    if (!menu) return;
    menu.classList.toggle('is-open', on);
    select.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  /* Pager: static slider-style controls (sv-btn arrows + sv-count) */
  var pager = root.querySelector('[data-pager]');
  var prevB = pager && pager.querySelector('.sv-prev');
  var nextB = pager && pager.querySelector('.sv-next');
  var pageCount = pager && pager.querySelector('.sv-count');
  var listEl = grid.querySelector('.w-dyn-items') || grid;
  function setCount(txt) {
    if (!pageCount) return;
    var t = pageCount.firstChild;
    while (t && t.nodeType !== 3) t = t.nextSibling;
    if (t) t.nodeValue = txt; else pageCount.textContent = txt;
  }
  function renderPager(total) {
    if (!pager) return;
    pager.style.display = total <= 1 ? 'none' : '';
    setCount(pad(state.p) + ' / ' + pad(total));
    if (prevB) prevB.setAttribute('aria-disabled', state.p <= 1 ? 'true' : 'false');
    if (nextB) nextB.setAttribute('aria-disabled', state.p >= total ? 'true' : 'false');
  }

  function writeUrl() {
    if (!(window.history && history.replaceState)) return;
    try {
      var u = new URL(location.href);
      if (state.f === 'all') u.searchParams.delete('brand'); else u.searchParams.set('brand', state.f);
      if (state.p <= 1) u.searchParams.delete('page'); else u.searchParams.set('page', state.p);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) {}
  }

  function render() {
    var f = state.f;
    var match = items.filter(function (i) {
      var c = i.querySelector('[data-brand]');
      var b = c && c.getAttribute('data-brand');
      return f === 'all' || b === f;
    });
    var total = Math.max(1, Math.ceil(match.length / PER_PAGE));
    if (state.p > total) state.p = total;
    if (state.p < 1) state.p = 1;
    var from = (state.p - 1) * PER_PAGE, to = from + PER_PAGE;
    items.forEach(function (i) { i.style.display = 'none'; });
    match.forEach(function (i, k) { if (k >= from && k < to) i.style.display = ''; });

    tabs.forEach(function (t) {
      var on = t.getAttribute('data-filter') === f;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (menu) {
      [].slice.call(menu.children).forEach(function (li) {
        var on = li.getAttribute('data-filter') === f;
        li.classList.toggle('is-active', on);
        li.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }
    var active = tabs.filter(function (t) { return t.getAttribute('data-filter') === f; })[0];
    if (active && label) {
      label.textContent = tabText(active);
      var sd = select && select.querySelector('.ct-chip-dot');
      var ad = tabDot(active);
      if (sd && ad) sd.className = ad.className;
    }
    if (count) count.textContent = pad(match.length) + (match.length === 1 ? ' article' : ' articles');

    var empty = listEl.querySelector('.in-empty');
    if (match.length === 0) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'in-empty';
        empty.textContent = 'No articles in this category yet. Check back soon.';
        listEl.appendChild(empty);
      }
    } else if (empty) {
      empty.parentNode.removeChild(empty);
    }
    lastTotal = total;
    renderPager(match.length ? total : 0);
  }

  function setFilter(f) {
    state.f = valid.indexOf(f) === -1 ? 'all' : f;
    state.p = 1;
    render();
    writeUrl();
  }
  function go(p, scroll) {
    state.p = p;
    render();
    writeUrl();
    if (scroll && bar) {
      var y = bar.getBoundingClientRect().top + window.pageYOffset - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  function key(el, fn) {
    el.addEventListener('click', fn);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    });
  }
  tabs.forEach(function (t) {
    t.setAttribute('aria-selected', 'false');
    key(t, function () { setFilter(t.getAttribute('data-filter')); });
  });
  if (menu) {
    key(select, function () { openMenu(!menu.classList.contains('is-open')); });
    [].slice.call(menu.children).forEach(function (li) {
      key(li, function () { setFilter(li.getAttribute('data-filter')); openMenu(false); select.focus(); });
    });
    document.addEventListener('click', function (e) {
      if (!filterWrap.contains(e.target)) openMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') openMenu(false);
    });
  }

  var lastTotal = 1;
  if (prevB) key(prevB, function () { if (state.p > 1) go(state.p - 1, true); });
  if (nextB) key(nextB, function () { if (state.p < lastTotal) go(state.p + 1, true); });

  try {
    var q = new URLSearchParams(location.search);
    var bf = q.get('brand') || 'all';
    state.f = valid.indexOf(bf) === -1 ? 'all' : bf;
    state.p = parseInt(q.get('page'), 10) || 1;
  } catch (e) {}
  render();
})();
