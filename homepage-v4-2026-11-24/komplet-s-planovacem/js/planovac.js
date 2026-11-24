/* ============================================================================
   PrivateToursCzech v1 — nový plánovač, krok 1 (náhled v4-s-planovacem, 27. 10. 2026)
   Vanilla JS, bez knihoven. Data: js/stops-data.js (= stops-data.v1.json, generuje _build/build-planovac.cjs).
   Texty rozhraní: window.PTCZ_T (CZ / EN, vloží šablona). Jazyk: <html lang>.

   CO POČÍTÁ SKUTEČNĚ: cena za vůz (Staria / Tesla) ze sazeb doplňku vozu, jízdní doby z matice OSRM × 1,1,
   rozpočet dne a řadu „K zastávce … se hodí“ (PRILOHA §3), stavový automat vozu (DOPLNEK kap. 3.2 + 16).
   CO JE UKÁZKA: km u vlastní trasy (odhad vzdušná čára × 1,35 – v produkci Google Directions), hledání
   „Jiné místo…“ (statický seznam míst z JSON místo Google Places), blokované dny (demo přepínač), krok 2–3.
   ========================================================================== */
(function () {
  'use strict';
  var D = window.PTCZ_STOPS, T = window.PTCZ_T;
  var LANG = (document.documentElement.lang || 'cs').slice(0, 2);
  var dl = window.dataLayer = window.dataLayer || [];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var icon = function (id, cls) { return '<svg class="' + (cls || 'i') + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; };
  var tpl = function (s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); };

  /* ---------------- data ---------------- */
  var P = {}; D.places.forEach(function (p) { P[p.id] = p; });
  var MAIN = D.places.filter(function (p) { return p.main; }).sort(function (a, b) { return a.order - b.order; }).map(function (p) { return p.id; });
  var IDX = {}; D.matrix.ids.forEach(function (id, i) { IDX[id] = i; });
  var F = D.drive_factor, TH = D.thresholds;
  var Mraw = function (a, b) { return D.matrix.minutes[IDX[a]][IDX[b]]; };          // surové minuty OSRM
  var M = function (a, b) { return Math.round(Mraw(a, b) * F); };                    // zobrazený čas × 1,1
  var FUN = { wine: 1, beer: 1, castle: 1 };
  var name = function (p) { return p.name[LANG] || p.name.en; };
  var txt = function (p, k) { return p[k] ? (p[k][LANG] || p[k].en) : ''; };
  var photo = function (p) { return p.photo ? 'img/ext/planovac/' + p.id + '.jpg' : null; };
  var colOf = function (p) { return D.tag_colors[p.tags[0]] || '#5B6070'; };
  var tripUrl = function (p) { return LANG === 'cs' ? (p.trip_cs ? 'https://privatetoursczech.cz/vylet/' + p.trip_cs + '/' : null) : (p.trip ? 'https://privatetoursczech.cz/en/trip/' + p.trip + '/' : null); };

  /* ---------------- sazby (DOPLNEK kap. 1; RF 26. 10.) ---------------- */
  var RATES = {
    staria: { slug: 'staria', name: 'Hyundai Staria 4×4', short: 'Hyundai Staria', km: 34, min: 7, stop: 100, max: 8, bags: 8, seats: 4, ico: 'van' },
    'tesla-y': { slug: 'tesla-y', name: 'Tesla Model Y', short: 'Tesla Model Y', km: 27, min: 5.6, stop: 80, max: 4, bags: 4, seats: 2, ico: 'suv' }
  };
  var G = { overnight: 2000, minimum: 3000, guideHour: 200, kmFactor: 1.35 };

  /* Hotové výlety z homepage: pořadí zastávek a km trasy. km Kutná Hora / Krumlov / Karlštejn = seed stránek výletů (DOPLNEK kap. 12);
     ostatní km dopočítané zpětně z ceny karty (Staria) stejným vzorcem – viz README. */
  var TRIPS = {
    'kutna-hora-bone-church': { stops: [['sedlec', 30], ['stbarbara', 60]], km: 172.417, title: { cs: 'Kutná Hora', en: 'Kutná Hora' } },
    'cesky-krumlov-and-hluboka-castle': { stops: [['hluboka', 90], ['krumlov', 180]], km: 357.875, title: { cs: 'Český Krumlov a zámek Hluboká', en: 'Český Krumlov and Hluboká Castle' } },
    'karlstejn-castle-and-velka-amerika-quarry': { stops: [['karlstejn', 120], ['velkaamerika', 60]], km: 77.697, title: { cs: 'Hrad Karlštejn a lom Velká Amerika', en: 'Karlštejn Castle and Velká Amerika Quarry' } },
    'bohemian-switzerland': { stops: [['bswitz', 180], ['bastei', 60]], km: 308.088, title: { cs: 'České Švýcarsko a Saské Švýcarsko', en: 'Bohemian Switzerland' } },
    'dresden-and-pirna-christmas-magic': { stops: [['pirna', 60], ['dresden', 240]], km: 299.324, title: { cs: 'Adventní kouzlo Drážďan a Pirny', en: 'Dresden and Pirna Christmas Magic' } },
    'karlovy-vary-and-loket-castle': { stops: [['kvary', 150], ['loket', 60]], km: 284.0, title: { cs: 'Karlovy Vary a hrad Loket', en: 'Karlovy Vary and Loket Castle' } }
  };
  var TRIP_CS = { 'kutna-hora-sedlecka-kostnice': 'kutna-hora-bone-church', 'cesky-krumlov-a-zamek-hluboka': 'cesky-krumlov-and-hluboka-castle', 'hrad-karlstejn-a-lom-velka-amerika': 'karlstejn-castle-and-velka-amerika-quarry', 'ceske-svycarsko': 'bohemian-switzerland', 'adventni-kouzlo-drazdan-a-pirny': 'dresden-and-pirna-christmas-magic', 'karlovy-vary-a-hrad-loket': 'karlovy-vary-and-loket-castle' };

  /* ---------------- formáty ---------------- */
  var money = function (n) { n = Math.round(n); var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, LANG === 'cs' ? ' ' : ','); return LANG === 'cs' ? s + ' Kč' : s + ' CZK'; };
  var fmtH = function (m) { var h = Math.floor(m / 60), r = m % 60; return (h ? h + ' h' : '') + (r ? (h ? ' ' : '') + r + ' min' : '') || '0 min'; };
  var fmtDur = function (m) { if (m < 0) return T.overnight; if (m < 60) return m + ' min'; var h = m / 60; return (Number.isInteger(h) ? h : String(h).replace('.', LANG === 'cs' ? ',' : '.')) + ' h'; };
  var num = function (n, dec) { return (Math.round(n * Math.pow(10, dec || 0)) / Math.pow(10, dec || 0)).toLocaleString(LANG === 'cs' ? 'cs-CZ' : 'en-GB'); };
  var plural = function (n) { return LANG === 'cs' ? (n === 1 ? T.stopsN1 : (n >= 2 && n <= 4 ? tpl(T.stopsN2, { n: n }) : tpl(T.stopsN5, { n: n }))) : (n === 1 ? T.stopsN1 : tpl(T.stopsN5, { n: n })); };

  /* ---------------- stav ---------------- */
  var S = {
    stops: [],            // {uid, pid, dur, includes:[], wish:''}
    dest: 'prague',
    date: '',
    persons: 2, bags: 2, seats: 0,
    seatTypes: { swivel: 0, kidfix: 0, ibooster: 0 }, // RF 31. 10.: výběr sedačky podle typu; seats = součet
    vuz: null, vuzZdroj: 'default', vuzPred: null, urlVuz: null,
    guideDriver: false, guideLicensed: false,
    trip: null,           // slug hotového výletu; km trasy platí, dokud host trasu nezmění
    fixedKm: null,
    demoBlockTesla: false, demoBlockBoth: false,
    removed: null, toastT: null, searching: false, showGrid: false, uid: 0,
    step: 1, time: '09:00', contact: { name: '', email: '', cc: '', phone: '', note: '', heard: '' }, sent: false
  };
  var push = function (ev, o) { o = o || {}; o.event = ev; o.planner_lang = LANG; o.planner_step = o.planner_step || S.step; dl.push(o); };
  var pushOnce = function (ev, o) { var k = 'ptcz_track_' + ev; try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) {} push(ev, o); };   // jako dnes: každá rezervační událost 1× za session

  /* ---------------- trasa, čas, km ---------------- */
  var parentOf = function (pid) { return P[pid].within || pid; };
  function seq() { return ['prague'].concat(S.stops.map(function (s) { return s.pid; })).concat([S.dest]); }
  function legs(fn) { var q = seq(), t = 0; for (var i = 0; i < q.length - 1; i++) t += fn(q[i], q[i + 1]); return t; }
  var driveShown = function () { return S.stops.length ? legs(M) : 0; };
  var driveRaw = function () { return S.stops.length ? legs(Mraw) : 0; };
  var stayMin = function () { return S.stops.reduce(function (a, s) { return a + (s.dur < 0 ? 0 : s.dur + s.includes.reduce(function (b, k) { return b + P[k].stay; }, 0)); }, 0); };
  var overnights = function () { return S.stops.filter(function (s) { return s.dur < 0; }).length; };
  function hav(a, b) { var R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180, x = Math.sin(dLat / 2), y = Math.sin(dLng / 2); var h = x * x + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * y * y; return 2 * R * Math.asin(Math.sqrt(h)); }
  function kmEstimate() { if (!S.stops.length) return 0; return legs(function (a, b) { return hav(P[a], P[b]) * G.kmFactor; }); }
  var km = function () { return S.fixedKm != null ? S.fixedKm : kmEstimate(); };
  function dayTotal() { if (!S.stops.length) return 0; var t = M('prague', S.stops[0].pid); for (var k = 0; k < S.stops.length; k++) { var s = S.stops[k]; t += s.dur < 0 ? 0 : s.dur + s.includes.reduce(function (b, id) { return b + P[id].stay; }, 0); if (k < S.stops.length - 1) t += M(s.pid, S.stops[k + 1].pid); } return t + M(S.stops[S.stops.length - 1].pid, S.dest); }

  /* ---------------- cena (vzorec Martina 23. 10. + sazby vozu) ---------------- */
  function priceFor(slug) {
    var r = RATES[slug], n = S.stops.length;
    if (!n) return null;
    var kmv = km(), stay = stayMin(), ov = overnights();
    var base = kmv * r.km + n * r.stop + stay * r.min + ov * G.overnight;   // nocleh: odjezd 9:00 → bez minut navíc (ukázka)
    var minApplied = base < G.minimum;
    var total = Math.max(Math.round(base), G.minimum);
    var hours = Math.ceil((driveRaw() + stay) / 60);                          // řidič-průvodce: celkový čas bez koeficientu 1,1 (DOPLNEK kap. 1)
    var guide = S.guideDriver ? hours * G.guideHour : 0;
    return { slug: slug, r: r, km: kmv, n: n, stay: stay, ov: ov, base: Math.round(base), minApplied: minApplied, car: total, hours: hours, guide: guide, total: total + guide };
  }

  /* ---------------- dostupnost vozu (DOPLNEK 3.2 + 16) ---------------- */
  var BLOCKED = '2026-12-15';
  function unavailable(slug) {
    var r = RATES[slug];
    if (S.persons > r.max) return { why: 'persons', text: tpl(T.capPersons, { car: r.short, n: r.max }) };
    if (S.seats > r.seats) return { why: 'seats', text: tpl(T.capSeats, { car: r.short, n: r.seats }) };
    if (S.bags > r.bags) return { why: 'bags', text: tpl(T.capBags, { car: r.short, n: r.bags }) };
    if (S.date === BLOCKED && (S.demoBlockBoth || (S.demoBlockTesla && slug === 'tesla-y'))) return { why: 'blocked', text: T.blocked };
    return null;
  }
  function resolveVehicle(reason) {
    var prev = S.vuz, rule = S.persons <= 4 ? 'tesla-y' : 'staria';
    var unT = unavailable('tesla-y'), unS = unavailable('staria');
    var auto = S.vuzZdroj === 'capacity' || S.vuzZdroj === 'availability';
    var flip = function () {   // vybraný vůz nedostupný → druhý, zdroj capacity / availability (priorita 1)
      var un = unavailable(S.vuz); if (!un) return false;
      var other = S.vuz === 'tesla-y' ? 'staria' : 'tesla-y';
      if (unavailable(other)) return false;
      if (S.vuzZdroj === 'user' || S.vuzZdroj === 'url') S.vuzPred = { vuz: S.vuz, zdroj: S.vuzZdroj };
      S.vuz = other; S.vuzZdroj = un.why === 'blocked' ? 'availability' : 'capacity'; return true;
    };
    if (S.vuz && flip()) { /* kapacita vítězí */ }
    else if (S.vuzPred && auto && !unavailable(S.vuzPred.vuz)) { S.vuz = S.vuzPred.vuz; S.vuzZdroj = S.vuzPred.zdroj; S.vuzPred = null; }   // návrat ruční / url volby
    else if (!S.vuz || S.vuzZdroj === 'default' || (auto && !S.vuzPred)) { S.vuz = rule; S.vuzZdroj = 'default'; flip(); }           // výchozí pravidlo 1–4 / 5+
    S.noVehicle = !!(unT && unS);
    if (prev !== S.vuz || reason === 'init') push('planner_vehicle_select', { planner_vehicle: S.vuz, planner_vehicle_source: S.vuzZdroj });
  }

  /* ---------------- „K zastávce … se hodí“ (PRILOHA §3) ---------------- */
  function fitsFor() {
    if (!S.stops.length) return [];
    var last = parentOf(S.stops[S.stops.length - 1].pid);
    var used = {}; S.stops.forEach(function (s) { used[s.pid] = 1; used[parentOf(s.pid)] = 1; });
    var base = dayTotal(), ov = overnights() > 0;
    var bonded = {}; S.stops.forEach(function (s) { (D.bonds[parentOf(s.pid)] || []).forEach(function (b) { bonded[b] = 1; }); });
    var bondedLast = {}; (D.bonds[last] || []).forEach(function (b) { bondedLast[b] = 1; });
    var hasFun = S.stops.some(function (s) { return P[s.pid].tags.some(function (t) { return FUN[t]; }); });
    return D.places.filter(function (p) { return p.id !== 'prague' && !used[p.id] && !p.within && (!p.bondOnly || bonded[p.id]); }).map(function (p) {
      var detour = M(last, p.id) + M(p.id, S.dest) - M(last, S.dest);
      var total = base + detour + p.stay;
      var score = (bonded[p.id] ? 0 : 10000) + detour;
      var memorialBlock = p.tags.indexOf('memorial') >= 0 && hasFun;
      return { p: p, detour: detour, total: total, score: score, long: !ov && total > TH.long_day_min, hide: (!ov && total > TH.hide_min) || memorialBlock || (detour > TH.max_detour_min && !bondedLast[p.id]) };
    }).filter(function (x) { return !x.hide; }).sort(function (a, b) { return a.score - b.score; }).slice(0, TH.max_fits);
  }

  /* ---------------- zastávky ---------------- */
  function addStop(pid, source, dur, at, includes) {
    var p = P[pid];
    var s = { uid: ++S.uid, pid: pid, dur: dur != null ? dur : p.stay, includes: includes || [], wish: '' };
    if (at == null || at > S.stops.length) S.stops.push(s); else S.stops.splice(at, 0, s);
    routeChanged();
    push('planner_stop_add', { planner_stop: pid, planner_stop_source: source });
    render(s.uid);
    return s;
  }
  function removeStop(uid) {
    var i = S.stops.findIndex(function (s) { return s.uid === uid; }); if (i < 0) return;
    var s = S.stops[i]; S.removed = { s: s, at: i, trip: S.trip, km: S.fixedKm };
    S.stops.splice(i, 1); routeChanged(); push('planner_stop_remove', { planner_stop: s.pid });
    render(); toast(tpl(T.removed, { place: name(P[s.pid]) }));
  }
  function routeChanged() { S.trip = null; S.fixedKm = null; }

  /* ---------------- vykreslení ---------------- */
  var root, list, pick, fits, moreGrid, day, searchWrap, searchInput, ac, otherBtn;
  function tile(id) {
    var p = P[id], ph = photo(p);
    return '<div class="ptcz-tile ptcz-tile--btn" role="button" tabindex="0" data-id="' + id + '" aria-label="' + esc(name(p)) + '" style="background:' + colOf(p) + '">' +
      (ph ? '<img src="' + ph + '" alt="" loading="lazy" decoding="async">' : '<span class="ptcz-tile__ini" aria-hidden="true">' + esc(name(p).charAt(0)) + '</span>') +
      '<span class="ptcz-tile__drive">' + icon('clock') + fmtH(M('prague', id)) + '</span>' +
      '<button type="button" class="ptcz-tile__add ptcz-tile__qa" data-qa="' + id + '" aria-label="' + esc(tpl(T.quick, { place: name(p) })) + '"><span>' + icon('plus') + '</span></button>' +
      '<span class="ptcz-tile__txt"><span class="ptcz-tile__name">' + esc(name(p)) + '</span><span class="ptcz-tile__sub">' + esc(txt(p, 'blurb')) + '</span></span></div>';
  }
  function gridHtml(ids) { return '<div class="ptcz-tiles ptcz-tiles--pick" role="list">' + ids.map(tile).join('') + '</div>'; }
  function renderPick() {
    var free = MAIN.filter(function (id) { return !S.stops.some(function (s) { return parentOf(s.pid) === id; }); });
    if (!S.stops.length) { pick.innerHTML = '<p class="ptcz-pl__q">' + T.q + '</p>' + gridHtml(free); pick.hidden = false; moreGrid.hidden = true; }
    else { pick.hidden = true; moreGrid.hidden = !S.showGrid; moreGrid.innerHTML = S.showGrid ? gridHtml(free) : ''; }
  }
  function dayTag(total) { if (overnights()) return ''; if (total > TH.hide_min) return '<span class="ptcz-tag ptcz-tag--warn ptcz-tag--err">' + T.veryLong + '</span>'; if (total > TH.long_day_min) return '<span class="ptcz-tag ptcz-tag--warn">' + T.longDay + '</span>'; return ''; }
  function stopCard(s, i, isNew) {
    var p = P[s.pid], ph = photo(p), n = S.stops.length;
    var incs = D.places.filter(function (x) { return x.within === s.pid; });
    var incHtml = '';
    if (incs.length) {
      var chosen = incs.filter(function (x) { return s.includes.indexOf(x.id) >= 0; }).map(function (x) { return name(x); });
      incHtml = '<div class="ptcz-stop__inc" data-open="0"><button type="button" class="ptcz-stop__incline" aria-expanded="false">' + T.include + ': <b>' + esc(chosen.length ? chosen.join(', ') : incs.map(function (x) { return name(x); }).join(', ')) + '</b> <span class="ptcz-stop__pl" aria-hidden="true">+</span></button>' +
        '<div class="ptcz-stop__inclist">' + incs.map(function (x) { return '<label><input type="checkbox" data-inc="' + x.id + '"' + (s.includes.indexOf(x.id) >= 0 ? ' checked' : '') + '> ' + esc(name(x)) + ' <span class="ptcz-stop__st">' + fmtDur(x.stay) + '</span></label>'; }).join('') + '</div></div>';
    }
    var total = s.dur + s.includes.reduce(function (b, id) { return b + P[id].stay; }, 0);
    return '<li class="ptcz-stop' + (isNew ? ' is-new' : '') + '" data-uid="' + s.uid + '">' +
      '<span class="ptcz-stop__n" aria-hidden="true">' + (i + 1) + '</span>' +
      '<button type="button" class="ptcz-stop__ph" data-detail="' + s.uid + '" aria-label="' + esc(tpl(T.details, { place: name(p) })) + '" style="background:' + colOf(p) + '">' + (ph ? '<img src="' + ph + '" alt="">' : esc(name(p).charAt(0))) + '</button>' +
      '<button type="button" class="ptcz-stop__main" data-detail="' + s.uid + '"><span class="ptcz-stop__nm">' + esc(name(p)) + '</span><span class="ptcz-stop__sb">' + esc(txt(p, 'blurb') || txt(p, 'region')) + '</span></button>' +
      '<div class="ptcz-stop__ud"><button type="button" class="ptcz-ib" data-up="' + s.uid + '" aria-label="' + T.up + '"' + (i === 0 ? ' disabled' : '') + '>' + icon('up') + '</button><button type="button" class="ptcz-ib" data-down="' + s.uid + '" aria-label="' + T.down + '"' + (i === n - 1 ? ' disabled' : '') + '>' + icon('chevron') + '</button><button type="button" class="ptcz-ib ptcz-ib--rm" data-rm="' + s.uid + '" aria-label="' + T.remove + '">' + icon('trash') + '</button></div>' +
      '<div class="ptcz-stop__stay"><button type="button" class="ptcz-stop__stayb" data-stay="' + s.uid + '" aria-haspopup="listbox" aria-expanded="false" aria-label="' + esc(tpl(T.changeTime, { place: name(p) })) + '">' + T.stay + ' <b aria-live="polite">' + fmtDur(s.dur < 0 ? s.dur : total) + '</b>' + icon('chevron') + '</button>' + (i === n - 1 ? dayTag(dayTotal()) : '') + '</div>' +
      incHtml +
      '<div class="ptcz-stop__wish' + (s.wish ? ' has' : '') + '"><button type="button" class="ptcz-stop__ask" data-wish="' + s.uid + '">' + icon('pen') + (s.wish ? '<span>' + esc(s.wish) + '</span>' : T.ask) + '</button><div class="ptcz-stop__ed"><textarea maxlength="200" placeholder="' + esc(T.ph) + '" aria-label="' + esc(T.ask) + '">' + esc(s.wish) + '</textarea><div class="ptcz-stop__edrow"><button type="button" class="ptcz-link" data-wsave="' + s.uid + '">' + T.save + '</button><button type="button" class="ptcz-link ptcz-link--muted" data-wcancel="' + s.uid + '">' + T.cancel + '</button></div></div></div>' +
      '</li>';
  }
  function renderFits() {
    var rows = fitsFor();
    var free = MAIN.filter(function (id) { return !S.stops.some(function (s) { return parentOf(s.pid) === id; }); });
    if (!S.stops.length || (!rows.length && !free.length)) { fits.innerHTML = ''; fits.hidden = true; return; }
    var last = P[parentOf(S.stops[S.stops.length - 1].pid)];
    fits.hidden = false;
    fits.innerHTML = '<p class="ptcz-fits__lbl">' + tpl(esc(T.fits), { place: '<b>' + esc(name(last)) + '</b>' }) + '</p><div class="ptcz-fits__row" role="list">' +
      rows.map(function (x) {
        var p = x.p, ph = photo(p);
        return '<button type="button" class="ptcz-chipbtn' + (x.long ? ' is-long' : '') + '" role="listitem" data-fit="' + p.id + '" data-detour="' + x.detour + '" data-long="' + (x.long ? 1 : 0) + '" title="' + esc(name(p)) + ' · +' + x.detour + ' min">' +
          (ph ? '<img src="' + ph + '" alt="" loading="lazy">' : '<span class="ptcz-chipbtn__ini" style="background:' + colOf(p) + '">' + esc(name(p).charAt(0)) + '</span>') +
          '<span class="ptcz-chipbtn__tx"><span class="ptcz-chipbtn__n1">' + esc(name(p)) + ' <span class="ptcz-chipbtn__m">+' + x.detour + ' min</span>' + (x.long ? '<span class="ptcz-tag ptcz-tag--warn">' + T.longDay + '</span>' : '') + '</span><span class="ptcz-chipbtn__n2">' + esc(txt(p, 'blurb')) + '</span></span></button>';
      }).join('') +
      (free.length ? '<button type="button" class="ptcz-chipbtn ptcz-chipbtn--txt" role="listitem" data-more="1" aria-expanded="' + (S.showGrid ? 'true' : 'false') + '">' + (S.showGrid ? T.lessDest : T.moreDest) + '</button>' : '') + '</div>';
  }
  function renderDay() {
    if (!S.stops.length) { day.textContent = ''; day.hidden = true; return; }
    day.hidden = false;
    var total = dayTotal(), ov = overnights();
    day.innerHTML = '<span>' + plural(S.stops.length) + ' · ' + fmtH(driveShown()) + ' ' + T.drive + ' · ' + fmtH(stayMin()) + ' ' + T.at + '</span><span>' + (ov ? T.twoDays : fmtH(total) + ' ' + T.d2d) + (!ov && total > TH.long_day_min ? ' · <span class="ptcz-day__warn">' + T.warnLong + '</span>' : '') + '</span>';
  }
  function renderList(newUid) {
    list.innerHTML = S.stops.map(function (s, i) { return stopCard(s, i, s.uid === newUid); }).join('');
    list.hidden = !S.stops.length;
    otherBtn.hidden = S.searching;
    searchWrap.hidden = !S.searching;
  }
  function renderVehicle() {
    var pT = priceFor('tesla-y'), pS = priceFor('staria');
    var cards = { 'tesla-y': pT, staria: pS };
    Object.keys(RATES).forEach(function (slug) {
      var r = RATES[slug], lab = $('[data-vehicle="' + slug + '"]'), inp = $('input', lab), un = unavailable(slug), pr = cards[slug];
      inp.checked = S.vuz === slug; inp.disabled = !!un;
      lab.classList.toggle('is-unavailable', !!un);
      $('.ptcz-vehicle__price', lab).innerHTML = pr ? money(pr.car) : '<span class="ptcz-vehicle__dash">' + T.noPrice + '</span>';
      var why = $('.ptcz-vehicle__why', lab); why.textContent = un ? un.text : ''; why.hidden = !un;
      lab.setAttribute('aria-describedby', un ? why.id : '');
    });
    // věta o minimu u Tesly (3.1), poznámka k průvodci (3.2/7), žádný vůz (16)
    var minNote = $('#vehicle-min'); minNote.hidden = !(pT && pT.minApplied && pS && !pS.minApplied);
    var guideNote = $('#guide-note'); guideNote.hidden = !(S.guideLicensed && ((S.vuz === 'tesla-y' && S.persons >= 4) || (S.vuz === 'staria' && S.persons >= 8)));
    guideNote.textContent = S.vuz === 'tesla-y' ? T.guideNoteTesla : T.guideNoteStaria;
    var none = $('#vehicle-none'); none.hidden = !S.noVehicle;
    $('#vehicle-legend-src').textContent = S.vuzZdroj === 'default' ? T.srcDefault : (S.vuzZdroj === 'user' ? T.srcUser : (S.vuzZdroj === 'url' ? T.srcUrl : T.srcCapacity));
  }
  function renderPrice() {
    var pr = S.vuz ? priceFor(S.vuz) : null, r = RATES[S.vuz || 'staria'];
    var empty = !pr || S.noVehicle;
    $$('[data-price-val]').forEach(function (el) { el.textContent = empty ? (S.noVehicle && S.stops.length ? T.noVehicleShort : T.empty) : money(pr.total); el.setAttribute('data-empty', empty ? '1' : '0'); });
    $$('[data-price-sub]').forEach(function (el) { el.textContent = empty ? '' : tpl(T.barSub, { n: r.max, car: r.short }); });
    $$('[data-price-car]').forEach(function (el) { el.textContent = tpl(T.carLine, { car: r.name, n: r.max }); });
    $$('[data-trip-note]').forEach(function (el) { el.hidden = !S.trip; el.textContent = S.trip ? tpl(T.tripPrice, { trip: TRIPS[S.trip].title[LANG] }) : ''; });
    $$('[data-guide-amount]').forEach(function (el) { el.textContent = pr ? '+' + money(pr.hours * G.guideHour) + ' (' + pr.hours + ' h)' : '+200 ' + (LANG === 'cs' ? 'Kč/h' : 'CZK/h'); });
    // rozpad
    var rowsHtml;
    if (!pr) { rowsHtml = '<li><span>' + T.empty + '</span></li>'; }
    else {
      var rows = [
        [tpl(T.rowKm, { km: num(pr.km, 1), rate: num(pr.r.km, 0) }), money(pr.km * pr.r.km), S.fixedKm == null ? T.kmEstimate : T.kmTrip],
        [tpl(T.rowStops, { n: pr.n, rate: pr.r.stop }), money(pr.n * pr.r.stop)],
        [tpl(T.rowStay, { min: pr.stay, rate: num(pr.r.min, 1) }), money(pr.stay * pr.r.min)]
      ];
      if (pr.ov) rows.push([tpl(T.rowOvernight, { n: pr.ov }), money(pr.ov * G.overnight)]);
      if (pr.minApplied) rows.push([T.rowMinimum, money(G.minimum - pr.base)]);
      if (pr.guide) rows.push([tpl(T.rowGuide, { h: pr.hours }), money(pr.guide)]);
      rowsHtml = rows.map(function (x) { return '<li><span>' + x[0] + (x[2] ? ' <small>' + x[2] + '</small>' : '') + '</span><b>' + x[1] + '</b></li>'; }).join('') + '<li class="ptcz-rows__total"><span>' + T.total + '</span><b>' + money(pr.total) + '</b></li>';
    }
    $$('[data-price-rows]').forEach(function (el) { el.innerHTML = rowsHtml; });
    $$('#continue, #continue-bar').forEach(function (b) { b.disabled = S.noVehicle && S.stops.length > 0; });
  }
  function render(newUid) {
    resolveVehicle();
    renderPick(); renderList(newUid); renderFits(); renderDay(); renderVehicle(); renderPrice();
    if (S.stops.length) push('planner_price_shown', { planner_vehicle: S.vuz, planner_price: priceFor(S.vuz) ? priceFor(S.vuz).total : null });
  }

  /* ---------------- panely (detail místa, délka, rozpad) ---------------- */
  var sheet, lastFocus;
  function openSheet(html, cls) {
    lastFocus = document.activeElement;
    sheet.className = 'ptcz-sheet is-open ' + (cls || '');
    $('.ptcz-sheet__panel', sheet).innerHTML = '<div class="ptcz-sheet__grip" aria-hidden="true"></div><button type="button" class="ptcz-sheet__x" data-close aria-label="' + T.close + '">' + icon('x') + '</button>' + html;
    sheet.setAttribute('aria-hidden', 'false'); document.body.classList.add('has-sheet');
    var panel = $('.ptcz-sheet__panel', sheet); panel.tabIndex = -1;
    var f = $('[data-autofocus]', sheet) || $('button:not([data-close]), [href], input, [tabindex="0"]', sheet); (f || panel).focus();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet && sheet.classList.contains('is-open')) closeSheet(); });
  function closeSheet() { if (!sheet.classList.contains('is-open')) return; sheet.className = 'ptcz-sheet'; sheet.setAttribute('aria-hidden', 'true'); document.body.classList.remove('has-sheet'); if (lastFocus && lastFocus.isConnected) lastFocus.focus(); }
  function detailHtml(p, ctx) {
    var ph = photo(p), incs = D.places.filter(function (x) { return x.within === p.id; }), url = tripUrl(p);
    var fact2 = ctx.detour != null ? '<div><span>' + T.toRoute + '</span><b>+' + ctx.detour + ' min</b></div>' : '<div><span>' + T.fromP + '</span><b>' + fmtH(M('prague', p.id)) + '</b></div>';
    return (ph ? '<img class="ptcz-sheet__pic" src="' + ph + '" alt="">' : '<div class="ptcz-sheet__pic ptcz-sheet__pic--ini" style="background:' + colOf(p) + '">' + esc(name(p).charAt(0)) + '</div>') +
      '<h2 class="ptcz-sheet__h">' + esc(name(p)) + (ctx.long ? '<span class="ptcz-tag ptcz-tag--warn">' + T.longDay + '</span>' : '') + '</h2><p class="ptcz-sheet__rg">' + esc(txt(p, 'region')) + '</p>' +
      '<div class="ptcz-sheet__tags">' + p.tags.map(function (t) { return '<span>' + esc(T.tags[t] || t) + '</span>'; }).join('') + '</div>' +
      (txt(p, 'desc') ? '<p class="ptcz-sheet__p">' + esc(txt(p, 'desc')) + '</p>' : '') +
      '<div class="ptcz-sheet__facts"><div><span>' + T.typ + '</span><b>' + fmtDur(p.stay) + '</b></div>' + fact2 + '</div>' +
      (incs.length ? '<div class="ptcz-sheet__incs"><p>' + T.incIn + '</p>' + incs.map(function (x) { return '<label><input type="checkbox" data-inc="' + x.id + '"' + (ctx.includes && ctx.includes.indexOf(x.id) >= 0 ? ' checked' : '') + '> <span>' + esc(name(x)) + '</span><span class="ptcz-stop__st">' + fmtDur(x.stay) + '</span></label>'; }).join('') + '</div>' : '') +
      (url ? '<a class="ptcz-link" href="' + url + '" target="_blank" rel="noopener">' + T.seeTrip + ' ' + icon('arrow') + '<span class="ptcz-sr-only"> (' + T.newTab + ')</span></a>' : '') +
      '<button type="button" class="ptcz-btn ptcz-btn--primary ptcz-btn--block ptcz-btn--lg ptcz-sheet__add" data-autofocus ' + (ctx.uid ? 'data-done="' + ctx.uid + '"' : 'data-add="' + p.id + '" data-source="' + ctx.source + '"') + '>' + (ctx.uid ? T.done : T.addStop) + '</button>';
  }
  var STEPS = TH.stay_steps_min.concat([TH.overnight_value]);
  function stayHtml(s) {
    var p = P[s.pid];
    return '<h2 class="ptcz-sheet__h ptcz-sheet__h--sm">' + esc(tpl(T.changeTime, { place: name(p) })) + '</h2><div class="ptcz-opts" role="listbox" aria-label="' + esc(T.time) + '">' +
      STEPS.map(function (v) { var on = s.dur === v; return '<button type="button" class="ptcz-opt" role="option" aria-selected="' + on + '" data-v="' + v + '" data-uid="' + s.uid + '"' + (on ? ' data-autofocus' : '') + '>' + (v < 0 ? T.overnight + ' <small>' + T.dep + '</small>' : fmtDur(v)) + (on ? icon('check') : '') + '</button>'; }).join('') + '</div>';
  }
  function toast(msg) {
    var t = $('#toast'); $('span', t).textContent = msg; t.classList.add('is-show'); clearTimeout(S.toastT);
    S.toastT = setTimeout(function () { t.classList.remove('is-show'); S.removed = null; }, 6000);
  }

  /* ---------------- hledání (STATICKÁ UKÁZKA: místa z JSON mimo mřížku; v produkci Google Places) ---------------- */
  function renderAc() {
    var q = searchInput.value.trim().toLowerCase();
    var norm = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
    var hits = q.length < 2 ? [] : D.places.filter(function (p) { return p.id !== 'prague' && !S.stops.some(function (s) { return s.pid === p.id; }) && (norm(name(p)).indexOf(norm(q)) >= 0 || norm(txt(p, 'region')).indexOf(norm(q)) >= 0); }).slice(0, 6);
    searchWrap.classList.toggle('has-text', q.length > 0);
    if (q.length < 2) { ac.hidden = true; ac.innerHTML = ''; $('.ptcz-fld', searchWrap).setAttribute('aria-expanded', 'false'); return; }
    ac.hidden = false; $('.ptcz-fld', searchWrap).setAttribute('aria-expanded', 'true');
    ac.innerHTML = (hits.length ? hits.map(function (p) { return '<button type="button" class="ptcz-ac__item" role="option" data-pick="' + p.id + '">' + icon('pin', 'i ptcz-ac__ico') + '<span><span class="ptcz-ac__name">' + esc(name(p)) + '</span><span class="ptcz-ac__sub">' + esc(txt(p, 'region')) + ', ' + (LANG === 'cs' ? 'Česko' : 'Czechia') + '</span></span></button>'; }).join('') : '<p class="ptcz-ac__empty">' + T.none + '</p>') +
      '<p class="ptcz-ac__foot"><span>' + T.ft1 + '</span><span>' + T.ftDemo + '</span></p>';
  }

  /* ---------------- URL: ?from= · ?stops= · ?vehicle= ---------------- */
  function applyUrl() {
    var q = new URLSearchParams(location.search);
    var from = q.get('from'); if (from && TRIP_CS[from]) from = TRIP_CS[from];
    var veh = q.get('vehicle'); if (veh && RATES[veh]) { S.vuz = veh; S.vuzZdroj = 'url'; }
    if (from && TRIPS[from]) {
      TRIPS[from].stops.forEach(function (x) { S.stops.push({ uid: ++S.uid, pid: x[0], dur: x[1], includes: [], wish: '' }); });
      S.trip = from; S.fixedKm = TRIPS[from].km;
    } else if (from) {
      // jiný slug výletu z JSON: zastávky s tímto výletem v pořadí JSON (bez míst „within“)
      D.places.filter(function (p) { return (p.trip === from || p.trip_cs === from) && !p.within; }).forEach(function (p) { S.stops.push({ uid: ++S.uid, pid: p.id, dur: p.stay, includes: [], wish: '' }); });
    }
    var stops = q.get('stops');
    if (stops) stops.split('|').forEach(function (id) { if (P[id] && id !== 'prague' && !S.stops.some(function (s) { return s.pid === id; })) { S.stops.push({ uid: ++S.uid, pid: id, dur: P[id].stay, includes: [], wish: '' }); S.trip = null; S.fixedKm = null; } });
    // přepínač jazyka nese stejný dotaz
    var ls = $('#lang-switch'); if (ls) ls.href = ls.getAttribute('href').split('?')[0] + location.search;
  }

  /* ---------------- události ---------------- */
  function bind() {
    root.addEventListener('click', function (e) {
      var t = e.target.closest('button, [role=button]'); if (!t) return;
      var d = t.dataset;
      if (d.qa) { e.stopPropagation(); addStop(d.qa, 'grid_quick'); return; }
      if (t.classList.contains('ptcz-tile--btn')) { var p = P[d.id]; openSheet(detailHtml(p, { source: 'grid' }), 'ptcz-sheet--detail'); return; }
      if (d.fit) { var pf = P[d.fit]; openSheet(detailHtml(pf, { source: 'fits', detour: +d.detour, long: d.long === '1' }), 'ptcz-sheet--detail'); return; }
      if (d.more) { S.showGrid = !S.showGrid; renderPick(); renderFits(); return; }
      if (d.detail) { var s = S.stops.find(function (x) { return x.uid === +d.detail; }); openSheet(detailHtml(P[s.pid], { uid: s.uid, includes: s.includes }), 'ptcz-sheet--detail'); return; }
      if (d.up || d.down) { var uid = +(d.up || d.down), i = S.stops.findIndex(function (x) { return x.uid === uid; }), j = d.up ? i - 1 : i + 1; if (j < 0 || j >= S.stops.length) return; var tmp = S.stops[i]; S.stops[i] = S.stops[j]; S.stops[j] = tmp; routeChanged(); render(); var b = $('[data-' + (d.up ? 'up' : 'down') + '="' + uid + '"]'); (b && !b.disabled ? b : $('[data-rm="' + uid + '"]')).focus(); return; }
      if (d.rm) { removeStop(+d.rm); return; }
      if (d.stay) { var ss = S.stops.find(function (x) { return x.uid === +d.stay; }); t.setAttribute('aria-expanded', 'true'); openSheet(stayHtml(ss), 'ptcz-sheet--stay'); return; }
      if (t.classList.contains('ptcz-stop__incline')) { var inc = t.parentNode; inc.dataset.open = '1'; t.setAttribute('aria-expanded', 'true'); var c = $('input', inc); if (c) c.focus(); return; }
      if (d.wish) { var w = t.closest('.ptcz-stop__wish'); w.classList.add('is-editing'); $('textarea', w).focus(); return; }
      if (d.wsave || d.wcancel) { var su = +(d.wsave || d.wcancel), sw = S.stops.find(function (x) { return x.uid === su; }); if (d.wsave) sw.wish = $('textarea', t.closest('.ptcz-stop__wish')).value.trim().slice(0, 200); render(); $('[data-wish="' + su + '"]').focus(); return; }
      if (t.id === 'other') { S.searching = true; renderList(); searchInput.focus(); push('planner_other_place'); return; }
      if (d.pick) { addStop(d.pick, 'search'); searchInput.value = ''; renderAc(); return; }
      if (t.classList.contains('ptcz-fld__clear')) { searchInput.value = ''; renderAc(); searchInput.focus(); return; }
    });
    root.addEventListener('keydown', function (e) { var t = e.target; if (t.classList && t.classList.contains('ptcz-tile--btn') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); t.click(); } });
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.dataset.inc && t.closest('.ptcz-stop')) { var uid = +t.closest('.ptcz-stop').dataset.uid, s = S.stops.find(function (x) { return x.uid === uid; }); s.includes = t.checked ? s.includes.concat([t.dataset.inc]) : s.includes.filter(function (x) { return x !== t.dataset.inc; }); routeChanged(); var open = t.closest('.ptcz-stop__inc'); render(); var again = $('.ptcz-stop[data-uid="' + uid + '"] .ptcz-stop__inc'); if (again && open) { again.dataset.open = '1'; $('[data-inc="' + t.dataset.inc + '"]', again).focus(); } }
    });
    searchInput.addEventListener('input', renderAc);
    searchInput.addEventListener('keydown', function (e) { if (e.key === 'Escape') { searchInput.value = ''; renderAc(); } if (e.key === 'ArrowDown') { var f = $('.ptcz-ac__item', ac); if (f) { e.preventDefault(); f.focus(); } } });

    // steppery
    $$('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.step, dir = +b.dataset.dir, lim = { persons: [1, 8], bags: [0, 8], seats: [0, 4] }[k];
        S[k] = Math.min(lim[1], Math.max(lim[0], S[k] + dir));
        $('[data-val="' + k + '"]').textContent = S[k];
        $('[data-step="' + k + '"][data-dir="-1"]').disabled = S[k] <= lim[0]; $('[data-step="' + k + '"][data-dir="1"]').disabled = S[k] >= lim[1];
        render();
      });
    });
    // dětské sedačky podle typu (RF 31. 10.): rozbalovací výběr s fotkami místo jednoho počítadla
    (function () {
      var old = $('#lab-seats'); if (!old) return;
      var row = old.closest('.ptcz-stepper'), cs = LANG === 'cs';
      var TYPES = [
        ['swivel', 'Britax Römer Swivel', cs ? 'Od narození do 7 let · do 125 cm' : 'Birth to 7 years · up to 125 cm', cs ? 'Otočná o 360°, do 4 let proti směru jízdy.' : 'Rotates 360°, rear-facing up to 4 years.'],
        ['kidfix', 'Britax Römer Kidfix M i-Size', cs ? '3,5 až 12 let · 100–150 cm' : '3.5 to 12 years · 100–150 cm', cs ? 'Pro starší děti, nastavitelná opěrka hlavy.' : 'For older children, adjustable headrest.'],
        ['ibooster', cs ? 'Podsedák iBooster' : 'iBooster booster seat', cs ? 'Do 12 let · 125–150 cm' : 'Up to 12 years · 125–150 cm', cs ? 'Norma i-Size, upevnění ISOFIX a pásem.' : 'i-Size standard, ISOFIX and seat belt.']];
      var MAX = 4, sub = cs ? 'zdarma, Britax Römer · vyberte typ' : 'free, Britax Römer · choose the type';
      var d = document.createElement('details'); d.className = 'ptcz-seatpick'; d.id = 'seatpick';
      d.innerHTML = '<summary class="ptcz-stepper"><span class="ptcz-stepper__lab" id="lab-seats">' + (cs ? 'Dětské sedačky' : 'Child seats') + '<small>' + sub + '</small></span><span class="ptcz-seatpick__sum"><span class="ptcz-seatpick__n" data-val="seats" aria-live="polite">0</span><svg class="i" aria-hidden="true"><use href="#i-chevron"/></svg></span></summary>' +
        '<ul class="ptcz-seatpick__list" role="list">' + TYPES.map(function (t) {
          var id = 'lab-seat-' + t[0];
          return '<li><img src="img/ext/po-sedacka-' + t[0] + '.jpg" alt="" width="400" height="400" loading="lazy"><span class="ptcz-seatpick__txt" id="' + id + '"><b>' + t[1] + '</b><span class="ptcz-seatpick__age">' + t[2] + '</span><small>' + t[3] + '</small></span>' +
            '<span class="ptcz-stepper__ctl" role="group" aria-labelledby="' + id + '"><button type="button" data-seat="' + t[0] + '" data-dir="-1" aria-label="' + (cs ? 'Méně: ' : 'Fewer: ') + t[1] + '" disabled><span><svg class="i" aria-hidden="true"><use href="#i-minus"/></svg></span></button><span class="ptcz-stepper__v" data-seatval="' + t[0] + '">0</span><button type="button" data-seat="' + t[0] + '" data-dir="1" aria-label="' + (cs ? 'Více: ' : 'More: ') + t[1] + '"><span><svg class="i" aria-hidden="true"><use href="#i-plus"/></svg></span></button></span></li>';
        }).join('') + '</ul>';
      row.replaceWith(d);
      S.seatNames = TYPES.reduce(function (o, t) { o[t[0]] = t[1].replace('Britax Römer ', '').replace('Podsedák ', '').replace(' booster seat', ''); return o; }, {});
      $$('[data-seat]', d).forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.dataset.seat, dir = +b.dataset.dir;
          if (dir > 0 && S.seats >= MAX) return;
          S.seatTypes[k] = Math.max(0, S.seatTypes[k] + dir);
          S.seats = S.seatTypes.swivel + S.seatTypes.kidfix + S.seatTypes.ibooster;
          Object.keys(S.seatTypes).forEach(function (t) {
            $('[data-seatval="' + t + '"]', d).textContent = S.seatTypes[t];
            $('[data-seat="' + t + '"][data-dir="-1"]', d).disabled = !S.seatTypes[t];
            $('[data-seat="' + t + '"][data-dir="1"]', d).disabled = S.seats >= MAX;
          });
          $('[data-val="seats"]', d).textContent = S.seats;
          d.classList.toggle('has-seats', S.seats > 0);
          render();
        });
      });
    })();
    // vůz
    $$('[data-vehicle] input').forEach(function (inp) { inp.addEventListener('change', function () { if (!inp.checked) return; S.vuz = inp.value; S.vuzZdroj = 'user'; S.vuzPred = null; push('planner_vehicle_select', { planner_vehicle: S.vuz, planner_vehicle_source: 'user' }); render(); }); });
    // služby
    $('#svc-guide-driver').addEventListener('change', function (e) { S.guideDriver = e.target.checked; render(); });
    $('#svc-guide-licensed').addEventListener('change', function (e) { S.guideLicensed = e.target.checked; render(); });
    // datum
    var date = $('#date');
    date.addEventListener('change', function () { S.date = date.value; date.closest('.ptcz-fld').classList.remove('has-error'); $('#date-msg').textContent = ''; render(); });
    // demo
    $('#demo-block-tesla').addEventListener('change', function (e) { S.demoBlockTesla = e.target.checked; render(); });
    $('#demo-block-both').addEventListener('change', function (e) { S.demoBlockBoth = e.target.checked; render(); });
    $('#demo-set-date').addEventListener('click', function () { date.value = BLOCKED; S.date = BLOCKED; render(); });
    // cíl
    $('#dest-change').addEventListener('click', function () { var f = $('#dest'); f.readOnly = !f.readOnly; f.focus(); $('#dest-hint').textContent = f.readOnly ? T.sameAsStart : T.destHint; });

    // panely
    sheet.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]') || e.target.classList.contains('ptcz-sheet__dim')) { closeSheet(); return; }
      var t = e.target.closest('button'); if (!t) return;
      if (t.dataset.add) { var incs = $$('[data-inc]:checked', sheet).map(function (c) { return c.dataset.inc; }); closeSheet(); addStop(t.dataset.add, t.dataset.source, null, null, incs); return; }
      if (t.dataset.done) { var s = S.stops.find(function (x) { return x.uid === +t.dataset.done; }); s.includes = $$('[data-inc]:checked', sheet).map(function (c) { return c.dataset.inc; }); closeSheet(); routeChanged(); render(); return; }
      if (t.dataset.v != null && t.dataset.uid) { var su = S.stops.find(function (x) { return x.uid === +t.dataset.uid; }); su.dur = +t.dataset.v; routeChanged(); closeSheet(); render(); var sb = $('[data-stay="' + su.uid + '"]'); if (sb) sb.focus(); push('planner_stay_change', { planner_stop: su.pid, planner_stay: su.dur }); return; }
    });
    sheet.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeSheet(); return; }
      if (e.key === 'Tab') { var f = $$('button, [href], input, [tabindex="0"]', sheet).filter(function (x) { return !x.disabled && x.offsetParent !== null; }); if (!f.length) return; var first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
      if (sheet.classList.contains('ptcz-sheet--stay') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { var o = $$('.ptcz-opt', sheet), i = o.indexOf(document.activeElement); if (i >= 0) { e.preventDefault(); o[(i + (e.key === 'ArrowDown' ? 1 : o.length - 1)) % o.length].focus(); } }
    });
    // tah dolů za úchyt (doplněk; vždy je i křížek a Esc)
    var y0 = null; sheet.addEventListener('touchstart', function (e) { if (e.target.closest('.ptcz-sheet__grip')) y0 = e.touches[0].clientY; }, { passive: true });
    sheet.addEventListener('touchend', function (e) { if (y0 != null && e.changedTouches[0].clientY - y0 > 80) closeSheet(); y0 = null; });
    // cena → rozpad
    $$('[data-open-price]').forEach(function (b) { b.addEventListener('click', function () { openSheet($('#price-tpl').innerHTML, 'ptcz-sheet--price'); renderPrice(); push('planner_price_sheet_open'); }); });
    // toast undo
    $('#toast button').addEventListener('click', function () { var r = S.removed; if (!r) return; S.stops.splice(Math.min(r.at, S.stops.length), 0, r.s); S.trip = r.trip; S.fixedKm = r.km; S.removed = null; $('#toast').classList.remove('is-show'); render(); });
    // Continue: krok 1 → 2 → 3 → odeslání (jedno tlačítko v kartě ceny, v liště i pod formulářem)
    $('#continue').addEventListener('click', function () { if (S.step === 1) next1(); else if (S.step === 2) next2(); else if (S.step === 3) book(); });
    $$('[data-next]').forEach(function (b) { b.addEventListener('click', function () { $('#continue').click(); }); });
    $$('[data-book]').forEach(function (b) { b.addEventListener('click', book); });
    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-goto]'); if (!g) return;
      goStep(+g.dataset.goto, g.dataset.focus || null);
    });
    $('#pick-time').addEventListener('change', function () { S.time = this.value; $$('[data-trip-line]').forEach(function (el) { el.innerHTML = tripLine(); }); });
    document.addEventListener('click', function (e) { var b = e.target.closest('#s-price [data-open-price]'); if (b) { openSheet($('#price-tpl').innerHTML, 'ptcz-sheet--price'); renderPrice(); push('planner_price_sheet_open'); } });
    ['your-name', 'your-email', 'phone', 'customer-note', 'how-heard', 'phone-cc'].forEach(function (id) {
      var el = $('#' + id); el.addEventListener('input', function () { readContact(); if (el.getAttribute('aria-invalid') === 'true') validate2(false); });
      el.addEventListener('blur', function () { if (el.value && (id === 'your-name' || id === 'your-email' || id === 'phone')) validate2(false, id); });
    });
    $$('#consent input').forEach(function (c) { c.addEventListener('change', function () { if ($('#gdpr_consent').checked && $('#terms_and_conditions').checked) { $('#err-consent').textContent = ''; $$('.ptcz-check').forEach(function (l) { l.classList.remove('has-error'); }); } }); });
    window.addEventListener('popstate', function (e) { var st = e.state && e.state.ptczStep; if (st && st !== S.step && !S.sent) goStep(st, null, true); });
    // lišta: skrýt při psaní (klávesnice), WhatsApp s ní
    document.addEventListener('focusin', function (e) { if (e.target.matches('input:not([readonly]):not([type=checkbox]):not([type=radio]):not([type=date]), textarea')) { $('#bar').classList.add('is-hidden'); $('#wa-fab').classList.add('is-hidden'); } });
    document.addEventListener('focusout', function () { setTimeout(function () { if (!document.activeElement || !document.activeElement.matches('input:not([readonly]):not([type=checkbox]):not([type=radio]), textarea')) { $('#bar').classList.remove('is-hidden'); $('#wa-fab').classList.remove('is-hidden'); } }, 300); });
  }

  /* ---------------- kroky 2–3 (kontakt, souhrn, odeslání) ---------------- */
  function next1() {
    var errs = [], date = $('#date');
    if (!S.date) { errs.push('date'); var f = date.closest('.ptcz-fld'); f.classList.add('has-error'); date.setAttribute('aria-invalid', 'true'); $('#date-msg').textContent = T.errDate; }
    if (!S.stops.length) { errs.push('stops'); $('#stops-msg').textContent = T.errStops; }
    else $('#stops-msg').textContent = '';
    if (errs.length) { push('planner_validation_error', { planner_errors: errs.join(','), planner_error_type: 'empty' }); var first = errs[0] === 'date' ? date : $('#other'); first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); $('#errsum').textContent = tpl(T.toFix, { n: errs.length }); return; }
    $('#errsum').textContent = '';
    var pr = priceFor(S.vuz);
    push('planner_continue_click', { planner_stops: S.stops.length, planner_vehicle: S.vuz });
    pushOnce('begin_checkout', { booking_step: 1, booking_step_name: 'start', booking_value: pr.total, booking_currency: 'CZK', booking_vehicle: S.vuz, booking_persons: S.persons, booking_luggage: S.bags, booking_stops_count: S.stops.length });
    goStep(2);
  }
  var pl3 = function (n, f) { return n === 1 ? f[0] : (n >= 2 && n <= 4 ? f[1] : f[2]); };
  var reEmail = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;   // dnes [a-z]{2,} → odmítá .COM (soupis 7/3)
  function readContact() {
    var c = S.contact; c.name = $('#your-name').value.trim(); c.email = $('#your-email').value.trim(); c.cc = $('#phone-cc').value; c.phone = $('#phone').value.trim(); c.note = $('#customer-note').value.trim(); c.heard = $('#how-heard').value;
    // E.164 jako dnes (user.phone): „+…“ nebo „00…“ = celé mezinárodní číslo, jinak předvolba + číslo bez úvodní nuly (v produkci to dělá intl-tel-input)
    var raw = c.phone.replace(/[^\d+]/g, ''); c.e164 = raw.charAt(0) === '+' ? '+' + raw.slice(1).replace(/\D/g, '') : raw.slice(0, 2) === '00' ? '+' + raw.slice(2) : c.cc + raw.replace(/^0+/, '');
  }
  function validate2(all, only) {
    readContact(); var c = S.contact, bad = [];
    var rules = [['your-name', c.name.length >= 5, T.errName], ['your-email', reEmail.test(c.email), T.errEmail], ['phone', /^\+[1-9]\d{6,14}$/.test(c.e164), T.errPhone]];
    rules.forEach(function (r) {
      if (only && r[0] !== only) return;
      var el = $('#' + r[0]), box = el.closest('.ptcz-f'), msg = $('#err-' + r[0]);
      if (!all && !only && el.getAttribute('aria-invalid') !== 'true') return;   // při psaní jen opravuje už označené chyby
      if (r[1]) { el.removeAttribute('aria-invalid'); box.classList.remove('has-error'); msg.textContent = ''; }
      else { bad.push(r[0]); el.setAttribute('aria-invalid', 'true'); box.classList.add('has-error'); msg.innerHTML = icon('alert') + '<span>' + esc(r[2]) + '</span>'; }
    });
    var eb = $('#errbox2'), left = $$('#contact-form [aria-invalid="true"]').length;   // souhrn chyb se průběžně přepočítá
    if (!eb.hidden) { if (left) eb.lastChild.textContent = tpl(T.toFix, { n: left }); else eb.hidden = true; }
    return bad;
  }
  function next2() {
    var bad = validate2(true), box = $('#errbox2');
    if (bad.length) {
      box.hidden = false; box.innerHTML = icon('alert') + '<span>' + esc(tpl(T.toFix, { n: bad.length })) + '</span>';
      push('planner_validation_error', { planner_errors: bad.join(','), planner_error_type: 'contact' });
      var f = $('#' + bad[0]); f.focus(); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); return;
    }
    box.hidden = true;
    pushOnce('booking_step_2', { booking_step: 2, booking_step_name: 'contact', how_heard: S.contact.heard || null });   // NOVÁ událost (dnes krok 2 nic neposílá) – návrh pro Martina
    goStep(3);
  }
  var fmtDate = function (iso, time) { var d = new Date(iso + 'T' + time); return d.toLocaleDateString(LANG === 'cs' ? 'cs-CZ' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + time; };
  var addMin = function (time, m) { var p = time.split(':'), t = (+p[0]) * 60 + (+p[1]) + m; t = ((t % 1440) + 1440) % 1440; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  function tripLine() {
    var r = RATES[S.vuz], pr = priceFor(S.vuz);
    return [S.date ? fmtDate(S.date, S.time) : '', S.stops.map(function (s) { return name(P[s.pid]); }).join(' → '), r.name, tpl(pl3(S.persons, T.people), { n: S.persons }), pr ? money(pr.total) : ''].filter(Boolean).map(esc).join(' · ');
  }
  function renderSummary() {
    var r = RATES[S.vuz], pr = priceFor(S.vuz), c = S.contact, start = $('#start').value || T.startVal, dest = $('#dest').value || start;
    var t = S.time, rows = ['<li class="ptcz-tl__pt"><b>' + t + '</b><span>' + T.pickup + ' · ' + esc(start) + '</span></li>'], clock = t, prev = 'prague', day = 0, late = false;
    var adv = function (m) { var p = clock.split(':'), x = (+p[0]) * 60 + (+p[1]) + m; if (x >= 1440) { day++; x -= 1440; } clock = String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
    var stamp = function () { return T.approx + ' ' + clock + (day ? ' <small>+' + day + '</small>' : ''); };
    S.stops.forEach(function (s) {
      adv(M(prev, s.pid));
      var inc = s.includes.map(function (k) { return name(P[k]); }), stay = s.dur < 0 ? T.nextMorning : tpl(T.stayAt, { d: fmtDur(s.dur + s.includes.reduce(function (b, k) { return b + P[k].stay; }, 0)) });
      rows.push('<li><b>' + stamp() + '</b><span>' + esc(name(P[s.pid])) + (inc.length ? ' <small>+ ' + esc(inc.join(', ')) + '</small>' : '') + ' <small>· ' + stay + '</small>' + (s.wish ? '<em>„' + esc(s.wish) + '“</em>' : '') + '</span></li>');
      if (s.dur >= 0) adv(s.dur + s.includes.reduce(function (b, k) { return b + P[k].stay; }, 0));
      else { day++; clock = '09:00'; rows.push('<li class="ptcz-tl__night"><b>' + clock + '</b><span><small>' + T.nextDay + '</small></span></li>'); }   // po noclehu odjezd další ráno 9:00 (v produkci čas z kroku 1)
      prev = s.pid;
    });
    var d0 = day; adv(M(prev, S.dest)); late = day > d0 || clock > '21:00' || (day > 0 && !overnights());
    rows.push('<li class="ptcz-tl__pt"><b>' + stamp() + '</b><span>' + T.back2 + ' · ' + esc(dest) + '</span></li>');
    $('#s-route').innerHTML = '<ol class="ptcz-tl">' + rows.join('') + '</ol>' + (late ? '<p class="ptcz-note ptcz-note--warn">' + icon('alert') + '<span>' + T.lateWarn + '</span></p>' : '') + '<p class="ptcz-sumcard__meta">' + (overnights() ? '' : tpl(T.dayLen, { d: fmtH(dayTotal()), km: num(km(), 0) }) + ' · ') + T.tlNote + (S.trip ? '' : ' <small>(' + T.kmEstimate + ')</small>') + '</p>';
    $('#s-when').innerHTML = '<p><b>' + esc(fmtDate(S.date, S.time)) + '</b></p>';
    $('#s-car').innerHTML = '<p><b>' + esc(r.name) + '</b> · ' + tpl(pl3(r.max, T.upToA), { n: r.max }) + '</p><p>' + [tpl(pl3(S.persons, T.people), { n: S.persons }), tpl(pl3(S.bags, T.bagsN), { n: S.bags }), S.seats ? tpl(pl3(S.seats, T.seatsN), { n: S.seats }) + (S.seatNames ? ' (' + Object.keys(S.seatTypes).filter(function (t) { return S.seatTypes[t]; }).map(function (t) { return S.seatTypes[t] + '× ' + S.seatNames[t]; }).join(', ') + ')' : '') : null].filter(Boolean).join(' · ') + '</p>';
    $('#s-svc').innerHTML = '<p>' + ([S.guideDriver ? T.svcDriverGuide + ' · +' + money(pr.guide) : null, S.guideLicensed ? T.svcLicensed + ' · ' + T.onRequest + ' (' + T.notIncl + ')' : null].filter(Boolean).map(esc).join('<br>') || T.none2) + '</p>';
    $('#s-svc').closest('.ptcz-sumcard').classList.toggle('is-empty', !S.guideDriver && !S.guideLicensed);
    $('#s-price').innerHTML = '<p class="ptcz-sumcard__total">' + money(pr.total) + '</p><p>' + esc(tpl(T.carLine, { car: r.name, n: r.max })) + ' · ' + T.priceFor + '</p><p class="ptcz-sumcard__meta">' + T.pay + '</p><button type="button" class="ptcz-linkbtn" data-open-price>' + icon('info') + T.breakdown + '</button>';
    var ol = $('.ptcz-next .ptcz-steps'), gl = $('[data-next-guide]', ol);
    if (S.guideLicensed && !gl) { var li = document.createElement('li'); li.setAttribute('data-next-guide', ''); li.innerHTML = '<span class="ptcz-steps__n" aria-hidden="true">' + (ol.children.length + 1) + '</span><p>' + T.nextGuide + '</p>'; ol.appendChild(li); }
    if (!S.guideLicensed && gl) gl.remove();
    $('#s-contact').innerHTML = '<p><b>' + esc(c.name) + '</b></p><p>' + esc(c.email) + '</p><p>' + esc(c.e164) + '</p>';
    $('#s-note').innerHTML = '<p>' + (c.note ? esc(c.note) : T.none2) + '</p>';
    $('#s-note').closest('.ptcz-sumcard').classList.toggle('is-empty', !c.note);
  }
  // ukázka varianty A (tři stránky): přechod mezi kroky 1–3 = načtení jiné stránky, stav nese sessionStorage (dnes localStorage ptcz_reservation)
  var VAR = document.body.dataset.variant || '', PAGE = +document.body.dataset.page || 0, VAR_A = ['planovac-a.html', 'planovac-a-udaje.html', 'planovac-a-rekapitulace.html'];
  function saveForA(focusId) { try { var c = {}; Object.keys(S).forEach(function (k) { if (k !== 'toastT' && k !== 'removed') c[k] = S[k]; }); c._start = $('#start').value; c._dest = $('#dest').value; c._focus = focusId || null; sessionStorage.setItem('ptcz_demo_a', JSON.stringify(c)); } catch (e) {} }
  function restoreForA() {
    var c; try { c = JSON.parse(sessionStorage.getItem('ptcz_demo_a') || 'null'); } catch (e) {}
    if (!c) return null;
    Object.keys(c).forEach(function (k) { if (k.charAt(0) !== '_') S[k] = c[k]; });
    $('#start').value = c._start || ''; $('#dest').value = c._dest || ''; if (S.date) $('#date').value = S.date;
    $('#pick-time').value = S.time; var k = S.contact;
    [['your-name', k.name], ['your-email', k.email], ['phone', k.phone], ['customer-note', k.note], ['how-heard', k.heard]].forEach(function (x) { $('#' + x[0]).value = x[1] || ''; });
    if (k.cc) $('#phone-cc').value = k.cc;
    return c;
  }
  function goStep(n, focusId, fromPop) {
    if (VAR === 'a' && n <= 3 && n !== PAGE) { saveForA(focusId); location.href = VAR_A[n - 1] + (focusId ? '#' + focusId : ''); return; }
    if (n === S.step) return;
    var prevStep = S.step; S.step = n;
    $$('.ptcz-view').forEach(function (v) { v.hidden = +v.dataset.view !== n; });
    $$('.ptcz-steps-nav li').forEach(function (li, i) { if (i + 1 === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); li.classList.toggle('is-done', i + 1 < n); $('button', li).disabled = !(i + 1 < n && n < 4); });
    document.body.setAttribute('data-step', n);
    var label = n === 3 ? T.book : T.cont;
    $('#continue').innerHTML = esc(label) + (n === 3 ? '' : ' ' + icon('arrow', 'i i--arrow')); $('#continue-bar').textContent = label;
    $$('[data-trip-line]').forEach(function (el) { el.innerHTML = tripLine(); });
    $$('[data-pickup]').forEach(function (el) { el.textContent = $('#start').value || T.startVal; });
    $$('[data-note-seats]').forEach(function (el) { el.hidden = !S.seats; });
    if (n === 3) { readContact(); renderSummary(); pushOnce('booking_step_3', { booking_step: 3, booking_step_name: 'summary', booking_value: priceFor(S.vuz).total, booking_currency: 'CZK', booking_vehicle: S.vuz }); }
    if (!fromPop) try { history.pushState({ ptczStep: n }, ''); } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
    var target = focusId ? $('#' + focusId) : (n === 2 ? (prevStep === 1 ? $('#lab-trip2') : $('#your-name')) : n === 3 ? $('#k3-h') : n === 1 ? $('.ptcz-pl__head .ptcz-h1') : null);
    if (target && focusId) setTimeout(function () { target.scrollIntoView({ block: 'center' }); }, 60);
    if (target) { if (!target.matches('input, select, textarea, button, [tabindex]')) target.setAttribute('tabindex', '-1'); setTimeout(function () { target.focus({ preventScroll: true }); }, 50); }
  }
  function book() {
    var g = $('#gdpr_consent'), tc = $('#terms_and_conditions'), btn = $('#place-order-btn');
    if (S.sending) return;
    if (!g.checked || !tc.checked) {
      $('#err-consent').innerHTML = icon('alert') + '<span>' + esc(T.errConsent) + '</span>';
      [g, tc].forEach(function (x) { x.closest('.ptcz-check').classList.toggle('has-error', !x.checked); });
      (g.checked ? tc : g).focus(); $('#consent').scrollIntoView({ block: 'center', behavior: 'smooth' }); return;
    }
    pushOnce('add_payment_info', { booking_step: 3, booking_step_name: 'add_payment_info' });
    S.sending = true; [btn, $('#continue'), $('#continue-bar')].forEach(function (b) { b.disabled = true; b.setAttribute('aria-busy', 'true'); });
    btn.innerHTML = '<span class="ptcz-spin" aria-hidden="true"></span>' + esc(T.sending);
    setTimeout(function () {   // náhled: místo POST save_reservation jen ukázka děkovné obrazovky
      S.sending = false; S.sent = true;
      push('planner_demo_sent', { booking_step: 4 });
      goStep(4); $('#bar').hidden = true;
      setTimeout(function () { $('#done-h').focus(); }, 60);
    }, 1200);
  }

  /* ---------------- start ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    root = $('#planner'); list = $('#stops'); pick = $('#pick'); fits = $('#fits'); moreGrid = $('#more-grid'); day = $('#day');
    searchWrap = $('#search-wrap'); searchInput = $('#search-poi'); ac = $('#ac'); otherBtn = $('#other'); sheet = $('#sheet');
    applyUrl();
    var dmin = new Date(); dmin.setDate(dmin.getDate() + 1); $('#date').min = dmin.toISOString().slice(0, 10);
    bind();
    try { history.replaceState({ ptczStep: VAR === 'a' ? PAGE : 1 }, ''); } catch (e) {}
    var restored = VAR === 'a' ? restoreForA() : null;
    if (restored) S.step = 1;
    resolveVehicle('init');
    render();
    if (VAR === 'a' && PAGE > 1) { if (!restored) { location.replace(VAR_A[0]); return; } goStep(PAGE, restored._focus, true); }
    window.PTCZ_PLANNER = { state: S, price: priceFor, fits: fitsFor, add: addStop, remove: removeStop, render: render };   // pro ověření Playwrightem
  });
})();
