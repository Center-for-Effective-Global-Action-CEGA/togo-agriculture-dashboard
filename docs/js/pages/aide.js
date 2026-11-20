/* Page « Aide & Support » / "Help & Support" (adresse #/aide) : coordonnées du Togo Data Lab
 * (comme pages/aide.py), mode d'emploi rapide et informations sur les données.
 */
(function () {
  'use strict';
  const App = window.App;

  App.pages['/aide'] = {
    titleKey: 'page.help',
    render: function (ctx) {
      ctx.el.innerHTML = '<h3>' + App.t('page.help') + '</h3>'
        + '<div class="card support-card mb-3"><div class="card-body">'
        + '<h5 class="mb-3">' + App.t('help.contactTitle') + '</h5>'
        + '<p>' + App.t('help.contactIntro') + '</p>'
        + '<p>' + App.icon('envelope', 'me-2') + App.t('help.email') + ' <a href="mailto:contact@datalab.gouv.tg">contact@datalab.gouv.tg</a></p>'
        + '<p>' + App.icon('telephone', 'me-2') + App.t('help.phone') + ' +228 71 39 97 78</p>'
        + '<p>' + App.icon('geo-alt', 'me-2') + '656 Avenue de la Nouvelle Marche, Quartier des Etoiles 01BP2274 Lomé 01, Lomé, Togo</p>'
        + '<hr></div></div>'

        + '<div class="card support-card mb-3"><div class="card-body">'
        + '<h5 class="mb-3">' + App.t('help.useTitle') + '</h5>'
        + '<ul class="mb-0">' + App.t('help.useList') + '</ul></div></div>'

        + '<div class="card support-card"><div class="card-body">'
        + '<h5 class="mb-3">' + App.t('help.aboutTitle') + '</h5>'
        + '<p>' + App.t('help.aboutText') + '</p>'
        + '<p class="mb-0" id="data-info">' + App.t('help.sources') + '</p>'
        + '</div></div>';
      return App.data('summary.json').then(function (s) {
        if (!ctx.alive()) return;
        const date = new Date(s.generated + 'T00:00:00').toLocaleDateString(App.lang === 'fr' ? 'fr-FR' : 'en-GB',
          { day: 'numeric', month: 'long', year: 'numeric' });
        ctx.el.querySelector('#data-info').insertAdjacentHTML('beforeend',
          ' ' + App.t('help.quarters', { q: App.esc(s.quarters.join(', ')), d: App.esc(date) }));
      }).catch(function () { /* information facultative */ });
    },
  };
})();
