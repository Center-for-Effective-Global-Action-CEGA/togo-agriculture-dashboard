/* Page « Performances des modèles » / "Model Performance" (adresse #/modeles).
 * Comme pages/modeles.py : liste des 4 modèles à gauche, description à droite.
 * Les chiffres sont pré-calculés par scripts/build_static_data.py (data/models.json, textes en
 * français et en anglais) : aucun modèle scikit-learn n'est exécuté dans le navigateur.
 */
(function () {
  'use strict';
  const App = window.App;
  let memo = 0;   // modèle affiché, gardé quand on change de langue

  /** Textes du modèle dans la langue choisie (français si la traduction manque). */
  function texts(m) { return (App.lang === 'en' && m.en) ? m.en : m; }

  function detail(m) {
    const t = texts(m);
    return '<h4 class="model-title">' + App.esc(t.title) + '</h4>'
      + '<p>' + App.esc(t.desc) + '</p>'
      + '<h5>' + App.t('models.data') + '</h5><p>' + App.esc(t.data) + '</p>'
      + '<h5>' + App.t('models.algo') + '</h5><p>' + App.esc(t.algorithm) + '</p>'
      + '<h5>' + App.t('models.perf') + '</h5>'
      + (t.performance && t.performance.length
        ? '<ul>' + t.performance.map(function (p) { return '<li>' + App.t('models.perfLine', { k: App.esc(p[0]), v: App.esc(p[1]) }) + '</li>'; }).join('') + '</ul>'
        : '<p class="text-muted">' + App.t('models.todo') + '</p>');
  }

  App.pages['/modeles'] = {
    titleKey: 'page.models',
    render: function (ctx) {
      if (!ctx.keepState) memo = 0;
      return App.data('models.json').then(function (d) {
        if (!ctx.alive()) return;
        const sel = Math.min(memo, d.models.length - 1);
        const note = (App.lang === 'en' && d.note_en) ? d.note_en : d.note;
        ctx.el.innerHTML = '<h3>' + App.t('models.h') + '</h3>'
          + '<div class="alert alert-light demo-note" role="note">' + App.icon('info-circle', 'me-2') + App.esc(note) + '</div>'
          + '<div class="row g-3">'
          + '<div class="col-lg-4 col-xl-3"><div class="model-list" role="tablist" aria-label="' + App.t('models.list') + '">'
          + d.models.map(function (m, i) {
            return '<button type="button" class="model-item' + (i === sel ? ' active' : '') + '" role="tab" aria-selected="' + (i === sel) + '" data-i="' + i + '">'
              + '<div class="model-item-title">' + App.t('models.item', { n: i + 1 }) + '</div><div class="model-item-sub">' + App.esc(texts(m).short) + '</div></button>';
          }).join('') + '</div></div>'
          + '<div class="col-lg-8 col-xl-9"><div class="card model-detail"><div class="card-body" id="model-detail" role="tabpanel">'
          + detail(d.models[sel]) + '</div></div></div></div>';
        ctx.el.querySelector('.model-list').addEventListener('click', function (e) {
          const btn = e.target.closest('.model-item');
          if (!btn) return;
          memo = +btn.dataset.i;
          ctx.el.querySelectorAll('.model-item').forEach(function (b) {
            const on = b === btn;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', String(on));
          });
          ctx.el.querySelector('#model-detail').innerHTML = detail(d.models[memo]);
        });
      });
    },
  };
})();
