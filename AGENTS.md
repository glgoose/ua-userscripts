# ua-userscripts

Dev-conventies voor dit script-repo: dev-stub workflow en naamgeving.

## Dev-stub vs. gebruik

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

Drie dingen die aan die stub vasthangen:

- **De metadata komt uit de stub, niet uit de required file.** `@match`, `@grant` en `@run-at`
  moeten er dus in staan; het `==UserScript==`-blok van de file zelf wordt genegeerd. `dev-stub`
  neemt die velden over uit het echte script, zodat de twee niet uit elkaar lopen.
- **`@updateURL` staat op `none`.** Die velden weglaten volstaat niet: Tampermonkey onthoudt de
  download-URL van de oorspronkelijke installatie apart van het meta-blok, dus een rij die ooit
  van de raw-URL kwam biedt daarna alsnog een update aan die je stub overschrijft. In
  `determineMetaURL` gaat `@updateURL` vóór die onthouden URL, en `none` breekt de check af.
  `@downloadURL` mag daardoor gewoon blijven staan: die wordt nooit meer bereikt, en levert wel
  het GitHub-icoon op in de overzichtslijst, want de herkomst wordt uit die URL afgeleid.
  `dev-stub` zet allebei zelf in de stub. Controleren doe je niet in Settings: het veld
  **Update URL** daar is `downloadURL` onder een misleidend label (`file_url = downloadURL ||
  fileURL`), en `@updateURL` heeft in dat scherm geen veld. Het toont dus de raw-URL, ook als
  `none` netjes is overgenomen. Controleer in plaats daarvan het gedrag: klik in de
  werkbalk-popup op **Check for userscript updates** en er hoort geen enkel dialoogvenster te
  komen.
- **De stub moet mee met elke `@version`-bump.** De code komt via `@require` uit de repo, dus
  functioneel merk je er niets van, maar de Version-kolom wijst anders een oude versie aan en
  die kolom is nu net waarmee je dev van gebruik onderscheidt. Draai `bin/dev-stub` opnieuw en
  plak.

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
