// ==UserScript==
// @name         BIPP: budgetverantwoordelijke standaard op de ingelogde gebruiker
// @namespace    https://github.com/glgoose/ua-userscripts
// @version      1.0.0
// @description  Zet "Budget verantwoordelijke" bij Aanvraag evalueren op jezelf in plaats van "Alle" en start de zoekopdracht.
// @author       glgoose
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/glgoose/ua-userscripts/tree/main/scripts/bipp-budgetverantwoordelijke
// @supportURL   https://github.com/glgoose/ua-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/bipp-budgetverantwoordelijke/bipp-budgetverantwoordelijke.user.js
// @updateURL    https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/bipp-budgetverantwoordelijke/bipp-budgetverantwoordelijke.user.js
// @match        https://bipp.biotechpartner.be/web/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  'use strict';

  var LABEL = 'budget verantwoordelijke';
  var FLAG_KEY = 'bippBudgetverantwoordelijkeToegepast';
  var SEARCH_DELAY_MS = 1500;

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  // "Glenn Goossens" in de kop en "Goossens Glenn" in de lijst: vergelijk de woorden, niet de volgorde.
  function words(s) {
    return norm(s.replace(/[^A-Za-zÀ-ÿ\s-]/g, ' ')).split(' ').filter(Boolean).sort();
  }

  function findSelect() {
    var cells = document.querySelectorAll('td, th, label, span, div');
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].children.length === 0 && norm(cells[i].textContent) === LABEL) {
        var row = cells[i].closest('tr') || cells[i].parentNode;
        var sel = row && row.querySelector('select');
        if (sel) return sel;
      }
    }
    return null;
  }

  function findOption(select, name) {
    var me = words(name);
    var opts = Array.prototype.slice.call(select.options);
    var exact = opts.filter(function (o) {
      var w = words(o.text);
      return w.length === me.length && w.every(function (x, i) { return x === me[i]; });
    })[0];
    if (exact) return exact;
    return opts.filter(function (o) {
      var w = words(o.text);
      return w.length > 0 && me.every(function (x) { return w.indexOf(x) !== -1; });
    })[0];
  }

  var select = findSelect();

  // Een pagina zonder dit veld wist de vlag, zodat het volgende bezoek weer de standaard zet.
  if (!select) {
    try { sessionStorage.removeItem(FLAG_KEY); } catch (e) { /* geen opslag */ }
    return;
  }

  // Na de zoekopdracht laadt dezelfde pagina opnieuw: een bewuste keuze van "Alle" blijft dan staan.
  try { if (sessionStorage.getItem(FLAG_KEY)) return; } catch (e) { /* geen opslag */ }

  var current = select.options[select.selectedIndex];
  if (!current || norm(current.text) !== 'alle') return;

  var m = document.body.innerText.match(/Welkom\s+(.+?)\s+-\s/);
  if (!m) { console.warn('[bipp-budgetverantwoordelijke] geen "Welkom <naam> -" in de kop'); return; }
  var option = findOption(select, m[1]);
  if (!option) { console.warn('[bipp-budgetverantwoordelijke] geen optie voor', m[1]); return; }

  try { sessionStorage.setItem(FLAG_KEY, '1'); } catch (e) { /* geen opslag */ }
  select.value = option.value;
  select.dispatchEvent(new Event('change', { bubbles: true }));

  // De dropdown heeft geen autopostback: druk zelf op Zoeken.
  setTimeout(function () {
    var btns = document.querySelectorAll('input[type="submit"], input[type="button"], button');
    for (var i = 0; i < btns.length; i++) {
      if (norm(btns[i].value || btns[i].textContent) === 'zoeken') { btns[i].click(); return; }
    }
  }, SEARCH_DELAY_MS);
})();
