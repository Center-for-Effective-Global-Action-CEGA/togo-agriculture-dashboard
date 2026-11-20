/* Page « Indices de Végétation » (adresse #/ndvi-map).
 * Comme pages/ndvi_map.py : l'application Google Earth Engine est affichée dans un cadre (iframe).
 * Un lien permet de l'ouvrir dans un nouvel onglet si le cadre ne s'affiche pas
 * (application hors ligne, réseau qui bloque Google, etc.).
 */
(function () {
  'use strict';
  const App = window.App;
  const GEE_URL = 'https://dashboard-468417.projects.earthengine.app/view/dashboard';

  App.pages['/ndvi-map'] = {
    title: 'Indices de Végétation',
    render: function (ctx) {
      ctx.el.innerHTML = '<h3>NDVI - EVI</h3>'
        + '<div class="ndvi-toolbar">'
        + '<p class="mb-0 small text-muted">Le NDVI et l\'EVI sont calculés à partir d\'images satellites : plus la valeur est élevée, '
        + 'plus la végétation est dense et verte. Cette carte est une application Google Earth Engine hébergée par Google.</p>'
        + '<a class="btn btn-outline-secondary btn-sm text-nowrap" href="' + GEE_URL + '" target="_blank" rel="noopener">'
        + App.icon('box-arrow-up-right', 'me-1') + 'Ouvrir dans un nouvel onglet</a>'
        + '</div>'
        + '<div class="ndvi-wrapper">'
        + '<iframe src="' + GEE_URL + '" class="ndvi-frame" title="Indices de végétation NDVI et EVI (application Google Earth Engine)" '
        + 'loading="lazy" allow="fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>'
        + '</div>'
        + '<p class="small text-muted mt-2 mb-0">Si la carte reste vide, l\'application Earth Engine est peut-être indisponible ou bloquée par votre réseau : '
        + 'utilisez le bouton « Ouvrir dans un nouvel onglet ».</p>';
    },
  };
})();
