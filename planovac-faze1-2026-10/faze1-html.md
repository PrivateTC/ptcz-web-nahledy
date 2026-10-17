# Fáze 1 – co změnit v šabloně a pluginu (pro vývojáře)

Verze 1.0 · 2026-10-17 · k úkolu Fáze 1 · zadání vývojáři (dokument „Plánovač výletů – vyladění UI“) (sekce 0, 1, 7, 8, 11 + Poznámky k měření)

Předloha `faze1.css` + `faze1.js` běží nad **dnešní** šablonou (`krok2.php`, `script-krok2.js`, `script-krok3.js`) tak, že si chybějící prvky dotvoří v JS. Pro produkci je správné dát je **do šablony (PHP)**, aby je viděl i Google a AI asistenti (serverový text), a JS nechat jen chování. Níže je přesný seznam. Texty označené **[M]** schvaluje majitel – v předloze jsou návrhy (tabulka v `index.html`), do nasazení je vezměte z `PTCZ_F1.texts` / z překladového zdroje pluginu.

Rozhoduje vývojář (technika, sekce 0): kam soubory načíst (theme `form.css` / plugin assets), jak pojmenovat překladové klíče, zda zůstat u `places.Autocomplete` (varianta A) nebo přejít na `AutocompleteSuggestion` (varianta B). Obojí je v předloze; brána měří výsledek, ne cestu.

---

## 1. Šablona kroku 1 (`krok2.php`) – pole Start / Zastávky / Cíl

Cílová struktura každého pole (JS v předloze ji vytváří funkcí `wrapField`, v produkci má být v HTML):

```html
<div class="form-group ptcz-fld" data-field="start" data-state="empty">
  <label class="labelz" for="autoComplete1"><img src="…/start.svg" alt="">Where do we pick you up?</label>   <!-- [M] -->
  <div class="ptcz-fld__wrap">
    <input type="text" id="autoComplete1" class="autoComplete"
           placeholder="Hotel, address or place in Prague"                                                   <!-- [M] -->
           autocomplete="off" autocapitalize="words" enterkeyhint="search"
           role="combobox" aria-autocomplete="list" aria-expanded="false" aria-haspopup="listbox"
           aria-controls="ptcz-ac-start" aria-describedby="ptcz-hint-start ptcz-msg-start">
    <button type="button" class="ptcz-fld__clear" aria-label="Clear">Clear</button>                           <!-- [M] aria-label -->
    <!-- varianta B: sem JS vloží <div class="ptcz-ac" id="ptcz-ac-start" role="listbox"> -->
  </div>
  <p class="ptcz-hint" id="ptcz-hint-start"></p>                     <!-- nápověda (u Startu prázdná) -->
  <p class="ptcz-msg"  id="ptcz-msg-start" role="status" aria-live="polite"></p>   <!-- chyba (prázdné = skryté) -->
</div>
```

Stejně pro **Zastávky** (`#search-poi`, `data-field="stops"`) a **Cíl** (`#autoComplete2`, `data-field="end"`). U Cíle zůstává `.destination-input-wrap` (vstup + `.arrival-box`); `.ptcz-fld__wrap` obalí jen `<input>`, nápověda a zpráva jdou **za** `.destination-input-wrap`.

Konkrétní změny:
- **Start**: text labelu „Where do we pick you up?“ / „Kde vás vyzvedneme?“ **[M]**, placeholder „Hotel, address or place in Prague“ / „Hotel, adresa nebo místo v Praze“ **[M]**.
- **Zastávky**: `<label class="labelz">` dostane `for="search-poi"` (dnes bez `for` → není to skutečný popisek). Odstavec `<p>For example, type in Unesco, castle or water…</p>` **nahradit** `<p class="ptcz-hint" id="ptcz-hint-stops">Type a place – e.g. Kutná Hora, Karlštejn Castle, Český Krumlov – and pick it from the list.</p>` **[M]** (předloha starý odstavec jen skrývá třídou `ptcz-hint--old`). Ikona lupy `.search-icon` se nevykresluje (× má stejnou funkci).
- **Cíl**: nápověda `#ptcz-hint-end` je prázdná; plugin do ní dá „Same as pickup – change it if you want to end somewhere else.“ **[M]** (`data-same="1"` → zelená fajfka) vždy, když `end === start`.
- **Datum** (`#departure`): pod `.input-wrapper` přidat `<p class="ptcz-msg" id="ptcz-msg-date" role="status" aria-live="polite"></p>` a na vstup `aria-describedby="ptcz-msg-date"`. Pole zůstává `readonly`/`inputmode="none"` (sekce 2 je Fáze 2).
- **Souhrn chyb**: před `.tlacitko` vložit `<div class="ptcz-errsum" role="status" aria-live="polite"></div>` (JS plní „2 things to fix“ **[M]**).
- **Title/aria-label** všech prvků, které plugin renderuje (`.remove-stop`, `.drag-handle`, `.info-toggle-btn`, křížky modálů, tlačítka poznámky): z překladového zdroje podle `document.documentElement.lang`. Předloha je na EN stránce jen přemapovává (`PTCZ_F1.texts.en.titles`) – to je náhrada, ne řešení.

