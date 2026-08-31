# ua-userscripts

| toepassing     | wat het doet                                     |                                                                                                                                                  |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **BIPP**       | budgetcode kiezen en zien in het winkelmandje    | [installeren](https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/bipp-budgetcode/bipp-budgetcode.user.js)                     |
| **BIPP**       | zoekveld in dropdowns met veel opties            | [installeren](https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/select-search/select-search.user.js)                         |
| **iExpense**   | alle onkostenrapporten in één doorzoekbare tabel | [installeren](https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/iexpense-search/iexpense-search.user.js)                     |
| **PeopleSoft** | werkende knop "Downloaden naar Excel"            | [installeren](https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/peoplesoft-excel-download/peoplesoft-excel-download.user.js) |

## Installatie-instructies

Nodig voordat de installeren-links hierboven werken.

**1. Extensie installeren** voor
[Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/),
[Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
of [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd).

**2. Gebruikersscripts toelaten** (Chrome en Edge, niet in Firefox)

1. Klik in de werkbalk op het puzzelstukje, rechts van de adresbalk.
2. Zoek **Tampermonkey** en klik op de drie puntjes ernaast.
3. Kies **Manage Extension** (Extensie beheren).
4. Zet **Allow User Scripts** (Gebruikersscripts toestaan) aan.

## Goed om te weten

**Je gebruikt meerdere toestellen (bijvoorbeeld een desktop en een laptop).** Ben je op
allebei met hetzelfde browseraccount ingelogd, dan staat de extensie er via browsersync
vaak al op en kan je stap 1 overslaan. Stap 2 reist niet mee, en de scripts uit de tabel
evenmin: die doe je per toestel opnieuw.

**Je ziet geen Allow User Scripts staan.** Dan is je browser oud: ga naar
`chrome://extensions` of `edge://extensions` en zet **Developer mode**
(Ontwikkelaarsmodus) aan.

## Ontwikkelen

De file in `scripts/` is de bron van waarheid voor de code. Wat in Tampermonkey staat is dus
óf een loader die naar die file wijst, óf een kopie die van de raw-URL komt. Nooit een met de
hand geplakte kopie, want dan zijn er twee waarheden die stil uit elkaar lopen.

| spoor       | wat er in Tampermonkey staat            | grootte           | `@version`  |
| ----------- | --------------------------------------- | ----------------- | ----------- |
| **dev**     | stub met `@require file:///...`          | een paar honderd byte | `1.0.0-dev` |
| **gebruik** | volledige kopie via de raw-URL           | de echte grootte  | `1.0.0`     |

De grootte in het dashboard zegt dus in welk spoor een rij zit.

### Een dev-stub maken

```sh
bin/dev-stub bipp-budgetcode
```

De stub gaat meteen naar het klembord. In Tampermonkey neem je het potlood van de bestaande
rij, dan Cmd+A, Cmd+V, Cmd+S. Via de `+`-tab krijg je een tweede rij in plaats van een
bijgewerkte, want Tampermonkey herkent een script aan `@namespace` plus `@name`.

`bin/dev-stub --list` toont de scriptmappen, `--no-copy` slaat het klembord over.

Twee dingen die aan die stub vasthangen:

- **De metadata komt uit de stub, niet uit de required file.** `@match`, `@grant` en `@run-at`
  moeten er dus in staan; het `==UserScript==`-blok van de file zelf wordt genegeerd. `dev-stub`
  neemt die velden over uit het echte script, zodat de twee niet uit elkaar lopen.
- **`@downloadURL` en `@updateURL` horen er niet in.** Met die velden overschrijft Tampermonkey
  je stub bij de eerste update-check met de volledige raw-versie. `dev-stub` laat ze weg.

Lokale bestanden lezen mag Tampermonkey alleen als **Allow access to file URLs** aanstaat, bij
`chrome://extensions` onder Details.

### Naamgeving

`<Toepassing>: <wat het doet>`, met de toepassing zoals je ze zelf noemt (`BIPP`, `iExpense`,
`PeopleSoft`), daarna de dubbele punt en een kleine-letter naamwoordgroep zonder punt. Het
dashboard sorteert op naam, dus zo staan de scripts van dezelfde toepassing bij elkaar.

- Geen `[DEV]` in de naam. Dat groepeert op ontwikkelstatus in plaats van op toepassing, en de
  Version-kolom zegt met `-dev` al hetzelfde.
- Geen technische slug in de naam. Die staat in het repo-pad en in `@homepageURL`.
- Draait een script op meerdere sites, dan `Algemeen: ...`.
- Mapnaam en bestandsnaam in kebab-case, zelfde volgorde: `<toepassing>-<functie>`.

Hoog `@version` op bij elke wijziging, anders krijgt niemand de update binnen.

## Licentie

[GPL-3.0-or-later](LICENSE). Gebruiken en aanpassen mag vrij. Verspreid je een
aangepaste versie, dan moet de broncode daarvan mee, onder dezelfde licentie.
