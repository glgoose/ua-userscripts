// ==UserScript==
// @name         BIPP: doorzoekbare dropdowns
// @namespace    https://github.com/glgoose/ua-userscripts
// @version      1.5.0
// @description  Geeft elke <select> met veel opties een zoekveld met substring-zoeken.
// @author       glgoose
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/glgoose/ua-userscripts/tree/main/scripts/select-search
// @supportURL   https://github.com/glgoose/ua-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/select-search/select-search.user.js
// @updateURL    https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/select-search/select-search.user.js
// @match        https://bipp.biotechpartner.be/web/*
// @run-at       document-idle
// @grant        none
// @noframes     false
// ==/UserScript==
/*
 * select-search - maakt elke <select> met veel opties doorzoekbaar.
 *
 * Het originele <select> blijft in de DOM en blijft de bron van waarheid:
 * het wordt enkel visueel verborgen. Selecteren gebeurt via selectedIndex +
 * native input/change events, zodat de applicatie niets merkt van de ingreep.
 */
(function () {
  'use strict';

  if (window.__selectSearchLoaded) {
    if (typeof window.__selectSearchScan === 'function') window.__selectSearchScan();
    return;
  }
  window.__selectSearchLoaded = true;

  // kleinere dropdowns laten we met rust; hoogstens MAX_RENDER treffers tekenen
  var MIN_OPTIONS = 10;
  var MAX_RENDER = 200;
  var uid = 0;

  /* ---------------------------------------------------------------- utils */

  function normMap(s) {
    // Genormaliseerde (accentloze, lowercase) string + index-mapping terug
    // naar de originele string, zodat we treffers kunnen highlighten.
    var out = '', map = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      for (var j = 0; j < c.length; j++) { out += c.charAt(j); map.push(i); }
    }
    return { n: out, map: map };
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function tokenize(q) {
    return normMap(q).n.split(/\s+/).filter(function (t) { return t.length > 0; });
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn(); }, ms);
    };
  }

  /* ------------------------------------------------------------ highlight */

  function highlight(item, tokens) {
    if (!tokens.length) return escapeHtml(item.label);
    var ranges = [];
    for (var t = 0; t < tokens.length; t++) {
      var tok = tokens[t], from = 0, idx;
      while ((idx = item.norm.n.indexOf(tok, from)) !== -1) {
        var start = item.norm.map[idx];
        var end = item.norm.map[idx + tok.length - 1] + 1;
        ranges.push([start, end]);
        from = idx + tok.length;
      }
    }
    if (!ranges.length) return escapeHtml(item.label);
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [ranges[0].slice()];
    for (var r = 1; r < ranges.length; r++) {
      var last = merged[merged.length - 1];
      if (ranges[r][0] <= last[1]) last[1] = Math.max(last[1], ranges[r][1]);
      else merged.push(ranges[r].slice());
    }
    var html = '', pos = 0;
    for (var m = 0; m < merged.length; m++) {
      html += escapeHtml(item.label.slice(pos, merged[m][0]));
      html += '<mark>' + escapeHtml(item.label.slice(merged[m][0], merged[m][1])) + '</mark>';
      pos = merged[m][1];
    }
    return html + escapeHtml(item.label.slice(pos));
  }

  /* ----------------------------------------------------------------- css */

  var CSS = [
    ':host{all:initial;display:inline-block;vertical-align:middle;max-width:100%}',
    '*{box-sizing:border-box;font:inherit}',
    '.box{position:relative;display:block;width:100%}',
    'input{width:100%;padding:2px 22px 2px 4px;border:1px solid #767676;border-radius:2px;',
    'background:#fff;color:#000;font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;',
    'height:100%;min-height:22px}',
    'input:focus{outline:none;border-color:#0b57d0;box-shadow:0 0 0 1px #0b57d0}',
    // #767676 haalt net de AA-drempel op wit; het #777 van li.kop zit er net onder.
    'input::placeholder{color:#767676;opacity:1}',
    '.caret{position:absolute;right:6px;top:50%;transform:translateY(-50%);pointer-events:none;',
    'border:4px solid transparent;border-top-color:#444;margin-top:2px}',
    // Het kruisje neemt de plek van het pijltje in en krijgt dus geen eigen ruimte. Zo blijft de
    // volle breedte voor de tekst, staat er nooit een leeg gat, en verschuift er evenmin iets:
    // enkel de zichtbaarheid van de twee wisselt. Zo doet Ant Design het ook.
    '.wis{position:absolute;right:2px;top:50%;transform:translateY(-50%);width:17px;height:17px;',
    'display:flex;align-items:center;justify-content:center;color:#767676;cursor:pointer;',
    'visibility:hidden}',
    '.box.wisbaar.gevuld:hover .wis,.box.wisbaar.gevuld:focus-within .wis{visibility:visible}',
    '.box.wisbaar.gevuld:hover .caret,.box.wisbaar.gevuld:focus-within .caret{visibility:hidden}',
    '.wis:hover{color:#000}',
    'ul{position:fixed;z-index:2147483647;margin:0;padding:2px 0;list-style:none;overflow-y:auto;',
    'background:#fff;color:#000;border:1px solid #b0b0b0;border-radius:3px;',
    'box-shadow:0 4px 14px rgba(0,0,0,.22);',
    'font:13px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;display:none}',
    'ul.open{display:block}',
    'li{padding:3px 8px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    'li.kop{padding:6px 8px 2px;color:#777;font-size:11px;font-weight:600;cursor:default}',
    'li.active{background:#0b57d0;color:#fff}',
    'li.active mark{background:#ffe08a;color:#000}',
    'li.dis{color:#999;cursor:default}',
    'li.note{color:#666;cursor:default;font-style:italic;padding-top:5px}',
    'li.empty{color:#666;cursor:default}',
    'mark{background:#ffe08a;color:inherit;padding:0}'
  ].join('');

  /* ------------------------------------------------------------- enhance */

  function enhance(select) {
    var doc = select.ownerDocument;
    var win = doc.defaultView || window;
    var id = 'ss' + (++uid);

    var rect = select.getBoundingClientRect();
    var wrap = doc.createElement('span');
    wrap.className = 'select-search-wrap';
    if (rect.width) wrap.style.width = rect.width + 'px';
    if (rect.height) wrap.style.height = rect.height + 'px';
    select.parentNode.insertBefore(wrap, select.nextSibling);

    var root = wrap.attachShadow({ mode: 'open' });
    var style = doc.createElement('style');
    style.textContent = CSS;
    var box = doc.createElement('span');
    box.className = 'box';
    var input = doc.createElement('input');
    input.type = 'text';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', id + '-list');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.title = 'Typ om te zoeken. Alt+klik zet het originele keuzemenu terug.';
    var caret = doc.createElement('span');
    caret.className = 'caret';
    // Wissen gebeurt met een kruisje in het veld, zoals in react-select, MUI en Ant Design, en
    // niet met een "geen waarde"-rij bovenaan de lijst. Ant Design toont het kruisje pas bij
    // hover, dat doen wij ook, met focus erbij zodat het toetsenbord niet in de kou staat.
    var wis = doc.createElement('span');
    wis.className = 'wis';
    wis.setAttribute('role', 'button');
    wis.setAttribute('aria-label', 'Wissen');
    wis.innerHTML = '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" '
      + 'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">'
      + '<path d="M2.5 2.5l7 7M9.5 2.5l-7 7"/></svg>';
    var list = doc.createElement('ul');
    list.id = id + '-list';
    list.setAttribute('role', 'listbox');
    box.appendChild(input);
    box.appendChild(wis);
    box.appendChild(caret);
    root.appendChild(style);
    root.appendChild(box);
    root.appendChild(list);

    // Origineel blijft bestaan (form submit, app-code), maar onzichtbaar.
    var prevStyle = select.getAttribute('style');
    select.style.position = 'absolute';
    select.style.opacity = '0';
    select.style.pointerEvents = 'none';
    select.style.width = (rect.width || 1) + 'px';
    select.style.height = (rect.height || 1) + 'px';
    select.dataset.ssEnhanced = '1';

    var items = [], shown = [], active = -1, open = false;
    // De zoekterm apart bijhouden. input.value is niet hetzelfde: bij een open lijst zonder
    // dat er getypt is staat daar het gekozen label in (geselecteerd, klaar om over te typen),
    // terwijl de lijst volledig is. Wie input.value als zoekterm leest, denkt dus dat er
    // gefilterd wordt op iets wat de gebruiker nooit intypte.
    var zoek = '';
    // Index van de optie met een lege waarde, de "niets gekozen"-stand. Die optie is geen keuze:
    // hij komt niet in de lijst, maar levert de placeholder en is het doel van het kruisje.
    var leegIndex = -1, leegLabel = '';

    function readOptions() {
      items = [];
      leegIndex = -1;
      leegLabel = '';
      // De volgorde van de optgroups bepaalt de volgorde van de blokken in de lijst, ook na
      // filteren. Opties zonder groep houden gi 0 en blijven dus vooraan.
      var groepen = [], gi;
      for (var i = 0; i < select.options.length; i++) {
        var o = select.options[i];
        var label = (o.textContent || '').replace(/\s+/g, ' ').trim();
        if (!o.value) {
          if (leegIndex === -1) { leegIndex = i; leegLabel = label; }
          continue;
        }
        var groep = o.parentNode && o.parentNode.tagName === 'OPTGROUP' ? o.parentNode : null;
        var grp = groep ? (groep.label || '') : '';
        if (!grp) gi = 0;
        else {
          gi = groepen.indexOf(grp);
          if (gi === -1) { groepen.push(grp); gi = groepen.length; } else gi += 1;
        }
        items.push({
          index: i,
          label: label,
          group: grp,
          gi: gi,
          disabled: o.disabled,
          // Wie de opties levert bepaalt of een regel weg mag, met data-removable op de optie of
          // op haar optgroup. Het script weet niet wat verwijderen betekent en doet het dus ook
          // niet zelf: het meldt enkel dat de gebruiker erom vraagt.
          removable: !!(o.dataset.removable || (groep && groep.dataset.removable)),
          // Enkel het label is doorzoekbaar: de groepsnaam staat als kopregel op het scherm en
          // hoort niet stilzwijgend mee te zoeken. highlight() mapt de treffers bovendien terug
          // op label, dus een treffer in de groepsnaam zou buiten het label vallen.
          norm: normMap(label)
        });
      }
    }

    function currentLabel() {
      var o = select.options[select.selectedIndex];
      // Staat de lege optie aan, dan is het veld leeg en neemt de placeholder het over. Anders
      // zou "budgetcode" er als gewone zwarte waarde staan, alsof er wel iets gekozen is.
      if (!o || !o.value) return '';
      return (o.textContent || '').replace(/\s+/g, ' ').trim();
    }

    // Het kruisje hoort alleen te bestaan waar wissen ook kan, en alleen zichtbaar te zijn als er
    // iets te wissen valt. De hover- en focusvoorwaarde staat in de CSS.
    function updateWis() {
      box.classList.toggle('wisbaar', leegIndex !== -1);
      box.classList.toggle('gevuld', !!currentLabel());
    }

    function syncFromSelect() {
      readOptions();
      input.placeholder = select.getAttribute('data-placeholder') || leegLabel;
      updateWis();
      if (!open) input.value = currentLabel();
    }

    function clear() {
      if (leegIndex === -1) return;
      select.selectedIndex = leegIndex;
      input.value = '';
      updateWis();
      closeList(false);
      fire(select, 'input');
      fire(select, 'change');
    }

    function position() {
      var r = input.getBoundingClientRect();
      var below = win.innerHeight - r.bottom - 6;
      var above = r.top - 6;
      var down = below >= 160 || below >= above;
      list.style.left = r.left + 'px';
      list.style.minWidth = r.width + 'px';
      list.style.maxWidth = Math.max(r.width, Math.min(560, win.innerWidth - r.left - 8)) + 'px';
      list.style.maxHeight = Math.max(120, (down ? below : above)) + 'px';
      if (down) {
        list.style.top = r.bottom + 2 + 'px';
        list.style.bottom = 'auto';
      } else {
        list.style.top = 'auto';
        list.style.bottom = (win.innerHeight - r.top + 2) + 'px';
      }
    }

    function filter(q) {
      var tokens = tokenize(q);
      if (!tokens.length) return items.slice();
      // Per groep twee emmers: eerst wat met de zoekterm begint, dan de rest. De emmers worden
      // in groepsvolgorde aan elkaar geplakt, zodat elke groep aaneengesloten blijft en de
      // kopregel zich niet herhaalt.
      var emmers = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i], n = it.norm.n, ok = true;
        for (var t = 0; t < tokens.length; t++) {
          if (n.indexOf(tokens[t]) === -1) { ok = false; break; }
        }
        if (!ok) continue;
        if (!emmers[it.gi]) emmers[it.gi] = { starts: [], rest: [] };
        (n.indexOf(tokens[0]) === 0 ? emmers[it.gi].starts : emmers[it.gi].rest).push(it);
      }
      var out = [];
      for (var g = 0; g < emmers.length; g++) {
        if (emmers[g]) out = out.concat(emmers[g].starts, emmers[g].rest);
      }
      return out;
    }

    // behoud: houd de blauwe balk waar hij stond. Enkel voor een herbouw van de optielijst onder
    // een open lijst, want dan is de gebruiker midden in iets en zou terugspringen naar de eerste
    // regel hem onderbreken. Bij openen en typen hoort de balk juist wel bovenaan te beginnen.
    function render(q, behoud) {
      var vorigeActieve = active;
      zoek = q || '';
      var tokens = tokenize(q);
      shown = filter(q);
      var html = '';
      if (!shown.length) {
        html = '<li class="empty">Geen resultaten</li>';
      } else {
        var n = Math.min(shown.length, MAX_RENDER), vorige = null;
        for (var i = 0; i < n; i++) {
          var it = shown[i];
          if (it.group && it.group !== vorige) {
            html += '<li class="kop">' + escapeHtml(it.group) + '</li>';
          }
          vorige = it.group;
          html += '<li role="option" id="' + id + '-o' + i + '" data-i="' + i + '"'
            + (it.removable ? ' data-rm="1"' : '')
            + (it.disabled ? ' class="dis" aria-disabled="true"' : '') + '>'
            + highlight(it, tokens)
            + '</li>';
        }
        if (shown.length > n) {
          html += '<li class="note">nog ' + (shown.length - n) + ' resultaten, verfijn je zoekterm</li>';
        }
      }
      list.innerHTML = html;
      shown = shown.slice(0, MAX_RENDER);
      var doel = 0;
      if (behoud && vorigeActieve > 0) doel = Math.min(vorigeActieve, shown.length - 1);
      setActive(shown.length ? doel : -1, false);
    }

    function setActive(i, scroll) {
      var nodes = list.querySelectorAll('li[data-i]');
      for (var k = 0; k < nodes.length; k++) nodes[k].classList.remove('active');
      active = i;
      if (i < 0 || i >= nodes.length) {
        input.removeAttribute('aria-activedescendant');
        return;
      }
      nodes[i].classList.add('active');
      input.setAttribute('aria-activedescendant', nodes[i].id);
      if (scroll !== false) {
        var li = nodes[i], top = li.offsetTop, bot = top + li.offsetHeight;
        if (top < list.scrollTop) list.scrollTop = top;
        else if (bot > list.scrollTop + list.clientHeight) list.scrollTop = bot - list.clientHeight;
      }
    }

    function openList(q) {
      render(q === undefined ? '' : q);
      list.classList.add('open');
      input.setAttribute('aria-expanded', 'true');
      open = true;
      position();
      win.addEventListener('scroll', position, true);
      win.addEventListener('resize', position);
    }

    function closeList(restore) {
      list.classList.remove('open');
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      open = false;
      active = -1;
      win.removeEventListener('scroll', position, true);
      win.removeEventListener('resize', position);
      if (restore !== false) input.value = currentLabel();
    }

    function choose(i) {
      var it = shown[i];
      if (!it || it.disabled) return;
      select.selectedIndex = it.index;
      input.value = it.label;
      updateWis();
      closeList(false);
      fire(select, 'input');
      fire(select, 'change');
    }

    // Het script haalt zelf niets weg. Het meldt enkel dat de gebruiker deze regel kwijt wil, en
    // wie de opties leverde beslist wat dat betekent en past de <select> aan. Luistert er niemand,
    // dan gebeurt er niets, en dat is geen fout.
    function fireRemove(it) {
      var ev;
      var detail = { value: select.options[it.index].value, label: it.label, index: it.index };
      try {
        ev = new CustomEvent('select-search:remove', { bubbles: true, cancelable: true, detail: detail });
      } catch (e) {
        ev = doc.createEvent('CustomEvent');
        ev.initCustomEvent('select-search:remove', true, true, detail);
      }
      select.dispatchEvent(ev);
    }

    function fire(el, type) {
      var ev;
      try {
        ev = new Event(type, { bubbles: true, cancelable: false });
      } catch (e) {
        ev = doc.createEvent('HTMLEvents');
        ev.initEvent(type, true, false);
      }
      el.dispatchEvent(ev);
      // Legacy apps binden vaak via jQuery; native events bereiken die handlers
      // wel, maar een expliciete trigger dekt ook .change()-only bindings.
      var jq = win.jQuery || win.$;
      if (jq && jq.fn && typeof jq === 'function') {
        try { jq(el).trigger(type); } catch (e2) { /* stil */ }
      }
    }

    function detach() {
      obs.disconnect();
      select.removeEventListener('change', onSelectChange);
      win.removeEventListener('scroll', position, true);
      win.removeEventListener('resize', position);
      if (prevStyle === null) select.removeAttribute('style');
      else select.setAttribute('style', prevStyle);
      delete select.dataset.ssEnhanced;
      select.dataset.nosearch = '1';
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }

    /* -------------------------------------------------------- listeners */

    input.addEventListener('mousedown', function (e) {
      // ontsnappingsluik: native select terug
      if (e.altKey) {
        e.preventDefault();
        detach();
        select.focus();
        return;
      }
      if (!open) { e.preventDefault(); input.focus(); openList(''); input.select(); }
    });
    // mousedown in plaats van click, met preventDefault: zo houdt het invoerveld zijn focus en
    // blijft het kruisje zichtbaar terwijl je klikt. stopPropagation houdt de lijst dicht.
    wis.addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      clear();
    });
    input.addEventListener('focus', function () { if (!open) openList(''); });
    input.addEventListener('input', function () { if (open) render(input.value); else openList(input.value); });
    input.addEventListener('blur', function () {
      setTimeout(function () { if (open) closeList(true); }, 120);
    });
    input.addEventListener('keydown', function (e) {
      var n = list.querySelectorAll('li[data-i]').length;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!open) { openList(''); break; }
          if (n) setActive((active + 1) % n);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!open) { openList(''); break; }
          if (n) setActive((active - 1 + n) % n);
          break;
        case 'Home': if (open && n) { e.preventDefault(); setActive(0); } break;
        case 'End': if (open && n) { e.preventDefault(); setActive(n - 1); } break;
        case 'PageDown': if (open && n) { e.preventDefault(); setActive(Math.min(n - 1, active + 10)); } break;
        case 'PageUp': if (open && n) { e.preventDefault(); setActive(Math.max(0, active - 10)); } break;
        case 'Enter':
          if (open) { e.preventDefault(); if (active >= 0) choose(active); else closeList(true); }
          break;
        case 'Tab':
          if (open && active >= 0) choose(active); else if (open) closeList(true);
          break;
        case 'Escape':
          if (open) { e.preventDefault(); e.stopPropagation(); closeList(true); }
          break;
        // Backspace op een leeg invoerveld wist de keuze, zoals in react-select. Staat er nog
        // tekst, dan doet Backspace gewoon wat je verwacht en blijft de keuze staan.
        case 'Backspace':
          if (!input.value && leegIndex !== -1 && currentLabel()) { e.preventDefault(); clear(); }
          break;
        // Delete haalt de actieve regel uit haar lijst, zoals de adresbalk van een browser dat met
        // een suggestie doet. Alleen zolang er niets getypt is: filtert de gebruiker, dan blijft
        // Delete de gewone teksttoets en gebeurt er niets met de lijst.
        case 'Delete':
          if (!open || zoek || active < 0) break;
          var doelwit = shown[active];
          if (!doelwit || !doelwit.removable) break;
          e.preventDefault();
          fireRemove(doelwit);
          break;
      }
    });
    // De muis verzet dezelfde balk als de pijltjes: één begrip van "waar sta ik", zodat Enter en
    // Delete altijd op de regel slaan die oplicht. mousemove en niet mouseover, want een muis die
    // toevallig boven de lijst ligt mag de pijltjes niet blijven overrulen.
    list.addEventListener('mousemove', function (e) {
      var li = e.target;
      while (li && li.tagName !== 'LI') li = li.parentNode;
      if (!li || !li.hasAttribute('data-i')) return;
      var i = parseInt(li.getAttribute('data-i'), 10);
      // Geen scroll: de regel ligt per definitie al onder de cursor en dus in beeld.
      if (i !== active) setActive(i, false);
    });
    list.addEventListener('mousedown', function (e) { e.preventDefault(); });
    list.addEventListener('click', function (e) {
      var li = e.target;
      while (li && li.tagName !== 'LI') li = li.parentNode;
      if (li && li.hasAttribute('data-i')) choose(parseInt(li.getAttribute('data-i'), 10));
    });

    function onSelectChange() {
      updateWis();
      if (!open) input.value = currentLabel();
    }
    select.addEventListener('change', onSelectChange);

    // De app vervangt de optielijst (bv. "Inclusief niet-raamcontractartikelen").
    var resync = debounce(function () {
      syncFromSelect();
      if (open) render(zoek, true);
    }, 50);
    var obs = new MutationObserver(resync);
    obs.observe(select, { childList: true, subtree: true });

    wrap.__selectSearchDetach = detach;
    wrap.__selectSearchSelect = select;
    syncFromSelect();
  }

  /* ---------------------------------------------------------------- scan */

  function eligible(s) {
    return !s.multiple && s.size <= 1 && !s.disabled
      && !s.dataset.ssEnhanced && !s.hasAttribute('data-nosearch')
      && s.options.length >= MIN_OPTIONS;
  }

  function scanDoc(doc) {
    var selects = doc.querySelectorAll('select');
    for (var i = 0; i < selects.length; i++) {
      if (eligible(selects[i])) {
        try { enhance(selects[i]); } catch (e) { /* laat de pagina met rust */ }
      }
    }
    // Wrappers waarvan de app het originele select heeft weggegooid opruimen.
    var wraps = doc.querySelectorAll('.select-search-wrap');
    for (var w = 0; w < wraps.length; w++) {
      var sel = wraps[w].__selectSearchSelect;
      if (sel && !doc.contains(sel) && wraps[w].parentNode) {
        wraps[w].parentNode.removeChild(wraps[w]);
      }
    }
    var frames = doc.querySelectorAll('iframe,frame');
    for (var f = 0; f < frames.length; f++) {
      try {
        var fd = frames[f].contentDocument;
        if (fd && fd.body) { attach(fd); }
      } catch (e) { /* cross-origin */ }
    }
  }

  var attached = [];
  function attach(doc) {
    if (attached.indexOf(doc) === -1) {
      attached.push(doc);
      new MutationObserver(debounce(function () { scanDoc(doc); }, 120))
        .observe(doc.documentElement, { childList: true, subtree: true });
    }
    scanDoc(doc);
  }

  function scan() { for (var i = 0; i < attached.length; i++) scanDoc(attached[i]); attach(document); }
  window.__selectSearchScan = scan;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { attach(document); });
  } else {
    attach(document);
  }
})();
