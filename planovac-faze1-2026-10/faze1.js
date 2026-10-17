/* ============================================================================
   PrivateToursCzech – Plánovač výletů, Fáze 1 (sekce 0, 1, 7, 8, 11 + T1)
   faze1.js · verze 1.0 · 2026-10-17 · vanilla JS, bez závislostí
   Zadání: zadání vývojáři (dokument „Plánovač výletů – vyladění UI“) 

   Co dělá (vše idempotentně, nic neodesílá):
     A. tělo stránky plánovače dostane třídu `ptcz-planner` (sekce 11: bez šipky nahoru)
     B. lokalizace title/aria-label podle <html lang> (sekce 0)
     C. pole Start / Zastávky / Cíl: stav data-state, tlačítko ×, nápověda,
        aria-combobox atributy, posun stránky při fokusu na mobilu (sekce 1)
     D. našeptávač: varianta A = jen CSS na .pac-container (nic tu),
        varianta B (extras) = vlastní seznam .ptcz-ac s typem místa, ikonou,
        hlavičkou skupiny, patičkou a tipy při fokusu (sekce 1 + doplňky)
        – provider "suggestion" = google.maps.places.AutocompleteSuggestion (produkce; vyžaduje
          Places API (New) zapnuté na klíči),
        – provider "legacy-mirror" je JEN v faze1-demo.js (předloha nad dnešní nabídkou) – nekopírovat
     E. inline validace kroku 1 a 2 místo modálu #notice (sekce 8)
     F. pevná spodní lišta 72 px + spodní list s cenou, skrytí při klávesnici (sekce 7)
     G. WhatsApp 44 px nad lištou, skrytý při psaní (sekce 11)
     H. měření T1: dataLayer události, které vyvolá tento soubor; zbytek pushuje plugin (faze1-html.md §6)

   Integrace pro vývojáře: viz faze1-html.md (co změnit v šabloně a kde zavolat
   PTCZ_F1.hooks.onPlaceSelected). Bez hooků běží soubor i nad dnešním pluginem.
   ========================================================================== */
