/* Page « Aide & Support » (adresse #/aide) : coordonnées du Togo Data Lab (comme pages/aide.py),
 * mode d'emploi rapide et informations sur les données.
 */
(function () {
  'use strict';
  const App = window.App;

  App.pages['/aide'] = {
    title: 'Aide & Support',
    render: function (ctx) {
      ctx.el.innerHTML = '<h3>Aide &amp; Support</h3>'
        + '<div class="card support-card mb-3"><div class="card-body">'
        + '<h5 class="mb-3">Des questions sur le dashboard ?</h5>'
        + '<p>Merci de bien vouloir contacter le Togo Data Lab via les coordonnées suivantes :</p>'
        + '<p>' + App.icon('envelope', 'me-2') + 'Email : <a href="mailto:contact@datalab.gouv.tg">contact@datalab.gouv.tg</a></p>'
        + '<p>' + App.icon('telephone', 'me-2') + 'Téléphone : +228 71 39 97 78</p>'
        + '<p>' + App.icon('geo-alt', 'me-2') + '656 Avenue de la Nouvelle Marche, Quartier des Etoiles 01BP2274 Lomé 01, Lomé, Togo</p>'
        + '<hr></div></div>'

        + '<div class="card support-card mb-3"><div class="card-body">'
        + '<h5 class="mb-3">Utiliser le tableau de bord</h5>'
        + '<ul class="mb-0">'
        + '<li><b>Tableau de bord</b> : chiffres clés du dernier trimestre, surfaces par trimestre, carte des parcelles, prix et précipitations.</li>'
        + '<li><b>Prédictions</b> : choisissez un trimestre et activez les couches <i>Parcelles</i>, <i>Cultures</i> ou <i>Rendements</i>. '
        + 'Survolez (ou touchez) un point pour voir ses valeurs ; cliquez sur la légende pour masquer une couche. '
        + 'Le bouton <i>Exporter</i> télécharge les données affichées (CSV ou GeoJSON).</li>'
        + '<li><b>Carte des Prix</b> : l\'onglet <i>Graphiques</i> montre l\'évolution mensuelle des prix ; l\'onglet <i>Cartes</i> montre '
        + 'le prix moyen annuel par préfecture, avec une comparaison possible entre deux cartes.</li>'
        + '<li><b>Indices de Végétation</b> : application Google Earth Engine (NDVI, EVI).</li>'
        + '<li><b>Performances des modèles</b> : description des modèles et indicateurs calculés sur les données de démonstration.</li>'
        + '</ul></div></div>'

        + '<div class="card support-card"><div class="card-body">'
        + '<h5 class="mb-3">À propos des données</h5>'
        + '<p><b>Version de démonstration.</b> Les prédictions, rendements, prix et données météo affichés sont des données '
        + '<b>simulées</b> : ils ne décrivent pas la situation réelle et ne doivent pas servir à prendre des décisions. '
        + 'Seules les limites administratives du Togo sont réelles.</p>'
        + '<p class="mb-0" id="data-info">Fonds de carte : © OpenStreetMap, © CARTO, imagerie © Esri. '
        + 'Les valeurs affichées sont pré-calculées à partir des fichiers de l\'application d\'origine.</p>'
        + '</div></div>';
      return App.data('summary.json').then(function (s) {
        if (!ctx.alive()) return;
        ctx.el.querySelector('#data-info').insertAdjacentHTML('beforeend',
          ' Trimestres disponibles : ' + App.esc(s.quarters.join(', ')) + '. Données préparées le '
          + App.esc(new Date(s.generated + 'T00:00:00').toLocaleDateString('fr-FR')) + '.');
      }).catch(function () { /* information facultative */ });
    },
  };
})();
