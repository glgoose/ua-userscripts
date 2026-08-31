// ==UserScript==
// @name         BIPP: budgetcode in het winkelmandje
// @namespace    https://github.com/glgoose/ua-userscripts
// @version      1.5.0
// @description  Zet de budgetcode als dropdown in de winkelmandjerij zelf, onder de grootboekrekening, zodat je niet meer via de aparte pagina Selectie analytische velden moet en de gekozen code ook gewoon ziet staan. Slaat op via een achtergrond-postback en vult de code aan in Interne commentaar.
// @author       Glenn Goossens
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/glgoose/ua-userscripts/tree/main/scripts/bipp-budgetcode
// @supportURL   https://github.com/glgoose/ua-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/bipp-budgetcode/bipp-budgetcode.user.js
// @updateURL    https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/bipp-budgetcode/bipp-budgetcode.user.js
// @match        https://bipp.biotechpartner.be/web/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// BIPP zet de gekozen analytische velden nergens leesbaar in de rij. De waarde staat er wel
// al: de link SpecifyAF krijgt title="budgetcode: 10-AD010000-CFALWERK, ". Die tooltip is de
// bron van waarheid, niet de linktekst, want die blijft groen "Bekijk" staan ook nadat de
// waarde weer op leeg is gezet.
//
// Opslaan gebeurt met dezelfde drie postbacks die je vandaag handmatig doet, maar via fetch.
// Omdat de eerste POST het live formulier serialiseert, gaat getypt werk dat nog niet
// opgeslagen is niet verloren: het gaat mee naar de server, precies zoals bij een echte
// postback. Na de keten wisselen we de verse viewstate in de pagina, zodat een volgende echte
// postback niet struikelt.

