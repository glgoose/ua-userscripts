// ==UserScript==
// @name         PeopleSoft: werkende "Downloaden naar Excel"
// @namespace    https://github.com/glgoose/ua-userscripts
// @version      1.1.0
// @description  Vervangt de kapotte PeopleSoft grid-knop "Downloaden naar Excel" door een echte XLSX-export die uit de DOM wordt opgebouwd.
// @author       Glenn Goossens
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/glgoose/ua-userscripts/tree/main/scripts/peoplesoft-excel-download
// @supportURL   https://github.com/glgoose/ua-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/peoplesoft-excel-download/peoplesoft-excel-download.user.js
// @updateURL    https://raw.githubusercontent.com/glgoose/ua-userscripts/main/scripts/peoplesoft-excel-download/peoplesoft-excel-download.user.js
// @match        https://app.psoft.uantwerpen.be/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// @grant        GM_info
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. Intercept every PeopleSoft "download to Excel" grid button.
   *    Their ids always look like  <RECORD_FIELD>$hexcel$<n>.
   *    We listen in the CAPTURE phase on document so the handler also
   *    survives PeopleSoft's constant AJAX re-rendering of the page.
   * ------------------------------------------------------------------ */
  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest && ev.target.closest('a[id*="$hexcel$"], a[id*="$hdown$"]');
    if (!btn) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();

    try {
      exportGridForButton(btn);
    } catch (err) {
      console.error('[psoft-excel-fix]', err);
      toast('Export mislukt: ' + err.message, true);
    }
  }, true);

  /* ------------------------------------------------------------------ *
   * 2. Find the grid that belongs to the button and export it.
   * ------------------------------------------------------------------ */
  function exportGridForButton(btn) {
    // "UA_LR_RESUL_DER$hexcel$0"  ->  name "UA_LR_RESUL_DER", occurrence "0"
    const m = btn.id.match(/^(.*)\$(?:hexcel|hdown)\$(\d+)$/);
    const gridName = m ? m[1] : null;
    const occ = m ? m[2] : '0';

    let container =
      (gridName && document.getElementById('win0div' + gridName + '$' + occ)) ||
      btn.closest('.ps_box-grid-flex, .ps_box-grid, .ps_grid_body, table.PSLEVEL1GRID');

    // fall back: walk up until we find something that contains a data table
    if (!container) {
      let p = btn.parentElement;
      while (p && !p.querySelector('table')) p = p.parentElement;
      container = p;
    }
    if (!container) throw new Error('grid niet gevonden');

    const aoa = readGrid(container);
    if (!aoa.length) throw new Error('geen rijen gevonden');

    const base = fileBase(gridName);
    writeXlsx(aoa, base, gridName || 'Data');
    toast('Geëxporteerd: ' + base + '.xlsx  (' + (aoa.length - 1) + ' rijen)');
  }

  /* ------------------------------------------------------------------ *
   * 3. DOM -> array of arrays.
   *    A PeopleSoft flex grid can be split into a frozen part and a
   *    scrolling part; each part is its own <table> with the SAME rows.
   *    We read every table and glue the columns together per row index.
   * ------------------------------------------------------------------ */
  function readGrid(container) {
    const tables = [...container.querySelectorAll('table')]
      .filter(t => t.tBodies.length && t.tBodies[0].rows.length);
    if (!tables.length) throw new Error('geen tabel in de grid');

    const headerParts = [];
    const bodyParts = [];

    tables.forEach(t => {
      // header
      let head = [];
      if (t.tHead && t.tHead.rows.length) {
        head = [...t.tHead.rows[t.tHead.rows.length - 1].cells].map(cellText);
      }
      // body
      const rows = [...t.tBodies[0].rows]
        .filter(r => !r.classList.contains('ps_grid-headerrow'))
        .map(r => [...r.cells].map(readCell));
      if (!rows.length) return;
      if (!head.length) head = rows[0].map((_, i) => 'Kolom ' + (i + 1));
      headerParts.push(head);
      bodyParts.push(rows);
    });

    if (!bodyParts.length) throw new Error('geen datarijen');

    const header = [].concat(...headerParts);
    const nRows = Math.max(...bodyParts.map(b => b.length));
    const out = [header];
    for (let i = 0; i < nRows; i++) {
      let row = [];
      bodyParts.forEach((part, p) => {
        const r = part[i] || [];
        const width = headerParts[p].length;
        for (let c = 0; c < width; c++) row.push(r[c] === undefined ? '' : r[c]);
      });
      // drop fully empty rows
      if (row.some(v => v !== '' && v !== null)) out.push(row);
    }
    return out;
  }

  function cellText(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function readCell(td) {
    // editable grids hold their value in an input/select/textarea
    const f = td.querySelector('input:not([type=hidden]), select, textarea');
    let raw;
    if (f) {
      raw = f.tagName === 'SELECT'
        ? (f.options[f.selectedIndex] ? f.options[f.selectedIndex].text : '')
        : f.value;
    } else {
      raw = cellText(td);
    }
    return toNumberIfPossible(raw);
  }

  /* nl-BE number formatting: "." = thousands, "," = decimals */
  function toNumberIfPossible(s) {
    if (typeof s !== 'string') return s;
    let v = s.replace(/ /g, ' ').trim();
    if (!v) return '';
    let neg = false;
    if (/^\(.*\)$/.test(v)) { neg = true; v = v.slice(1, -1).trim(); }
    if (/-$/.test(v)) { neg = true; v = v.slice(0, -1).trim(); }   // trailing minus
    v = v.replace(/^€\s*/, '').replace(/\s/g, '');
    let num = null;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(v)) {
      num = parseFloat(v.replace(/\./g, '').replace(',', '.'));
    } else if (/^-?\d+(,\d+)?$/.test(v)) {
      num = parseFloat(v.replace(',', '.'));
    } else if (/^-?\d+(\.\d+)?$/.test(v) && !/^\d{1,3}\.\d{3}$/.test(v)) {
      num = parseFloat(v);
    }
    if (num === null || !isFinite(num)) return s.trim();
    return neg ? -Math.abs(num) : num;
  }

  /* ------------------------------------------------------------------ *
   * 4. Build and save the workbook.
   * ------------------------------------------------------------------ */
  function writeXlsx(aoa, base, sheetName) {
    if (typeof XLSX === 'undefined') { writeCsv(aoa, base); return; }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // number format + column widths
    const range = XLSX.utils.decode_range(ws['!ref']);
    const widths = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      let w = 8;
      for (let R = range.s.r; R <= range.e.r; R++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (!cell) continue;
        if (cell.t === 'n' && R > 0) cell.z = '#,##0.00';
        const len = String(cell.v == null ? '' : cell.v).length;
        if (len + 2 > w) w = len + 2;
      }
      widths.push({ wch: Math.min(w, 34) });
    }
    ws['!cols'] = widths;
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, String(sheetName).slice(0, 28) || 'Data');
    XLSX.writeFile(wb, base + '.xlsx');
  }

  function writeCsv(aoa, base) {
    const esc = v => {
      const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v == null ? '' : v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = '﻿' + aoa.map(r => r.map(esc).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = base + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function fileBase(gridName) {
    const title = (document.title || 'peoplesoft')
      .replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 60);
    const d = new Date();
    const stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes());
    return title + '_' + (gridName || 'grid') + '_' + stamp;
  }
  const pad = n => String(n).padStart(2, '0');

  /* ------------------------------------------------------------------ *
   * 5. Tiny toast so you can see it actually fired.
   * ------------------------------------------------------------------ */
  function toast(msg, isError) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText =
      'position:fixed;z-index:2147483647;bottom:20px;right:20px;max-width:380px;' +
      'padding:10px 14px;border-radius:6px;font:13px/1.4 system-ui,sans-serif;' +
      'color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.3);' +
      'background:' + (isError ? '#b3261e' : '#1f6f43') + ';';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }
})();
