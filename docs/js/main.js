/* Mosaiks – navigation entre les pages, menu latéral et choix de la langue.
 *
 * Les pages sont repérées par la partie de l'adresse après « # » (#/predictions, #/price…).
 * Ce choix permet au site de fonctionner sur GitHub Pages, même dans un sous-dossier
 * (https://utilisateur.github.io/nom-du-repo/#/predictions), sans aucune configuration de serveur.
 *
 * Langue : anglais par défaut ; le sélecteur FR | EN de la barre du haut change la langue tout de suite,
 * la garde pendant la navigation et pour les visites suivantes (stockage du navigateur).
 * On peut aussi partager un lien dans une langue donnée : …/?lang=fr ou …/?lang=en
 */
(function () {
  'use strict';
  const App = window.App;

  App.pages['404'] = {
    titleKey: 'page.notfound',
    render: function (ctx) {
      ctx.el.innerHTML = '<h3>' + App.t('page.notfound') + '</h3><div class="card"><div class="card-body">'
        + '<p>' + App.t('notfound.text') + '</p><a class="btn btn-primary btn-sm" href="#/">' + App.icon('house', 'me-1')
        + App.t('notfound.back') + '</a></div></div>';
    },
  };

  const main = document.getElementById('page');
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebar-toggle');
  let current = null;   // page affichée : { token, el, cleanup }
  let counter = 0;

  function routeFromHash() {
    const h = location.hash || '';
    if (h === '' || h === '#') return '/';
    if (h.indexOf('#/') !== 0) return null;          // simple ancre (#page) : pas un changement de page
    return h.slice(1).split('?')[0].replace(/\/+$/, '') || '/';
  }

  function setSidebar(open) {
    sidebar.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }

  /** Traduit les textes fixes du cadre (menu, barre du haut, avertissement). */
  function applyShell() {
    document.documentElement.lang = App.lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = App.t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.dataset.i18nAttr.split(';').forEach(function (pair) {
        const kv = pair.split(':');
        if (kv.length === 2) el.setAttribute(kv[0].trim(), App.t(kv[1].trim()));
      });
    });
    document.querySelectorAll('.lang-switch [data-lang]').forEach(function (b) {
      const on = b.dataset.lang === App.lang;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  /** Change la langue et réaffiche la page en cours (les filtres choisis sont conservés). */
  App.setLang = function (lang) {
    if (App.LANGS.indexOf(lang) < 0 || lang === App.lang) return;
    App.lang = lang;
    try { localStorage.setItem(App.LANG_KEY, lang); } catch (e) { /* stockage indisponible */ }
    applyShell();
    navigate(true);
  };

  function navigate(keepState) {
    const path = routeFromHash();
    if (path === null) return;
    const page = App.pages[path] || App.pages['404'];

    // Nettoyage de la page précédente (cartes, graphiques, écouteurs)
    if (current) {
      const old = current;
      current = null;
      if (old.cleanup) { try { old.cleanup(); } catch (e) { console.warn(e); } }
      if (window.Plotly) old.el.querySelectorAll('.js-plotly-plot').forEach(function (g) { Plotly.purge(g); });
      old.el.remove();
    }
    main.querySelectorAll('.page-loading').forEach(function (n) { n.remove(); });

    const token = ++counter;
    const el = document.createElement('div');
    el.className = 'page';
    main.appendChild(el);
    const entry = { token: token, el: el, cleanup: null };
    current = entry;
    const ctx = { el: el, keepState: keepState === true, alive: function () { return current === entry; } };

    document.title = App.t(page.titleKey) + ' – Mosaiks';
    document.querySelectorAll('.sidebar-link').forEach(function (a) {
      const on = a.dataset.route === path;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    setSidebar(false);
    if (!keepState) window.scrollTo(0, 0);

    el.innerHTML = '<div class="page-loading" role="status"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>'
      + App.t('loading') + '</div>';
    let result;
    try {
      result = page.render(ctx);
    } catch (err) {
      el.innerHTML = App.errorBox(err);
      console.error(err);
      return;
    }
    Promise.resolve(result).then(function (cleanup) {
      if (typeof cleanup !== 'function') return;
      if (ctx.alive()) entry.cleanup = cleanup; else cleanup();
    }).catch(function (err) {
      console.error(err);
      if (ctx.alive()) el.innerHTML = App.errorBox(err);
    });
  }

  // Menu sur téléphone : le bouton l'ouvre ou le ferme ; un clic à côté le referme
  toggle.addEventListener('click', function () { setSidebar(!sidebar.classList.contains('open')); });
  document.getElementById('sidebar-overlay').addEventListener('click', function () { setSidebar(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) { setSidebar(false); toggle.focus(); }
  });

  // Sélecteur de langue FR | EN
  document.querySelectorAll('.lang-switch [data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { App.setLang(b.dataset.lang); });
  });

  applyShell();
  window.addEventListener('hashchange', function () { navigate(false); });
  if (!window.Plotly || !window.L) {
    main.innerHTML = '<div class="alert alert-danger">' + App.t('error.libs') + '</div>';
    return;
  }
  navigate(false);
})();
