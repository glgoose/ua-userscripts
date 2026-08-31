// ==UserScript==
// @name         iExpense: doorzoekbare rapportentabel
// @namespace    https://github.com/glgoose/ua-userscripts
// @version      1.7.1
// @description  Vervangt "Update Expense Reports" op Expenses Home door dezelfde tabel met alle rijen tegelijk, doorzoekbaar en sorteerbaar zonder server round trips, in een scrollvenster van vaste hoogte zodat de pagina niet verspringt, en zet Notifications bovenaan met Track Submitted onderaan
// @author       Glenn Goossens
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/glgoose/ua-userscripts/tree/main/scripts/iexpense-search
// @supportURL   https://github.com/glgoose/ua-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/iexpense-search/iexpense-search.user.js
// @updateURL    https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/iexpense-search/iexpense-search.user.js
// @match        https://ofprd.uantwerpen.be/OA_HTML/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  var TABLE = 'ActiveReportsRN.ActiveReportsTbl';
  var K_ROWS = 'iexpSearch.rows.v1'; // v1 bewaart ook de HTML van elke rij
  var K_QUERY = 'iexpSearch.query.v1'; // de zoekopdracht overleeft een Update-bezoek
  var K_KIND = 'iexpSearch.kind.v1'; // en de gekozen chip ook
  var MAX_STEPS = 40; // vangt een eventuele lus af, de tabel telt er een tiental
  var refreshing = false;
  // Een geslaagde stap komt normaal binnen enkele seconden terug. In een tab
  // op de achtergrond klemt Chrome timers op een tik per seconde, dus de marge
  // staat ruim en er wordt meermaals opnieuw geprobeerd: een vuring die niets
  // doet komt voor, gemeten vlak na een paginalading.
  var BAR_TIMEOUT = 8000;
  var TRIES = 5;
  var FAR_START = 99999; // startrij ver voorbij het einde, de server knipt af
  var TOTAL_TIMEOUT = 3000; // hoe lang we wachten tot de keuzelijst het totaal draagt
  var entries = []; // { data, tr, slots } per rij, waarbij tr een echte node is
  var walked = 0; // aantal rijen dat de lopende ophaalronde al binnen heeft
  var total = 0; // het totaal dat OAF zelf noemt, 0 zolang het onbekend is

  // Ondergrens van het scrollvenster. Op een halfhoog venster blijven er zo
  // altijd twaalf rijen staan, en op een groot scherm groeit het mee met 100vh.
  var SHOW_ROWS = 12; // zoveel rijen tegelijk in beeld, de rest via zoeken
  var ROW_FALLBACK = 29; // gemeten rijhoogte, alleen nodig als er nog niets staat

  // Cirkelpijl met een enkele boog, de gangbare reload. Bewust een SVG en geen
  // teken als U+21BB: dat erft de streekdikte en de basislijn van de tekstfont
  // en staat dan te dun en te laag naast een label van 12px.
  var ICON_REFRESH =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"' +
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M13.6 6.4A5.8 5.8 0 1 0 14 9"/><path d="M13.9 2.6v3.8h-3.8"/></svg>';

  // De eerste zes kolommen van de OAF-kopregel zijn sorteerbaar, de laatste drie
  // zijn de actie-iconen. De volgorde hier volgt die van de kopregel.
  var COLUMNS = [
    { key: 'name', type: 'text' },
    { key: 'num', type: 'text' },
    { key: 'date', type: 'date' },
    { key: 'status', type: 'text' },
    { key: 'total', type: 'number' },
    { key: 'purpose', type: 'text', sortable: false }
  ];

  // De width-attributen van OAF geven Report Date de breedste kolom van de hele
  // tabel voor elf tekens datum, terwijl Name (tot 33 tekens) en Purpose worden
  // afgeknepen. Eigen breedtes, in procenten en afgeleid van de langste inhoud.
  // Samen 92%, de rest is voor de drie actiekolommen.
  var WIDTHS = ['26%', '13%', '12%', '11%', '10%', '20%'];

  // De chips splitsen op soort rapport en niet op status: een rapport dat je
  // voor iemand anders indient krijgt van OAF het nummer TP-EXP..., een eigen
  // rapport EXP.... Dat onderscheid staat nergens anders in de tabel, terwijl
  // je de status meteen in de kolom leest.
  //
  // Derden staat vooraan, direct naast Alle. Niet omdat het de grootste groep
  // is, maar omdat het de enige chip is die echt werk doet: Eigen is bijna
  // altijd gelijk aan Alle, dus de chip die je aanklikt hoort het dichtst bij
  // het zoekveld te staan.
  var KIND_ORDER = ['Derden', 'Eigen'];
  var kindFilter = ''; // leeg is de Alle-chip
  var chipCounts = {}; // soort -> aantal rijen dat de zoekterm haalt
  var chipHits = 0; // totaal aantal rijen dat de zoekterm haalt
  var chipFiltering = false; // staat er een zoekterm, dan toont Alle treffers/totaal

  // Nieuwste eerst, zoals de OAF-tabel er zelf bij staat.
  var sort = { key: 'date', dir: -1 };

  // ---------------------------------------------------------------- helpers

  function byId(id) {
    return document.getElementById(id);
  }

  function contentTable() {
    return byId(TABLE + ':Content');
  }

  function barText() {
    var cb = byId(TABLE + ':ControlBar');
    return cb ? cb.innerText.replace(/\s+/g, ' ').trim() : '';
  }

  function navAnchor(direction) {
    var root = byId('posrefdiv:' + TABLE);
    if (!root) return null;
    var links = root.querySelectorAll('a');
    var wanted = direction === 'F' ? /next/i : /previous/i;
    for (var i = 0; i < links.length; i++) {
      var onclick = links[i].getAttribute('onclick') || '';
      if (onclick.indexOf('_navBarSubmit') !== -1 && wanted.test(links[i].textContent)) {
        return links[i];
      }
    }
    return null;
  }

  // Een programmatische link.click() laat de tabel onberoerd, gemeten op de
  // pagina zelf. De body van het onclick-attribuut uitvoeren werkt wel, en dat
  // doet een partial refresh: de pagina herlaadt niet.
  //
  // OAF gooit soms een TypeError vanuit _navBarSubmit als je vuurt terwijl het
  // vorige venster nog niet opnieuw geregistreerd is. Vandaar de try/catch en
  // de pogingen in step().
  function fireNav(direction) {
    var link = navAnchor(direction);
    if (!link) return false;
    try {
      new Function(link.getAttribute('onclick') || '').call(link);
      return true;
    } catch (e) {
      return false;
    }
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function waitForBar(previous) {
    return new Promise(function (resolve) {
      var started = Date.now();
      var timer = setInterval(function () {
        if (barText() !== previous) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - started > BAR_TIMEOUT) {
          clearInterval(timer);
          resolve(false);
        }
      }, 150);
    });
  }

  // 'end' betekent het einde van de tabel, 'fail' betekent dat er iets misging.
  // Dat onderscheid is nodig: alleen na een echte 'end' mag de cache vervangen
  // worden, anders gooi je rijen weg die er wel degelijk nog zijn.
  async function step(direction) {
    for (var attempt = 0; attempt < TRIES; attempt++) {
      if (!navAnchor(direction)) return 'end';
      var before = barText();
      if (fireNav(direction) && (await waitForBar(before))) {
        await sleep(400); // OAF werkt de controlbar bij voor zijn navigatie
        return 'ok';
      }
      await sleep(400);
    }
    return 'fail';
  }

  // ------------------------------------------------------------------ cache

  function readRows() {
    try {
      return JSON.parse(sessionStorage.getItem(K_ROWS)) || {};
    } catch (e) {
      return {};
    }
  }

  function writeRows(rows) {
    try {
      sessionStorage.setItem(K_ROWS, JSON.stringify(rows));
    } catch (e) {
      // Vol geraakt. Wat op het scherm staat blijft werken, alleen begint een
      // volgende paginalading dan opnieuw met verzamelen.
    }
  }

  function readQuery() {
    try {
      return sessionStorage.getItem(K_QUERY) || '';
    } catch (e) {
      return '';
    }
  }

  function writeQuery(value) {
    try {
      sessionStorage.setItem(K_QUERY, value);
    } catch (e) {
      // Niet erg, dan is de zoekopdracht na een Update-bezoek gewoon leeg.
    }
  }

  function kindOf(row) {
    return /^TP-/i.test(String(row.num || '')) ? 'Derden' : 'Eigen';
  }

  function readKind() {
    try {
      return sessionStorage.getItem(K_KIND) || '';
    } catch (e) {
      return '';
    }
  }

  function writeKind(value) {
    try {
      sessionStorage.setItem(K_KIND, value);
    } catch (e) {
      // Niet erg, dan staat na een Update-bezoek gewoon de Alle-chip aan.
    }
  }

  // ---------------------------------------------------------------- harvest

  // De kolomnaam staat in de title van een span binnen de cel, niet op de td
  // zelf. Het rapportnummer komt uit het stabiele anker-id.
  function cellLabel(td) {
    if (td.getAttribute('title')) return td.getAttribute('title');
    var kid = td.querySelector('[title]');
    return kid ? kid.getAttribute('title') : '';
  }

  function harvest() {
    var table = contentTable();
    if (!table) return [];

    var trs = table.querySelectorAll('tr');
    var out = [];

    for (var i = 0; i < trs.length; i++) {
      var tr = trs[i];
      var numLink = tr.querySelector('a[id*=":ReportNumber"]');
      if (!numLink) continue;

      var row = {
        num: numLink.textContent.replace(/\s+/g, ' ').trim(),
        html: tr.outerHTML // de opmaak van OAF, gratis
      };

      var tds = tr.children;
      for (var c = 0; c < tds.length; c++) {
        var title = cellLabel(tds[c]);
        var value = tds[c].textContent.replace(/\s+/g, ' ').trim();
        if (title === 'Name') row.name = value;
        else if (title === 'Report Date') row.date = value;
        else if (title === 'Status') row.status = value;
        else if (/^Report Total/.test(title)) row.total = value;
        else if (title === 'Purpose') row.purpose = value;
      }

      if (row.num) out.push(row);
    }
    return out;
  }

  function collectInto(target) {
    var found = harvest();
    for (var i = 0; i < found.length; i++) target[found[i].num] = found[i];
    return found.length;
  }

  // ----------------------------------------------------------- sorteerlogica

  var MONTHS = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };

  // "30-Jun-2026" wordt 20260630. Bewust geen new Date(): dat formaat is niet
  // betrouwbaar gespecificeerd en verschilt per browser.
  function parseDate(value) {
    var m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(String(value || '').trim());
    if (!m) return 0;
    var month = MONTHS[m[2].toLowerCase()];
    if (!month) return 0;
    return Number(m[3]) * 10000 + month * 100 + Number(m[1]);
  }

  // Bedragen staan in US-notatie, met een punt als decimaalteken en soms een
  // komma als duizendtal ("2,249.59"). Die komma mag dus gewoon weg.
  function parseTotal(value) {
    var n = parseFloat(String(value || '').replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function column(key) {
    for (var i = 0; i < COLUMNS.length; i++) {
      if (COLUMNS[i].key === key) return COLUMNS[i];
    }
    return COLUMNS[2];
  }

  function compareBy(col, a, b) {
    if (col.type === 'date') return parseDate(a.date) - parseDate(b.date);
    if (col.type === 'number') return parseTotal(a.total) - parseTotal(b.total);
    return String(a[col.key] || '').localeCompare(String(b[col.key] || ''), undefined, {
      sensitivity: 'base'
    });
  }

  function toggleSort(key) {
    if (sort.key === key) sort.dir = -sort.dir;
    else sort = { key: key, dir: column(key).type === 'text' ? 1 : -1 };
  }

  function matches(row, query) {
    if (!query) return true;
    // Status staat bewust niet in de hooiberg: op status filter je met een chip
    // of met het oog, en de drie waarden ("Saved", "In Progress", "Withdrawn")
    // bevatten losse letters die anders elke korte zoekterm laten aanslaan.
    var hay = [row.num, row.name, row.date, row.total, row.purpose]
      .join(' ')
      .toLowerCase();
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every(function (term) {
        return hay.indexOf(term) !== -1;
      });
  }

  // -------------------------------------------------------------------- view

  // De delete-link is geen gewone link maar href="#" met daarop een submitForm
  // die twee identificaties meestuurt: een evtSrcRowIdx, de positie binnen het
  // venster van tien rijen dat OAF zelf getekend heeft, en een versleutelde
  // ReportHeaderId. Onze tabel toont alle rijen in onze eigen volgorde, dus die
  // positie slaat hier nergens op. Of de server op de positie of op de id
  // afgaat, valt niet na te gaan zonder een echt rapport te verwijderen, en dat
  // is onomkeerbaar. Onbekend gedrag plus onomkeerbaar, dus dood icoon.
  // Duplicate is wel een gewone href met een eigen DupReportHeaderId.
  function defuseDelete(tr) {
    var link = tr.querySelector('a[id*=":DeleteLink:"]');
    if (!link) return;
    var holder = document.createElement('span');
    holder.title = 'verwijderen kan via origineel';
    var img = link.querySelector('img');
    if (img) {
      img.style.opacity = '0.3';
      holder.appendChild(img);
    }
    link.parentNode.replaceChild(holder, link);
  }

  function stripIds(node) {
    node.removeAttribute('id');
    var kids = node.querySelectorAll('[id]');
    for (var i = 0; i < kids.length; i++) kids[i].removeAttribute('id');
  }

  // OAF hangt op elke kolomkop een onclick met _tableSortSubmit en een
  // oaondragstart. cloneNode neemt die attributen mee, dus zonder strippen doet
  // elke klik naast het lokale sorteren ook nog een server round trip: die zet
  // de pagina opnieuw op, en daardoor sloeg de richting pas bij de tweede klik om.
  function stripEvents(node) {
    var all = [node];
    var kids = node.querySelectorAll('*');
    for (var i = 0; i < kids.length; i++) all.push(kids[i]);
    for (var n = 0; n < all.length; n++) {
      var attrs = all[n].attributes;
      for (var a = attrs.length - 1; a >= 0; a--) {
        var name = attrs[a].name.toLowerCase();
        if (name.indexOf('on') === 0 || name.indexOf('oaon') === 0) {
          all[n].removeAttribute(attrs[a].name);
        }
      }
    }
  }

  // De link op het rapportnummer en het potlood in de Update-kolom hebben exact
  // dezelfde href: één bestemming per rij, twee keer aangeboden in een klein
  // doel. De bestemming komt daarom op de rij zelf te staan, zodat de hele rij
  // klikbaar wordt, en de Update-kolom kan weg. Allebei vóór stripIds(), want
  // daarna zijn de OAF-id's waarop we de kolom herkennen verdwenen.
  function markLink(tr) {
    var cell = tr.querySelector('a[id*=":ReportNumber"]') || tr.querySelector('a[href]');
    var href = cell ? cell.getAttribute('href') : '';
    if (href && href.charAt(0) !== '#') tr.setAttribute('data-href', href);
  }

  function dropUpdateCell(tr) {
    var link = tr.querySelector('a[id*=":Update:"]');
    var cell = link && link.closest ? link.closest('td') : null;
    if (cell && cell.parentNode === tr) tr.removeChild(cell);
  }

  function rowNode(html) {
    var wrap = document.createElement('table');
    wrap.innerHTML = '<tbody>' + html + '</tbody>';
    var tr = wrap.querySelector('tr');
    if (!tr) return null;
    defuseDelete(tr);
    markLink(tr);
    dropUpdateCell(tr);
    // De originele tabel blijft in de DOM staan, dus zonder strippen zouden er
    // dubbele id's als N12:Update:3 ontstaan en die verwarren OAF's scripts.
    stripIds(tr);
    return tr;
  }

  // De kopregel van OAF overnemen, maar de sorteerlinks eruit: die doen een
  // server round trip die onze tabel zou wegvagen.
  function oafHeadRow() {
    var source = byId(TABLE + ':header');
    return source ? source.querySelector('tr') : null;
  }

  // Wordt alleen aangeroepen als oafHeadRow() er staat, init() wacht daarop.
  function headerRow() {
    var copy = oafHeadRow().cloneNode(true);
    stripIds(copy);
    stripEvents(copy);

    // De Update-kop weg, op zijn label en niet op een vaste index, zodat een
    // herschikking door OAF de verkeerde kolom niet raakt.
    for (var u = copy.children.length - 1; u >= 0; u--) {
      if (copy.children[u].textContent.replace(/\s+/g, ' ').trim() === 'Update') {
        copy.removeChild(copy.children[u]);
      }
    }

    var ths = copy.children;
    for (var i = 0; i < ths.length; i++) {
      var label = ths[i].textContent.replace(/\s+/g, ' ').trim();
      ths[i].textContent = label;
      ths[i].setAttribute('data-label', label);
      ths[i].setAttribute('data-cls', ths[i].className || '');
      ths[i].removeAttribute('width');
      if (WIDTHS[i]) ths[i].setAttribute('width', WIDTHS[i]);
      if (COLUMNS[i] && COLUMNS[i].sortable !== false) {
        ths[i].setAttribute('data-sort', COLUMNS[i].key);
      }
    }
    return copy;
  }

  // Elke sorteerbare kop draagt permanent een driehoekje, in lichtgrijs zolang
  // er niet op gesorteerd is. Zonder dat lijkt alleen de actieve kolom klikbaar.
  // De vaste breedte van het driehoekje voorkomt dat kolommen verspringen bij
  // het wisselen van sorteerkolom.
  function paintHeader() {
    var head = byId('iexpHead');
    if (!head) return;
    var ths = head.children;
    for (var i = 0; i < ths.length; i++) {
      var th = ths[i];
      var key = th.getAttribute('data-sort');
      th.textContent = th.getAttribute('data-label') || '';
      if (!key) continue;
      var active = key === sort.key;
      var base = th.getAttribute('data-cls') || '';
      th.className = active ? (base + ' iexpSorted').trim() : base;
      th.title = 'sorteren op ' + th.getAttribute('data-label');
      var ind = document.createElement('span');
      ind.className = active && sort.dir === 1 ? 'iexpInd iexpUp' : 'iexpInd';
      th.appendChild(ind);
    }
  }

  function applySort() {
    var col = column(sort.key);
    entries.sort(function (a, b) {
      var d = compareBy(col, a.data, b.data) * sort.dir;
      if (d) return d;
      // Vaste tiebreak, zodat gelijke waarden niet rondspringen.
      d = parseDate(b.data.date) - parseDate(a.data.date);
      if (d) return d;
      return String(a.data.num).localeCompare(String(b.data.num));
    });

    var body = byId('iexpBody');
    for (var i = 0; i < entries.length; i++) body.appendChild(entries[i].tr);
    paintHeader();
  }

  function escHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Geeft de HTML terug met alle treffers in een <mark>, of null als er niets
  // te markeren valt. De posities worden eerst verzameld en samengevoegd, en pas
  // daarna wordt er HTML van gemaakt: een replace op de al opgebouwde string zou
  // ook in het ingevoegde opmaakwerk zelf gaan zoeken.
  function markHtml(text, terms) {
    if (!terms.length) return null;
    var low = text.toLowerCase();
    var ranges = [];
    for (var i = 0; i < terms.length; i++) {
      var from = 0;
      var at;
      while ((at = low.indexOf(terms[i], from)) !== -1) {
        ranges.push([at, at + terms[i].length]);
        from = at + terms[i].length;
      }
    }
    if (!ranges.length) return null;

    ranges.sort(function (a, b) {
      return a[0] - b[0];
    });
    var merged = [ranges[0]];
    for (var j = 1; j < ranges.length; j++) {
      var last = merged[merged.length - 1];
      if (ranges[j][0] <= last[1]) last[1] = Math.max(last[1], ranges[j][1]);
      else merged.push(ranges[j]);
    }

    var out = '';
    var pos = 0;
    for (var k = 0; k < merged.length; k++) {
      out += escHtml(text.slice(pos, merged[k][0]));
      out += '<mark class="iexpMark">' + escHtml(text.slice(merged[k][0], merged[k][1])) + '</mark>';
      pos = merged[k][1];
    }
    return out + escHtml(text.slice(pos));
  }

  // Elk stuk tekst in de rij krijgt een eigen span, een keer, bij het bouwen.
  // Markeren is daarna alleen die spans vullen, en terugzetten is één toewijzing.
  function textSlots(tr) {
    var walker = document.createTreeWalker(tr, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    }
    var slots = [];
    for (var i = 0; i < nodes.length; i++) {
      var text = nodes[i].nodeValue;
      var span = document.createElement('span');
      span.textContent = text;
      nodes[i].parentNode.replaceChild(span, nodes[i]);
      slots.push({ span: span, text: text, marked: false });
    }
    return slots;
  }

  function applyFilter() {
    var input = byId('iexpSearchInput');
    var query = input ? input.value : '';
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    var visible = 0;

    // De chips tellen binnen de zoekterm maar buiten de gekozen chip om:
    // anders zou de chip die je aanklikt de andere op nul zetten.
    chipCounts = {};
    chipHits = 0;
    chipFiltering = !!query;

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var kind = kindOf(entry.data);
      if (!(kind in chipCounts)) chipCounts[kind] = 0;
      var hit = matches(entry.data, query);
      if (hit) {
        chipHits++;
        chipCounts[kind]++;
      }
      if (kindFilter && kind !== kindFilter) hit = false;
      entry.tr.style.display = hit ? '' : 'none';
      if (!hit) continue;
      visible++;
      for (var j = 0; j < entry.slots.length; j++) {
        var slot = entry.slots[j];
        var html = markHtml(slot.text, terms);
        if (html === null) {
          if (slot.marked) {
            slot.span.textContent = slot.text;
            slot.marked = false;
          }
        } else {
          slot.span.innerHTML = html;
          slot.marked = true;
        }
      }
    }

    var empty = byId('iexpEmpty');
    if (empty) empty.style.display = visible ? 'none' : '';
    var message = byId('iexpEmptyMsg');
    if (message) message.textContent = emptyText(query);
    var clear = byId('iexpClear');
    if (clear) clear.style.display = query ? '' : 'none';

    // Zonder dit sta je na het filteren gescrold voorbij je eigen treffers.
    var scroll = byId('iexpScroll');
    if (scroll) scroll.scrollTop = 0;

    writeQuery(query);
    paintChips();
  }

  // De lege staat noemt beide voorwaarden, anders zoek je naar een zoekterm
  // die wel treffers heeft terwijl de statuschip ze wegfiltert.
  function emptyText(query) {
    if (kindFilter && query) return 'geen rapporten bij ' + kindFilter + ' voor ' + query;
    if (kindFilter) return 'geen rapporten bij ' + kindFilter;
    return 'geen resultaten voor ' + query;
  }

  // Rijen worden een keer tot nodes gemaakt. Filteren verbergt ze, sorteren
  // verplaatst ze. Zo blijft alles wat aan die nodes hangt intact, en is een
  // toetsaanslag geen herparse.
  function rebuild() {
    var body = byId('iexpBody');
    if (!body) return;

    var rows = readRows();
    entries = [];
    body.innerHTML = '';

    Object.keys(rows).forEach(function (key) {
      var row = rows[key];
      if (!row.html) return;
      var tr = rowNode(row.html);
      if (tr) {
        entries.push({ data: row, tr: tr, slots: textSlots(tr) });
        body.appendChild(tr);
      }
    });

    sizeScroller();
    applySort();
    applyFilter();
  }

  // Een echte height en geen max-height: die laatste begrenst wel maar zet geen
  // vloer, dus bij weinig treffers kromp het venster alsnog mee en sprong de
  // pagina. De hoogte hangt nu af van de dataset en niet van het filter.
  //
  // De rijhoogte wordt gemeten, want die volgt de fontinstellingen van de
  // gebruiker. Het venster toont SHOW_ROWS rijen plus de kopregel, of minder als
  // de hele lijst korter is. Zoeken haalt de rest naar boven, dus een venster
  // van 46 rijen hoog levert alleen maar scrollwerk op. Het vh-deel past zich
  // aan bij het verslepen van het venster, dus er is geen resize-listener nodig.
  //
  // Dit draait alleen vanuit rebuild(), voor applyFilter(), zodat de gemeten
  // hoogte bij de hele dataset hoort en niet bij het huidige filter.
  function sizeScroller() {
    var scroll = byId('iexpScroll');
    if (!scroll) return;
    var rowH = entries.length ? entries[0].tr.offsetHeight : 0;
    if (!rowH) rowH = ROW_FALLBACK;
    var head = scroll.querySelector('thead');
    scroll.style.height = ''; // vrijgeven, anders meet scrollHeight zichzelf
    var needed = scroll.scrollHeight + 2; // plus de randen
    var cap = (head ? head.offsetHeight : 0) + SHOW_ROWS * rowH + 2;
    scroll.style.height =
      'min(' + needed + 'px, ' + cap + 'px, calc(100vh - 120px))';
  }

  // De chips dragen zelf de telling, dus er is geen aparte teller meer. De
  // Alle-chip doet daarbij drie dingen: in ruststand het totaal, tijdens het
  // zoeken treffers en totaal ("3/46"), en tijdens het ophalen de voortgang.
  // Alle drie de chips staan er altijd, ook als een soort op nul staat. Een
  // eenzame Alle-chip verklaart zichzelf niet, terwijl "Derden 0" wel meteen
  // zegt wat er te zien valt en wat er niet is.
  function chipKeys() {
    return [''].concat(KIND_ORDER);
  }

  function makeChip(key) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'iexpChip';
    chip.setAttribute('data-kind', key);
    chip.title = key === 'Derden'
      ? 'alleen rapporten voor derden (TP-EXP)'
      : key === 'Eigen'
        ? 'alleen eigen rapporten (EXP)'
        : 'alles, ook rapporten voor derden';
    chip.appendChild(document.createTextNode(key || 'Alle'));
    chip.appendChild(document.createElement('b'));
    chip.addEventListener('click', function () {
      kindFilter = kindFilter === key ? '' : key;
      writeKind(kindFilter);
      applyFilter();
      var input = byId('iexpSearchInput');
      if (input) input.focus({ preventScroll: true });
    });
    return chip;
  }

  function paintChips() {
    var box = byId('iexpChips');
    if (!box) return;

    var keys = chipKeys();
    // Een soort die na een ophaalronde niet meer voorkomt mag het filter niet
    // blijven dichthouden.
    if (kindFilter && keys.indexOf(kindFilter) === -1) {
      kindFilter = '';
      writeKind('');
    }
    // Alleen opnieuw opbouwen als de verzameling statussen echt verandert:
    // anders bouwt elke toetsaanslag de knoppen onder de muis vandaan.
    var signature = keys.join('|');
    if (box.getAttribute('data-keys') !== signature) {
      box.setAttribute('data-keys', signature);
      box.innerHTML = '';
      for (var i = 0; i < keys.length; i++) box.appendChild(makeChip(keys[i]));
    }

    var chips = box.children;
    for (var j = 0; j < chips.length; j++) {
      var chip = chips[j];
      var key = chip.getAttribute('data-kind');
      var n = key ? chipCounts[key] || 0 : chipHits;
      var text;
      if (!key && refreshing) {
        text = total ? walked + '/' + total : String(walked);
      } else if (!key && chipFiltering) {
        text = n + '/' + entries.length;
      } else {
        text = String(n);
      }
      chip.lastChild.textContent = text;
      chip.setAttribute('aria-pressed', key === kindFilter ? 'true' : 'false');
      chip.setAttribute('data-empty', !refreshing && n === 0 ? 'true' : 'false');
      // Tijdens het ophalen kloppen alleen de voortgangscijfers op Alle; de
      // soorttellingen zijn nog die van de vorige lijst en staan dus gedempt.
      chip.className = key && refreshing ? 'iexpChip iexpStale' : 'iexpChip';
    }
  }

  function setBusy() {
    var button = byId('iexpRefresh');
    if (button) {
      button.className = refreshing ? 'iexpBusy' : '';
      button.disabled = refreshing;
    }
    paintChips();
  }

  function original() {
    return byId(TABLE);
  }

  // Verbergen gebeurt via een stylesheet en niet via een inline stijl: de
  // partial refresh vervangt de SPAN zelf, dus een inline display:none is na
  // de eerste navigatiestap weg en dan staan er weer twee tabellen.
  function hideOriginal() {
    if (byId('iexpStyle')) return;
    var sel = '#' + CSS.escape(TABLE);
    var style = document.createElement('style');
    style.id = 'iexpStyle';
    // In de stand "oorspronkelijke tabel" blijft de balk staan, alleen het
    // scrollvenster en de zoekonderdelen gaan weg. Anders verdwijnt de link
    // waarmee je terugkomt samen met de rest.
    style.textContent = [
      sel + '{display:none}',
      'html.iexpOrigineel ' + sel + '{display:revert}',
      'html.iexpOrigineel #iexpScroll,html.iexpOrigineel #iexpField,',
      'html.iexpOrigineel #iexpChips,html.iexpOrigineel #iexpRefresh{display:none}',
      '#iexpWrap{margin:8px 0}',
      '#iexpBar{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
      '#iexpField{position:relative;display:inline-flex;align-items:center}',
      '#iexpSearchInput{width:320px;padding:4px 24px 4px 6px;border:1px solid #9bb;',
      'border-radius:3px;font:12px Helvetica,Arial,sans-serif}',
      '#iexpSearchInput:focus{outline:none;border-color:#145c9e;box-shadow:0 0 0 2px #dce8f2}',
      '#iexpClear{position:absolute;right:4px;border:0;background:none;color:#8a949c;',
      'font-size:14px;line-height:1;cursor:pointer;padding:2px 4px}',
      '#iexpClear:hover{color:#333}',
      '#iexpSpacer{flex:1}',
      '#iexpOrig{color:#145c9e;background:none;border:0;padding:3px 2px;cursor:pointer;',
      'font:12px Helvetica,Arial,sans-serif;white-space:nowrap}',
      '#iexpOrig:hover{text-decoration:underline}',
      '#iexpRefresh{display:inline-flex;align-items:center;justify-content:center;',
      'width:24px;height:22px;padding:0;background:none;border:1px solid transparent;',
      'border-radius:3px;color:#5a646c;cursor:pointer}',
      '#iexpRefresh:hover{background:#eef1f4;border-color:#cbd3da;color:#222}',
      '#iexpRefresh:disabled{cursor:default;color:#9aa4ac;background:none;border-color:transparent}',
      '#iexpRefresh svg{width:14px;height:14px;display:block}',
      '#iexpRefresh.iexpBusy svg{animation:iexpSpin .9s linear infinite}',
      '@keyframes iexpSpin{to{transform:rotate(360deg)}}',
      // De chips staan links van de rek, samen met het zoekveld. Alles wat
      // groeit staat dus aan één kant en duwt de link en de verversknop niet
      // meer voor zich uit; er hoeft daarvoor niets gereserveerd te worden.
      '#iexpChips{display:flex;align-items:center;gap:4px}',
      '.iexpChip{font:12px Helvetica,Arial,sans-serif;color:#5a646c;background:none;',
      'border:1px solid #cbd3da;border-radius:3px;padding:2px 8px;cursor:pointer;',
      'white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.iexpChip:hover{background:#eef1f4;color:#222}',
      '.iexpChip[aria-pressed="true"]{color:#145c9e;background:#dce8f2;border-color:#a9c6e0}',
      // De cijfers staan lichter dan het label, maar niet lichter dan #6b757d:
      // dat is 4,7:1 op wit en dus nog leesbaar volgens WCAG AA.
      '.iexpChip b{font-weight:400;color:#6b757d;margin-left:4px}',
      '.iexpChip[aria-pressed="true"] b{color:#145c9e}',
      '.iexpChip[data-empty="true"]{color:#6b757d;border-color:#e2e7eb}',
      '.iexpChip.iexpStale b{opacity:.45}',
      '#iexpScroll{overflow-y:auto;overflow-anchor:none;border:1px solid #d6dfe6}',
      // De tabel erfde zijn breedte van de container van OAF. In een eigen
      // scrollvenster is die weg, dus hier expliciet.
      '#iexpScroll>table{width:100%!important;table-layout:auto!important}',
      // nowrap, anders brak "Report Total (EUR)" in twee regels en zakte het
      // driehoekje naar de tweede regel in plaats van naast het label te staan.
      '#iexpWrap thead th,#iexpWrap thead td{position:sticky;top:0;z-index:2;',
      'background:#f2f4f7;user-select:none;white-space:nowrap}',
      '#iexpWrap thead [data-sort]{cursor:pointer}',
      '#iexpWrap thead [data-sort]:hover{background:#e7ebef}',
      '#iexpWrap thead .iexpSorted{background:#e9edf1;color:#000;',
      'box-shadow:inset 0 -2px 0 #145c9e}',
      // Met randen getekend en niet als teken U+25B4 / U+25BE: Helvetica en Arial
      // bevatten die tekens niet, dus viel elke richting terug op een ander
      // lettertype en stond het driehoekje omhoog kleiner dan dat omlaag.
      '#iexpWrap .iexpInd{display:inline-block;width:0;height:0;margin-left:5px;',
      'vertical-align:middle;border-left:4px solid transparent;',
      'border-right:4px solid transparent;border-top:5px solid currentColor;',
      'color:#b3bcc4}',
      '#iexpWrap .iexpInd.iexpUp{transform:rotate(180deg)}',
      '#iexpWrap thead th:hover .iexpInd{color:#7b858d}',
      '#iexpWrap thead .iexpSorted .iexpInd{color:#145c9e}',
      '#iexpBody tr:nth-child(even) td{background:#fafbfc}',
      '#iexpBody tr:hover td{background:#dce8f2}',
      '#iexpBody tr[data-href]{cursor:pointer}',
      '#iexpBody tr[data-href]:active td{background:#c9dcee}',
      '#iexpWrap mark.iexpMark{background:#ffe9a8;color:inherit;padding:0 1px}',
      '#iexpEmptyMsg{color:#8a949c;font-style:italic;text-align:center;padding:18px 6px}'
    ].join('');
    document.head.appendChild(style);
  }

  function toggleOriginal() {
    var shown = document.documentElement.classList.toggle('iexpOrigineel');
    byId('iexpOrig').textContent = shown ? 'Terug naar zoeken' : 'Oorspronkelijke tabel';
  }

  function openFirstHit() {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].tr.style.display === 'none') continue;
      var link = entries[i].tr.querySelector('a[href]:not([href="#"])');
      if (link) location.href = link.href;
      return;
    }
  }

  function buildPanel() {
    var anchor = original();
    if (!anchor || !anchor.parentNode || byId('iexpWrap')) return false;

    var wrap = document.createElement('div');
    wrap.id = 'iexpWrap';

    var bar = document.createElement('div');
    bar.id = 'iexpBar';

    var field = document.createElement('span');
    field.id = 'iexpField';

    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'iexpSearchInput';
    input.placeholder = 'zoek';
    input.autocomplete = 'off';

    var clear = document.createElement('button');
    clear.id = 'iexpClear';
    clear.type = 'button';
    clear.textContent = '\u00d7';
    clear.title = 'wissen (Esc)';
    clear.style.display = 'none';

    field.appendChild(input);
    field.appendChild(clear);

    var spacer = document.createElement('span');
    spacer.id = 'iexpSpacer';

    // Een button, want het is een actie, maar opgemaakt als een OAF-link: dit
    // gaat naar een andere weergave van dezelfde lijst en hoort geen gewicht te
    // hebben naast het zoekveld.
    var orig = document.createElement('button');
    orig.id = 'iexpOrig';
    orig.type = 'button';
    orig.textContent = 'Oorspronkelijke tabel';
    orig.title = 'De tabel van Oracle, nodig voor verwijderen, Detach, Columns, Advanced Sort en Attach';

    // Opnieuw ophalen en cache wissen zijn hier dezelfde handeling: de cache is
    // niets anders dan de opgehaalde lijst.
    var refresh = document.createElement('button');
    refresh.id = 'iexpRefresh';
    refresh.type = 'button';
    refresh.title = 'Lijst opnieuw ophalen bij Oracle';
    refresh.innerHTML = ICON_REFRESH;

    var chips = document.createElement('span');
    chips.id = 'iexpChips';
    chips.setAttribute('aria-live', 'polite');

    bar.appendChild(field);
    bar.appendChild(chips);
    bar.appendChild(spacer);
    bar.appendChild(orig);
    bar.appendChild(refresh);

    // De tabelschil van OAF hergebruiken zodat de opmaak klopt. Kopregel en
    // rijen komen in dezelfde tabel, dan lopen de kolombreedtes vanzelf gelijk.
    var table = contentTable().cloneNode(false);
    table.removeAttribute('id');
    // OAF zet zelf inline table-layout:fixed en width:0px op zijn tabel. Die
    // erven we mee met de shallow clone, en dan blijft onze tabel 0 breed.
    table.removeAttribute('style');

    var columnCount = 9;
    var head = headerRow();
    if (head) {
      head.id = 'iexpHead';
      columnCount = head.children.length;
      // Een echte thead, want alleen daarin plakt een sticky kopregel.
      var thead = document.createElement('thead');
      thead.appendChild(head);
      table.appendChild(thead);
    }

    var body = document.createElement('tbody');
    body.id = 'iexpBody';
    table.appendChild(body);

    // De lege staat staat in een eigen tbody, zodat applySort() hem niet
    // tussen de rijen door omhoog schuift.
    var emptyBody = document.createElement('tbody');
    var emptyRow = document.createElement('tr');
    emptyRow.id = 'iexpEmpty';
    emptyRow.style.display = 'none';
    var emptyCell = document.createElement('td');
    emptyCell.id = 'iexpEmptyMsg';
    emptyCell.colSpan = columnCount;
    emptyRow.appendChild(emptyCell);
    emptyBody.appendChild(emptyRow);
    table.appendChild(emptyBody);

    // Het scrollvenster is de kern van deze versie: de documenthoogte hangt
    // niet langer af van het aantal zichtbare rijen, dus filteren, sorteren en
    // de achtergrondwandeling laten de pagina niet meer verspringen.
    var scroll = document.createElement('div');
    scroll.id = 'iexpScroll';
    scroll.appendChild(table);

    wrap.appendChild(bar);
    wrap.appendChild(scroll);
    anchor.parentNode.insertBefore(wrap, anchor);

    input.addEventListener('input', applyFilter);

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        input.value = '';
        applyFilter();
        return;
      }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      openFirstHit();
    });

    clear.addEventListener('click', function () {
      input.value = '';
      applyFilter();
      input.focus({ preventScroll: true });
    });

    // Zoals in GitHub en Slack: een schuine streep zet de cursor in het veld.
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      var tag = t && t.tagName ? t.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
      if (document.documentElement.classList.contains('iexpOrigineel')) return;
      e.preventDefault();
      // Alleen hier scrollen: bij een muisklik staat het veld al in beeld en is
      // meebewegen storend, maar de sneltoets kan van buiten het beeld komen.
      var top = wrap.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight - 60) {
        wrap.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      input.focus({ preventScroll: true });
      input.select();
    });

    // Op de tabel, niet op de kopregel zelf: die kan later vervangen worden
    // door de echte van OAF, en dan zou een handler op de rij meeverdwijnen.
    table.addEventListener('click', function (e) {
      var th = e.target.closest ? e.target.closest('[data-sort]') : null;
      if (!th) return;
      toggleSort(th.getAttribute('data-sort'));
      applySort();
      input.focus({ preventScroll: true });
    });

    // De hele rij als klikdoel. Gedelegeerd op de tbody, dus sorteren en
    // herbouwen hoeven niets te herbedraden. Een echte link binnen de rij wint
    // altijd, zodat Duplicate Duplicate blijft en het rapportnummer zijn eigen
    // anker houdt, inclusief rechtermuisknop en toetsenbord.
    function openRow(e) {
      if (e.button !== 0 && e.button !== 1) return;
      if (!e.target.closest) return;
      if (e.target.closest('a,button,input,label')) return;
      var tr = e.target.closest('tr[data-href]');
      if (!tr) return;
      // Slepen om te selecteren en dubbelklikken op een woord laten een
      // selectie achter. Die mag niet als navigatie tellen.
      var sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      e.preventDefault();
      var href = tr.getAttribute('data-href');
      if (e.button === 1 || e.metaKey || e.ctrlKey || e.shiftKey) {
        window.open(href, '_blank');
      } else {
        location.href = href;
      }
    }

    body.addEventListener('click', openRow);
    body.addEventListener('auxclick', openRow);
    // Zonder dit start een middenklik het autoscrollen van Chrome, en dat blijft
    // hangen omdat auxclick te laat komt om het nog tegen te houden.
    body.addEventListener('mousedown', function (e) {
      if (e.button === 1 && e.target.closest && e.target.closest('tr[data-href]')) {
        e.preventDefault();
      }
    });

    orig.addEventListener('click', toggleOriginal);
    refresh.addEventListener('click', function () {
      refreshAll();
    });

    input.value = readQuery();
    kindFilter = readKind();
    return true;
  }

  // -------------------------------------------------------------- verversen

  // Naast Previous en Next zet OAF een keuzelijst met vensters erin. Elke optie
  // draagt een waarde "startrij,aantal", en zodra de query uitgeput is ook een
  // label met het totaal erin ("16 - 20 of 46"). Daarmee kan je rechtstreeks
  // naar een venster springen in plaats van te wandelen.
  //
  // Dat scheelt veel. De Next-links stappen per vijf rijen terwijl de tabel er
  // vijftien tegelijk toont, dus wandelen betekent tien stappen met elk tien
  // rijen die je al had, en daarvoor nog eens tot tien stappen achteruit om te
  // weten dat het begin ook echt het begin is: gemeten zestien tot zesentwintig
  // seconden. Springen zijn er vier, samen ongeveer vier seconden.
  function rangeChoice() {
    var root = byId('posrefdiv:' + TABLE);
    if (!root) return null;
    var selects = root.querySelectorAll('select');
    for (var i = 0; i < selects.length; i++) {
      var onchange = selects[i].getAttribute('onchange') || '';
      if (onchange.indexOf('_navChoiceSubmit') !== -1 && onchange.indexOf(TABLE) !== -1) {
        return selects[i];
      }
    }
    return null;
  }

  // OAF vult de keuzelijst pas na de eerste render af. Vlak na het laden staan
  // er een handvol opties in met korte labels ("1 - 5"), even later dezelfde
  // opties met het totaal erin ("1 - 5 of 46"). Gemeten: bij een verse lading
  // leest het script anders total 0 en valt het terug op de trage wandeling.
  // Dus wachten tot een label het totaal draagt, met een eigen korte limiet;
  // loopt die af, dan doet de terugval het werk.
  function waitForTotal() {
    return new Promise(function (resolve) {
      var started = Date.now();
      var timer = setInterval(function () {
        var select = rangeChoice();
        var n = select ? totalFromChoice(select) : 0;
        if (n) {
          clearInterval(timer);
          resolve(n);
        } else if (Date.now() - started > TOTAL_TIMEOUT) {
          clearInterval(timer);
          resolve(0);
        }
      }, 100);
    });
  }

  // De waarden in de keuzelijst zijn "startrij,aantal". Dat aantal is vijf,
  // terwijl de tabel er vijftien toont: gemeten geeft de sprong naar "16,5"
  // gewoon vijftien rijen terug, want de server bepaalt de vensterbreedte zelf.
  // Wij moeten dus wel het aantal van OAF meesturen, anders keurt hij de waarde
  // af, maar we mogen zelf in stappen van vijftien harvesten.
  function choiceStep(select) {
    for (var i = 0; i < select.options.length; i++) {
      var m = /^(\d+),(\d+)$/.exec(select.options[i].value);
      if (m) return Number(m[2]);
    }
    return 0;
  }

  function totalFromChoice(select) {
    for (var i = 0; i < select.options.length; i++) {
      var m = /\bof\s+(\d[\d.,\u00a0 ]*)/.exec(select.options[i].text);
      if (m) {
        var n = Number(m[1].replace(/\D/g, ''));
        if (n) return n;
      }
    }
    return 0;
  }

  // De rapportnummers van het zichtbare venster, als één string. Verandert die,
  // dan is de partial refresh binnen. Betrouwbaarder dan de tekst van de
  // controlbar, want die verandert ook bij dingen die ons niet aangaan.
  function rowSignature() {
    var table = contentTable();
    if (!table) return '';
    var links = table.querySelectorAll('a[id*=":ReportNumber"]');
    var out = [];
    for (var i = 0; i < links.length; i++) {
      out.push(links[i].textContent.replace(/\s+/g, ' ').trim());
    }
    return out.join('|');
  }

  function visibleRowCount() {
    var table = contentTable();
    return table ? table.querySelectorAll('a[id*=":ReportNumber"]').length : 0;
  }

  function waitForRows(previous) {
    return new Promise(function (resolve) {
      var started = Date.now();
      var timer = setInterval(function () {
        if (rowSignature() !== previous) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - started > BAR_TIMEOUT) {
          clearInterval(timer);
          resolve(false);
        }
      }, 100);
    });
  }

  // De gevraagde combinatie staat lang niet altijd als optie in de lijst, want
  // OAF stapt per vijf en de tabel toont er vijftien. Een eigen optie erbij
  // hangen mag: de waarde gaat mee in de submit, de lijst wordt daarna toch
  // door de partial refresh vervangen.
  async function jumpTo(start, size) {
    var value = start + ',' + size;
    for (var attempt = 0; attempt < TRIES; attempt++) {
      // Na elke partial refresh is de keuzelijst een andere node, dus telkens
      // opnieuw opzoeken.
      var select = rangeChoice();
      if (!select) return 'fail';
      var option = null;
      for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].value === value) option = select.options[i];
      }
      if (!option) {
        option = document.createElement('option');
        option.value = value;
        option.text = value;
        select.appendChild(option);
      }
      select.value = value;
      var before = rowSignature();
      var fired = true;
      try {
        new Function(select.getAttribute('onchange') || '').call(select);
      } catch (e) {
        fired = false;
      }
      if (fired && (await waitForRows(before))) return 'ok';
      await sleep(400);
    }
    return 'fail';
  }

  // Terugval voor het geval OAF geen keuzelijst rendert of het totaal niet uit
  // een label te halen is: de oude wandeling met Previous en Next. Eerst
  // achteruit tot het begin, want zonder die stap zou een verversing vanaf het
  // laatste venster zichzelf compleet noemen en de cache uitkleden.
  async function walkWithLinks(fresh) {
    for (var b = 0; b < MAX_STEPS; b++) {
      if ((await step('B')) !== 'ok') break;
    }
    walked = collectInto(fresh);
    paintChips();
    for (var i = 0; i < MAX_STEPS; i++) {
      var result = await step('F');
      if (result === 'end') return true;
      if (result === 'fail') return false;
      collectInto(fresh);
      walked = Object.keys(fresh).length;
      paintChips();
    }
    return false;
  }

  // Vervangt de cache alleen als de verzameling aantoonbaar compleet is. Bij de
  // sprongen is dat een telling tegen het totaal uit de keuzelijst, bij de
  // terugval het bereiken van het einde. Anders zou een halve ophaalronde
  // rapporten weggooien die er wel degelijk nog zijn.
  async function refreshAll() {
    if (refreshing) return;
    refreshing = true;
    walked = 0;
    total = 0;
    setBusy();

    var fresh = {};
    var complete = false;
    try {
      walked = collectInto(fresh);
      var size = visibleRowCount();
      var select = rangeChoice();
      var chunk = select ? choiceStep(select) || size : size;
      total = select ? totalFromChoice(select) : 0;
      paintChips();

      if (!select) {
        // Geen keuzelijst betekent dat alles in één venster past.
        complete = walked > 0;
      } else if (!size || !chunk) {
        complete = await walkWithLinks(fresh);
      } else {
        // OAF kent het totaal zelf pas als de query uitgeput is: vlak na het
        // laden staat er een ingekorte keuzelijst die op "More..." eindigt en
        // draagt geen enkel label een "of 46". Daarom eerst een sprong naar een
        // startrij ver voorbij het einde. De server knipt die af tot het
        // laatste venster, en pas dan staat het totaal in elk label. Die sprong
        // levert meteen ook de staart van de lijst op, dus hij kost niets.
        var tail = 0;
        if (!total) {
          if ((await jumpTo(FAR_START, chunk)) === 'ok') {
            tail = visibleRowCount();
            collectInto(fresh);
            walked = Object.keys(fresh).length;
            total = await waitForTotal();
            paintChips();
          }
        }
        if (!total) {
          complete = await walkWithLinks(fresh);
        } else {
          // Venster 1 staat al binnen, en de staart ook. Wat ertussen zit gaat
          // aflopend, met venster 1 als afsluiter zodat de oorspronkelijke
          // tabel eronder staat zoals de gebruiker hem achterliet.
          var starts = [];
          for (var s = 1 + size; s <= total - tail; s += size) starts.push(s);
          starts.reverse();
          starts.push(1);
          for (var i = 0; i < starts.length; i++) {
            if ((await jumpTo(starts[i], chunk)) !== 'ok') break;
            collectInto(fresh);
            walked = Object.keys(fresh).length;
            paintChips();
          }
          complete = Object.keys(fresh).length >= total;
        }
      }
    } finally {
      refreshing = false;
    }
    if (complete && Object.keys(fresh).length) {
      writeRows(fresh);
      rebuild();
    }
    setBusy();
  }

  // De rijen zitten in een div van 144px met overflow:hidden terwijl de tabel
  // ruim 500px hoog is. Dat afknippen weghalen, voor als je op origineel klikt.
  // Bewust een stijlregel en geen inline style. OAF laat zijn tabel bij een
  // partial refresh van nul naar volle grootte groeien en zet daarvoor
  // height, width en overflow rechtstreeks op de elementen. Omdat de tabel bij
  // ons verborgen staat maakt hij die animatie nooit af, en dan is de
  // oorspronkelijke tabel na een ophaalronde nul bij nul: rijen wel in de DOM,
  // niets te zien. Een regel met !important overleeft zowel de inline waarden
  // als het vervangen van de knopen.
  function unclip() {
    if (byId('iexpUnclip')) return;
    var id = 'contentDiv:' + TABLE;
    var style = document.createElement('style');
    style.id = 'iexpUnclip';
    var esc = function (value) { return value.replace(/[:.]/g, '\\$&'); };
    style.textContent =
      '#' + esc(id) + '{height:auto!important;max-height:none!important;' +
      'width:auto!important;overflow:visible!important}' +
      '#' + esc(TABLE + ':Content') + '{width:100%!important;table-layout:auto!important}';
    document.head.appendChild(style);
  }

  // De volgorde van de pagina volgt wat je ermee doet en niet wat OAF toevallig
  // rendert. Notificaties eerst, want daar staat wat op je wacht. Dan Update
  // Expense Reports, de tabel waar je echt in werkt. Track Submitted onderaan:
  // wat ingediend is vraagt normaal geen aandacht meer.
  //
  // Alle drie zijn directe kinderen van OIEHomePageContainer, dus de hele
  // herschikking is een reeks insertBefore op één plek: die van de bovenste van
  // de drie, zodat alles wat erboven staat blijft waar het staat.
  var REGION_ORDER = ['WFWorklistRN', 'ActiveReportsRN', 'TrackReportsRN'];

  function orderRegions() {
    var nodes = [];
    var i;
    for (i = 0; i < REGION_ORDER.length; i++) {
      var region = byId(REGION_ORDER[i]);
      if (!region || !region.parentNode) return; // ontbreekt er een, dan niets
      nodes.push(region);
    }
    var parent = nodes[0].parentNode;
    for (i = 1; i < nodes.length; i++) {
      if (nodes[i].parentNode !== parent) return; // niet dezelfde container
    }

    var kids = [].slice.call(parent.children);
    var spots = nodes.map(function (node) { return kids.indexOf(node); });
    var ordered = true;
    for (i = 1; i < spots.length; i++) {
      if (spots[i] < spots[i - 1]) ordered = false;
    }
    if (ordered) return; // staat al goed, niets aanraken

    var marker = document.createComment('iexp');
    parent.insertBefore(marker, kids[Math.min.apply(null, spots)]);
    for (i = 0; i < nodes.length; i++) parent.insertBefore(nodes[i], marker);
    parent.removeChild(marker);
  }

  // ------------------------------------------------------------------- init

  function init(tries) {
    if (!contentTable()) return; // niet de Expenses Home pagina
    // Zonder de kopregel van OAF valt er niets over te nemen. Gemeten met een
    // teller: onder @run-at document-idle staat hij er altijd meteen, dus dit
    // is een vangnet en geen gewoon pad.
    if (!oafHeadRow()) {
      if (tries > 0) setTimeout(function () { init(tries - 1); }, 400);
      return;
    }
    orderRegions();
    if (!buildPanel()) return;

    unclip();

    // Meteen tonen wat er is: de cache van deze sessie, aangevuld met het
    // zichtbare venster, dat sowieso vers is.
    var rows = readRows();
    collectInto(rows);
    writeRows(rows);
    rebuild();

    hideOriginal();

    // Even laten bezinken: vlak na een paginalading slikt OAF de eerste
    // navigatie stilzwijgend in.
    setTimeout(refreshAll, 1500);
  }

  init(10);
})();
