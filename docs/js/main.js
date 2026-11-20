/* Mosaiks – navigation entre les pages et menu latéral.
 *
 * Les pages sont repérées par la partie de l'adresse après « # » (#/predictions, #/price…).
 * Ce choix permet au site de fonctionner sur GitHub Pages, même dans un sous-dossier
 * (https://utilisateur.github.io/nom-du-repo/#/predictions), sans aucune configuration de serveur.
 */
(function () {
  'use strict';
  const App = window.App;

  App.pages['404'] = {
    title: 'Page introuvable',
    render: function (ctx) {
      ctx.el.innerHTML = '<h3>Page introuvable</h3><div class="card"><div class="card-body">'
        + '<p>Cette page n\'existe pas.</p><a class="btn btn-primary btn-sm" href="#/">' + App.icon('house', 'me-1')
        + 'Retour au tableau de bord</a></div></div>';
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

  function navigate() {
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
    const ctx = { el: el, alive: function () { return current === entry; } };

    document.title = page.title + ' – Mosaiks';
    document.querySelectorAll('.sidebar-link').forEach(function (a) {
      const on = a.dataset.route === path;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    setSidebar(false);
    window.scrollTo(0, 0);

    el.innerHTML = '<div class="page-loading" role="status"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Chargement…</div>';
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

  window.addEventListener('hashchange', navigate);
  if (!window.Plotly || !window.L) {
    main.innerHTML = '<div class="alert alert-danger">Les bibliothèques du site (dossier lib/) n\'ont pas pu être chargées.</div>';
    return;
  }
  navigate();
})();
