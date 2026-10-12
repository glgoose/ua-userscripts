# bipp-budgetverantwoordelijke

Zet het filter *Budget verantwoordelijke* op de pagina *Aanvraag evalueren* van BIPP standaard op jezelf in plaats van *Alle*, en start de zoekopdracht.

[**Installeren**](https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/bipp-budgetverantwoordelijke/bipp-budgetverantwoordelijke.user.js)
· gebeurt er niets, zie de [installatie-uitleg](../../README.md).

## Hoe het werkt

- Het script zoekt de dropdown via het label *Budget verantwoordelijke* in dezelfde rij.
- Je naam komt uit de kop (`Welkom Glenn Goossens - ...`). De lijst heeft de omgekeerde volgorde
  (`Goossens Glenn`), dus het script vergelijkt de woorden en niet de volgorde.
- Na de keuze drukt het script na 1,5 seconde zelf op *Zoeken*, want de dropdown doet dat niet.
- Kies je zelf weer *Alle*, dan blijft dat staan. Een vlag in `sessionStorage` onthoudt dat het
  script al gewerkt heeft en wordt gewist zodra je een BIPP-pagina zonder dit filter opent.

## Beperkingen

- Staat je naam niet in de lijst, of heeft de kop een ander formaat, dan doet het script niets en
  schrijft het een waarschuwing in de console.

## Licentie

[GPL-3.0-or-later](../../LICENSE).
