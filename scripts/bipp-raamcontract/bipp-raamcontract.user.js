// ==UserScript==
// @name         BIPP: "Inclusief niet-raamcontractartikelen" standaard aan
// @namespace    https://github.com/glgoose/ua-userscripts
// @version      1.0.0
// @description  Vinkt "Inclusief niet-raamcontractartikelen" aan zodra de zoekpagina laadt.
// @author       glgoose
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/glgoose/ua-userscripts/tree/main/scripts/bipp-raamcontract
// @supportURL   https://github.com/glgoose/ua-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/bipp-raamcontract/bipp-raamcontract.user.js
// @updateURL    https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/bipp-raamcontract/bipp-raamcontract.user.js
// @match        https://bipp.biotechpartner.be/web/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  'use strict';

  var LABEL = 'inclusief niet-raamcontractartikelen';
  var GUARD_KEY = 'bippRaamcontractLast';
  var GUARD_MS = 5000;
  var MAX_WAIT_MS = 15000;

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  function findBox() {
    var boxes = document.querySelectorAll('input[type="checkbox"]');
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      var label = box.labels && box.labels[0];
      var t = norm(label ? label.textContent : box.parentNode && box.parentNode.textContent);
      if (t === LABEL) return box;
    }
    return null;
  }

  // Een klik die een postback met paginaherlaad uitlost, start dit script opnieuw.
  // Staat het vinkje daarna weer uit, dan zou dat eindeloos doorgaan.
  function recentlyClicked() {
    try { return Date.now() - Number(sessionStorage.getItem(GUARD_KEY) || 0) < GUARD_MS; }
    catch (e) { return false; }
  }
  function markClicked() {
    try { sessionStorage.setItem(GUARD_KEY, String(Date.now())); } catch (e) { /* geen opslag */ }
  }

  var obs;
  function stop() { if (obs) obs.disconnect(); }

  function check() {
    var box = findBox();
    if (!box) return false;
    if (!box.checked && !recentlyClicked()) {
      markClicked();
      box.click(); // click, geen .checked = true, zodat de handlers van de app draaien
    }
    return true;
  }

  if (check()) return;
  // De pagina bouwt het formulier soms pas later op.
  obs = new MutationObserver(function () { if (check()) stop(); });
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(stop, MAX_WAIT_MS);
})();
