# select-search

Geeft elke `<select>` met veel opties een zoekveld. Een native dropdown zoekt alleen op de eerste
letters, dus "Poule" vinden in "Restaurant Poule & Poulette B.V." lukt niet. Met dit script wel.

Het originele `<select>` blijft de bron van waarheid en wordt enkel verborgen. Het formulier
verstuurt dus exact hetzelfde als voorheen.

## Installeren

1. Installeer Tampermonkey voor je browser:

   | Browser | Extensie | Extra stap |
   |---|---|---|
   | Firefox | [installeren](https://addons.mozilla.org/firefox/addon/tampermonkey/) | geen |
   | Chrome | [installeren](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) | zie stap 2 |
   | Edge | [installeren](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) | zie stap 2 |

2. Alleen Chrome en Edge: ga naar `chrome://extensions` of `edge://extensions`, klik bij
   Tampermonkey op *Details* en zet **Allow user scripts** aan. Zonder dat draait geen enkel
   userscript.

3. Open de
   [installatielink](https://raw.githubusercontent.com/glgoose/select-search/main/dist/select-search.user.js)
   en klik op installeren.

Beheert je werkgever je browser, dan zijn extensies mogelijk beperkt tot een goedgekeurde lijst.
Vraag het na bij IT. Kan het niet, gebruik dan de [bookmarklet](#bookmarklet).

## Gebruik

Klik een dropdown aan en typ.

- Zoekt op **substring**, negeert accenten: `genee` vindt `Genée`.
- Meerdere woorden in willekeurige volgorde: `poule rest` vindt `Restaurant Poule & Poulette B.V.`
- Pijltjes navigeren, Enter kiest, Escape sluit, Tab kiest en gaat verder.
- Dropdowns met minder dan 10 opties blijven onaangeroerd.
- Boven 200 treffers toont het enkel het aantal. Verfijn dan je zoekterm.

## Problemen

| Symptoom | Oplossing |
|---|---|
| Eén veld doet raar | **Alt+klik** op het zoekveld zet daar het originele menu terug |
| Veld moet altijd overgeslagen | Zet `data-nosearch` op de `<select>` |
| Niets gebeurt op de pagina | Check in het Tampermonkey-dashboard of de URL onder `@match` valt |
| Formulier zit in een iframe van een ander domein | Niet op te lossen, browserbeperking |

## Bookmarklet

Alternatief zonder extensie. Werkt overal, maar je klikt hem zelf aan per pagina.

1. Kopieer de inhoud van [`dist/bookmarklet.txt`](dist/bookmarklet.txt).
2. Maak een bladwijzer met naam `Zoek in dropdown` en die tekst als URL.
3. Klik hem aan op de pagina met de dropdown. Nog eens klikken doet een herscan.

Sites met een strikte Content-Security-Policy blokkeren bookmarklets. Dan is de extensie de enige
route.

## Ontwikkelen

`src/select-search.js` bevat de volledige logica, zonder dependencies.

```sh
./build.sh                    # genereert dist/ (userscript + bookmarklet)
python3 -m http.server 8731   # open http://localhost:8731/test/fixture.html
```

Hoog bij elke wijziging `@version` op in `src/userscript-header.txt`, anders krijgt niemand de
update binnen.

## Licentie

MIT
