/* Page « Performances des modèles » (adresse #/modeles).
 * Comme pages/modeles.py : liste des 4 modèles à gauche, description à droite.
 * Les chiffres sont pré-calculés par scripts/build_static_data.py (data/models.json) :
 * aucun modèle scikit-learn n'est exécuté dans le navigateur.
 */
(function () {
  'use strict';
  const App = window.App;

  function detail(m) {
    return '<h4 class="model-title">' + App.esc(m.title) + '</h4>'
      + '<p>' + App.esc(m.desc) + '</p>'
      + '<h5>Données utilisées</h5><p>' + App.esc(m.data) + '</p>'
      + '<h5>Algorithme</h5><p>' + App.esc(m.algorithm) + '</p>'
      + '<h5>Performance</h5>'
      + (m.performance && m.performance.length
        ? '<ul>' + m.performance.map(function (p) { return '<li>' + App.esc(p[0]) + ' : ' + App.esc(p[1]) + '</li>'; }).join('') + '</ul>'
        : '<p class="text-muted">À compléter.</p>');
  }

  App.pages['/modeles'] = {
    title: 'Performances des modèles',
    render: function (ctx) {
      return App.data('models.json').then(function (d) {
        if (!ctx.alive()) return;
        ctx.el.innerHTML = '<h3>Précision des modèles</h3>'
          + '<div class="alert alert-light demo-note" role="note">' + App.icon('info-circle', 'me-2') + App.esc(d.note) + '</div>'
          + '<div class="row g-3">'
          + '<div class="col-lg-4 col-xl-3"><div class="model-list" role="tablist" aria-label="Modèles">'
          + d.models.map(function (m, i) {
            return '<button type="button" class="model-item' + (i === 0 ? ' active' : '') + '" role="tab" aria-selected="' + (i === 0) + '" data-i="' + i + '">'
              + '<div class="model-item-title">Modèle ' + (i + 1) + '</div><div class="model-item-sub">' + App.esc(m.short) + '</div></button>';
          }).join('') + '</div></div>'
          + '<div class="col-lg-8 col-xl-9"><div class="card model-detail"><div class="card-body" id="model-detail" role="tabpanel">'
          + detail(d.models[0]) + '</div></div></div></div>';
        ctx.el.querySelector('.model-list').addEventListener('click', function (e) {
          const btn = e.target.closest('.model-item');
          if (!btn) return;
          ctx.el.querySelectorAll('.model-item').forEach(function (b) {
            const on = b === btn;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', String(on));
          });
          ctx.el.querySelector('#model-detail').innerHTML = detail(d.models[+btn.dataset.i]);
        });
      });
    },
  };
})();
