// ==UserScript==
// @name         BIPP: budgetverantwoordelijke standaard op de ingelogde gebruiker
// @namespace    https://github.com/glgoose/ua-userscripts
// @version      1.1.0
// @description  Zet "Budget verantwoordelijke" bij Aanvraag evalueren en "Aanvrager" bij Aanvragen op jezelf in plaats van "Alle" en start de zoekopdracht.
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

  // Eén filter per scherm. De id's staan vast: op Aanvragen deelt "Aanvrager" een rij met "Status
  // aanvraag", dus de eerste select naast een label is daar de verkeerde.
  var FILTERS = [
    { id: 'qBudgetOwner', name: 'budget verantwoordelijke' }, // Aanvraag evalueren
    { id: 'qRequestor', name: 'aanvrager' }                   // Aanvragen
  ];
  var FLAG_PREFIX = 'bippFilterToegepast:';
  var SEARCH_DELAY_MS = 1500;

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  // "Glenn Goossens" in de kop en "Goossens Glenn" in de lijst: vergelijk de woorden, niet de volgorde.
  function words(s) {
    return norm(s.replace(/[^A-Za-zÀ-ÿ\s-]/g, ' ')).split(' ').filter(Boolean).sort();
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

  function flagged(id) {
    try { return !!sessionStorage.getItem(FLAG_PREFIX + id); } catch (e) { return false; }
  }
  function setFlag(id, on) {
    try {
      if (on) sessionStorage.setItem(FLAG_PREFIX + id, '1');
      else sessionStorage.removeItem(FLAG_PREFIX + id);
    } catch (e) { /* geen opslag */ }
  }

  // Een pagina zonder dit veld wist de vlag, zodat het volgende bezoek weer de standaard zet.
  var present = FILTERS.filter(function (f) {
    var there = !!document.getElementById(f.id);
    if (!there) setFlag(f.id, false);
    return there;
  });
  if (!present.length) return;

  var m = document.body.innerText.match(/Welkom\s+(.+?)\s+-\s/);
  if (!m) { console.warn('[bipp-budgetverantwoordelijke] geen "Welkom <naam> -" in de kop'); return; }

  var changed = false;
  present.forEach(function (f) {
    // Na de zoekopdracht laadt dezelfde pagina opnieuw: een bewuste keuze van "Alle" blijft dan staan.
    if (flagged(f.id)) return;

    var select = document.getElementById(f.id);
    var current = select.options[select.selectedIndex];
    if (!current || norm(current.text) !== 'alle') return;

    var option = findOption(select, m[1]);
    if (!option) { console.warn('[bipp-budgetverantwoordelijke] geen optie voor', m[1], 'bij', f.name); return; }

    setFlag(f.id, true);
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    changed = true;
  });
  if (!changed) return;

  // De dropdown heeft geen autopostback: druk zelf op Zoeken.
  setTimeout(function () {
    var btns = document.querySelectorAll('input[type="submit"], input[type="button"], button');
    for (var i = 0; i < btns.length; i++) {
      if (norm(btns[i].value || btns[i].textContent) === 'zoeken') { btns[i].click(); return; }
    }
  }, SEARCH_DELAY_MS);
})();
