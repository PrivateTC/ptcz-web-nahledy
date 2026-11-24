/* ===== ptcz-track.js — měření homepage v2 (referenční implementace k zadání v1.2, kap. 6) =====
 * Jen čte data-* atributy ze serverového HTML a posílá události do window.dataLayer.
 * Žádný GTM kód (funguje i na dev2 bez GTM), nic nezapisuje do cookies / localStorage / sessionStorage,
 * neposílá žádný text, který napsal host. Jeden prvek = jedna událost.
 * Každá událost nese vždy celou sadu svých parametrů (nepoužité = null), aby v datovém modelu GTM
 * nezůstala hodnota z předchozí události.
 * Převzít 1:1 nebo napsat po svém — závazné jsou názvy událostí, parametrů a hodnot (zadání kap. 6). */
(function () {
  'use strict';
  var dl = window.dataLayer = window.dataLayer || [];
  var body = document.body;
  var PAGE_TYPE = body.getAttribute('data-page-type') || 'other';
  var LANG = (document.documentElement.lang || 'cs').slice(0, 2);

  function push(o) { o.page_type = PAGE_TYPE; dl.push(o); }
  function num(v) { var n = parseInt(v, 10); return isNaN(n) ? null : n; }
  function sectionOf(el, placement) {
    var s = el.closest('[data-section]');
    return s ? s.getAttribute('data-section') : placement;
  }

  // ===== Kliky: cta_click / tour_card_click / whatsapp_click / lang_switch =====
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a,button');
    if (!a) return;

    var target = a.getAttribute('data-click-target');
    var card = a.closest('[data-tour-slug]');
    if (card && target) {
      var list = card.closest('[data-list-id]');
      push({
        event: 'tour_card_click',
        list_id: list ? list.getAttribute('data-list-id') : null,
        tour_slug: card.getAttribute('data-tour-slug'),
        card_type: card.getAttribute('data-card-type'),
        card_position: num(card.getAttribute('data-position')),
        click_target: target
      });
      return;
    }

    var id = a.getAttribute('data-cta-id');
    if (!id) return;
    var placement = a.getAttribute('data-placement') || 'section';
    var section = sectionOf(a, placement);

    if (id === 'whatsapp') {
      push({ event: 'whatsapp_click', placement: placement, section_id: section, tour: null });
      return;
    }
    if (id === 'lang_switch') {
      push({ event: 'lang_switch', from_lang: LANG, to_lang: (a.getAttribute('hreflang') || '').slice(0, 2), placement: placement });
      return;
    }
    push({
      event: 'cta_click',
      cta_id: id,
      cta_role: a.getAttribute('data-cta-role') || 'tertiary',
      placement: placement,
      section_id: section,
      cta_position: num(a.getAttribute('data-cta-position'))
    });
  }, true);

  // ===== Rozbalení: faq_open / details_open (jen otevření hostem, ne automatické otevření na počítači) =====
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (!d || d.tagName !== 'DETAILS' || !d.open) return;
    if (d.__ptczAuto) { d.__ptczAuto = false; return; }
    if (d.hasAttribute('data-faq-id')) {
      push({ event: 'faq_open', faq_id: d.getAttribute('data-faq-id'), faq_position: num(d.getAttribute('data-faq-position')) });
    } else if (d.hasAttribute('data-details-id')) {
      push({ event: 'details_open', section_id: sectionOf(d, null), details_id: d.getAttribute('data-details-id') });
    }
  }, true);

  // ===== section_view: horní okraj sekce ve výřezu okna (0 ≤ top < výška okna) aspoň 500 ms, jednou za zobrazení =====
  var sections = [].slice.call(document.querySelectorAll('[data-section]'));
  var seen = {}, timers = {};
  function checkSections() {
    var h = window.innerHeight;
    sections.forEach(function (s) {
      var id = s.getAttribute('data-section');
      if (seen[id]) return;
      var top = s.getBoundingClientRect().top;
      var visible = top >= 0 && top < h;
      if (visible && !timers[id]) {
        timers[id] = setTimeout(function () {
          seen[id] = true; delete timers[id];
          push({ event: 'section_view', section_id: id });
        }, 500);
      } else if (!visible && timers[id]) {
        clearTimeout(timers[id]); delete timers[id];
      }
    });
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; checkSections(); });
  }, { passive: true });
  window.addEventListener('resize', checkSections);
  checkSections();

  // ===== tour_list_scroll: jen když je seznam karet vodorovně posuvný (mobil) =====
  [].forEach.call(document.querySelectorAll('[data-list-id]'), function (list) {
    var cards = list.querySelectorAll('[data-tour-slug]');
    if (!cards.length || !('IntersectionObserver' in window)) return;
    var maxSeen = 1, moved = false, ended = false;
    function scrollable() { return list.scrollWidth > list.clientWidth + 2; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var p = num(en.target.getAttribute('data-position')) || 1;
        if (p > maxSeen) maxSeen = p;
        if (moved && !ended && p === cards.length && scrollable()) {
          ended = true;
          push({ event: 'tour_list_scroll', list_id: list.getAttribute('data-list-id'), scroll_action: 'reached_end', max_card_seen: maxSeen });
        }
      });
    }, { root: list, threshold: 0.6 });
    [].forEach.call(cards, function (c) { io.observe(c); });
    list.addEventListener('scroll', function () {
      if (moved || !scrollable() || list.scrollLeft <= 24) return; // > 24 px = posun hostem (ne dorovnání scroll-snapu)
      moved = true;
      push({ event: 'tour_list_scroll', list_id: list.getAttribute('data-list-id'), scroll_action: 'first_move', max_card_seen: maxSeen });
    }, { passive: true });
  });

  // ===== currency_switch: dnešní přepínač měny vysílá window událost 'currencyChanged' (ptcz-price.js) =====
  window.addEventListener('currencyChanged', function (e) {
    var to = (e && e.detail && (e.detail.currency || e.detail)) || null;
    if (typeof to !== 'string') {
      try { to = localStorage.getItem('currency'); } catch (err) { to = null; } // jen čtení dnešní volby
    }
    push({ event: 'currency_switch', currency_to: to ? String(to).toLowerCase() : null });
  });
})();
