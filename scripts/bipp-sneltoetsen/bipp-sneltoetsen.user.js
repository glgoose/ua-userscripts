// ==UserScript==
// @name         BIPP: sneltoetsen voor knoppen
// @namespace    https://github.com/glgoose/ua-userscripts
// @version      1.1.2
// @description  Ctrl+letter drukt op Bevestigen (B), Zoeken (Z), Reset (R), Nieuw (N), Opslaan (S), Indienen (I) en Terug (T). De letter is onderstreept en bij ingedrukte Ctrl verschijnt de sneltoets onder de knop.
// @author       glgoose
// @license      GPL-3.0-or-later
// @homepageURL  https://gitea.flw.uantwerpen.be/glenn/ua-userscripts/src/branch/main/scripts/bipp-sneltoetsen
// @supportURL   https://gitea.flw.uantwerpen.be/glenn/ua-userscripts/issues
// @downloadURL  https://gitea.flw.uantwerpen.be/glenn/ua-userscripts/raw/branch/main/scripts/bipp-sneltoetsen/bipp-sneltoetsen.user.js
// @updateURL    https://gitea.flw.uantwerpen.be/glenn/ua-userscripts/raw/branch/main/scripts/bipp-sneltoetsen/bipp-sneltoetsen.user.js
// @match        https://bipp.biotechpartner.be/web/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  'use strict';

  // Knoplabel (kleine letters), de letter die onderstreept wordt, en de toets.
  var KEYS = [
    { label: 'bevestigen', letter: 'b', code: 'KeyB' },
    { label: 'zoeken', letter: 'z', code: 'KeyZ' },
    { label: 'reset', letter: 'r', code: 'KeyR' },
    { label: 'nieuw', letter: 'n', code: 'KeyN' },
    { label: 'opslaan', letter: 's', code: 'KeyS' },
    { label: 'indienen', letter: 'i', code: 'KeyI' },
    { label: 'terug', letter: 't', code: 'KeyT' }
  ];
  var MARK = 'data-bipp-sneltoets';

  function hint(k) { return 'Ctrl+' + k.letter.toUpperCase(); }

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }

  // Eerste zichtbare, actieve knop met dit label. Een postback-pagina kan er verborgen kopieën van hebben.
  function findButton(k) {
    var btns = document.querySelectorAll('input[type="submit"], input[type="button"], button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (norm(b.value || b.textContent) === k.label && !b.disabled && visible(b)) return b;
    }
    return null;
  }

  // <button>: de letter in een <u>. <input> kan geen HTML bevatten, dus daar komt een lijntje onder de letter.
  function underline(btn, k) {
    if (btn.getAttribute(MARK)) return;
    btn.setAttribute(MARK, k.letter);
    // BIPP zet soms zelf een title (Bevestigen): dan komt de sneltoets op een eigen regel eronder.
    btn.title = btn.title ? btn.title + '\n' + hint(k) : hint(k);
    if (btn.tagName === 'BUTTON' && btn.children.length === 0) {
      var t = btn.textContent;
      var i = t.toLowerCase().indexOf(k.letter);
      btn.textContent = '';
      btn.appendChild(document.createTextNode(t.slice(0, i)));
      var u = document.createElement('u');
      u.textContent = t.charAt(i);
      btn.appendChild(u);
      btn.appendChild(document.createTextNode(t.slice(i + 1)));
      return;
    }
    drawLine(btn, k);
    window.addEventListener('resize', function () { drawLine(btn, k); });
  }

  function drawLine(btn, k) {
    var old = btn.nextSibling && btn.nextSibling.getAttribute && btn.nextSibling.getAttribute(MARK + '-line');
    if (old) btn.parentNode.removeChild(btn.nextSibling);
    var cs = getComputedStyle(btn);
    var ctx = document.createElement('canvas').getContext('2d');
    ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var text = btn.value || btn.textContent;
    var i = text.toLowerCase().indexOf(k.letter);
    var before = ctx.measureText(text.slice(0, i)).width;
    var letter = ctx.measureText(text.charAt(i)).width;
    var total = ctx.measureText(text).width;
    var inner = btn.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var start = parseFloat(cs.paddingLeft) + btn.clientLeft + Math.max(0, (inner - total) / 2);
    var line = document.createElement('span');
    line.setAttribute(MARK + '-line', '1');
    var fs = parseFloat(cs.fontSize);
    // position:absolute houdt de lijn buiten de flow, dus er verschuift niets.
    line.style.cssText = 'position:absolute;pointer-events:none;height:1px;background:currentColor;color:' + cs.color +
      ';left:' + (btn.offsetLeft + start + before) + 'px;width:' + letter + 'px;top:' +
      (btn.offsetTop + btn.offsetHeight / 2 + fs * 0.55) + 'px';
    btn.parentNode.insertBefore(line, btn.nextSibling);
  }

  var tips = [];
  function showTips() {
    hideTips();
    KEYS.forEach(function (k) {
      var btn = findButton(k);
      if (!btn) return;
      var r = btn.getBoundingClientRect();
      var tip = document.createElement('span');
      tip.textContent = hint(k);
      tip.style.cssText = 'position:absolute;z-index:99999;pointer-events:none;white-space:nowrap;' +
        'font:11px ui-monospace,Menlo,Consolas,monospace;background:#1f2937;color:#fff;border-radius:4px;padding:1px 6px;' +
        'left:' + (r.left + window.scrollX + r.width / 2) + 'px;top:' + (r.bottom + window.scrollY + 4) + 'px;transform:translateX(-50%)';
      document.body.appendChild(tip);
      tips.push(tip);
    });
  }
  function hideTips() {
    tips.forEach(function (t) { if (t.parentNode) t.parentNode.removeChild(t); });
    tips = [];
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Control') { if (!e.repeat) showTips(); return; }
    if (!e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    for (var i = 0; i < KEYS.length; i++) {
      if (e.code !== KEYS[i].code) continue;
      var btn = findButton(KEYS[i]);
      if (!btn) return;
      e.preventDefault();
      hideTips();
      btn.click();
      return;
    }
  }, true);
  document.addEventListener('keyup', function (e) { if (e.key === 'Control') hideTips(); }, true);
  window.addEventListener('blur', hideTips);

  // De pagina bouwt de knoppen soms pas na een postback op: probeer het een paar keer.
  var tries = 0;
  (function init() {
    var left = 0;
    KEYS.forEach(function (k) {
      var btn = findButton(k);
      if (btn) underline(btn, k); else left++;
    });
    if (left && ++tries < 30) setTimeout(init, 500);
  })();
})();
