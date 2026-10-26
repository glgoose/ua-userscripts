# bipp-raamcontract

Zet het vinkje *Inclusief niet-raamcontractartikelen* op de zoekpagina van BIPP standaard aan.

[**Installeren**](https://gitea.flw.uantwerpen.be/glenn/ua-userscripts/raw/branch/main/scripts/bipp-raamcontract/bipp-raamcontract.user.js)
· gebeurt er niets, zie de [installatie-uitleg](../../README.md).

## Hoe het werkt

- Het script zoekt het selectievakje via de tekst van zijn label en klikt erop als het uit staat.
  Een echte klik (geen `checked = true`) laat de handlers van de app draaien, dus de
  optielijsten van Leverancier en Fabricaat worden meteen opnieuw opgebouwd.
- Bouwt de pagina het formulier later op, dan wacht het script daar maximaal 15 seconden op.
- Een vinkje dat je zelf uitzet blijft uit tot de pagina opnieuw laadt.

## Beperkingen

- Laadt de app de pagina opnieuw na de klik en staat het vinkje daarna uit, dan klikt het script
  niet nogmaals binnen 5 seconden, om een herlaadlus te vermijden.

## Licentie

[GPL-3.0-or-later](../../LICENSE).
