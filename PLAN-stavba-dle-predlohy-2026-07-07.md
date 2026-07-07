# Plán stavby nového webu podle předlohy

**Datum:** 7. 7. 2026 · **Dohodli:** RF + Claude · **Staví:** Martin (dev2) · **Kontroluje:** Claude · **Schvaluje:** RF

---

## 1. Jediný zdroj — co je předloha

**Předloha nového webu = GitHub Pages: https://privatetc.github.io/ptcz-web-nahledy/** (repo `PrivateTC/ptcz-web-nahledy`).

Vše ostatní — kopie na Google Drive, PTC-Dev-Shared, starší verze návrhů — je **jen záloha/historie, NENÍ zdroj**. Když se cokoliv liší, platí GitHub.

## 2. Role (dohodnuto s RF 7. 7. 2026)

1. **Martin** staví web na dev2 podle této předlohy a podle tohoto plánu.
2. **Claude** (přes mini render, s přihlášením na dev2) kontroluje, že stav na dev2 odpovídá předloze — stránku po stránce, desktop i mobil. Na dev2 nic nemění, jen se dívá — dev2 je Martinovo pracoviště.
3. **RF** schvaluje. **Na produkci nejde nic bez schválení RF.**

## 3. Postup u každé stránky

1. Martin postaví stránku na dev2 (dev2 adresu doplní do tabulky níže / dá vědět).
2. Claude vyrenderuje dev2 (desktop + mobil) a porovná **1:1 s předlohou**: rozvržení, barvy, mezery, texty, CTA, chování na mobilu.
3. Výstup kontroly = konkrétní seznam **„sedí / nesedí“**.
4. Martin doladí body „nesedí“ → nová kontrola.
5. Když vše sedí → **RF schválí**. Teprve potom se stránka smí chystat na produkci.

## 4. Stránky — předloha, dev2, stav

| Stránka | Předloha (GitHub náhled) | dev2 URL (doplní RF/Martin) | Stav kontroly |
|---|---|---|---|
| Homepage | [náhled](https://privatetc.github.io/ptcz-web-nahledy/homepage-nova-v1.1-CZ-vzdusny-2026-06-14.html) | https://dev2.privatetoursczech.cz/ | ✅ zkontrolováno 7. 7. — sedí (horní část i patička) |
| Detail výletu CZ | [náhled](https://privatetc.github.io/ptcz-web-nahledy/detail-vyletu-cesky-krumlov-KOMPLET-CZ-vzdusny-2026-06-14.html) | — | čeká na dev2 URL |
| Detail výletu EN | [náhled](https://privatetc.github.io/ptcz-web-nahledy/detail-vyletu-cesky-krumlov-KOMPLET-vzdusny-2026-06-14.html) | — | čeká na dev2 URL |
| Plánovač | [náhled](https://privatetc.github.io/ptcz-web-nahledy/planovac-redesign-KOMPLET-vzdusny-2026-06-14.html) | — | čeká na dev2 URL |
| Blog (šablona článku) | [náhled](https://privatetc.github.io/ptcz-web-nahledy/blog-clanek-nova-v1.0-CZ-vzdusny-2026-06-14.html) | — | čeká na dev2 URL |
| Partnerský program | [náhled](https://privatetc.github.io/ptcz-web-nahledy/partnersky-program-nova-v1.0-CZ-2026-06-07.html) | — | čeká na dev2 URL |
| Vlož plán z AI | [náhled](https://privatetc.github.io/ptcz-web-nahledy/planovac-vloz-plan-z-ai-CZ-v1.0-2026-06-06.html) | — | čeká na dev2 URL |
| Rozšířená sticky lišta | [náhled](https://privatetc.github.io/ptcz-web-nahledy/sticky-footer-rozsireny-mobil-ipad-pc-2026-06-14.html) | — | čeká na dev2 URL |

Detail výletu (Č. Krumlov) je **šablona pro všech 25 výletů** — kontroluje se jednou jako vzor.

## 5. Detaily co stavět

Podrobný rozpis bloků a funkcí = master plán **`plan-nasazeni-martin-web-v1.0-2026-06-06.html`** (uložen na Drive: `Private Tours Czech/Reports/Design/`). Tento dokument ho nenahrazuje — řídí jen postup stavby a kontrolu.

## 6. Mimo tento plán

- **Obsah 25 výletů** (naplnění textů do šablony detailu) = samostatná vrstva, řeší se zvlášť.
- **SEO a SEO-LLM zůstávají optimal** — změny CTA a vzhledu nemění titulky, H1/H2, schema ani hreflang.