(function () {
  'use strict';

  var SELECTOR_URL = 'AnalyticalFieldSelector.aspx';
  var CACHE_KEY = 'bippBudgetcodeOptions';
  var TTL_MS = 7 * 24 * 60 * 60 * 1000;
  var EMPTY_LABEL = 'budgetcode';

  // ---------- kleine hulpjes ----------

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function text(el) { return el ? (el.textContent || '').trim() : ''; }

  function participant() { return text(document.getElementById('company')); }

  function isCartPage() {
    return !!document.getElementById('resultTable') && qsa('a[id$="_SpecifyAF"]').length > 0;
  }
  function isSelectorPage() {
    return !!qs('select[id$="_analyticalFieldValue"]') && !!document.getElementById('SaveBtn');
  }

  // ---------- cache van de optielijst ----------

  function readCache() {
    var raw;
    try { raw = localStorage.getItem(CACHE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return null; }
    if (!data || !data.options || !data.options.length) return null;
    if (Date.now() - (data.ts || 0) > TTL_MS) return null;
    // De lijst hangt aan de participant, dus niet hergebruiken na een wissel.
    if (data.participant !== participant()) return null;
    return data;
  }

  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* quota, stil */ }
  }

  // Oogst de optielijst en de veldnamen uit een selectorpagina, live of uit een fetch.
  function harvest(doc) {
    var sels = qsa('select[id$="_analyticalFieldValue"]', doc);
    if (!sels.length) return null;

    var names = [];
    qsa('tr', doc.getElementById('analyticalFieldsTable') || doc).forEach(function (tr) {
      if (qs('select[id$="_analyticalFieldValue"]', tr) && tr.cells && tr.cells.length) {
        names.push(text(tr.cells[0]));
      }
    });

    var options = [];
    var o = sels[0].options;
    for (var i = 0; i < o.length; i++) options.push([o[i].value, o[i].text]);

    var comp = doc.getElementById('company');
    var data = {
      ts: Date.now(),
      participant: comp ? text(comp) : participant(),
      fields: names.length ? names : ['budgetcode'],
      options: options
    };
    writeCache(data);
    return data;
  }

  var loading = null;
  function loadOptions() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);
    if (loading) return loading;
    loading = fetch(SELECTOR_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (t) {
        var data = harvest(new DOMParser().parseFromString(t, 'text/html'));
        if (!data) throw new Error('optielijst niet gevonden');
        return data;
      });
    loading['catch'](function () { loading = null; });
    return loading;
  }

  // ---------- formulier posten ----------

  function serialize(form, extra) {
    var params = new URLSearchParams();
    var entries = new FormData(form).entries();
    var e = entries.next();
    while (!e.done) {
      // Bestandsvelden overslaan, die horen niet in een urlencoded body.
      if (typeof e.value[1] === 'string') params.append(e.value[0], e.value[1]);
      e = entries.next();
    }
    for (var k in (extra || {})) {
      if (Object.prototype.hasOwnProperty.call(extra, k)) params.set(k, extra[k]);
    }
    return params;
  }

  function postForm(url, params) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (t) {
      return new DOMParser().parseFromString(t, 'text/html');
    });
  }

  // De sessie houdt maar één "huidige regel" bij voor analytische velden, dus nooit twee
  // ketens tegelijk laten lopen.
  var queue = Promise.resolve();
  function enqueue(fn) {
    queue = queue['catch'](function () { /* vorige fout blokkeert de volgende niet */ }).then(fn);
    return queue;
  }

  function syncHidden(doc) {
    ['__VIEWSTATE', '__EVENTVALIDATION', '__VIEWSTATEGENERATOR'].forEach(function (name) {
      var live = document.getElementById(name);
      var fresh = doc.getElementById(name);
      if (live && fresh) live.value = fresh.value;
    });
  }

  function saveCode(row, code) {
    var form = document.forms[0];
    return postForm(form.getAttribute('action') || location.pathname,
      serialize(form, { '__EVENTTARGET': row.target, '__EVENTARGUMENT': '' })
    ).then(function (doc) {
      var sel = qs('select[id$="_analyticalFieldValue"]', doc);
      if (!sel) throw new Error('selectorpagina niet gekregen');
      harvest(doc);
      sel.value = code;
      if (sel.value !== code) throw new Error('onbekende code');
      return postForm(SELECTOR_URL, serialize(doc.forms[0], { 'SaveBtn': 'Opslaan' }));
    }).then(function (doc) {
      var sel = qs('select[id$="_analyticalFieldValue"]', doc);
      if (!sel || sel.value !== code) throw new Error('server bevestigde de waarde niet');
      return postForm(SELECTOR_URL, serialize(doc.forms[0], { 'BackBtn': 'Terug' }));
    }).then(function (doc) {
      if (!doc.getElementById('resultTable')) throw new Error('winkelmandje niet teruggekregen');
      syncHidden(doc);
      // Alleen de cel bijwerken. De server rendert een volledig nieuw winkelmandje en dat
      // erover kopiëren zou onze injectie en de select-search-wrappers slopen.
      var fresh = doc.getElementById(row.link.id);
      if (fresh) {
        row.link.textContent = fresh.textContent;
        row.link.setAttribute('style', fresh.getAttribute('style') || '');
        if (fresh.getAttribute('title')) row.link.setAttribute('title', fresh.getAttribute('title'));
        else row.link.removeAttribute('title');
      }
      return doc;
    });
  }

  // ---------- rij uitlezen ----------

  function parseTip(link) {
    var raw = link.getAttribute('title') || '';
    var out = {};
    raw.split(/,\s*/).forEach(function (part) {
      var i = part.indexOf(':');
      if (i <= 0) return;
      var value = part.slice(i + 1).trim();
      if (value) out[part.slice(0, i).trim()] = value;
    });
    return out;
  }

  function currentCode(row) {
    var tip = parseTip(row.link);
    for (var k in tip) { if (Object.prototype.hasOwnProperty.call(tip, k)) return tip[k]; }
    return '';
  }

  function ledgerSet(row) {
    var v = row.ledger ? row.ledger.value : '';
    return !!v && v !== '-1';
  }

  function rows() {
    return qsa('a[id$="_SpecifyAF"]').map(function (link) {
      var m = /WebForm_PostBackOptions\("([^"]+)"/.exec(link.getAttribute('href') || '');
      var tr = link.closest('tr');
      return {
        link: link,
        tr: tr,
        td: link.closest('td'),
        target: m ? m[1].replace(/:/g, '$') : null,
        ledger: tr ? qs('select[id$="_interfaceAccountList"]', tr) : null,
        comment: tr ? qs('textarea[id$="_internalComment"]', tr) : null,
        article: tr ? text(qs('span[id$="_ArticleCode"]', tr)) : ''
      };
    }).filter(function (row) {
      if (!row.target || !row.td) return false;
      // Het script kan twee keer draaien (geinstalleerd plus handmatig geinjecteerd, of in een
      // frame). Staat de dropdown er al, dan laten we die rij met rust in plaats van er een
      // tweede naast te zetten.
      return !qs('div[data-bipp-budgetcode]', row.td);
    });
  }

  // ---------- Interne commentaar ----------

  function commentKey(row) { return 'bippBudgetcodeComment:' + (row.article || row.link.id); }

  function rememberWritten(row, code) {
    try {
      if (code) sessionStorage.setItem(commentKey(row), code);
      else sessionStorage.removeItem(commentKey(row));
    } catch (e) { /* stil */ }
  }
  function lastWritten(row) {
    try { return sessionStorage.getItem(commentKey(row)) || ''; } catch (e) { return ''; }
  }

  // Alleen de budgetcode komt in Interne commentaar, op een eigen regel. Bestaande tekst zoals
  // een OZ-nummer blijft staan. Een eerder door ons weggeschreven regel wordt vervangen in
  // plaats van dat er een tweede bijkomt.
  function updateComment(row, code) {
    var ta = row.comment;
    if (!ta) return;
    if (!ledgerSet(row)) return;

    var prev = lastWritten(row);
    var lines = (ta.value || '').split('\n');
    var at = -1;
    if (prev) {
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].trim() === prev) { at = i; break; }
      }
    }

    if (at >= 0) {
      if (code) lines[at] = code;
      else lines.splice(at, 1);
      ta.value = lines.join('\n');
    } else if (code) {
      var already = lines.some(function (l) { return l.trim() === code; });
      if (!already) ta.value = ta.value ? ta.value + '\n' + code : code;
    }

    rememberWritten(row, code);
  }

  // ---------- UI in de rij ----------

  // Monochrome inline SVG op currentColor: geen emoji, want die worden per platform in kleur
  // gerenderd. Twee lijnen, geen vulling.
  var ICONS = {
    bezig: '<path d="M4.5 2h7M4.5 14h7M5.5 2v2.2c0 1.6 2.5 2.3 2.5 3.8s-2.5 2.2-2.5 3.8V14' +
      'M10.5 2v2.2c0 1.6-2.5 2.3-2.5 3.8s2.5 2.2 2.5 3.8V14"/>',
    fout: '<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6v4.2M8 11.4v.2"/>'
  };

  function icon(name) {
    if (!name) return '';
    return '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>';
  }

  // Alles wat later van toestand wisselt krijgt hier al zijn plek, ook als het leeg is. Zo
  // verschuift er nooit iets: het icoonvak bestaat altijd, de link staat altijd op dezelfde
  // hoogte, en statusmeldingen komen nooit in de tekstflow terecht.
  function ui(row) {
    if (row.ui) return row.ui;

    var box = document.createElement('div');
    box.setAttribute('data-bipp-budgetcode', '1');
    // Ademruimte boven (grootboekrekening) en onder (vendor-link).
    box.style.margin = '5px 0 3px';

    // Voetregel: de bestaande vendor-link links, het icoonvak rechts. De link verhuist mee
    // maar blijft dezelfde node, want saveCode werkt hem chirurgisch bij op id.
    var foot = document.createElement('div');
    foot.style.display = 'flex';
    foot.style.alignItems = 'center';
    foot.style.justifyContent = 'space-between';
    foot.style.marginTop = '3px';

    var slot = document.createElement('span');
    slot.style.display = 'inline-flex';
    slot.style.width = '14px';
    slot.style.height = '14px';
    slot.style.alignItems = 'center';
    slot.style.justifyContent = 'center';
    slot.style.flex = '0 0 14px';

    // Anker op de directe ouder van de link, niet op de td: BIPP wikkelt de link in een
    // eigen div en dan is hij geen kind van de cel.
    var host = row.link.parentNode;
    host.insertBefore(box, row.link);
    host.insertBefore(foot, row.link);
    foot.appendChild(row.link);
    foot.appendChild(slot);

    row.ui = { box: box, foot: foot, slot: slot, select: null };
    return row.ui;
  }

  // De zichtbare dropdowntekst zit na verrijking door select-search in een shadow root, dus
  // color op de native select doet dan niets. Opacity op de wrapper erft wel door.
  function skin(row) {
    var u = ui(row);
    if (!u.select) return null;
    var next = u.select.nextSibling;
    if (next && next.className === 'select-search-wrap') return next;
    return u.select;
  }

  function setState(row, state, message) {
    var u = ui(row);
    var target = skin(row);

    u.slot.innerHTML = icon(state === 'rust' ? '' : state);
    u.slot.style.color = state === 'fout' ? '#c33' : '#222';
    // Bezig is grijs, net als de dropdowntekst, zodat de regel als een toestand leest.
    u.slot.style.opacity = state === 'bezig' ? '0.5' : '1';
    u.slot.title = message || '';

    if (target) {
      // Grijs zolang de keten loopt, en niet aanklikbaar. Niet via disabled: select-search
      // legt een eigen invoerveld over de dropdown dat daar niet in meegaat.
      target.style.opacity = state === 'bezig' ? '0.5' : '1';
      target.style.pointerEvents = state === 'bezig' ? 'none' : '';
      if (u.select) {
        u.select.style.outline = state === 'fout' ? '1.5px solid #c33' : '';
        u.select.style.outlineOffset = state === 'fout' ? '-1px' : '';
        u.select.title = message || '';
      }
      if (target !== u.select) {
        target.style.outline = state === 'fout' ? '1.5px solid #c33' : '';
        target.style.outlineOffset = state === 'fout' ? '-1px' : '';
        target.title = message || '';
      }
    }
  }

  function fillOptions(select, data, code) {
    // renderSelect zette de huidige code er als tijdelijke optie in, zodat de dropdown meteen op
    // eindformaat stond. Die moet weg voor de echte lijst erbij komt, anders staat de code er
    // dubbel in. De select zelf blijft dezelfde node, dus dit verschuift niets.
    while (select.children.length > 1) select.removeChild(select.lastChild);

    // Het recent-blok komt van select-search, dat het bovenaan de lijst zet en de dubbels er
    // hier uit haalt. Wij leveren enkel de volledige lijst.
    var all = document.createElement('optgroup');
    all.label = 'alle budgetcodes';
    data.options.forEach(function (e) {
      if (e[0]) all.appendChild(new Option(e[1], e[0]));
    });
    select.appendChild(all);

    select.value = code || '';
  }

  // Meteen op eindformaat, met alleen de huidige waarde erin. De volledige lijst komt er later
  // bij: dan wordt er geen element vervangen en verschuift er dus niets. select-search pikt de
  // dropdown vanzelf op zodra de MIN_OPTIONS-drempel gehaald is, via zijn eigen observer.
  function renderSelect(row) {
    var u = ui(row);
    if (u.select) return u.select;

    var select = document.createElement('select');
    select.className = 'TextBox';
    // Geen name-attribuut: dan serialiseert FormData ons veld niet mee. select-search leidt zijn
    // veldsleutel normaal uit name of id af, dus die krijgt hij hier expliciet mee. Manueel, want
    // een code hoort pas in recent te staan als de server ze aanvaard heeft, zie onPick.
    select.dataset.ssRecent = 'manual';
    select.dataset.ssRecentKey = 'budgetcode';
    select.appendChild(new Option(EMPTY_LABEL, ''));

    var code = currentCode(row);
    if (code) {
      select.appendChild(new Option(code, code));
      select.value = code;
    }

    if (row.ledger) {
      var w = row.ledger.offsetWidth;
      if (w) select.style.width = w + 'px';
    }
    select.style.verticalAlign = 'middle';
    select.style.boxSizing = 'border-box';

    u.box.appendChild(select);
    u.select = select;
    select.addEventListener('change', function () { onPick(row); });
    return select;
  }

  // Programmatisch de waarde zetten. Het change-event is nodig omdat select-search zijn
  // overlay alleen daarop bijwerkt (select-search.js:375); de vlag houdt onPick uit de lus.
  function setValue(row, value) {
    var select = row.ui.select;
    if (select.value === value) return;
    row.syncing = true;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: false }));
    row.syncing = false;
  }

  function onPick(row) {
    var u = ui(row);
    var select = u.select;
    if (row.syncing) return;
    // Tijdens de keten negeren we keuzes, en zetten we terug naar de code die op dat moment
    // opgeslagen wordt, niet naar de vorige: anders toont de rij straks iets anders dan wat
    // er op de server staat.
    if (row.busy) { setValue(row, row.pending || row.savedCode || ''); return; }

    var code = select.value;
    var label = select.selectedIndex >= 0 ? select.options[select.selectedIndex].text : code;
    var before = row.savedCode || '';
    if (code === before) return;

    row.busy = true;
    row.pending = code;
    setState(row, 'bezig', 'bezig met opslaan…');

    // Eerst de commentaar bijwerken, dan pikt de eerste POST van de keten die meteen mee.
    updateComment(row, code);

    enqueue(function () {
      return saveCode(row, code).then(function () {
        row.savedCode = code;
        row.busy = false;
        row.pending = null;
        // De guard kan de zichtbare waarde ondertussen teruggezet hebben.
        setValue(row, code);
        if (code && window.selectSearch && window.selectSearch.remember) {
          window.selectSearch.remember(select, code, label);
        }
        // Geen vinkje. De zandloper verdwijnt en de dropdowntekst wordt weer zwart, en dat is
        // de bevestiging al. Een tick die een seconde later toch weer weggaat voegt niets toe
        // en vraagt aandacht voor iets wat al gelukt is.
        setState(row, 'rust', '');
      })['catch'](function (err) {
        // Terugdraaien in de UI en in de commentaar, de server heeft de waarde niet.
        updateComment(row, before);
        row.busy = false;
        row.pending = null;
        setValue(row, before);
        row.savedCode = before;
        setState(row, 'fout', 'niet opgeslagen: ' +
          (err && err.message ? err.message : 'fout') + '. Gebruik de link ernaast.');
      });
    });
  }

  // ---------- opstarten ----------

  function enhanceCart() {
    var list = rows();
    if (!list.length) return;

    // Eerst de volledige opbouw, met de plek voor het icoon er al in. Daarna komt er niets
    // meer bij en verdwijnt er niets meer, dus verschuift er ook niets meer.
    list.forEach(function (row) {
      row.savedCode = currentCode(row);
      renderSelect(row);
      setState(row, 'rust', '');
      // Staat de code er al serverzijdig en nog niet in de commentaar, dan aanvullen.
      if (row.savedCode) updateComment(row, row.savedCode);
    });

    loadOptions().then(function (data) {
      list.forEach(function (row) {
        var u = ui(row);
        // Meerdere analytische velden kunnen we niet met een enkele dropdown afhandelen, dan
        // laten we de vendor-flow staan.
        if (data.fields && data.fields.length > 1) {
          u.select.disabled = true;
          setState(row, 'fout', 'meerdere analytische velden, gebruik de link ernaast');
          return;
        }
        fillOptions(u.select, data, row.savedCode);
        if (typeof window.__selectSearchScan === 'function') window.__selectSearchScan();
      });
    })['catch'](function (err) {
      list.forEach(function (row) {
        ui(row).select.disabled = true;
        setState(row, 'fout', 'lijst niet geladen: ' +
          (err && err.message ? err.message : 'fout') + '. Gebruik de link ernaast.');
      });
    });
  }

  if (isSelectorPage()) {
    // Gebruikt iemand de vendor-flow toch, dan verversen we de cache gratis.
    harvest(document);
  } else if (isCartPage()) {
    enhanceCart();
  }
}());
