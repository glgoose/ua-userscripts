// ==UserScript==
// @name         BIPP: sneltoets Ctrl+B voor Bevestigen
// @namespace    https://github.com/glgoose/ua-userscripts
// @version      1.0.0
// @description  Ctrl+B drukt op Bevestigen. De B in de knop is onderstreept en bij ingedrukte Ctrl verschijnt Ctrl+B boven de knop.
// @author       glgoose
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/glgoose/ua-userscripts/tree/main/scripts/bipp-sneltoetsen
// @supportURL   https://github.com/glgoose/ua-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/bipp-sneltoetsen/bipp-sneltoetsen.user.js
// @updateURL    https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/bipp-sneltoetsen/bipp-sneltoetsen.user.js
// @match        https://bipp.biotechpartner.be/web/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  'use strict';

  var LABEL = 'bevestigen';
  var HINT = 'Ctrl+B';
  var MARK = 'data-bipp-sneltoets';

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }

  // Eerste zichtbare, actieve knop met dit label. Een postback-pagina kan er verborgen kopieën van hebben.
  function findButton() {
    var btns = document.querySelectorAll('input[type="submit"], input[type="button"], button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (norm(b.value || b.textContent) === LABEL && !b.disabled && visible(b)) return b;
    }
    return null;
  }

  // <button>: de B in een <u>. <input> kan geen HTML bevatten, dus daar komt een lijntje over de letter.
  function underline(btn) {
    if (btn.getAttribute(MARK)) return;
    btn.setAttribute(MARK, '1');
    if (!btn.title) btn.title = HINT;
    if (btn.tagName === 'BUTTON' && btn.children.length === 0) {
      var t = btn.textContent;
      var i = t.toLowerCase().indexOf('b');
      btn.textContent = '';
      btn.appendChild(document.createTextNode(t.slice(0, i)));
      var u = document.createElement('u');
      u.textContent = t.charAt(i);
      btn.appendChild(u);
      btn.appendChild(document.createTextNode(t.slice(i + 1)));
      return;
    }
    drawLine(btn);
    window.addEventListener('resize', function () { drawLine(btn); });
  }

  function drawLine(btn) {
    var old = btn.nextSibling && btn.nextSibling.getAttribute && btn.nextSibling.getAttribute(MARK + '-line');
    if (old) btn.parentNode.removeChild(btn.nextSibling);
    var cs = getComputedStyle(btn);
    var ctx = document.createElement('canvas').getContext('2d');
    ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var text = btn.value || btn.textContent;
    var i = text.toLowerCase().indexOf('b');
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

  var tip = null;
  function showTip() {
    var btn = findButton();
    if (!btn) return;
    hideTip();
    var r = btn.getBoundingClientRect();
    tip = document.createElement('span');
    tip.textContent = HINT;
    tip.style.cssText = 'position:absolute;z-index:99999;pointer-events:none;white-space:nowrap;' +
      'font:11px ui-monospace,Menlo,Consolas,monospace;background:#1f2937;color:#fff;border-radius:4px;padding:1px 6px;' +
      'left:' + (r.left + window.scrollX + r.width / 2) + 'px;top:' + (r.top + window.scrollY - 22) + 'px;transform:translateX(-50%)';
    document.body.appendChild(tip);
  }
  function hideTip() { if (tip && tip.parentNode) tip.parentNode.removeChild(tip); tip = null; }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Control') { if (!e.repeat) showTip(); return; }
    if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.code === 'KeyB') {
      var btn = findButton();
      if (!btn) return;
      e.preventDefault();
      hideTip();
      btn.click();
    }
  }, true);
  document.addEventListener('keyup', function (e) { if (e.key === 'Control') hideTip(); }, true);
  window.addEventListener('blur', hideTip);

  // De pagina bouwt de knoppen soms pas na een postback op: probeer het een paar keer.
  var tries = 0;
  (function init() {
    var btn = findButton();
    if (btn) { underline(btn); return; }
    if (++tries < 30) setTimeout(init, 500);
  })();
})();
