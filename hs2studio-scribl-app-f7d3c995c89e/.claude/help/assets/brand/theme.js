/* Bounteous brand kit — theme toggle + tab/sub-nav switching for arc-help cheat-sheets.
 * NASA Power-of-10 in spirit: small single-purpose functions, no unbounded loops
 * (all loops are bounded by DOM NodeLists collected once).
 */
(function () {
  'use strict';

  var THEME_KEY = 'arc-help-theme';

  function getStoredTheme() {
    try {
      return window.localStorage.getItem(THEME_KEY);
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(value) {
    try {
      window.localStorage.setItem(THEME_KEY, value);
    } catch (e) {
      /* storage unavailable — theme still applies for this session */
    }
  }

  function applyTheme(value) {
    document.documentElement.dataset.theme = value;
  }

  function initTheme() {
    var stored = getStoredTheme();
    applyTheme(stored === 'light' || stored === 'dark' ? stored : 'dark');
  }

  function toggleTheme() {
    var current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setStoredTheme(next);
  }

  function wireThemeToggle() {
    var btn = document.querySelector('[data-theme-toggle]');
    if (btn) btn.addEventListener('click', toggleTheme);
  }

  function showTab(id) {
    var tabs = document.querySelectorAll('nav.tabs button[data-tab]');
    var pages = document.querySelectorAll('.page');
    tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === id); });
    pages.forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + id); });
  }

  function showSubpage(tabId, subId) {
    var buttons = document.querySelectorAll('.subnav[data-tab="' + tabId + '"] button[data-subpage]');
    var subpages = document.querySelectorAll('.subpage[data-tab="' + tabId + '"]');
    buttons.forEach(function (b) { b.classList.toggle('active', b.dataset.subpage === subId); });
    subpages.forEach(function (p) { p.classList.toggle('active', p.id === 'sub-' + tabId + '-' + subId); });
  }

  function wireTabs() {
    var tabs = document.querySelectorAll('nav.tabs button[data-tab]');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { showTab(t.dataset.tab); });
    });
  }

  function wireSubnavs() {
    var buttons = document.querySelectorAll('.subnav button[data-subpage]');
    buttons.forEach(function (b) {
      var tabId = b.closest('.subnav').dataset.tab;
      b.addEventListener('click', function () { showSubpage(tabId, b.dataset.subpage); });
    });
  }

  function init() {
    initTheme();
    wireThemeToggle();
    wireTabs();
    wireSubnavs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