## 2. Plugin `script-krok2.js` – našeptávač (sekce 1)

### Varianta A – ponechat `google.maps.places.Autocomplete`, jen omezit a přestylovat
V `initAutocomplete()` i u `poiAutocomplete`:
```js
new google.maps.places.Autocomplete(input, {
  fields: ["geometry", "name", "formatted_address", "place_id", "address_components"],
  types: ["geocode", "establishment"],
  componentRestrictions: { country: ['cz', 'at', 'de', 'pl', 'sk'] },   // legacy limit = 5 zemí
  bounds: new google.maps.LatLngBounds({ lat: 48.5, lng: 12.1 }, { lat: 51.1, lng: 18.9 }),
  strictBounds: false
});
```
+ session token: `const token = new google.maps.places.AutocompleteSessionToken();` před prvním psaním, po `place_changed` nový. **Pro bránu** vystavit instance: `window.ptczPlannerAutocompletes = [autocompleteStart, autocompleteEnd, poiAutocomplete];` – brána z nich čte `componentRestrictions` (bod S1-1a) místo hádání z textu. Vzhled řeší `faze1.css` (blok 4, `.pac-container` / `.pac-item`). Co zůstává mimo 1:1: řádek nemá typ místa, ikona je jedna pro vše, patička vlevo jen přes CSS `::before`, varování v konzoli „not available to new customers“ zůstává (bod „Hotovo, když“ je u něj podmíněný). Předloha tuto variantu simuluje souborem `demo-shim.js` (obalí konstruktor) – do produkce nepatří.

### Varianta B – vlastní nabídka nad `AutocompleteSuggestion` (doplňky z nového webu)
> **Předpoklad (ověřeno 17. 10. 2026 na produkci):** klíč Maps JS má dnes **zablokované Places API (New)** – `AutocompleteSuggestion.fetchAutocompleteSuggestions` vrací „Requests to this API places.googleapis.com method google.maps.places.v1.Places.AutocompletePlaces are blocked“. Varianta B tedy vyžaduje v Google Cloud zapnout **Places API (New)** pro projekt a povolit ho v omezeních klíče (rozhoduje majitel – nový účtovaný produkt, cena za autocomplete session je obdobná legacy). Do té doby běží jen varianta A; předloha B je ukázána nad zrcadlem legacy nabídky a kód provideru `suggestion` je připravený, ale na produkci neotestovaný.
`faze1.js` obsahuje hotový combobox (`.ptcz-ac`): debounce 220 ms, `AutocompleteSuggestion.fetchAutocompleteSuggestions({ input, sessionToken, includedRegionCodes: ['cz','at','de','pl','sk','hu'], locationBias: obdélník ČR, language, region:'cz' })`, max 5 položek, šipky/Enter/Esc, `aria-activedescendant`, typ místa z `placePrediction.types`, ikona podle typu, hlavička skupiny, patička s logem Google, tipy při fokusu prázdného pole Zastávky (`PTCZ_F1.config.tips` – doplnit `placeId`, pak se tip vybírá rovnou; bez `placeId` jen vyplní text).
Napojení na dnešní logiku: místo `autocomplete.getPlace()` dostanete objekt ve **stejném tvaru jako legacy** (`geometry.location`, `name`, `formatted_address`, `place_id`, `address_components`) přes hook:
```js
PTCZ_F1.hooks.onPlaceSelected = function (fieldKey, place, input) {
  // fieldKey: 'start' | 'end' | 'stops'; place = legacy tvar → zavolat dnešní tělo place_changed
};
PTCZ_F1.init({ extras: true, provider: 'suggestion' });
```
a legacy `new google.maps.places.Autocomplete(...)` pro tato tři pole **nevytvářet** (jinak budou dvě nabídky). `fetchFields` bere `['location','displayName','formattedAddress','id','addressComponents','types']`. Tím zmizí i varování v konzoli.

