# ua-userscripts

Repo: https://gitea.flw.uantwerpen.be/glenn/ua-userscripts. Scripts in `scripts/<map>/`, elk met een eigen README.

## Dev-stub vs. gebruik

`scripts/` is de bron van waarheid. In Tampermonkey staat een van twee sporen, nooit een met de hand geplakte kopie:

| spoor       | in Tampermonkey                 | `@version`  |
| ----------- | ------------------------------- | ----------- |
| **dev**     | stub met `@require file:///...` | `0.0.0-dev` |
| **gebruik** | volledige kopie via de raw-URL  | `1.0.0`     |

### Dev-stub maken en installeren

```sh
bin/dev-stub bipp-budgetcode   # --list toont de mappen, --no-copy slaat het klembord over
```

Claude installeert de stub zelf:

1. Serveer de stub (`--no-copy`) als `<map>.user.js` vanuit de scratchpad op een vrije poort.
2. Open die URL in de Claude-in-Chrome-tab, in het Chrome-profiel **UA** (Profile 1, kies met `select_browser`; controleer via de `History` van dat profiel).
3. De gebruiker klikt op **Install** (de `chrome-extension://`-pagina is onbereikbaar voor de tools).
4. Stop de server.

Zelfde `@namespace` plus `@name` werkt een bestaande rij bij. Een andere `@name` geeft een tweede rij die dezelfde file nog eens laadt (elke sneltoets dubbel): verwijder dan eerst de oude.

Eigenschappen van de stub:

- **Metadata komt uit de stub**, niet uit de required file. `@match`, `@grant`, `@run-at` en `@require` moeten erin staan; `dev-stub` neemt ze over. Opnieuw genereren en installeren is alleen nodig als die wijzigen.
- **Geen `@downloadURL` en `@updateURL`.** `@updateURL none` geeft een eslint-waarschuwing in de editor. Een rij die ooit van de raw-URL kwam, biedt alsnog updates aan die de stub overschrijven: verwijder die rij en maak de stub opnieuw via **Create a new script**.
- **Vaste `0.0.0-dev`**, geen bump nodig: de code komt bij elke paginaload van schijf.
- **Met `src/`** wijst `@require` daarnaar. Opslaan en herladen volstaat; `build.sh` draai je pas bij publiceren.
- **Vereist** dat **Allow access to file URLs** aanstaat (`chrome://extensions`, Details).

## Publiceren

- Hoog `@version` op bij elke wijziging, anders krijgt niemand de update.
- `@namespace` blijft `https://github.com/glgoose/ua-userscripts`. Het is alleen een identificatie, en wijzigen geeft bij iedereen een dubbele rij.

## Naamgeving

`<Toepassing>: <wat het doet>`: toepassing zoals je ze zelf noemt (`BIPP`, `iExpense`, `PeopleSoft`, of `Algemeen` bij meerdere sites), dubbele punt, kleine-letter naamwoordgroep zonder punt. Het dashboard sorteert op naam, zo staan scripts van dezelfde toepassing bij elkaar.

- Geen `[DEV]` of technische slug in de naam.
- Mapnaam en bestandsnaam in kebab-case, zelfde volgorde: `<toepassing>-<functie>`.

## Testen op BIPP

Pagina's zoals `OrderComposer.aspx` en `OrderRequestDetail.aspx` werken alleen via het menu (een `__doPostBack`, bijvoorbeeld `javascript:__doPostBack('orderRequestMenu$reviewRequestBtn','')`). Rechtstreeks via de URL geeft de server "Object reference not set to an instance of an object": navigeer eerst naar een andere BIPP-pagina en klik dan in het menu.
