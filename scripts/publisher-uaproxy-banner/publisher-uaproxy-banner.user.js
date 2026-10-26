// ==UserScript==
// @name         Algemeen: UA-proxy waarschuwing op uitgeverspagina's
// @namespace    https://github.com/glgoose/ua-userscripts
// @version      1.0.1
// @description  Rode balk op uitgeverspagina's als de UA-proxy uit staat, met een knop om te verbinden.
// @author       glgoose
// @license      GPL-3.0-or-later
// @homepageURL  https://gitea.flw.uantwerpen.be/glenn/ua-userscripts/src/branch/main/scripts/publisher-uaproxy-banner
// @supportURL   https://gitea.flw.uantwerpen.be/glenn/ua-userscripts/issues
// @match        *://*.tandfonline.com/*
// @match        *://*.taylorfrancis.com/*
// @match        *://*.sagepub.com/*
// @match        *://*.wiley.com/*
// @match        *://*.oup.com/*
// @match        *://*.sciencedirect.com/*
// @match        *://*.elsevier.com/*
// @match        *://*.cambridge.org/*
// @match        *://*.jstor.org/*
// @match        *://*.springer.com/*
// @match        *://*.springernature.com/*
// @match        *://*.nature.com/*
// @match        *://*.degruyter.com/*
// @match        *://*.degruyterbrill.com/*
// @match        *://*.brill.com/*
// @match        *://*.muse.jhu.edu/*
// @match        *://*.journals.uchicago.edu/*
// @match        *://*.annualreviews.org/*
// @match        *://*.emerald.com/*
// @match        *://*.direct.mit.edu/*
// @match        *://*.psycnet.apa.org/*
// @match        *://*.ingentaconnect.com/*
// @match        *://*.bloomsburycollections.com/*
// @run-at       document-idle
// @connect      127.0.0.1
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==
(function () {
  'use strict';

  var BASE = 'http://127.0.0.1:18088';
  var POLL_MS = 3000;
  // The token is not in the repo: the first click on Connect asks for it once and keeps it in
  // Tampermonkey storage.
  var token = GM_getValue('token', '');

  var bar = null, text = null, btn = null, timer = null;

  function request(method, path, cb) {
    GM_xmlhttpRequest({
      method: method,
      url: BASE + path,
      headers: method === 'POST' ? { 'X-UA-Token': token } : {},
      timeout: 4000,
      onload: function (r) {
        var j = null;
        try { j = JSON.parse(r.responseText); } catch (e) { /* not JSON */ }
        cb(r.status, j);
      },
      onerror: function () { cb(0, null); },
      ontimeout: function () { cb(0, null); },
    });
  }

  // The bar is built once at its final size and never changes height or button width, so
  // state changes only swap text (single line, truncated).
  function build() {
    bar = document.createElement('div');
    text = document.createElement('span');
    btn = document.createElement('button');
    btn.textContent = 'Connect';
    btn.style.cssText =
      'margin-left:12px;min-width:96px;padding:2px 12px;border:1px solid #fff;border-radius:4px;' +
      'background:transparent;color:#fff;font:inherit;font-weight:600;cursor:pointer';
    btn.addEventListener('click', connect);
    bar.append(text, btn);
    bar.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:8px 16px;' +
      'background:#b3261e;color:#fff;font:14px/1.4 -apple-system,system-ui,sans-serif;' +
      'text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.3);white-space:nowrap;overflow:hidden;' +
      'text-overflow:ellipsis';
    document.documentElement.appendChild(bar);
  }

  function render(s) {
    var state = s && s.state;
    if (state === 'up' || (s && s.on_ua && state === 'down')) { hide(); return; }
    if (!bar) build();
    var base = 'UA proxy down';
    if (!s) {
      text.textContent = 'uaproxyd is not running';
      btn.disabled = true;
    } else if (state === 'connecting') {
      text.textContent = s.mfa ? 'Enter ' + s.mfa + ' in the Authenticator app.' : 'Connecting to the UA proxy.';
      btn.disabled = true;
    } else {
      text.textContent = s.error ? base + ' ' + s.error : base;
      btn.disabled = false;
    }
    btn.textContent = state === 'connecting' ? 'Connecting' : 'Connect';
    bar.style.background = state === 'connecting' ? '#b45309' : '#b3261e';
  }

  function hide() {
    if (bar) { bar.remove(); bar = null; }
    if (timer) { clearInterval(timer); timer = null; }
  }

  function poll() {
    request('GET', '/status', function (code, j) { render(code === 200 ? j : null); });
  }

  function connect() {
    if (!token) {
      token = (window.prompt('uaproxyd token (cat ~/.local/share/uaproxyd/token):') || '').trim();
      if (!token) return;
      GM_setValue('token', token);
    }
    btn.disabled = true;
    request('POST', '/connect', function (code, j) {
      if (code === 403) { token = ''; GM_setValue('token', ''); }
      render(code === 202 ? j : null);
    });
  }

  poll();
  timer = setInterval(poll, POLL_MS);
})();
