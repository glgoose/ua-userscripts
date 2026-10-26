# bipp-sneltoetsen

Ctrl+letter drukt in BIPP op een knop. De letter is onderstreept, de tooltip toont de sneltoets, en zolang je Ctrl ingedrukt houdt verschijnt de sneltoets onder elke knop die er een heeft.

| toets  | knop       | waar                                              |
| ------ | ---------- | ------------------------------------------------- |
| Ctrl+B | Bevestigen | Aanvraag evalueren, bestelbon detail              |
| Ctrl+Z | Zoeken     | Artikelen, Favorietenlijsten, Aanvragen, Bestelbonnen, Ontvangstregistratie |
| Ctrl+R | Reset      | idem                                              |
| Ctrl+N | Nieuw      | Artikelen, Favorietenlijsten                      |
| Ctrl+S | Opslaan    | Winkelmandje, bestelbon detail                    |
| Ctrl+I | Indienen   | Winkelmandje                                      |
| Ctrl+T | Terug      | detailpagina's                                    |

Verwijderen, Annuleren en In wachtstand krijgen bewust geen sneltoets: die zijn niet terug te draaien of komen zelden voor.

[**Installeren**](https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/bipp-sneltoetsen/bipp-sneltoetsen.user.js)
· gebeurt er niets, zie de [installatie-uitleg](../../README.md).

## Hoe het werkt

- Het script zoekt op elke pagina onder `/web/` per sneltoets de eerste zichtbare, actieve knop met dat label. Is er geen, dan doet de toets niets en gaat hij gewoon door naar de browser.
- Op macOS gebruikt Chrome Cmd voor zijn eigen sneltoetsen, dus Ctrl+letter is vrij. In tekstvelden zijn sommige Ctrl-letters Emacs-bindings (Ctrl+B één teken terug, Ctrl+N volgende regel, Ctrl+T letters wisselen): die heb je in BIPP niet meer.
- Zet BIPP zelf al een tooltip op de knop (Bevestigen, Indienen), dan komt de sneltoets op een eigen regel eronder.
- De onderstreping en de hints verschuiven niets: ze staan `position:absolute` buiten de flow. Bij een `<input>` kan de letter niet onderstreept worden met HTML, dus komt er een lijntje onder, berekend uit de lettermaat.
- Pagina's die hun knoppen later opbouwen krijgen tot 15 seconden de tijd.

## Licentie

[GPL-3.0-or-later](../../LICENSE).