(function () {
  'use strict';
  if (window.PTCZ_F1 && window.PTCZ_F1.__inited) return;

  const LANG = ((document.documentElement.lang || 'en').toLowerCase().startsWith('cs')) ? 'cs' : 'en';

  /* ---------- Texty [M] – schvaluje majitel (EN / CZ) ---------------------- */
  const TEXTS = {
    en: {
      startLabel: 'Where do we pick you up?',
      startPlaceholder: 'Hotel, address or place in Prague',
      stopsHint: 'Type a place – e.g. Kutná Hora, Karlštejn Castle, Český Krumlov – and pick it from the list.',
      stopsPlaceholder: 'Search for places',
      endSameHint: 'Same as pickup – change it if you want to end somewhere else.',
      clear: 'Clear',
      noMatch: 'No match in Czechia or nearby – try the town name (e.g. Kutná Hora).',
      footCountries: 'Czechia and neighbouring countries',
      groupPlaces: 'Places',
      groupTips: 'From our tours',
      typeLabels: { airport: 'airport', hotel: 'hotel', castle: 'castle', town: 'town', address: 'address', place: 'place', station: 'station', nature: 'nature' },
      errStart: 'Please choose your pickup place from the list.',
      errEnd: 'Please choose your destination from the list.',
      errDate: 'Please choose the day and time of pickup.',
      errName: 'Please enter your full name.',
      errEmail: 'Please enter a valid e-mail address.',
      errEmailTypo: 'This e-mail looks incomplete – did you mean {s}?',
      errPhone: 'Please enter a phone number we can reach you on.',
      errSum: (n) => n === 1 ? '1 thing to fix' : n + ' things to fix',
      barEmpty: 'Add a stop to see the price',
      barSub: 'whole car, up to 8 · tap for details',
      sheetTitle: 'Price details',
      sheetFor: 'for the whole car, up to 8 people',
      included: ['English-speaking driver', 'Fuel, tolls and parking', 'No deposit – pay on the day', 'Free cancellation up to 24 h before pickup'],
      sheetHow: 'How is the price calculated?',
      sheetPay: 'You pay the driver on the day – card or cash. Entrance fees and meals are not included.',
      sheetWa: 'Questions? WhatsApp us',
      titles: { 'Přetáhnout': 'Drag to reorder', 'Odebrat zastávku': 'Remove stop', 'Detailní rozpis ceny': 'Price details', 'Více informací o přenocování': 'More about overnight stays', 'Zavřít': 'Close', 'Poznámka k místu': 'Stop note', 'Uložit': 'Save', 'Přidat poznámku': 'Add a note', 'Předchozí': 'Previous month', 'Další': 'Next month', 'Předchozí měsíc': 'Previous month', 'Další měsíc': 'Next month' }
    },
    cs: {
      startLabel: 'Kde vás vyzvedneme?',
      startPlaceholder: 'Hotel, adresa nebo místo v Praze',
      stopsHint: 'Napište místo – např. Kutná Hora, hrad Karlštejn, Český Krumlov – a vyberte ho z nabídky.',
      stopsPlaceholder: 'Vyhledávej místa',
      endSameHint: 'Stejné jako vyzvednutí – změňte, pokud chcete skončit jinde.',
      clear: 'Vymazat',
      noMatch: 'Nic v Česku ani v okolí – zkuste název města (např. Kutná Hora).',
      footCountries: 'Česko a sousední země',
      groupPlaces: 'Místa',
      groupTips: 'Z našich výletů',
      typeLabels: { airport: 'letiště', hotel: 'hotel', castle: 'hrad / zámek', town: 'město', address: 'adresa', place: 'místo', station: 'nádraží', nature: 'příroda' },
      errStart: 'Vyberte prosím místo vyzvednutí z nabídky.',
      errEnd: 'Vyberte prosím cíl z nabídky.',
      errDate: 'Vyberte prosím den a čas vyzvednutí.',
      errName: 'Zadejte prosím jméno a příjmení.',
      errEmail: 'Zadejte prosím platný e-mail.',
      errEmailTypo: 'E-mail vypadá neúplně – mysleli jste {s}?',
      errPhone: 'Zadejte prosím telefon, na kterém vás zastihneme.',
      errSum: (n) => n === 1 ? '1 věc k opravě' : (n < 5 ? n + ' věci k opravě' : n + ' věcí k opravě'),
      barEmpty: 'Přidejte zastávku a uvidíte cenu',
      barSub: 'celý vůz, až 8 osob · klepněte pro detail',
      sheetTitle: 'Rozpis ceny',
      sheetFor: 'za celý vůz, až 8 osob',
      included: ['Anglicky mluvící řidič', 'Palivo, mýtné a parkovné', 'Bez zálohy – platí se v den výletu', 'Storno zdarma do 24 h před vyzvednutím'],
      sheetHow: 'Jak se cena počítá?',
      sheetPay: 'Platíte řidiči v den výletu – kartou nebo hotově. Vstupné a jídlo nejsou v ceně.',
      sheetWa: 'Máte dotaz? Napište nám na WhatsApp',
      titles: {}
    }
  };
  const T = TEXTS[LANG];

  /* ---------- Konfigurace ------------------------------------------------- */
  const CONFIG = {
    extras: false,                 // doplňky z nového webu (typ místa, ikona, skupina, tipy)
    provider: 'auto',              // 'suggestion' | 'legacy-mirror' | 'auto'
    countries: ['cz', 'at', 'de', 'pl', 'sk'],       // legacy Autocomplete bere max. 5
    regionCodesNew: ['cz', 'at', 'de', 'pl', 'sk', 'hu'], // AutocompleteSuggestion bere až 15
    bounds: { south: 48.5, west: 12.1, north: 51.1, east: 18.9 }, // obdélník ČR = locationBias
    tips: [ // volitelné (extras): 5 tipů při fokusu prázdného pole Zastávky; placeId doplní vývojář
      { name: 'Kutná Hora', sub: { en: 'Central Bohemia · UNESCO', cs: 'Střední Čechy · UNESCO' }, type: 'town', placeId: null },
      { name: 'Karlštejn Castle', nameCs: 'Hrad Karlštejn', sub: { en: '30 km from Prague', cs: '30 km od Prahy' }, type: 'castle', placeId: null },
      { name: 'Český Krumlov', sub: { en: 'South Bohemia · UNESCO', cs: 'Jižní Čechy · UNESCO' }, type: 'town', placeId: null },
      { name: 'Bohemian Switzerland', nameCs: 'České Švýcarsko', sub: { en: 'national park, 120 km from Prague', cs: 'národní park, 120 km od Prahy' }, type: 'nature', placeId: null },
      { name: 'Karlovy Vary', sub: { en: 'spa town, 130 km from Prague', cs: 'lázně, 130 km od Prahy' }, type: 'town', placeId: null }
    ],
    minChars: 2,
    debounceMs: 220
  };

  const hooks = { onPlaceSelected: null }; // vývojář: (fieldKey, legacyPlace, input) → napojí na dnešní place_changed logiku

  /* ---------- Pomocné ----------------------------------------------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const on = (el, ev, fn, o) => el && el.addEventListener(ev, fn, o);
  const isMobile = () => window.innerWidth <= 991;
  const dl = (event, extra) => {
    window.dataLayer = window.dataLayer || [];
    const p = Object.assign({ event: event, planner_lang: LANG, planner_step: STEP, planner_variant: CONFIG.extras ? 'extras' : 'base' }, extra || {});
    window.dataLayer.push(p);
    return p;
  };
  const reservation = () => { try { return JSON.parse(localStorage.getItem('ptcz_reservation') || '{}') || {}; } catch (e) { return {}; } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const PATH = location.pathname;
  const IS_PLANNER = /\/(en\/trip-planner|planovac-vyletu|en\/prague-private-tours|planovac-vyletu-na-miru|en\/trip\/[^/]+\/book|vylet\/[^/]+\/book)(\/|$)/.test(PATH);
  const STEP = /\/(details|udaje)\/?$/.test(PATH) ? 2 : (/\/(summary|rekapitulace)\/?$/.test(PATH) ? 3 : 1);

  const ICONS = {
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    airport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 16l20-6-3-3-7 2-6-5-2 1 4 6-6 2-2-1-1 2 4 2z"/></svg>',
    hotel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18V8M21 18v-6a2 2 0 0 0-2-2H9v8M3 14h18M6 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>',
    castle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V8l2-2 2 2v3h2V8l2-2 2 2v3h2V8l2-2 2 2v13M4 21h16M10 21v-5h4v5"/></svg>',
    town: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l5-3v17M10 21V11l5-3v13M15 21V13l4-2v10"/></svg>',
    address: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    station: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l1.5-3M16 21l-1.5-3M9 14h.01M15 14h.01"/></svg>',
    nature: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l5 7h-3l4 6H6l4-6H7zM12 16v5"/></svg>'
  };

  /* ---------- A. Tělo stránky --------------------------------------------- */
  function markBody() {
    if (IS_PLANNER) document.body.classList.add('ptcz-planner');
    if (CONFIG.extras) document.body.classList.add('ptcz-ac-mode');
  }

  /* ---------- B. Lokalizace title/aria ------------------------------------ */
  function localizeTitles(root) {
    if (LANG !== 'en') return;
    $$('[title],[aria-label]', root || document).forEach((el) => {
      ['title', 'aria-label'].forEach((a) => {
        const v = el.getAttribute(a);
        if (v && T.titles[v.trim()]) el.setAttribute(a, T.titles[v.trim()]);
      });
    });
  }
  function watchTitles() {
    const mo = new MutationObserver((muts) => muts.forEach((m) => {
      if (m.type === 'attributes') localizeTitles(m.target.parentNode || document);
      m.addedNodes && m.addedNodes.forEach((n) => n.nodeType === 1 && localizeTitles(n.parentNode || n));
    }));
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title', 'aria-label'] });
    localizeTitles();
  }

  /* ---------- C. Pole s našeptávačem -------------------------------------- */
  const FIELDS = {}; // key → { key, input, wrap, fld, msg, hint, clear, ac, state, selectedValue }

  function typeFrom(types, name, sub) {
    const t = (types || []).join(' ');
    const n = (name || '').toLowerCase() + ' ' + (sub || '').toLowerCase();
    if (/airport/.test(t) || /\bairport\b|letiště|\(prg\)/.test(n)) return 'airport';
    if (/lodging|hotel/.test(t) || /\bhotel\b|\bhostel\b|\bpension\b|penzion|\bapart/.test(n)) return 'hotel';
    if (/castle/.test(t) || /\bcastle\b|chateau|château|\bhrad\b|zámek|\bburg\b|schloss|\bpalace\b|palác/.test(n)) return 'castle';
    if (/train_station|transit_station|bus_station/.test(t) || /station|nádraží|hlavní nádr/.test(n)) return 'station';
    if (/natural_feature|park|national_park/.test(t) || /national park|národní park|\bgorge\b|\bfalls\b|rocks\b|skály|\bkarst\b|\bkras\b|switzerland\b/.test(n)) return 'nature';
    if (/locality|administrative_area|political|postal_town|sublocality/.test(t)) return 'town';
    if (/street_address|route|premise|street_number/.test(t) || /\d/.test(name || '')) return 'address';
    if (!t) { // bez Google types (zrcadlo legacy nabídky – jen předloha): město = podřádek je jen země nebo „kraj, země“
      const COUNTRY = /(czechia|czech republic|česko|germany|německo|austria|rakousko|poland|polsko|slovakia|slovensko|hungary|maďarsko)$/i;
      const parts = (sub || '').split(',').map((x) => x.trim()).filter(Boolean);
      if (parts.length && COUNTRY.test(parts[parts.length - 1]) && parts.length <= 2 && !/\d/.test(sub) && (name || '').trim().split(/\s+/).length <= 3 && !/\d/.test(name || '')) return 'town';
      return 'place';
    }
    return 'place';
  }

  function wrapField(key, input, labelFor) {
    if (!input || FIELDS[key]) return null;
    const fld = input.closest('.form-group') || input.parentNode;
    fld.classList.add('ptcz-fld');
    fld.dataset.field = key;
    let wrap = input.parentNode;
    if (!wrap.classList.contains('ptcz-fld__wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'ptcz-fld__wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    }
    // × (44 px)
    let clear = wrap.querySelector('.ptcz-fld__clear');
    if (!clear) {
      clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'ptcz-fld__clear';
      clear.setAttribute('aria-label', T.clear);
      clear.textContent = T.clear;
      wrap.appendChild(clear);
    }
    // nápověda + zpráva (vývojář je dá do šablony; tady se doplní, když chybí)
    let hint = fld.querySelector('.ptcz-hint');
    if (!hint) {
      hint = document.createElement('p');
      hint.className = 'ptcz-hint';
      hint.id = 'ptcz-hint-' + key;
      (wrap.parentNode.classList.contains('destination-input-wrap') ? wrap.parentNode : wrap).insertAdjacentElement('afterend', hint);
    }
    let msg = fld.querySelector('.ptcz-msg');
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'ptcz-msg';
      msg.id = 'ptcz-msg-' + key;
      msg.setAttribute('role', 'status');
      msg.setAttribute('aria-live', 'polite');
      hint.insertAdjacentElement('afterend', msg);
    }
    // atributy pole
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'words');
    input.setAttribute('enterkeyhint', 'search');
    input.setAttribute('aria-describedby', hint.id + ' ' + msg.id);
    if (labelFor) { const lb = $('label[for="' + input.id + '"]'); if (!lb) { /* vývojář doplní <label for> */ } }
    const f = FIELDS[key] = { key, input, wrap, fld, msg, hint, clear, state: 'empty', selectedValue: null, ac: null };
    setState(f, input.value.trim() ? 'selected' : 'empty');
    on(clear, 'click', () => { input.value = ''; f.selectedValue = null; setState(f, 'empty'); clearError(key); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); });
    on(input, 'input', () => { f.selectedValue = null; setState(f, input.value.trim() ? 'typing' : 'empty'); if (f.err) revalidateSoon(key); });
    on(input, 'focus', () => { ensureRoomBelow(input); });
    on(input, 'blur', () => { setTimeout(() => validatePlaceField(key, true), 60); }); // 60 ms: výběr v nabídce (mousedown) proběhne dřív než blur
    return f;
  }
  function setState(f, s) { f.state = s; f.fld.dataset.state = s; }
  function markSelected(key, value) { const f = FIELDS[key]; if (!f) return; f.selectedValue = value || f.input.value; setState(f, 'selected'); clearError(key); }

  function ensureRoomBelow(input) {
    if (!isMobile()) return;
    setTimeout(() => {
      const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
      const r = input.getBoundingClientRect();
      const need = r.bottom + 160 - vh;
      if (need > 0) window.scrollBy({ top: need, behavior: 'smooth' });
    }, 260);
  }

  function setupStep1Fields() {
    const a1 = $('#autoComplete1'), poi = $('#search-poi'), a2 = $('#autoComplete2');
    if (!a1) return;
    // Texty [M]
    const lb1 = $('label[for="autoComplete1"]');
    if (lb1) { const tn = Array.prototype.filter.call(lb1.childNodes, (n) => n.nodeType === 3).pop(); if (tn) tn.textContent = T.startLabel; else lb1.appendChild(document.createTextNode(T.startLabel)); }
    a1.placeholder = T.startPlaceholder;
    if (poi) {
      poi.placeholder = T.stopsPlaceholder;
      const oldHint = poi.closest('.form-group') && poi.closest('.form-group').parentNode.querySelector(':scope > p');
      if (oldHint && !oldHint.classList.contains('ptcz-hint')) oldHint.classList.add('ptcz-hint--old');
      const lbStops = poi.closest('.form-group') && poi.closest('.form-group').parentNode.querySelector(':scope > label.labelz');
      if (lbStops && !lbStops.htmlFor) lbStops.htmlFor = 'search-poi'; // skutečný <label for>
    }
    wrapField('start', a1, true);
    if (poi) { const f = wrapField('stops', poi); f.hint.textContent = T.stopsHint; }
    if (a2) { const f = wrapField('end', a2, true); updateEndHint(); }
    // stav selected z localStorage (po návratu)
    const d = reservation();
    if (d.startPlaceId && a1.value.trim() && a1.value.trim() === String(d.start || '').trim()) markSelected('start', a1.value);
    if (a2 && d.endPlaceId && a2.value.trim() && a2.value.trim() === String(d.end || '').trim()) markSelected('end', a2.value);
  }
  function updateEndHint() {
    const f = FIELDS.end; if (!f) return;
    const d = reservation();
    const same = d.start && d.end && d.start === d.end;
    f.hint.textContent = same ? T.endSameHint : '';
    f.hint.dataset.same = same ? '1' : '0';
  }

  /* ---------- D. Našeptávač B (.ptcz-ac) ---------------------------------- */
  function buildAc(f) {
    if (f.ac) return f.ac;
    const ac = document.createElement('div');
    ac.className = 'ptcz-ac';
    ac.id = 'ptcz-ac-' + f.key;
    ac.setAttribute('role', 'listbox');
    f.wrap.appendChild(ac);
    f.input.setAttribute('role', 'combobox');
    f.input.setAttribute('aria-autocomplete', 'list');
    f.input.setAttribute('aria-expanded', 'false');
    f.input.setAttribute('aria-controls', ac.id);
    f.input.setAttribute('aria-haspopup', 'listbox');
    f.ac = ac;
    f.items = [];
    on(ac, 'mousedown', (e) => { e.preventDefault(); }); // nezavřít pole blur-em před klikem
    on(ac, 'click', (e) => { const it = e.target.closest('.ptcz-ac__item'); if (!it) return; chooseItem(f, Number(it.dataset.i)); });
    on(f.input, 'keydown', (e) => {
      if (ac.dataset.open !== '1' || CONFIG.provider === 'legacy-mirror') return; // v mirroru klávesy řeší Google
      const n = f.items.length; if (!n) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); highlight(f, (f.hi + 1) % n); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(f, (f.hi - 1 + n) % n); }
      else if (e.key === 'Enter') { if (f.hi >= 0) { e.preventDefault(); chooseItem(f, f.hi); } }
      else if (e.key === 'Escape') { closeAc(f); }
    });
    return ac;
  }
  function highlight(f, i) {
    f.hi = i;
    $$('.ptcz-ac__item', f.ac).forEach((el, k) => { el.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    const el = f.ac.querySelector('.ptcz-ac__item[data-i="' + i + '"]');
    f.input.setAttribute('aria-activedescendant', el ? el.id : '');
  }
  function renderAc(f, items, opts) {
    opts = opts || {};
    const ac = buildAc(f);
    f.items = items; f.hi = -1;
    let html = '';
    if (!items.length) {
      html += '<div class="ptcz-ac__empty">' + esc(T.noMatch) + '</div>';
    } else {
      if (CONFIG.extras) html += '<div class="ptcz-ac__group">' + esc(opts.group || T.groupPlaces) + '</div>';
      items.forEach((it, i) => {
        const type = it.type || 'place';
        const label = CONFIG.extras ? (T.typeLabels[type] || T.typeLabels.place) : '';
        const sub = CONFIG.extras && label ? (label + (it.sub ? ' · ' + it.sub : '')) : (it.sub || '');
        html += '<div class="ptcz-ac__item" role="option" id="' + ac.id + '-' + i + '" data-i="' + i + '" data-type="' + type + '" aria-selected="false">' +
          '<span class="ptcz-ac__ico" aria-hidden="true">' + (ICONS[CONFIG.extras ? type : 'pin'] || ICONS.pin) + '</span>' +
          '<span class="ptcz-ac__txt"><span class="ptcz-ac__name">' + it.nameHtml + '</span>' +
          (sub ? '<span class="ptcz-ac__sub">' + esc(sub) + '</span>' : '') + '</span></div>';
      });
    }
    html += '<div class="ptcz-ac__foot"><span>' + esc(T.footCountries) + '</span><img alt="Google" src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"></div>';
    if (ac.__html !== html) { ac.innerHTML = html; ac.__html = html; }
    ac.dataset.open = '1';
    f.input.setAttribute('aria-expanded', 'true');
  }
  function closeAc(f) { if (!f.ac) return; f.ac.dataset.open = '0'; f.input.setAttribute('aria-expanded', 'false'); f.input.removeAttribute('aria-activedescendant'); }
  function markMatch(text, q) {
    const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<b>' + esc(text.slice(i, i + q.length)) + '</b>' + esc(text.slice(i + q.length));
  }
  function chooseItem(f, i) {
    const it = f.items[i]; if (!it) return;
    if (it.tip) { // tip: vyplnit text, nechat vyhledat
      f.input.value = it.name; f.input.dispatchEvent(new Event('input', { bubbles: true })); f.input.focus(); return;
    }
    if (it.select) { it.select(); }
    closeAc(f);
  }
  function showTips(f) {
    if (!CONFIG.extras || f.key !== 'stops' || f.input.value.trim()) return;
    const items = CONFIG.tips.map((t) => ({ tip: true, name: (LANG === 'cs' && t.nameCs) || t.name, nameHtml: esc((LANG === 'cs' && t.nameCs) || t.name), sub: t.sub[LANG], type: t.type }));
    renderAc(f, items, { group: T.groupTips });
  }

  /* --- provider "suggestion" (produkce, nové Places API) --- */
  function providerSuggestion(f) {
    let token = null, timer = null, seq = 0;
    const P = window.google.maps.places;
    on(f.input, 'focus', () => showTips(f));
    on(f.input, 'blur', () => setTimeout(() => closeAc(f), 150));
    on(f.input, 'input', () => {
      const q = f.input.value.trim();
      clearTimeout(timer);
      if (q.length < CONFIG.minChars) { if (!q) showTips(f); else closeAc(f); return; }
      timer = setTimeout(async () => {
        const my = ++seq;
        if (!token) token = new P.AutocompleteSessionToken();
        try {
          const b = CONFIG.bounds;
          const res = await P.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: q, sessionToken: token, language: LANG === 'cs' ? 'cs' : 'en', region: 'cz',
            includedRegionCodes: CONFIG.regionCodesNew,
            locationBias: { south: b.south, west: b.west, north: b.north, east: b.east }
          });
          if (my !== seq) return;
          const items = (res.suggestions || []).slice(0, 5).map((s) => {
            const pp = s.placePrediction;
            const name = pp.mainText ? pp.mainText.text : pp.text.text;
            const sub = pp.secondaryText ? pp.secondaryText.text : '';
            return {
              name, sub, nameHtml: markMatch(name, q), type: typeFrom(pp.types, name, sub), placeId: pp.placeId,
              select: async () => {
                const place = pp.toPlace();
                await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress', 'id', 'addressComponents', 'types'] });
                token = null; // nová relace po výběru
                const legacy = {
                  geometry: { location: place.location },
                  name: place.displayName, formatted_address: place.formattedAddress, place_id: place.id, types: place.types,
                  address_components: (place.addressComponents || []).map((c) => ({ long_name: c.longText, short_name: c.shortText, types: c.types }))
                };
                f.input.value = name + (sub ? ', ' + sub : '');
                markSelected(f.key, f.input.value);
                if (typeof hooks.onPlaceSelected === 'function') hooks.onPlaceSelected(f.key, legacy, f.input);
                dl('planner_place_selected', { planner_field: f.key, planner_place_type: typeFrom(place.types, name, sub) });
              }
            };
          });
          renderAc(f, items);
        } catch (e) { console.warn('[PTCZ_F1] AutocompleteSuggestion', e); closeAc(f); }
      }, CONFIG.debounceMs);
    });
  }

  function setupAutocomplete() {
    if (!CONFIG.extras) return; // varianta A: jen CSS na .pac-container
    const keys = Object.keys(FIELDS); if (!keys.length) return;
    let prov = CONFIG.provider;
    if (prov === 'auto') prov = (window.google && window.google.maps && window.google.maps.places && window.google.maps.places.AutocompleteSuggestion && typeof hooks.onPlaceSelected === 'function') ? 'suggestion' : (providers['legacy-mirror'] ? 'legacy-mirror' : 'none');
    CONFIG.provider = prov;
    if (prov === 'none') { console.warn('[PTCZ_F1] extras: chybí provider (AutocompleteSuggestion + hooks.onPlaceSelected) – nabídka zůstává legacy (varianta A)'); document.body.classList.remove('ptcz-ac-mode'); return; }
    keys.forEach((k) => buildAc(FIELDS[k]));
    if (prov === 'suggestion') keys.forEach((k) => providerSuggestion(FIELDS[k]));
    else if (providers[prov]) providers[prov](FIELDS);
  }
  const providers = { suggestion: providerSuggestion }; // další (demo) registruje faze1-demo.js

  /* ---------- E. Validace (sekce 8) ---------------------------------------- */
  const ERRORS = {}; // key → text
  function msgEl(key) { const f = FIELDS[key]; return f ? f.msg : $('#ptcz-msg-' + key); }
  function fldEl(key) { const f = FIELDS[key]; return f ? f.fld : ($('#ptcz-msg-' + key) || {}).closest && $('#ptcz-msg-' + key).closest('.ptcz-fld'); }
  function setError(key, text, input) {
    const m = msgEl(key), fl = fldEl(key);
    if (!m) return;
    const was = ERRORS[key];
    ERRORS[key] = text; m.textContent = text;
    if (fl) fl.classList.add('err');
    if (input) input.setAttribute('aria-invalid', 'true');
    if (FIELDS[key]) { FIELDS[key].err = true; if (FIELDS[key].state !== 'empty') setState(FIELDS[key], 'invalid'); }
    if (was !== text) dl('planner_field_error', { planner_field: key, planner_error_type: key === 'email' && /\?/.test(text) ? 'typo' : (input && !input.value.trim() ? 'empty' : 'invalid') });
    updateSummary();
  }
  function clearError(key, input) {
    const m = msgEl(key), fl = fldEl(key);
    delete ERRORS[key];
    if (m) m.textContent = '';
    if (fl) fl.classList.remove('err');
    const inp = input || (FIELDS[key] && FIELDS[key].input);
    if (inp) inp.removeAttribute('aria-invalid');
    if (FIELDS[key]) { FIELDS[key].err = false; if (FIELDS[key].state === 'invalid') setState(FIELDS[key], FIELDS[key].input.value.trim() ? (FIELDS[key].selectedValue ? 'selected' : 'typing') : 'empty'); }
    updateSummary();
  }
  let sumEl = null;
  function updateSummary() {
    const btn = $('#continue-btn'); if (!btn) return;
    if (!sumEl) { sumEl = document.createElement('div'); sumEl.className = 'ptcz-errsum'; sumEl.setAttribute('role', 'status'); sumEl.setAttribute('aria-live', 'polite'); const host = btn.closest('.tlacitko') || btn.parentNode; host.parentNode.insertBefore(sumEl, host); }
    const n = Object.keys(ERRORS).length;
    sumEl.textContent = n ? T.errSum(n) : '';
  }
  const revalTimers = {};
  function revalidateSoon(key) { clearTimeout(revalTimers[key]); revalTimers[key] = setTimeout(() => { if (STEP === 1) validatePlaceField(key, false); else validateStep2Field(key, false); }, 120); }

  function placeSelected(key) {
    const f = FIELDS[key]; if (!f) return false;
    const v = f.input.value.trim(); if (!v) return false;
    if (f.selectedValue && f.selectedValue === v) return true;
    const d = reservation();
    if (key === 'start' && d.startPlaceId && String(d.start || '').trim() === v) { markSelected(key, v); return true; }
    if (key === 'end' && d.endPlaceId && String(d.end || '').trim() === v) { markSelected(key, v); return true; }
    return false;
  }
  function validatePlaceField(key, onBlur) {
    const f = FIELDS[key]; if (!f || key === 'stops') return true;
    const v = f.input.value.trim();
    if (!v) { if (f.err || !onBlur) { if (!onBlur) setError(key, key === 'start' ? T.errStart : T.errEnd, f.input); else clearError(key); } return !f.err; }
    if (placeSelected(key)) { if (f.err) clearError(key); return true; }
    setError(key, key === 'start' ? T.errStart : T.errEnd, f.input);
    return false;
  }
  function validateDate() {
    const inp = $('#departure'); if (!inp) return true;
    if (!$('#ptcz-msg-date')) { const m = document.createElement('p'); m.className = 'ptcz-msg'; m.id = 'ptcz-msg-date'; m.setAttribute('role', 'status'); m.setAttribute('aria-live', 'polite'); const host = inp.closest('.form-group') || inp.parentNode; host.classList.add('ptcz-fld'); host.appendChild(m); inp.setAttribute('aria-describedby', 'ptcz-msg-date'); }
    if (!inp.value.trim()) { setError('date', T.errDate, inp); return false; }
    clearError('date', inp); return true;
  }
  function focusFirstError() {
    const first = Object.keys(ERRORS)[0]; if (!first) return;
    const inp = FIELDS[first] ? FIELDS[first].input : (first === 'date' ? $('#departure') : $('#ptcz-msg-' + first) && $('#ptcz-msg-' + first).closest('.ptcz-fld').querySelector('input,textarea'));
    if (!inp) return;
    inp.scrollIntoView({ block: 'center', behavior: 'auto' }); // okamžitě: pole musí být ve viewportu do 100 ms
    if (first === 'date') { inp.focus({ preventScroll: true }); } else { inp.focus({ preventScroll: true }); }
  }
  function setupStep1Validation() {
    const btn = $('#continue-btn'); if (!btn || STEP !== 1) return;
    const dep = $('#departure');
    on(dep, 'change', () => { if (ERRORS.date) validateDate(); });
    on(dep, 'click', () => dl('planner_calendar_open'));
    // kontrola dokud je chyba (plugin mění hodnoty bez událostí)
    setInterval(() => {
      Object.keys(ERRORS).forEach((k) => { if (k === 'date') { if (dep && dep.value.trim()) clearError('date', dep); } else if (FIELDS[k] && placeSelected(k)) clearError(k); });
      // plugin mění hodnoty bez událostí (vyprázdnění Zastávek po výběru, doplnění Cíle) → srovnat stav pole
      Object.keys(FIELDS).forEach((k) => { const f = FIELDS[k]; const v = f.input.value.trim(); if (!v && f.state !== 'empty') { f.selectedValue = null; setState(f, 'empty'); } else if (v && f.state === 'typing' && placeSelected(k)) setState(f, 'selected'); });
      updateEndHint();
    }, 400);
    document.addEventListener('click', (e) => {
      if (e.target !== btn && !btn.contains(e.target)) return;
      const ok = [validatePlaceField('start', false), validateDate(), validatePlaceField('end', false)].every(Boolean);
      if (!ok) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        focusFirstError();
        dl('planner_validation_error', { planner_errors: Object.keys(ERRORS).join(','), planner_error_type: Object.keys(ERRORS)[0] });
      } else {
        dl('planner_continue_click', { planner_stops: (reservation().stops || []).length });
      }
    }, true);
  }

  /* --- krok 2 --- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  const DOMAIN_FIX = { 'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'gmai.com': 'gmail.com', 'gmial.com': 'gmail.com', 'gmail': 'gmail.com', 'hotmail.con': 'hotmail.com', 'hotmail': 'hotmail.com', 'yahoo.con': 'yahoo.com', 'yahoo': 'yahoo.com', 'outlook.con': 'outlook.com', 'outlook': 'outlook.com', 'icloud': 'icloud.com', 'seznam': 'seznam.cz', 'seznam.com': 'seznam.cz' };
  function emailSuggestion(v) {
    const at = v.indexOf('@'); if (at < 1) return null;
    const dom = v.slice(at + 1).toLowerCase();
    if (DOMAIN_FIX[dom]) return v.slice(0, at + 1) + DOMAIN_FIX[dom];
    return null;
  }
  function step2Field(key) {
    const sel = { name: '#your-name', email: '#your-email', phone: '#phone' }[key];
    const input = $(sel); if (!input) return null;
    if (!$('#ptcz-msg-' + key)) {
      const host = input.closest('.form-group') || input.parentNode;
      host.classList.add('ptcz-fld');
      const m = document.createElement('p'); m.className = 'ptcz-msg'; m.id = 'ptcz-msg-' + key; m.setAttribute('role', 'status'); m.setAttribute('aria-live', 'polite');
      host.appendChild(m);
      input.setAttribute('aria-describedby', m.id);
      if (key === 'name') { input.setAttribute('autocomplete', 'name'); input.setAttribute('autocapitalize', 'words'); }
      if (key === 'email') { input.setAttribute('inputmode', 'email'); input.setAttribute('autocomplete', 'email'); input.setAttribute('autocapitalize', 'off'); input.setAttribute('spellcheck', 'false'); }
      if (key === 'phone') { input.setAttribute('inputmode', 'tel'); input.setAttribute('autocomplete', 'tel'); }
    }
    return input;
  }
  function validateStep2Field(key, onBlur) {
    const input = step2Field(key); if (!input) return true;
    const v = input.value.trim();
    if (key === 'name') { if (!v) { if (!onBlur || ERRORS.name) setError('name', T.errName, input); return !!v; } clearError('name', input); return true; }
    if (key === 'email') {
      if (!v) { if (!onBlur || ERRORS.email) setError('email', T.errEmail, input); return false; }
      const sug = emailSuggestion(v);
      if (sug) { setError('email', T.errEmailTypo.replace('{s}', sug), input); return false; }
      if (!EMAIL_RE.test(v)) { setError('email', T.errEmail, input); return false; }
      clearError('email', input); return true;
    }
    if (key === 'phone') {
      const ok = window.iti && typeof window.iti.isValidNumber === 'function' ? window.iti.isValidNumber() : !!v;
      if (!ok) { if (!onBlur || ERRORS.phone || v) setError('phone', T.errPhone, input); return false; }
      clearError('phone', input); return true;
    }
    return true;
  }
  function setupStep2Validation() {
    const btn = $('#continue-btn'); if (!btn || STEP !== 2) return;
    ['name', 'email', 'phone'].forEach((k) => {
      const inp = step2Field(k); if (!inp) return;
      on(inp, 'blur', () => validateStep2Field(k, true));
      on(inp, 'input', () => { if (ERRORS[k]) revalidateSoon(k); });
    });
    document.addEventListener('click', (e) => {
      if (e.target !== btn && !btn.contains(e.target)) return;
      const ok = ['name', 'email', 'phone'].map((k) => validateStep2Field(k, false)).every(Boolean);
      if (!ok) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); focusFirstError(); dl('planner_validation_error', { planner_errors: Object.keys(ERRORS).join(',') }); }
      else dl('planner_continue_click');
    }, true);
  }

  /* ---------- F. Pevná lišta + spodní list (sekce 7) ----------------------- */
  let bar = null, sheet = null;
  function priceText() {
    const el = $('#ptcz-price-display') || $('#summary-price');
    return el ? el.textContent.trim() : '';
  }
  function hasPriceContent() { const d = reservation(); return Array.isArray(d.stops) && d.stops.length > 0 || (d.end && d.start && d.end !== d.start); }
  function setupBar() {
    const t = $('.tlacitko'); const btn = $('#continue-btn'); if (!t || !btn) return;
    bar = t;
    let pb = t.querySelector('.ptcz-bar__price');
    if (!pb) {
      pb = document.createElement('button');
      pb.type = 'button'; pb.className = 'ptcz-bar__price';
      pb.setAttribute('aria-expanded', 'false'); pb.setAttribute('aria-controls', 'ptcz-sheet');
      pb.innerHTML = '<span class="ptcz-bar__top"><span class="ptcz-bar__val"></span><span class="ptcz-bar__i" aria-hidden="true"></span></span><span class="ptcz-bar__sub"></span>';
      if (btn.parentNode === t) t.insertBefore(pb, btn); else t.insertBefore(pb, t.firstChild);
      on(pb, 'click', () => openSheet());
    }
    function refresh() {
      const val = pb.querySelector('.ptcz-bar__val'), sub = pb.querySelector('.ptcz-bar__sub');
      const empty = STEP === 1 && !hasPriceContent();
      const nv = empty ? T.barEmpty : (priceText() || '–'), ns = empty ? '' : T.barSub;
      if (val.textContent !== nv) val.textContent = nv;              // zapisovat jen při změně (jinak smyčka MutationObserveru)
      if (val.dataset.empty !== (empty ? '1' : '0')) val.dataset.empty = empty ? '1' : '0';
      if (sub.textContent !== ns) sub.textContent = ns;
      const ico = pb.querySelector('.ptcz-bar__i'); const d = empty ? 'none' : ''; if (ico.style.display !== d) ico.style.display = d;
    }
    refresh();
    const mo = new MutationObserver((muts) => { if (muts.some((m) => !m.target.closest || !m.target.closest('.ptcz-bar__price'))) refresh(); });
    mo.observe(t, { subtree: true, childList: true, characterData: true });
    setInterval(refresh, 800);
    // skrytí při klávesnici
    const isText = (el) => el && el.matches && el.matches('input:not([readonly]):not([type="checkbox"]):not([type="radio"]), textarea');
    on(document, 'focusin', (e) => { if (isText(e.target) && isMobile()) hideBar(true); });
    on(document, 'focusout', (e) => { if (isText(e.target)) setTimeout(() => { if (!isText(document.activeElement)) hideBar(false); }, 120); });
    if (window.visualViewport) on(window.visualViewport, 'resize', () => { if (window.visualViewport.height < window.innerHeight * 0.75) hideBar(true); else if (!isText(document.activeElement)) hideBar(false); });
  }
  function hideBar(h) {
    if (bar) bar.classList.toggle('is-hidden', h);
    waKeyboardHidden = !!h; updateWa();
  }
  function buildSheet() {
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.className = 'ptcz-sheet'; sheet.id = 'ptcz-sheet';
    sheet.innerHTML = '<div class="ptcz-sheet__dim"></div><div class="ptcz-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="ptcz-sheet-title">' +
      '<div class="ptcz-sheet__grip"></div><div class="ptcz-sheet__head"><h2 class="ptcz-sheet__title" id="ptcz-sheet-title">' + esc(T.sheetTitle) + '</h2><button type="button" class="ptcz-sheet__close" aria-label="' + esc(LANG === 'cs' ? 'Zavřít' : 'Close') + '">×</button></div>' +
      '<div class="ptcz-sheet__total"><b class="ptcz-sheet__val"></b></div><p class="ptcz-sheet__for">' + esc(T.sheetFor) + '</p>' +
      '<ul class="ptcz-sheet__inc">' + T.included.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul>' +
      '<details class="ptcz-sheet__detail"><summary>' + esc(T.sheetHow) + '</summary><ul class="ptcz-sheet__rows"></ul></details>' +
      '<p class="ptcz-sheet__pay">' + esc(T.sheetPay) + '</p>' +
      '<a class="ptcz-sheet__wa" target="_blank" rel="noopener" href="' + esc(($('#ptcz-wa-btn') || {}).href || 'https://wa.me/420737194194') + '">' + esc(T.sheetWa) + '</a></div>';
    document.body.appendChild(sheet);
    const close = () => closeSheet();
    on($('.ptcz-sheet__dim', sheet), 'click', close);
    on($('.ptcz-sheet__close', sheet), 'click', close);
    on(document, 'keydown', (e) => { if (e.key === 'Escape' && sheet.dataset.open === '1') close(); });
    return sheet;
  }
  function openSheet() {
    const s = buildSheet();
    $('.ptcz-sheet__val', s).textContent = priceText() || '–';
    const rows = $('.ptcz-sheet__rows', s); rows.innerHTML = '';
    $$('#summary-breakdown-wrapper-down .summary-row, #summary-breakdown .summary-row, #summary-breakdown li').forEach((r) => {
      const sp = r.querySelector('span'), st = r.querySelector('strong');
      const li = document.createElement('li');
      li.innerHTML = '<span>' + esc(sp ? sp.textContent.trim() : r.textContent.trim()) + '</span><strong>' + esc(st ? st.textContent.trim() : '') + '</strong>';
      rows.appendChild(li);
    });
    s.dataset.open = '1';
    $('.ptcz-bar__price', bar || document) && $('.ptcz-bar__price', bar || document).setAttribute('aria-expanded', 'true');
    $('.ptcz-sheet__close', s).focus();
    dl('planner_price_details_open');
  }
  function closeSheet() { if (!sheet) return; sheet.dataset.open = '0'; const pb = $('.ptcz-bar__price'); if (pb) { pb.setAttribute('aria-expanded', 'false'); pb.focus(); } }

  /* ---------- H. Měření T1 ----------------------------------------------- */
  /* Produkční kód pushuje jen události, které sám vyvolá: planner_field_error, planner_validation_error,
     planner_continue_click, planner_calendar_open, planner_price_details_open, planner_place_selected.
     planner_start_set / stop_added / stop_removed / price_shown / date_set má pushovat PLUGIN ve chvíli,
     kdy událost vzniká (viz faze1-html.md §6). V předloze je odvozuje faze1-demo.js ze zápisů do localStorage. */

  /* ---------- G. WhatsApp (sekce 11) – dočasné schování při překryvu ------- */
  /* Ikona 44 px nad lištou (rozhodnutí majitele 16. 10.). Když by při scrollu ležela nad polem nebo
     ovládacím prvkem, dostane třídu is-hidden (data-hidden="overlap"); po odscrollování se vrátí.
     Při psaní ji skrývá hideBar() (data-hidden="keyboard"). */
  let waKeyboardHidden = false;
  function waOverlaps(wa) {
    const w = wa.getBoundingClientRect(); if (!w.width) return false;
    const vh = window.innerHeight;
    const els = document.querySelectorAll('.ptcz-reservation input, .ptcz-reservation button, .ptcz-reservation select, .ptcz-reservation textarea, .ptcz-reservation a, .ptcz-reservation [role="button"], .ptcz-ac, .pac-container');
    for (const e of els) {
      if (e.closest('#map, .map-wrapper, .tlacitko')) continue;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > vh) continue;
      if (getComputedStyle(e).visibility === 'hidden') continue;
      if (Math.min(w.right, r.right) - Math.max(w.left, r.left) > 0 && Math.min(w.bottom, r.bottom) - Math.max(w.top, r.top) > 0) return true;
    }
    return false;
  }
  function updateWa() {
    const wa = $('#ptcz-wa-btn'); if (!wa) return;
    if (waKeyboardHidden) { wa.classList.add('is-hidden'); wa.dataset.hidden = 'keyboard'; return; }
    const was = wa.classList.contains('is-hidden');
    if (was) { wa.classList.remove('is-hidden'); } // změřit v zobrazené poloze
    const ov = waOverlaps(wa);
    wa.classList.toggle('is-hidden', ov);
    if (ov) wa.dataset.hidden = 'overlap'; else delete wa.dataset.hidden;
  }
  function setupWhatsApp() {
    const wa = $('#ptcz-wa-btn'); if (!wa) return;
    let raf = 0; const sched = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; updateWa(); }); };
    on(window, 'scroll', sched, { passive: true }); on(window, 'resize', sched);
    new MutationObserver(sched).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'data-open'] });
    setInterval(sched, 500);
    sched();
  }

  /* ---------- Init ---------------------------------------------------------- */
  function init(opts) {
    Object.assign(CONFIG, opts || {});
    if (window.PTCZ_F1.__inited) return;
    window.PTCZ_F1.__inited = true;
    markBody();
    watchTitles();
    if (STEP === 1) { setupStep1Fields(); setupAutocomplete(); setupStep1Validation(); }
    if (STEP === 2) setupStep2Validation();
    setupBar();
    setupWhatsApp();
  }

  window.PTCZ_F1 = Object.assign(window.PTCZ_F1 || {}, { init, config: CONFIG, texts: TEXTS, hooks, providers, fields: FIELDS, errors: ERRORS, openSheet, closeSheet, hideBar, updateWa, lang: LANG, step: STEP, typeFrom,
    _int: { $, $$, on, dl, reservation, renderAc, highlight, showTips, closeAc, markSelected, setState, updateEndHint, markMatch } /* interní – jen pro faze1-demo.js */ });
  if (!window.PTCZ_F1_NOAUTO) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
    else setTimeout(() => init(), 0);
  }
})();
