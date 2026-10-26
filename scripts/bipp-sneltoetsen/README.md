# bipp-sneltoetsen

Ctrl+B drukt in BIPP op *Bevestigen*. Op de knop is de B onderstreept, de tooltip toont *Ctrl+B*, en zolang je Ctrl ingedrukt houdt verschijnt *Ctrl+B* boven de knop.

[**Installeren**](https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/bipp-sneltoetsen/bipp-sneltoetsen.user.js)
· gebeurt er niets, zie de [installatie-uitleg](../../README.md).

## Hoe het werkt

- Het script zoekt op elke pagina onder `/web/` de eerste zichtbare, actieve knop met het label *Bevestigen*. Is er geen, dan doet Ctrl+B niets.
- Ctrl+B werkt ook in tekstvelden. Op macOS betekent het daar normaal "cursor één teken terug" (Emacs-binding), die je dan niet meer hebt.
- De onderstreping en de hint verschuiven niets: ze staan `position:absolute` buiten de flow. Bij een `<input>` kan de letter niet onderstreept worden met HTML, dus komt er een lijntje over, berekend uit de lettermaat.
- Pagina's die hun knoppen later opbouwen krijgen tot 15 seconden de tijd.

## Licentie

[GPL-3.0-or-later](../../LICENSE).
