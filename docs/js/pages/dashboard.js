/* Page « Tableau de bord » (adresse #/).
 * Reprend pages/dashboard.py : 4 chiffres clés, surfaces par trimestre, carte des parcelles du dernier
 * trimestre, tableau des prix nationaux et tableau des pluies. Tous les chiffres viennent de
 * data/summary.json (calculés par scripts/build_static_data.py avec les mêmes formules).
 */
(function () {
  'use strict';
  const App = window.App;

  function deltaBadge(delta, prevQ) {
    if (delta === null || delta === undefined) return '<div class="kpi-delta"></div>';
    const up = delta >= 0.05;
    return '<div class="kpi-delta ' + (up ? 'up' : 'down') + '">' + (up ? '↑' : '↓') + ' '
      + App.fmt(Math.abs(delta), 1) + ' % vs ' + App.esc(prevQ) + '</div>';
  }

  function kpiCard(label, value, icon, deltaHTML) {
    return '<div class="col-md-6 col-xl-3"><div class="card kpi-card h-100"><div class="card-body">'
      + '<div class="kpi-top"><div><div class="kpi-label">' + App.esc(label) + '</div>'
      + '<div class="kpi-value">' + value + '</div></div>'
      + '<div class="kpi-icon">' + App.icon(icon) + '</div></div>'
      + (deltaHTML || '<div class="kpi-delta"></div>') + '</div></div></div>';
  }

  function sectionCard(title, bodyHTML, bodyClass) {
    return '<div class="card section-card h-100"><div class="card-header section-header">' + App.esc(title) + '</div>'
      + '<div class="card-body ' + (bodyClass || '') + '">' + bodyHTML + '</div></div>';
  }

  /** Tableau paginé (10 lignes par page, comme la DataTable d'origine). */
  function pagedTable(container, columns, rows, pageSize) {
    let page = 0;
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    function draw() {
      const slice = rows.slice(page * pageSize, (page + 1) * pageSize);
      container.innerHTML = App.table(columns, slice)
        + (pages > 1 ? '<nav class="pager" aria-label="Pages du tableau">'
          + '<button type="button" class="btn btn-sm btn-light" data-p="first" aria-label="Première page"' + (page === 0 ? ' disabled' : '') + '>«</button>'
          + '<button type="button" class="btn btn-sm btn-light" data-p="prev" aria-label="Page précédente"' + (page === 0 ? ' disabled' : '') + '>‹</button>'
          + '<span class="pager-text">' + (page + 1) + ' / ' + pages + '</span>'
          + '<button type="button" class="btn btn-sm btn-light" data-p="next" aria-label="Page suivante"' + (page === pages - 1 ? ' disabled' : '') + '>›</button>'
          + '<button type="button" class="btn btn-sm btn-light" data-p="last" aria-label="Dernière page"' + (page === pages - 1 ? ' disabled' : '') + '>»</button>'
          + '</nav>' : '');
    }
    container.addEventListener('click', function (e) {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      page = { first: 0, prev: Math.max(0, page - 1), next: Math.min(pages - 1, page + 1), last: pages - 1 }[b.dataset.p];
      draw();
    });
    draw();
  }

  function areasFigure(el, s) {
    const colors = { 'Cultivées': '#636EFA', 'Maïs': '#EF553B', 'Soja': '#00CC96' };
    const traces = ['Cultivées', 'Maïs', 'Soja'].map(function (col) {
      return {
        type: 'bar', name: col, x: s.areas.quarters, y: s.areas[col], marker: { color: colors[col] },
        hovertemplate: '%{x}<br>' + col + ' : %{y:,.0f} km²<extra></extra>',
      };
    });
    return App.plot(el, traces, App.layout({
      barmode: 'group',
      legend: App.legend(el, 'Cultures'),
      xaxis: { title: { text: 'Trimestre' }, type: 'category' },
      yaxis: { title: { text: 'Surface (km²)' } },
      margin: { l: 10, r: 10, t: 20, b: 10 },
      height: 340,
    }));
  }

  function parcelsMap(wrapper, mapEl, s, ctx) {
    const map = App.createMap(mapEl, { zoomPosition: 'topleft' });
    const loading = App.mapLoading(wrapper);
    const legend = new App.MapLegend().addTo(map);
    App.addRegionOutlines(map).catch(function () { /* contours facultatifs */ });
    Promise.all([App.grid(), App.data('parcelles/' + s.last_q + '.json')]).then(function (res) {
      if (!ctx.alive()) return;
      const grid = res[0], parc = res[1];
      const agri = [], non = [];
      const missing = new Set(parc.missing || []);
      for (let i = 0; i < grid.n; i++) {
        if (missing.has(i)) continue;
        ((parc.code[i] & 1) ? agri : non).push(i);
      }
      const hover = function (k, i) {
        return '<b>' + App.fmt(parc.pct[i], 2) + ' %</b> de surface cultivée<br>Région : ' + App.esc(grid.regionTitle[grid.region[i]]);
      };
      const layers = [
        { id: 'agri', name: 'Agricoles', color: 'darkgreen', radius: 2, visible: true, indices: Int32Array.from(agri), hover: hover },
        { id: 'non', name: 'Non agricoles', color: 'grey', radius: 2, visible: true, indices: Int32Array.from(non), hover: hover },
      ];
      const pl = new App.PointLayer(grid).addTo(map);
      pl.setLayers(layers);
      App.attachHover(map, pl);
      legend.update([{ title: 'Parcelles', items: layers }], function () { pl.refresh(); });
      loading.hide();
    }).catch(function (err) {
      if (!ctx.alive()) return;
      loading.hide();
      wrapper.insertAdjacentHTML('beforeend', '<div class="map-error">' + App.errorBox(err) + '</div>');
    });
    return map;
  }

  App.pages['/'] = {
    title: 'Tableau de bord',
    render: function (ctx) {
      const el = ctx.el;
      return App.data('summary.json').then(function (s) {
        if (!ctx.alive()) return;
        const k = s.kpi;
        el.innerHTML = '<h3>Tableau de bord</h3>'
          + '<div class="row g-3 mb-3">'
          + kpiCard('Cultures couvertes', 'Maïs &amp; Soja', 'graph-up')
          + kpiCard('Surfaces cultivées', App.fmt(k.surface_last, 0) + ' km²', 'geo-alt', deltaBadge(k.surface_delta, s.prev_q))
          + kpiCard('Précipitations moyennes', App.fmt(k.precip_last, 0) + ' mm', 'cloud-rain')
          + kpiCard('Débit moyen', App.fmt(k.debit_last, 1) + ' m³/s', 'bullseye', deltaBadge(k.debit_delta, s.prev_q))
          + '</div>'
          + '<div class="row g-3 mb-3">'
          + '<div class="col-lg-6">' + sectionCard('Superficie des cultures', '<div id="areas-chart" class="chart-340"></div>') + '</div>'
          + '<div class="col-lg-6">' + sectionCard('Parcelles cultivées (emblavées) — ' + s.last_q,
            '<div class="mini-map-wrapper"><div id="parcels-map" class="mini-map" aria-label="Carte des parcelles"></div></div>', 'p-2') + '</div>'
          + '</div>'
          + '<div class="row g-3">'
          + '<div class="col-lg-6">' + sectionCard('Prix moyens par culture (' + s.price_table.year + ', national)', '<div id="price-table"></div>') + '</div>'
          + '<div class="col-lg-6">' + sectionCard('Précipitations moyennes — ' + s.last_q, '<div id="precip-table"></div>') + '</div>'
          + '</div>';

        areasFigure(el.querySelector('#areas-chart'), s);
        pagedTable(el.querySelector('#price-table'), ['Denrée', 'Prix moyen (FCFA/kg)'],
          s.price_table.rows.map(function (r) { return [r[0], App.fmt(r[1], 0)]; }), 10);
        el.querySelector('#precip-table').innerHTML = App.table(['Région', 'Hauteur (mm)'],
          s.precip_table.map(function (r) { return [r[0], App.fmt(r[1], 2)]; }));

        const map = parcelsMap(el.querySelector('.mini-map-wrapper'), el.querySelector('#parcels-map'), s, ctx);
        return function cleanup() { map.remove(); };
      });
    },
  };
})();
