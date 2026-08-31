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
- Ook bij zoeken blijven de groepen aaneengesloten en in de volgorde van de dropdown zelf, zodat
  een groep als *recent* bovenaan blijft en geen enkele kopregel zich herhaalt. Binnen een groep
  komt wat met de zoekterm begint eerst.
- Er wordt enkel op het label gezocht, niet op de groepsnaam.
- Een optie met een lege waarde geldt als "niets gekozen". Ze staat niet in de lijst, maar haar
  label wordt de grijze placeholder van het veld. Met `data-placeholder` op de `<select>` zet je
  een eigen tekst, die wint van dat label.
- Staat er iets gekozen, dan neemt een kruisje de plek van het pijltje in zodra je er met de muis
  over gaat of erin staat. Dat zet de keuze terug op leeg. Het kruisje krijgt dus geen eigen
  ruimte: de tekst houdt de volle breedte en er verschuift niets. Backspace in een leeg veld doet
  hetzelfde. Zonder lege optie is er niets te wissen en blijft het kruisje weg.
- Staat er `data-removable` op een `<option>` of op een `<optgroup>`, dan haalt `Delete` de
  regel die oplicht uit de lijst, zolang je niets getypt hebt. Ben je aan het zoeken, dan blijft
  Delete een gewone teksttoets. Het script gooit zelf niets weg: het stuurt een `select-search:remove`
  event op de `<select>`, met `detail` `{value, label, index}`. Wie de opties leverde beslist
  wat verwijderen betekent en past de `<select>` aan, waarna de lijst zichzelf hertekent met
  behoud van de zoekterm en de plek van de selectie.
- Boven 200 treffers toont het enkel het aantal. Verfijn dan je zoekterm.

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
