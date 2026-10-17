# SEO a jazykové modely – plánovač výletů, Fáze 1

Datum: 17. 10. 2026 · Metoda: `curl` serverového HTML bez JS (UA „PTCZ-predloha“) pro `/en/trip-planner/`, `/planovac-vyletu/`, variantu `?from=…`, `?utm_source=…`, krok 2 `/en/prague-private-tours/details/`, krok 3 `/en/prague-private-tours/summary/`, `robots.txt`, `page-sitemap.xml`, `/llms.txt`; předloha ověřena jako vložený CSS/JS (nic na serveru se neměnilo).

## Co je v pořádku (nasazeno 16. 10., neměnit)
- Title „Trip Planner – Private Day Trip from Prague | PrivateToursCzech“ (52 zn.) / „Plánovač výletů – soukromý výlet z Prahy | PrivateToursCzech“; meta description 140–160 zn. v obou jazycích; jeden H1; úvodní odstavec `.ptcz-planovac-uvod` je v serverovém HTML (celý vůz, řidič, bez zálohy).
- Canonical na čistou URL, hreflang cs + en + x-default, obě URL v `page-sitemap.xml`; `robots.txt` výslovně pouští GPTBot, ClaudeBot, OAI-SearchBot, Claude-Web.
- Popisky polí jsou skutečné `<label for>` u Startu (`autoComplete1`), Data (`departure`), Cíle (`autoComplete2`), Jména a E-mailu na kroku 2; text je v serverovém HTML, ne jen placeholder.
- JSON-LD (Yoast): WebPage, WebSite + SearchAction, Organization, BreadcrumbList. Service/FAQ schema na plánovači není – pro formulářovou stránku to není chyba.
- `/llms.txt` plánovač popisuje správně: „build a route and see the price per car“, „Route: fully customisable in the trip planner“, „Exact prices are shown in the trip planner“, odkazy EN i CZ.

## Co úprava Fáze 1 mění z pohledu SEO/LLM
- Předloha **nepřidává žádný obsah, který by měl být vidět jen přes JS**: nápovědy (`.ptcz-hint`), zprávy (`.ptcz-msg`, `aria-live`), nový popisek Startu a placeholder jsou v `faze1-html.md` předepsány **do šablony (PHP)** – v demu je dotváří JS jen proto, že na produkci nic neměníme. Po nasazení ověřit `curl` (bez JS), že nový text labelu a nápověda u Zastávek jsou v HTML.
- Nevznikají duplicitní H1/H2: lišta, list s cenou a nabídka používají `<h2 class="ptcz-sheet__title">` jen uvnitř `role="dialog"` (skrytý, dokud se neotevře). Pokud by vývojář list renderoval v PHP, použít `<p>`/`<div>` místo `<h2>`, ať se nadpis nepočítá do osnovy.
- Velikost: `faze1.css` 21,8 KB (5,5 KB gzip), `faze1.js` 46,2 KB (14,3 KB gzip) – bez knihoven, bez obrázků (ikony inline SVG), bez dalších požadavků kromě loga „powered by Google“ (gstatic, cache). Lazy načítání Maps se v této fázi nemění (sekce 5 = Fáze 3); první psaní tedy není zpomaleno.
- Přístupnost: pole `role="combobox"` + `aria-expanded/controls/activedescendant`, položky `role="option"`, chyby `role="status" aria-live="polite"` napojené přes `aria-describedby`, list `role="dialog" aria-modal`, kontrast chybové #d92d20 na #fef3f2 = 5,9:1, sekundární #6B6B6B na bílé = 5,3:1, prstenec fokusu 3 px.

## Nálezy (mimo předlohu, k rozhodnutí)
1. **`/en/trip-planner/?from=…` nemá canonical ani robots** (ověřeno 17. 10.: `?utm_source=x` canonical má, `?from=test` i `?from=tour` ne; stejná stránka s `x-ptcz-nocache: flow`). Varianta tak může být indexována jako duplikát. → vývojář: pro parametr `from` (a `k`, `load_reservation`, `edit_reservation_id`, `adminmode`) vracet `<link rel="canonical">` na čistou URL + `<meta name="robots" content="noindex,follow">`. **[T]**
2. **Kroky 2 a 3 (`/en/prague-private-tours/details/`, `/summary/`, CZ `/planovac-vyletu-na-miru/udaje/`, `/rekapitulace/`) nemají canonical ani noindex** a v `robots.txt` nejsou zakázané (zakázáno je jen `/thank-you/`). Jsou to procesní stránky bez obsahu – `noindex,follow`. V sitemapě nejsou (správně). **[T]**
3. Stránka nemá žádné `<h2>` (jen H1 a sedm `<h3>` v modálech sedaček/průvodce). Pro osnovu a AI čtení stačí **popisky sekcí formuláře** (Start, Stops, Destination, Car…) ponechat jako `<label>`/`<legend>`, ne měnit na nadpisy – nic nedoporučuji měnit, jen při Fázi 2 (sekce 9) nepřidávat H2 do karet.
4. Popisek Zastávek `<label class="labelz">Stops</label>` nemá `for="search-poi"` → není to skutečný popisek pole (AI/čtečka vidí jen placeholder „Search for places“). Předloha doplňuje `for` v JS; v šabloně to je jednořádková změna (viz `faze1-html.md` §1). **[T]**
5. Popisky „Number of persons“ / „Number of luggage“ míří `for="person"` na `<span>`, ne na ovládací prvek; stepper je sekce 3 (Fáze 2) – tam převést hodnotu na `<output>` a popisek na `aria-labelledby`.

## Návrhy (max 5) v rozsahu Fáze 1
| # | Návrh | Co mění pro zákazníka | Kdo |
|---|---|---|---|
| 1 | Nápovědu u Zastávek a nový popisek Startu dát do PHP šablony (serverový text), ne přes JS – AI asistenti a Google tak vidí, co pole očekává („Hotel, address or place in Prague“, „Type a place… and pick it from the list“). | ano – texty [M] v tabulce galerie | M schvaluje, T provede |
| 2 | Canonical + `noindex,follow` pro `?from=` varianty plánovače a pro kroky 2–3 (nálezy 1–2). | ne | T |
| 3 | `for="search-poi"` u popisku Zastávek; u Cíle ponechat dva popisky (`Destination` + `Reach your destination`) jen jako jeden `<label for>` a druhý jako `<span>` – dnes jsou oba `<label for="autoComplete2">`, čtečka přečte „Destination Reach your destination“. | ne (vizuálně beze změny) | T |
| 4 | Do `/llms.txt` doplnit k řádku „Trip planner“ jednu větu: „Places: Czechia and neighbouring countries (Austria, Germany, Poland, Slovakia); pickup anywhere in Prague; you pay the driver on the day, no deposit; free cancellation up to 24 h.“ – odpovídá zadání sekce 1 a §1 pravdy; dnes tam o omezení zemí nic není. | ne (soubor pro AI) | M schvaluje znění, Claude zapíše |
| 5 | Chybové texty (sekce 8) a nápovědy nechat v překladovém zdroji pluginu (`ptczTranslations`), ne natvrdo v JS – kvůli hreflang konzistenci (CZ stránka nesmí dostat EN chybu). Předloha má obě sady v `PTCZ_F1.texts`. | ne | T |

Co se **nenavrhuje**: měnit title/H1/úvod (nasazeno 16. 10.), přidávat FAQ/Service schema na formulář (bez obsahu by to byl prázdný markup), lazy Maps (Fáze 3).
