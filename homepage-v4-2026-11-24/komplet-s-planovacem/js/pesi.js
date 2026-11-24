/* Pěší prohlídka – krok 2 (Údaje) a krok 3 (Rekapitulace) v design systému PrivateToursCzech v1.
   Jen náhled: dvě samostatné stránky jako dnes (RF 27. 10., otázka 1 = A), stav mezi nimi nese sessionStorage
   (v produkci localStorage ptcz_reservation), místo POST save_reservation se ukáže děkovná obrazovka. */
(function () {
  'use strict';
  var T = window.PTCZ_T, C = window.PTCZ_W, w = C.w, LANG = C.lang, PAGE = C.page, FILES = C.files;
  var dl = window.dataLayer = window.dataLayer || [];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var tpl = function (s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); };
  var icon = function (id) { return '<svg class="i" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; };
  var pl3 = function (n, f) { return LANG === 'cs' ? (n === 1 ? f[0] : (n >= 2 && n <= 4 ? f[1] : f[2])) : (n === 1 ? f[0] : f[2]); };
  var money = function (n) { var s = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, LANG === 'cs' ? ' ' : ','); return LANG === 'cs' ? s + ' Kč' : s + ' CZK'; };
  var hours = function (m) { var h = m / 60; return (Number.isInteger(h) ? h : String(h).replace('.', LANG === 'cs' ? ',' : '.')) + ' h'; };
  var mins = function (m) { return m >= 60 ? hours(m) : m + ' min'; };
  var KEY = 'ptcz_demo_pesi';
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  /* ---------------- stav ---------------- */
  var load = function () { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  var saved = load();
  var q = new URLSearchParams(location.search), qTrip = +q.get('trip');
  var defTrip = LANG === 'cs' ? 7458 : 7469;
  var tripId = C.walks[qTrip] && C.walks[qTrip].lang === LANG ? qTrip : (saved && C.walks[saved.trip] && C.walks[saved.trip].lang === LANG ? saved.trip : defTrip);
  var S = { trip: tripId, date: '', time: '09:00', persons: 2, contact: { name: '', email: '', cc: LANG === 'cs' ? '+420' : '+44', phone: '', note: '', heard: '', e164: '' }, sending: false };
  if (saved) {   // údaje drží i při přepnutí prohlídky nebo jazyka
    S.date = saved.date || ''; S.time = saved.time || '09:00'; S.persons = saved.persons || 2; if (saved.contact) S.contact = saved.contact; }
  var TOUR = C.walks[S.trip];
  /* čas začátku podle trasy a ročního období (RF 28. 10., P1 = A): duben–září „leto“, říjen–březen „zima“ */
  var season = function (iso) { var m = +(iso || today()).slice(5, 7); return m >= 4 && m <= 9 ? 'leto' : 'zima'; };
  var slots = function (iso) { var r = TOUR.win[season(iso)], out = [], p = function (s) { var a = s.split(':'); return a[0] * 60 + +a[1]; };
    for (var m = p(r[0]); m <= p(r[1]); m += 15) out.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')); return out; };
  var fitTime = function (time, iso) { var s = slots(iso); return s.indexOf(time) >= 0 ? time : (time < s[0] ? s[0] : s[s.length - 1]); };
  var isSunday = function (iso) { return !!iso && new Date(iso + 'T12:00').getDay() === 0; };
  S.time = fitTime(S.time, S.date);
  var save = function () { try { sessionStorage.setItem(KEY, JSON.stringify({ trip: S.trip, date: S.date, time: S.time, persons: S.persons, contact: S.contact })); } catch (e) {} };
  var push = function (ev, o) { o = o || {}; o.event = ev; o.booking_lang = LANG; o.booking_trip_type = 'pesi'; o.booking_is_walking = 1; o.booking_value = TOUR.price; o.booking_currency = 'CZK'; o.booking_persons = S.persons; o.booking_luggage = 0; o.booking_stops_count = TOUR.stops.length; dl.push(o); };   // společné parametry jako dnes (soupis kap. 4)
  var pushOnce = function (ev, o) { var k = 'ptcz_track_pesi_' + ev; try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) {} push(ev, o); };
  var go = function (file, hash) { save(); location.href = file + '?pesi=1&trip=' + S.trip + (hash ? '#' + hash : ''); };

  /* ---------------- společné ---------------- */
  function common() {
    document.title = tpl(w.h1, { tour: TOUR.name }) + ' · PrivateToursCzech';
    $('[data-h1]').textContent = tpl(w.h1, { tour: TOUR.name });
    $$('[data-tour-link]').forEach(function (a) { a.href = TOUR.url; });
    $$('[data-price-val]').forEach(function (el) { el.textContent = money(TOUR.price); });
    $$('[data-trip-line]').forEach(function (el) { el.innerHTML = tripLine(); });
    var ls = $('[data-keep-trip]'); if (ls) ls.href = ls.getAttribute('href').split('?')[0] + '?pesi=1&trip=' + TOUR.pair;
    // ukázka: přepínač prohlídky (jen náhled)
    var box = $('[data-demo-tours]');
    if (box) box.innerHTML = Object.keys(C.walks).filter(function (id) { return C.walks[id].lang === LANG; }).map(function (id) {
      return '<button type="button" data-demo-trip="' + id + '"' + (+id === S.trip ? ' aria-pressed="true" style="background:rgba(255,255,255,.18)"' : '') + '>' + esc(C.walks[id].name) + '</button>';
    }).join(' ');
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-demo-trip]'); if (b) { S.trip = +b.dataset.demoTrip; readAll(); go(FILES[PAGE - 2]); return; }
      var g = e.target.closest('[data-goto]'); if (g) { e.preventDefault(); if (PAGE === 3) go(FILES[0], g.dataset.focus || ''); }
    });
  }
  function tripLine() {
    var parts = [TOUR.name, tpl(w.dur, { d: hours(TOUR.mins) })];
    if (S.date) parts.push(fmtDate(S.date, S.time));
    parts.push(tpl(pl3(S.persons, T.people), { n: S.persons }), money(TOUR.price));
    return parts.map(esc).join(' · ');
  }
  var fmtDate = function (iso, time) { var d = new Date(iso + 'T' + time); return d.toLocaleDateString(LANG === 'cs' ? 'cs-CZ' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + time; };

  /* ---------------- krok 2: Údaje ---------------- */
  var reEmail = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  function readAll() {
    if (PAGE !== 2) return;
    S.date = $('#date').value; S.time = $('#pick-time').value;
    var c = S.contact; c.name = $('#your-name').value.trim(); c.email = $('#your-email').value.trim(); c.cc = $('#phone-cc').value; c.phone = $('#phone').value.trim(); c.note = $('#customer-note').value.trim(); c.heard = $('#how-heard').value;
    var raw = c.phone.replace(/[^\d+]/g, ''); c.e164 = raw.charAt(0) === '+' ? '+' + raw.slice(1).replace(/\D/g, '') : raw.slice(0, 2) === '00' ? '+' + raw.slice(2) : c.cc + raw.replace(/^0+/, '');
  }
  function setErr(id, ok, msg) {
    var el = $('#' + id), box = el.closest('.ptcz-f'), m = $('#err-' + id);
    if (ok) { el.removeAttribute('aria-invalid'); box.classList.remove('has-error'); m.textContent = ''; }
    else { el.setAttribute('aria-invalid', 'true'); box.classList.add('has-error'); m.innerHTML = icon('alert') + '<span>' + esc(msg) + '</span>'; }
  }
  function validate(all, only) {
    readAll(); var c = S.contact, bad = [];
    [['date', !!S.date && S.date >= today(), w.errDate], ['your-name', c.name.length >= 5, T.errName], ['your-email', reEmail.test(c.email), T.errEmail], ['phone', /^\+[1-9]\d{6,14}$/.test(c.e164), T.errPhone]].forEach(function (r) {
      if (only && r[0] !== only) return;
      if (!all && !only && $('#' + r[0]).getAttribute('aria-invalid') !== 'true') return;
      setErr(r[0], r[1], r[2]); if (!r[1]) bad.push(r[0]);
    });
    var eb = $('#errbox2'), left = $$('.ptcz-pl__form [aria-invalid="true"]').length;
    if (!eb.hidden) { if (left) eb.lastChild.textContent = tpl(T.toFix, { n: left }); else eb.hidden = true; }
    return bad;
  }
  function setPersons(n) {
    var note = $('#persons-max');
    if (n > 4) { note.hidden = false; return; }
    note.hidden = true; S.persons = Math.max(1, n);
    $('[data-val="persons"]').textContent = S.persons;
    $('[data-step="persons"][data-dir="-1"]').disabled = S.persons <= 1;
    $('[data-step="persons"][data-dir="1"]').setAttribute('aria-disabled', S.persons >= 4 ? 'true' : 'false');
    $$('[data-trip-line]').forEach(function (el) { el.innerHTML = tripLine(); });
    save();
  }
  function next() {
    var bad = validate(true), box = $('#errbox2');
    if (bad.length) {
      box.hidden = false; box.innerHTML = icon('alert') + '<span>' + esc(tpl(T.toFix, { n: bad.length })) + '</span>';
      push('planner_validation_error', { planner_errors: bad.join(','), planner_error_type: 'contact' });
      var f = $('#' + bad[0]); f.focus(); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); return;
    }
    pushOnce('booking_step_2', { booking_step: 2, booking_step_name: 'contact', booking_value: TOUR.price, booking_currency: 'CZK', booking_persons: S.persons, how_heard: S.contact.heard || null });
    go(FILES[1]);
  }
  function fillTimes(moved) {
    var sel = $('#pick-time'), r = TOUR.win[season(S.date)].map(function (x) { return x.replace(/^0/, ''); }), before = S.time;
    S.time = fitTime(S.time, S.date);
    sel.innerHTML = slots(S.date).map(function (x) { return '<option' + (x === S.time ? ' selected' : '') + '>' + x + '</option>'; }).join('');
    sel.value = S.time;
    $('#time-hint').textContent = tpl(w.timeHint, { season: w.season[season(S.date)], from: r[0], to: r[1] });
    var mv = $('#time-moved'); mv.hidden = !(moved && before !== S.time);
    if (!mv.hidden) mv.querySelector('span').textContent = tpl(w.timeMoved, { season: w.season[season(S.date)], t: S.time.replace(/^0/, ''), from: r[0], to: r[1] });
    $('#sunday-note').hidden = !(isSunday(S.date) && S.time < '12:00');
  }
  function page2() {
    $('#date').min = today();
    $('#date').value = S.date; fillTimes(false);
    var c = S.contact; $('#your-name').value = c.name; $('#your-email').value = c.email; $('#phone-cc').value = c.cc; $('#phone').value = c.phone; $('#customer-note').value = c.note; $('#how-heard').value = c.heard;
    setPersons(S.persons);
    $$('[data-step="persons"]').forEach(function (b) { b.addEventListener('click', function () { setPersons(S.persons + (+b.dataset.dir)); }); });
    ['date', 'pick-time', 'your-name', 'your-email', 'phone', 'phone-cc', 'customer-note', 'how-heard'].forEach(function (id) {
      var el = $('#' + id);
      el.addEventListener('input', function () { readAll(); save(); $$('[data-trip-line]').forEach(function (x) { x.innerHTML = tripLine(); }); if (el.getAttribute('aria-invalid') === 'true') validate(false); });
      el.addEventListener('change', function () { readAll(); if (id === 'date' || id === 'pick-time') { fillTimes(id === 'date'); if (id === 'pick-time') $('#time-moved').hidden = true; } save(); $$('[data-trip-line]').forEach(function (x) { x.innerHTML = tripLine(); }); if (id === 'date') validate(false, 'date'); });
      el.addEventListener('blur', function () { if (el.value && (id === 'your-name' || id === 'your-email' || id === 'phone')) validate(false, id); });
    });
    ['#continue', '#continue-bar', '[data-next]'].forEach(function (s) { var b = $(s); if (b) b.addEventListener('click', next); });
    var h = location.hash.slice(1), target = h && document.getElementById(h);
    if (target) { if (!target.matches('input, select, textarea, button, [tabindex]')) target.setAttribute('tabindex', '-1'); setTimeout(function () { target.scrollIntoView({ block: 'center' }); target.focus({ preventScroll: true }); }, 60); }
  }

  /* ---------------- krok 3: Rekapitulace ---------------- */
  function addMin(time, m) { var p = time.split(':'), x = (+p[0]) * 60 + (+p[1]) + m, day = Math.floor(x / 1440); x = x % 1440; return { t: String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'), day: day }; }
  // zastávky bez minut: data výletu mají jiné minuty a záměrně se nepoužívají (cena-pesi.php), dnešní rekapitulace i e-mail je vynechávají
  function page3() {
    var c = S.contact;
    if (!S.date || !c.name) { location.replace(FILES[0] + '?pesi=1&trip=' + S.trip); return; }   // bez údajů z kroku 2 zpět na Údaje (dnes totéž dělá kontrola stavu)
    var end = addMin(S.time, TOUR.mins);
    $('#s-route').innerHTML = '<p><b>' + esc(TOUR.name) + '</b></p><ol class="ptcz-tl">'
      + '<li class="ptcz-tl__pt"><b>' + S.time + '</b><span>' + esc(w.tlStart) + '</span></li>'
      + TOUR.stops.map(function (s) { return '<li><b aria-hidden="true">·</b><span>' + esc(s[0]) + '</span></li>'; }).join('')
      + '<li class="ptcz-tl__pt"><b>' + T.approx + ' ' + end.t + (end.day ? ' <small>+' + end.day + '</small>' : '') + '</b><span>' + esc(tpl(w.tlEnd, { end: TOUR.end })) + '</span></li></ol>'
      + '<p class="ptcz-sumcard__meta">' + esc(tpl(w.dur, { d: hours(TOUR.mins) })) + ' · ' + esc(w.durNote) + '</p>';
    $('#s-when').innerHTML = '<p><b>' + esc(fmtDate(S.date, S.time)) + '</b></p><p>' + esc(w.meet) + '</p>'
      + (isSunday(S.date) && S.time < '12:00' ? '<p class="ptcz-note">' + icon('info') + '<span>' + esc(w.sunday) + '</span></p>' : '');
    $('#s-persons').innerHTML = '<p><b>' + esc(tpl(pl3(S.persons, T.people), { n: S.persons })) + '</b></p><p>' + esc(w.personsHint) + '</p>';
    $('#s-contact').innerHTML = '<p><b>' + esc(c.name) + '</b></p><p>' + esc(c.email) + '</p><p>' + esc(c.e164) + '</p>';
    $('#s-note').innerHTML = '<p>' + (c.note ? esc(c.note) : T.none2) + '</p>';
    $('#s-note').closest('.ptcz-sumcard').classList.toggle('is-empty', !c.note);
    $('#s-price').innerHTML = '<p class="ptcz-sumcard__total">' + money(TOUR.price) + '</p><p>' + esc(w.priceFor) + '</p><p class="ptcz-sumcard__meta">' + esc(w.pay) + '</p>';
    pushOnce('booking_step_3', { booking_step: 3, booking_step_name: 'summary' });   // nově i pro pěší (RF 28. 10., P2 = A); dnes se pro pěší neposílá
    $$('#consent input').forEach(function (x) { x.addEventListener('change', function () { if ($('#gdpr_consent').checked && $('#terms_and_conditions').checked) { $('#err-consent').textContent = ''; $$('.ptcz-check').forEach(function (l) { l.classList.remove('has-error'); }); } }); });
    $('#place-order-btn').addEventListener('click', book);
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
    S.sending = true; btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = '<span class="ptcz-spin" aria-hidden="true"></span>' + esc(T.sending);
    setTimeout(function () {   // náhled: místo POST save_reservation (pevná cena se na serveru ověří z databáze jako dnes) jen děkovná obrazovka
      push('planner_demo_sent', { booking_step: 4 });
      try { Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('ptcz_track_pesi_') === 0) sessionStorage.removeItem(k); }); } catch (e) {}   // nová rezervace v téže relaci se změří znovu
      $$('.ptcz-view').forEach(function (v) { v.hidden = v.dataset.view !== '4'; });
      document.body.setAttribute('data-step', '4'); $('#bar').hidden = true; window.scrollTo(0, 0);
      setTimeout(function () { $('#done-h').focus(); }, 60);
    }, 1200);
  }

  document.addEventListener('DOMContentLoaded', function () {
    common();
    if (PAGE === 2) page2(); else page3();
    save();
    window.PTCZ_WALK = { state: S, tour: TOUR };   // pro ověření Playwrightem
  });
})();
