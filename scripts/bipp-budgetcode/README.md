# bipp-budgetcode

Zet de budgetcode als dropdown in de rij van het winkelmandje zelf, net onder de
grootboekrekening. Geen omweg meer langs *Selectie analytische velden*, en je ziet ook gewoon
staan welke code een artikel heeft.

BIPP verbergt die code vandaag volledig: na *Creëer*, kiezen, *Opslaan* en *Terug* zegt de rij
alleen nog `Bekijk`, in het groen, en die kleur blijft ook staan als de code weer leeg is. De
gekozen waarde zit wel al in de pagina, maar alleen als tooltip op die link.

[**Installeren**](https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/bipp-budgetcode/bipp-budgetcode.user.js)
· gebeurt er niets, zie de [installatie-uitleg](../../README.md).

## Gebruik

- Kies de budgetcode in de dropdown onder de grootboekrekening. De pagina blijft staan waar ze
  staat.
- Zoeken in die lijst van ruim vijfduizend codes gaat via
  [select-search](../select-search/README.md), dat op dezelfde pagina meeloopt.
- Bovenaan de lijst staan onder *recent* de vijf codes die je het laatst gebruikt hebt. Dat blok
  komt van [select-search](../select-search/README.md#recent) en werkt intussen op elke grote
  dropdown op BIPP, niet enkel op de budgetcode. Hier telt een code pas als de server ze
  aanvaard heeft: mislukt het opslaan, dan blijft recent ongemoeid.
- De gekozen code komt ook in **Interne commentaar** te staan, wat er verder in de rij al dan
  niet ingevuld is. Enkel de code zelf, dus `8947-2025` en niet de omschrijving die in de
  dropdown achter het streepje staat. Stond er al tekst in het veld, dan komt ze op een nieuwe
  regel eronder. Kies je daarna een andere code, dan wordt die regel vervangen in plaats van dat
  er een bijkomt.
- Is er nog niets gekozen, dan staat er grijs `budgetcode` in het veld. Dat is een
  placeholder, geen waarde, en hij staat niet als regel in de lijst.
- Wissen doe je met het kruisje rechts in het veld. Zodra er een code staat en je met de muis
  over het veld gaat of erin staat, neemt dat kruisje de plek van het pijltje in. Backspace in
  een leeg veld doet hetzelfde. Dat haalt ook de regel uit Interne commentaar weg.
- Een code uit *recent* halen: open de lijst, ga met de pijltjes of de muis op die regel staan
  en druk `Delete`, zolang je nog niets getypt hebt. De code staat daarna weer gewoon onder *alle
  budgetcodes*. Kies je hem later opnieuw, dan komt hij vanzelf terug bovenaan.
- De link *Creëer* / *Bekijk* blijft staan als uitweg.

De status staat als klein icoontje rechts op de regel van die link, zodat er nooit iets
verschuift:

- **Zandloper, tekst grijs**: bezig met opslaan. Een nieuwe keuze wordt zolang genegeerd.
- **Geen icoontje, tekst weer zwart**: opgeslagen. Er komt geen vinkje bij, de zandloper gaat
  gewoon weg. Dat de tekst weer zwart is, is de bevestiging.
- **Uitroepteken, rode rand**: niet opgeslagen, de waarde is teruggedraaid.

De volledige melding staat in de tooltip van het icoontje en van de dropdown.

## Hoe het opslaat

Kiezen in de dropdown doet in de achtergrond precies wat je anders met de hand doet: de postback
naar de selectorpagina, *Opslaan*, en *Terug*. Het script controleert in het antwoord of de
server de waarde echt geselecteerd heeft en verwisselt daarna `__VIEWSTATE`, `__EVENTVALIDATION`
en `__VIEWSTATEGENERATOR` in de live pagina, zodat een gewone postback erna blijft werken.

Omdat het live formulier meegestuurd wordt, gaat niet-opgeslagen typwerk (aantal, commentaar)
niet verloren: dat wordt door de eerste stap zelfs meteen mee gecommit. Het verkeer per keuze is
hetzelfde als dat van de drie handmatige stappen.

## Beperkingen

- **De groene link blijft groen.** Dat komt van BIPP zelf en is niet betrouwbaar. De dropdown is
  de bron van waarheid.
- **De optielijst wordt gecached** in `localStorage`, per participant, zeven dagen. De eerste
  keer duurt het kiezen een moment langer omdat de lijst dan opgehaald wordt.
- **Na een mislukte poging** klopt de dropdown weer, maar de server kan de tussenliggende
  commentaarregel nog vasthouden: de eerste stap van de keten commit het formulier, de latere
  stap is degene die faalde. De eerstvolgende geslaagde keuze zet dat recht, want die stuurt het
  formulier opnieuw mee.
- **Meer dan één analytisch veld** wordt niet inline aangeboden. De selectorpagina is een
  repeater; verschijnt er ooit een tweede veld, dan valt het script voor die rij terug op de
  link.

## Ontwikkelen

Eén bestand, geen build, geen dependencies. Hoog `@version` op bij elke wijziging, anders krijgt
niemand de update binnen.

Tijdens het ontwikkelen laad je het script via een dev-stub in plaats van een geplakte kopie,
zie [Ontwikkelen](../../AGENTS.md#dev-stub-vs-gebruik).

```sh
node --check bipp-budgetcode.user.js
```

## Licentie

[GPL-3.0-or-later](../../LICENSE).
