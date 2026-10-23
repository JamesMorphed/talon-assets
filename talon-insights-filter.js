/* Talon Insights catalogue filter v1.0.0
   Brand tabs (desktop), dropdown (mobile), article count, empty state, ?brand= deep link. */
(function () {
  var root = document.querySelector('.in-catalog');
  if (!root) return;
  var grid = root.querySelector('.in-grid');
  if (!grid) return;

  var css =
    '.in-grid .w-dyn-list,.in-grid .w-dyn-items{display:contents}' +
    '.in-grid .w-dyn-empty{display:none}' +
    '.in-grid .w-dyn-item{min-width:0}' +
    '.in-grid [data-brand=scaffolding]{--in-b:#ff5a5f}' +
    '.in-grid [data-brand=roofing]{--in-b:#8a93ff}' +
    '.in-grid [data-brand=environmental]{--in-b:#ffb800}' +
    '.in-grid [data-brand=compliance]{--in-b:#3ad452}' +
    '.in-grid .sv-card-brand{color:var(--in-b,#e6ebf2)}' +
    '.in-grid .hv-ins-title{transition:color .3s}' +
    '.in-grid .hv-ins-card:hover .hv-ins-title,.in-grid .hv-ins-card:focus-visible .hv-ins-title{color:var(--in-b,#e6ebf2)}' +
    '.in-grid .hv-ins-img{transition:transform .6s cubic-bezier(.22,1,.36,1)}' +
    '.in-grid .hv-ins-card:hover .hv-ins-img{transform:scale(1.03)}' +
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
    '@media (max-width:767px){.in-catalog .sv-select{display:flex}.in-catalog .sv-tabs{display:none}}' +
    '@media (prefers-reduced-motion:reduce){.in-grid .hv-ins-img,.in-grid .hv-ins-title{transition:none}}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var tabs = [].slice.call(root.querySelectorAll('.sv-tab'));
  var select = root.querySelector('.sv-select');
  var label = root.querySelector('.sv-select-label');
  var count = root.querySelector('.in-count');
  var filterWrap = root.querySelector('.sv-filter');
  var items = [].slice.call(grid.querySelectorAll('.w-dyn-item'));
  var valid = tabs.map(function (t) { return t.getAttribute('data-filter'); });
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

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
      if (d) {
        var c = d.cloneNode(true);
        li.appendChild(c);
      }
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

  function apply(f, push) {
    if (valid.indexOf(f) === -1) f = 'all';
    var shown = 0;
    items.forEach(function (i) {
      var c = i.querySelector('[data-brand]');
      var b = c && c.getAttribute('data-brand');
      var on = f === 'all' || b === f;
      i.style.display = on ? '' : 'none';
      if (on) shown++;
    });
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
    if (count) count.textContent = pad(shown) + (shown === 1 ? ' article' : ' articles');

    var empty = grid.querySelector('.in-empty');
    if (shown === 0) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'in-empty';
        empty.textContent = 'No articles in this category yet. Check back soon.';
        grid.appendChild(empty);
      }
    } else if (empty) {
      empty.parentNode.removeChild(empty);
    }

    if (push && window.history && history.replaceState) {
      try {
        var u = new URL(location.href);
        if (f === 'all') u.searchParams.delete('brand'); else u.searchParams.set('brand', f);
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      } catch (e) {}
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
    key(t, function () { apply(t.getAttribute('data-filter'), true); });
  });

  if (menu) {
    key(select, function () { openMenu(!menu.classList.contains('is-open')); });
    [].slice.call(menu.children).forEach(function (li) {
      key(li, function () { apply(li.getAttribute('data-filter'), true); openMenu(false); select.focus(); });
    });
    document.addEventListener('click', function (e) {
      if (!filterWrap.contains(e.target)) openMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') openMenu(false);
    });
  }

  var start = 'all';
  try { start = new URLSearchParams(location.search).get('brand') || 'all'; } catch (e) {}
  apply(start, false);
})();
