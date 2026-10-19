# publisher-uaproxy-banner

Rode balk bovenaan uitgeverspagina's als de UA-proxy uit staat, met een **Connect**-knop. Zonder
proxy laadt de pagina zonder UA-toegang en geeft een Zotero-save geen PDF.

## Installeren

- Open `http://127.0.0.1:18088/ua-banner.user.js` in Chrome (`uaproxyd` moet draaien). De daemon
  zet het token in de kopie, dus er hoeft niets ingevuld te worden.
- Dev-spoor: `bin/dev-stub publisher-uaproxy-banner`. Het token zit niet in de repo, dus de
  eerste klik op Connect vraagt ernaar (`cat ~/.local/share/uaproxyd/token`) en onthoudt het in
  Tampermonkey.

## Hoe het werkt

- Het script vraagt `/status` aan `uaproxyd` (geen verkeer door de tunnel, dus de idle-stop van
  `uavpn` blijft werken) en toont de balk zolang de state niet `up` is. Tijdens het verbinden
  staat het MFA-nummer in de balk.
- **Connect** doet een `POST /connect` met het token in `X-UA-Token`.
- De balk heeft een vaste hoogte en de knop een vaste breedte, dus een nieuwe state verschuift
  niets.

## De `@match`-lijst

De domeinen komen uit `~/dotfiles/lib/uaproxy/publishers.txt`. Na een wijziging van die lijst:
`./sync-matches` herschrijft de regels, `./sync-matches --check` faalt bij verschil. Plak de
stub daarna opnieuw in Tampermonkey, want de metadata komt uit de stub.

## Licentie

[GPL-3.0-or-later](../../LICENSE).
