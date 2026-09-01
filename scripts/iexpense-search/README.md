# iexpense-search

Vervangt op Expenses Home de tabel *Update Expense Reports* door dezelfde tabel met alle rijen
tegelijk. Zoeken en sorteren gebeurt lokaal, dus zonder de trage stap langs de server die OAF
bij elke klik doet.

[**Installeren**](https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/iexpense-search/iexpense-search.user.js)
· gebeurt er niets, zie de [installatie-uitleg](../../README.md).

## Gebruik

- Typ in de zoekbalk. Er wordt gezocht op naam, rapportnummer, datum, bedrag en purpose.
- De chips **Alle · Derden · Eigen** splitsen op soort rapport. Een rapport dat je voor iemand
  anders indient heeft een nummer dat met `TP-EXP` begint, een eigen rapport met `EXP`.
- Klik ergens op een rij om het rapport te openen. Cmd-klik of middenklik opent het in een
  nieuw tabblad.
- Klik een kolomkop aan om te sorteren.
- *Oorspronkelijke tabel* rechts zet de tabel van OAF weer terug.

De pagina wordt bovendien geordend naar wat je ermee doet: Notifications bovenaan, dan Update
Expense Reports, en Track Submitted onderaan.

## Beperkingen

- **Purpose is afgekapt door de server.** OAF stuurt maximaal twintig tekens plus een beletselteken
  en heeft de volledige tekst nergens op de pagina staan. Zoeken op purpose komt dus niet verder
  dan het twintigste teken.
- **Het prullenbakicoon doet niets.** Verwijderen gaat bij OAF via een formulierpost die de
  positie van de rij binnen zijn eigen venster van tien rijen meestuurt. Onze tabel toont alle
  rijen in een eigen volgorde, dus die positie klopt hier niet. Wat de server precies volgt valt
  niet na te gaan zonder een echt rapport te wissen, en dat is onomkeerbaar. Verwijderen doe je
  dus via *Oorspronkelijke tabel*.

## Ontwikkelen

Eén bestand, geen build, geen dependencies. Hoog `@version` op bij elke wijziging, anders krijgt
niemand de update binnen.

Tijdens het ontwikkelen laad je het script via een dev-stub in plaats van een geplakte kopie,
zie [Ontwikkelen](../../AGENTS.md#dev-stub-vs-gebruik).

```sh
node --check iexpense-search.user.js
```

## Licentie

[GPL-3.0-or-later](../../LICENSE).
