# peoplesoft-excel-download

Laat de knop *Downloaden naar Excel* in de grids van PeopleSoft weer doen wat hij belooft. Het
script vangt de klik op en bouwt zelf een `.xlsx` uit wat er in de tabel staat.

De grid-knop van PeopleSoft zelf levert een bestand op dat Excel niet wil of niet goed leest.
Deze aanpak omzeilt de server volledig: wat je op je scherm ziet is wat in het bestand komt.

[**Installeren**](https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/peoplesoft-excel-download/peoplesoft-excel-download.user.js)
· gebeurt er niets, zie de [installatie-uitleg](../../README.md).

## Gebruik

- Klik in een grid gewoon op *Downloaden naar Excel*. Er verschijnt rechtsonder een groene
  melding met de bestandsnaam en het aantal rijen.
- De bestandsnaam bestaat uit de paginatitel, de naam van de grid en een tijdstempel, dus twee
  exports van dezelfde pagina overschrijven elkaar niet.
- Getallen komen als getal in het bestand, niet als tekst. `1.234,56`, `€ 1.234,56`, `(1.234,56)`
  en een min achteraan worden alle vier correct gelezen volgens de nl-BE-notatie, en negatief
  blijft negatief.
- De kopregel wordt vastgezet en de kolombreedtes worden op de inhoud gezet.
- Bij een grid die je kan bewerken, wordt de waarde uit het invoerveld of de dropdown gelezen,
  niet de opmaak eromheen.

## Hoe het werkt

- De klik wordt opgevangen in de **capture**-fase op `document`, want PeopleSoft hertekent de
  pagina constant met AJAX. Een handler op de knop zelf zou dat niet overleven.
- De knop-id (`<GRID>$hexcel$<n>` of `$hdown$`) verraadt bij welke grid hij hoort, en daarmee
  wordt de bijbehorende container gevonden.
- Een PeopleSoft flex-grid is soms in twee tabellen gesplitst, een vastgezet deel en een
  scrollend deel, met dezelfde rijen. Het script leest alle tabellen en plakt de kolommen per
  rij-index weer aan elkaar.
- Het schrijven gebeurt met [SheetJS](https://sheetjs.com/) 0.18.5, via `@require` van cdnjs.
  Die bibliotheek zit dus niet in dit bestand, wat verklaart waarom Tampermonkey deze rij als
  honderden kB toont.
- Is SheetJS niet geladen, dan valt het script terug op een CSV met puntkomma's en een BOM, wat
  Excel in een Nederlandstalige omgeving zonder importwizard opent.

## Beperkingen

- **Alleen wat in de DOM staat.** Een grid die zijn rijen pagineert, exporteert de pagina die je
  ziet. Zet de grid eerst op alle rijen.
- **Getalherkenning is heuristiek.** Iets dat op een getal lijkt maar tekst hoort te blijven,
  zoals een code met punten erin, kan als getal in het bestand komen.
- **`@grant GM_info`** staat in de kop maar wordt in de code niet gebruikt. Het staat er nog
  omdat het de uitvoeringscontext bepaalt en het script daarmee werkt; weghalen verandert die
  context en is niet getest.

## Ontwikkelen

Eén bestand, geen build. De enige dependency komt via `@require` binnen.

Tijdens het ontwikkelen laad je het script via een dev-stub in plaats van een geplakte kopie,
zie [Ontwikkelen](../../README.md#ontwikkelen).

```sh
node --check peoplesoft-excel-download.user.js
```

De commentaren in dit bestand zijn in het Engels, de andere scripts in deze repo zijn in het
Nederlands.

## Licentie

[GPL-3.0-or-later](../../LICENSE).