### Stav pole (obě varianty)
Po výběru: `data-state="selected"`; po změně textu `typing`; při blur s textem bez `place_id` `invalid` + zpráva. Předloha to pozná podle `localStorage.ptcz_reservation.startPlaceId/endPlaceId` – v pluginu je čistší volat `PTCZ_F1`-ekvivalent `markSelected(key)` přímo v `place_changed`. U Zastávek po výběru pole vyprázdnit a vrátit fokus (dnes se vyprazdňuje, fokus ne).

## 3. Validace (sekce 8) – `script-krok2.js` ř. ~2120 a `script-krok3.js` ř. ~330
Dnešní větev `if (!data.start || !departure || …) { showModal(#notice) }` nahradit inline validací (předloha: `setupStep1Validation` / `setupStep2Validation` v `faze1.js` – lze převzít 1:1, běží v capture fázi na `document`, takže dnešní handler nebude spuštěn, když je chyba):
- všechny chyby najednou, `aria-invalid="true"`, text do `#ptcz-msg-*`, třída `.err` na `.ptcz-fld`, fokus + `scrollIntoView({block:'center'})` na první, souhrn do `.ptcz-errsum`;
- po první neúspěšné validaci kontrola na `input`/`blur`; Start/Cíl/e-mail i před prvním Continue na `blur`;
- jméno jen neprázdné (bez „5 znaků“), e-mail regex + návrh domény (`gmail.con → gmail.com`, `john@gmail → john@gmail.com`), telefon `iti.isValidNumber()`;
- `#notice` jen pro systémové chyby (limit API, výpadek trasy) – zaoblení 20 px (`faze1.css`), `role="alertdialog"`.
- Překladové klíče `validation_start/departure/end`, `errorName/Email/Phone` dostanou nové texty **[M]** (tabulka v `index.html`).

## 4. Pevná lišta (sekce 7) – `updateButtonWithPrice()` v `script-krok2.js`
Cílová struktura `.tlacitko.sticky-fixed` na mobilu (jen tyto děti viditelné):
```html
<div class="tlacitko sticky-fixed">
  <button type="button" class="ptcz-bar__price" aria-expanded="false" aria-controls="ptcz-sheet">
    <span class="ptcz-bar__top"><span class="ptcz-bar__val">$129.88</span><span class="ptcz-bar__i" aria-hidden="true"></span></span>
    <span class="ptcz-bar__sub">whole car, up to 8 · tap for details</span>   <!-- [M] -->
  </button>
  <button class="newbutton" id="continue-btn">Continue</button>
</div>
```
- `#summary-breakdown-wrapper-down`, `.tlacitko-info`, `.text-pod-cenou-wrapper`, `.payment` do lišty nevkládat (CSS je skrývá, ale lepší je nerenderovat).
- Prázdný stav (žádná zastávka, cíl = start): `.ptcz-bar__val[data-empty="1"]` s textem „Add a stop to see the price“ **[M]**; Continue zůstává aktivní (sekce 6 je Fáze 2).
- Klepnutí na cenu → spodní list `#ptcz-sheet` (`role="dialog"`, `aria-modal`): celková cena, „for the whole car, up to 8 people“ **[M]**, seznam „v ceně“ **[M]** (driver · fuel/tolls/parking · no deposit · free cancellation 24 h – podle přehled nabídky §1), `<details>` „How is the price calculated?“ s řádky z dnešního `#summary-breakdown`, věta o platbě **[M]**, řádek „Questions? WhatsApp us“. Esc / ztmavení / × zavře, fokus zpět na cenu. Předloha list staví v `buildSheet()`.
- Skrytí při klávesnici: `focusin` na `input:not([readonly]), textarea` → `.is-hidden` na liště i `#ptcz-wa-btn`; `focusout` vrátí do 300 ms; `visualViewport.resize` (výška < 75 % `innerHeight`) skryje také.
- `body.ptcz-planner` dostane `padding-bottom` 72 px + safe-area (CSS), aby lišta nezakryla konec formuláře.
- Kroky 2–3: lišta se stejným CSS; „Back“ jako textový odkaz 44 px vlevo a hlavní tlačítko na jednom řádku (`white-space:nowrap`) – v předloze jen CSS, ověřit po nasazení.

