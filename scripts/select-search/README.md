# select-search

Geeft elke `<select>` met veel opties een zoekveld. Een native dropdown zoekt alleen op de eerste
letters, dus "Poule" vinden in "Restaurant Poule & Poulette B.V." lukt niet. Met dit script wel.

Het originele `<select>` blijft de bron van waarheid en wordt enkel verborgen. Het formulier
verstuurt dus exact hetzelfde als voorheen.

[**Installeren**](https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/select-search/select-search.user.js)
· gebeurt er niets, zie de [installatie-uitleg](../../README.md).

## Gebruik

Klik een dropdown aan en typ.

- Zoekt op **substring**, negeert accenten: `genee` vindt `Genée`.
- Meerdere woorden in willekeurige volgorde: `poule rest` vindt `Restaurant Poule & Poulette B.V.`
- Pijltjes navigeren, Enter kiest, Escape sluit, Tab kiest en gaat verder. Ga je met de muis
  over de lijst, dan verzet die dezelfde selectie als de pijltjes, zodat Enter altijd de regel
  neemt die oplicht.
- Dropdowns met minder dan 10 opties blijven onaangeroerd.
- Zit de dropdown in groepen (`<optgroup>`), dan komt elke groepsnaam als grijze kopregel boven
  zijn blok te staan. Die regel is geen resultaat: pijltjes slaan hem over en Enter kiest hem
  nooit. Opties zonder groep blijven los bovenaan.
- Bovenaan staat onder *recent* wat je in dat veld het laatst gekozen hebt, tot vijf waarden.
  Ze staan niet nog eens in hun eigen groep. Zie [Recent](#recent).
- Ook bij zoeken blijven de groepen aaneengesloten en in de volgorde van de dropdown zelf, zodat
  *recent* bovenaan blijft en geen enkele kopregel zich herhaalt. Binnen een groep komt wat met
  de zoekterm begint eerst.
- Er wordt enkel op het label gezocht, niet op de groepsnaam.
- Een optie met een lege waarde geldt als "niets gekozen". Ze staat niet in de lijst, maar haar
  label wordt de grijze placeholder van het veld. Met `data-placeholder` op de `<select>` zet je
  een eigen tekst, die wint van dat label.
- Een optie zonder leesbare tekst telt evengoed als "niets gekozen", ook al draagt ze een waarde,
  zoals de `<option value="0">&nbsp;</option>` van een OAF-scherm. Een regel die je niet kunt
  lezen is geen keuze: ze blijft uit de lijst en dus ook uit *recent*. Is er geen optie met een
  lege waarde, dan mikt het kruisje op deze.
- Staat er iets gekozen, dan neemt een kruisje de plek van het pijltje in zodra je er met de muis
  over gaat of erin staat. Dat zet de keuze terug op leeg. Het kruisje krijgt dus geen eigen
  ruimte: de tekst houdt de volle breedte en er verschuift niets. Backspace in een leeg veld doet
  hetzelfde. Zonder lege optie is er niets te wissen en blijft het kruisje weg.
- `Delete` haalt de regel die oplicht uit haar lijst, zolang je niets getypt hebt. Ben je aan het
  zoeken, dan blijft Delete een gewone teksttoets. Op een regel uit *recent* doet het script dat
  zelf. Staat er `data-removable` op een `<option>` of op een `<optgroup>`, dan gooit het script
  zelf niets weg: het stuurt een `select-search:remove` event op de `<select>`, met `detail`
  `{value, label, index}`. Wie de opties leverde beslist wat verwijderen betekent en past de
  `<select>` aan, waarna de lijst zichzelf hertekent met behoud van de zoekterm en de plek van
  de selectie.
- Boven 200 treffers toont het enkel het aantal. Verfijn dan je zoekterm.

## Recent

Elke dropdown houdt zijn eigen vijf laatst gekozen waarden bij, bovenaan de lijst onder de
kopregel *recent*. Er is geen vervaltermijn: vijf plaatsen verdringen zichzelf al, en een lijst
die na verlof leeg blijkt is enkel verwarrend. `Delete` op zo'n regel haalt ze eruit, waarna ze
weer gewoon tussen de andere opties staat.

De lijst hangt aan het veld, niet aan de pagina of aan de rij. De sleutel komt uit `name` of `id`,
met de volgnummers eruit: `ctl00$body$resultTable$ctl03$interfaceAccountList` en dezelfde dropdown
in rij 4 delen dus één lijst. Heeft een `<select>` geen `name` en geen `id`, dan krijgt hij geen
recent-blok en blijft hij verder gewoon doorzoekbaar.

Alles staat samen onder één localStorage-sleutel, `selectSearchRecent`:

```json
{ "v": 1, "fields": { "<veldsleutel>": { "ts": 0, "items": [["waarde", "label"]] } } }
```

`ts` dient enkel om boven de 40 velden het oudste veld te laten vallen. Lezen en schrijven falen
stil: is de opslag vol of geblokkeerd, dan verdwijnt het recent-blok en werkt de rest gewoon door.

### Voor wie de opties levert

| | |
|---|---|
| `data-ss-recent-key="..."` | Eigen veldsleutel, in plaats van die uit `name` of `id`. Nodig bij een `<select>` zonder allebei. |
| `data-ss-recent="manual"` | Het blok en `Delete` werken, maar kiezen onthoudt niets. Voor wie pas mag onthouden na een bevestiging van de server. |
| `window.selectSearch.remember(selectOfSleutel, value, label)` | Zet een waarde in recent en tekent het blok opnieuw. |
| `window.selectSearch.forget(selectOfSleutel, value)` | Haalt ze er weer uit. |

## Problemen

| Symptoom | Oplossing |
|---|---|
| Eén veld doet raar | **Alt+klik** op het zoekveld zet daar het originele menu terug |
| Veld moet altijd overgeslagen | Zet `data-nosearch` op de `<select>` |
| Niets gebeurt op de pagina | Check in het Tampermonkey-dashboard of de URL onder `@match` valt |
| Formulier zit in een iframe van een ander domein | Niet op te lossen, browserbeperking |

## Bookmarklet

Alternatief zonder extensie, voor wie geen extensies mag installeren. Werkt overal, maar je klikt
hem zelf aan per pagina.

1. Kopieer de inhoud van [`bookmarklet.txt`](bookmarklet.txt).
2. Maak een bladwijzer met naam `Zoek in dropdown` en die tekst als URL.
3. Klik hem aan op de pagina met de dropdown. Nog eens klikken doet een herscan.

Sites met een strikte Content-Security-Policy blokkeren bookmarklets. Dan is de extensie de enige
route.

## Ontwikkelen

`src/select-search.js` bevat de volledige logica, zonder dependencies.

```sh
./build.sh                    # genereert select-search.user.js en bookmarklet.txt
python3 -m http.server 8731   # open http://localhost:8731/test/fixture.html
```

Hoog bij elke wijziging `@version` op in `src/userscript-header.txt`, anders krijgt niemand de
update binnen.

Tijdens het ontwikkelen laad je het script via een dev-stub in plaats van een geplakte kopie,
zie [Ontwikkelen](../../README.md#ontwikkelen). Draai eerst `./build.sh`, want de stub wijst
naar `select-search.user.js`.

## Licentie

[GPL-3.0-or-later](../../LICENSE).
