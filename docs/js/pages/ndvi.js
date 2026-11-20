/* Page « Indices de Végétation » / "Vegetation Indices" (adresse #/ndvi-map).
 * Comme pages/ndvi_map.py : l'application Google Earth Engine est affichée dans un cadre (iframe).
 * Un lien permet de l'ouvrir dans un nouvel onglet si le cadre ne s'affiche pas
 * (application hors ligne, réseau qui bloque Google, etc.).
 */
(function () {
  'use strict';
  const App = window.App;
  const GEE_URL = 'https://dashboard-468417.projects.earthengine.app/view/dashboard';

  App.pages['/ndvi-map'] = {
    titleKey: 'page.ndvi',
    render: function (ctx) {
      ctx.el.innerHTML = '<h3>NDVI - EVI</h3>'
        + '<div class="ndvi-toolbar">'
        + '<p class="mb-0 small text-muted">' + App.t('ndvi.intro') + '</p>'
        + '<a class="btn btn-outline-secondary btn-sm text-nowrap" href="' + GEE_URL + '" target="_blank" rel="noopener">'
        + App.icon('box-arrow-up-right', 'me-1') + App.t('ndvi.open') + '</a>'
        + '</div>'
        + '<div class="ndvi-wrapper">'
        + '<iframe src="' + GEE_URL + '" class="ndvi-frame" title="' + App.esc(App.t('ndvi.frameTitle')) + '" '
        + 'loading="lazy" allow="fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>'
        + '</div>'
        + '<p class="small text-muted mt-2 mb-0">' + App.t('ndvi.note') + '</p>';
    },
  };
})();