## 5. WhatsApp a šipka nahoru (sekce 11) – theme (`footer.php` / místo, kde se `#ptcz-btt` a `#ptcz-wa-btn` vykreslují)
- Na URL `/en/trip-planner/*`, `/planovac-vyletu/*`, `/en/prague-private-tours/*`, `/planovac-vyletu-na-miru/*`, `/en/trip/*/book/`, `/vylet/*/book/` **nevykreslovat** `#ptcz-btt` (předloha ho jen skrývá CSS přes `body.ptcz-planner`; brána hlásí „v DOM: 1“ jako upozornění).
- `#ptcz-wa-btn`: 44 × 44 px, ikona 22 px, vpravo 12 px, na mobilu 12 px nad lištou (`bottom: calc(72px + safe-area + 12px)`), `z-index` pod listem/modály; třída `.is-hidden` při psaní. Inline skript `ptczWaOffset()` v hlavičce může zůstat (nastavuje `--ptcz-wa-bottom`), CSS předlohy ho přebíjí.
- **Otázka pro majitele (brána bod S11-2b):** plovoucí tlačítko nad formulářem plné šířky se při některém scrollu vždy ocitne nad nějakým polem; předloha ho dává do pravého dolního rohu (překryv s poli ~15–25 px na okraji). Nulový překryv jde zaručit jen umístěním do lišty nebo do spodního listu ceny (řádek „Questions? WhatsApp us“ už tam je). Rozhodnutí RF 16. 10. = ikona nad lištou; brána proto měří překryv v klidových polohách stavů a hlásí ho, ale neblokuje.

## 6. Měření T1 (Poznámky k měření) – `dataLayer`
**Plugin pushuje události ve chvíli, kdy vznikají** (po `place_changed` Startu, po přidání/odebrání zastávky, po přepočtu ceny, po potvrzení data) – `faze1.js` sám pushuje jen to, co vyvolá (chyby, Continue, kalendář, list s cenou, výběr v nabídce). Soubor `faze1-demo.js` (blok `/* DEMO – NEKOPÍROVAT */`) události v předloze jen odvozuje ze zápisů do `localStorage` – do produkce nepatří, stejně jako `demo-shim.js`.

| Událost | Kdy | Parametry |
|---|---|---|
| `planner_start_set` | po výběru Startu z nabídky | `planner_lang`, `planner_step` |
| `planner_stop_added` / `planner_stop_removed` | po přidání / odebrání zastávky | `planner_stops` (počet) |
| `planner_price_shown` | po přepočtu ceny s ≥ 1 zastávkou | `planner_value` (CZK, číslo), `planner_currency` |
| `planner_date_set` | po potvrzení data | – |
| `planner_calendar_open` | klik na `#departure` | – |
| `planner_continue_click` | Continue bez chyb | `planner_stops` |
| `planner_validation_error` | Continue s chybou | `planner_errors` („start,date“), `planner_error_type` (první) |
| `planner_field_error` | každá nová chyba u pole (blur i Continue) | `planner_field`, `planner_error_type` (`empty`/`invalid`/`typo`) |
| `planner_price_details_open` | otevření listu s cenou | – |
| `planner_place_selected` | výběr z nabídky | `planner_field`, `planner_place_type` |

Všechny nesou `planner_lang`, `planner_step` (1–3), `planner_variant`. GA4 event tagy v GTM (workspace 10) založí Claude po nasazení (měřicí verze, A2).

## 7. Co zůstává mimo 1:1 (kreslí Google / mimo Fázi 1)
- Varianta A: obsah řádku nabídky (jen název + lokalita, bez typu), jedna ikona, Google logo `::after`, varování v konzoli.
- Varianta B: logo „powered by Google“ (licence – musí zůstat), pořadí a texty položek (Google), `types` jen ty, které Google vrátí (hrady bývají `tourist_attraction`, odvozuje se i z názvu).
- Ovládání mapy (tlačítka Google Maps pod 44 px), cookie lišta Complianz (sekce 11 [M+T] – nezadáno), kalendář/čas (sekce 2 = Fáze 2), stepper (3), karty zastávek (4), cenový box/rozpis na konci stránky (6), krok 2 atributy a telefon (12), souhrn (13).
- Reálná iOS klávesnice (simulace zmenšením viewportu) a VoiceOver (ověřit ručně).
