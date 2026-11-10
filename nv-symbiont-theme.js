/* nv-symbiont-theme.js — apply the IA Symbiont's color to the system.
   Reads localStorage 'nv_symbiont_base' ('hexa' / 'cyphr' / 'helix')
   and sets data-symbiont on the root element, so nv-symbiont-theme.css
   recolors the containers, radio, and other system elements to the
   pick (Hexa cyan, Cyphr indigo, Helix pink). Listens for changes so
   the theme follows the pick live, across tabs. Defaults to Cyphr
   (the current indigo/purple look) when nothing is picked. */
(function () {
  function base() {
    try {
      var b = localStorage.getItem('nv_symbiont_base') || '';
      if (b === 'hexa' || b === 'cyphr' || b === 'helix') return b;
    } catch (e) {}
    return 'cyphr';
  }
  function apply() {
    document.documentElement.setAttribute('data-symbiont', base());
  }
  apply();
  /* Exposed so a picker on this page can recolor the system the
     moment the pick is made (the storage event only fires in other
     tabs, so the picker's own page needs a direct call). */
  window.NVSymbiontTheme = { apply: apply };
  window.addEventListener('storage', function (e) {
    if (e.key === 'nv_symbiont_base') apply();
  });
  /* The pick can change on this page (IA picker, Avatar Editor) —
     re-apply when the page regains focus, so the theme follows. */
  window.addEventListener('focus', apply);
})();
