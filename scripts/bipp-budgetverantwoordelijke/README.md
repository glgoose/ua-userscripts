# bipp-budgetverantwoordelijke

Zet in BIPP het filter *Budget verantwoordelijke* op *Aanvraag evalueren* en het filter *Aanvrager* op *Aanvragen* standaard op jezelf in plaats van *Alle*, en start de zoekopdracht.

[**Installeren**](https://gitea.flw.uantwerpen.be/glenn/ua-userscripts/raw/branch/main/scripts/bipp-budgetverantwoordelijke/bipp-budgetverantwoordelijke.user.js)
· gebeurt er niets, zie de [installatie-uitleg](../../README.md).

## Hoe het werkt

- Het script zoekt de dropdown via vaste id's: `qBudgetOwner` (*Aanvraag evalueren*) en `qRequestor` (*Aanvragen*). Een label is daar geen betrouwbare ingang, want *Aanvrager* deelt een rij met *Status aanvraag*.
- Je naam komt uit de kop (`Welkom Glenn Goossens - ...`). De lijst heeft de omgekeerde volgorde
  (`Goossens Glenn`), dus het script vergelijkt de woorden en niet de volgorde.
- Na de keuze drukt het script na 1,5 seconde zelf op *Zoeken*, want de dropdown doet dat niet.
- Kies je zelf weer *Alle*, dan blijft dat staan. Per filter onthoudt een vlag in `sessionStorage` dat het
  script al gewerkt heeft. Die vlag wordt gewist zodra je een BIPP-pagina zonder dat filter opent.

## Beperkingen

- Staat je naam niet in de lijst, of heeft de kop een ander formaat, dan doet het script niets en
  schrijft het een waarschuwing in de console.

## Licentie

[GPL-3.0-or-later](../../LICENSE).
