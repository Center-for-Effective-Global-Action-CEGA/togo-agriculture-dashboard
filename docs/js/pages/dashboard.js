/* Page « Tableau de bord » / "Dashboard" (adresse #/).
 * Reprend pages/dashboard.py : 4 chiffres clés, surfaces par trimestre, carte des parcelles du dernier
 * trimestre, tableau des prix nationaux et tableau des pluies. Tous les chiffres viennent de
 * data/summary.json (calculés par scripts/build_static_data.py avec les mêmes formules).
 * Les textes affichés viennent des dictionnaires js/i18n/en.js et js/i18n/fr.js (App.t).
 */
(function () {
  'use strict';
  const App = window.App;

  function deltaBadge(delta, prevQ) {
    if (delta === null || delta === undefined) return '<div class="kpi-delta"></div>';
    const up = delta >= 0.05;
    return '<div class="kpi-delta ' + (up ? 'up' : 'down') + '">' + (up ? '↑' : '↓') + ' '
      + App.pct(Math.abs(delta), 1) + ' vs ' + App.esc(prevQ) + '</div>';
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
    function btn(p, label, symbol, disabled) {
      return '<button type="button" class="btn btn-sm btn-light" data-p="' + p + '" aria-label="' + App.t(label) + '"'
        + (disabled ? ' disabled' : '') + '>' + symbol + '</button>';
    }
    function draw() {
      const slice = rows.slice(page * pageSize, (page + 1) * pageSize);
      container.innerHTML = App.table(columns, slice)
        + (pages > 1 ? '<nav class="pager" aria-label="' + App.t('pager.label') + '">'
          + btn('first', 'pager.first', '«', page === 0)
          + btn('prev', 'pager.prev', '‹', page === 0)
          + '<span class="pager-text">' + (page + 1) + ' / ' + pages + '</span>'
          + btn('next', 'pager.next', '›', page === pages - 1)
          + btn('last', 'pager.last', '»', page === pages - 1)
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
    // Les noms de colonnes viennent des données (en français) ; seuls les libellés affichés sont traduits
    const series = [['Cultivées', 'chart.cultivated', '#636EFA'], ['Maïs', 'chart.maize', '#EF553B'], ['Soja', 'chart.soy', '#00CC96']];
    const traces = series.map(function (c) {
      const name = App.t(c[1]);
      return {
        type: 'bar', name: name, x: s.areas.quarters, y: s.areas[c[0]], marker: { color: c[2] },
        hovertemplate: App.t('chart.areaHover', { name: name }),
      };
    });
    return App.plot(el, traces, App.layout({
      barmode: 'group',
      legend: App.legend(el, App.t('chart.crops')),
      xaxis: { title: { text: App.t('chart.quarter') }, type: 'category' },
      yaxis: { title: { text: App.t('chart.area') } },
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
        return App.t('hover.pct', { v: App.pct(parc.pct[i], 2), region: App.esc(grid.regionTitle[grid.region[i]]) });
      };
      const layers = [
        { id: 'agri', name: App.t('layer.agri'), color: 'darkgreen', radius: 2, visible: true, indices: Int32Array.from(agri), hover: hover },
        { id: 'non', name: App.t('layer.nonagri'), color: 'grey', radius: 2, visible: true, indices: Int32Array.from(non), hover: hover },
      ];
      const pl = new App.PointLayer(grid).addTo(map);
      pl.setLayers(layers);
      App.attachHover(map, pl);
      legend.update([{ title: App.t('legend.plots'), items: layers }], function () { pl.refresh(); });
      loading.hide();
    }).catch(function (err) {
      if (!ctx.alive()) return;
      loading.hide();
      wrapper.insertAdjacentHTML('beforeend', '<div class="map-error">' + App.errorBox(err) + '</div>');
    });
    return map;
  }

  App.pages['/'] = {
    titleKey: 'page.dashboard',
    render: function (ctx) {
      const el = ctx.el;
      return App.data('summary.json').then(function (s) {
        if (!ctx.alive()) return;
        const k = s.kpi;
        el.innerHTML = '<h3>' + App.t('page.dashboard') + '</h3>'
          + '<div class="row g-3 mb-3">'
          + kpiCard(App.t('dash.kpi.crops'), App.t('dash.kpi.cropsValue'), 'graph-up')
          + kpiCard(App.t('dash.kpi.area'), App.fmt(k.surface_last, 0) + ' km²', 'geo-alt', deltaBadge(k.surface_delta, s.prev_q))
          + kpiCard(App.t('dash.kpi.rain'), App.fmt(k.precip_last, 0) + ' mm', 'cloud-rain')
          + kpiCard(App.t('dash.kpi.flow'), App.fmt(k.debit_last, 1) + ' m³/s', 'bullseye', deltaBadge(k.debit_delta, s.prev_q))
          + '</div>'
          + '<div class="row g-3 mb-3">'
          + '<div class="col-lg-6">' + sectionCard(App.t('dash.areaChart'), '<div id="areas-chart" class="chart-340"></div>') + '</div>'
          + '<div class="col-lg-6">' + sectionCard(App.t('dash.parcels', { q: s.last_q }),
            '<div class="mini-map-wrapper"><div id="parcels-map" class="mini-map" aria-label="' + App.t('dash.map.aria') + '"></div></div>', 'p-2') + '</div>'
          + '</div>'
          + '<div class="row g-3">'
          + '<div class="col-lg-6">' + sectionCard(App.t('dash.prices', { year: s.price_table.year }), '<div id="price-table"></div>') + '</div>'
          + '<div class="col-lg-6">' + sectionCard(App.t('dash.rain', { q: s.last_q }), '<div id="precip-table"></div>') + '</div>'
          + '</div>';

        areasFigure(el.querySelector('#areas-chart'), s);
        const priceRows = App.sortBy(s.price_table.rows, function (r) { return App.product(r[0]); });
        pagedTable(el.querySelector('#price-table'), [App.t('table.commodity'), App.t('table.avgPrice')],
          priceRows.map(function (r) { return [App.product(r[0]), App.fmt(r[1], 0)]; }), 10);
        el.querySelector('#precip-table').innerHTML = App.table([App.t('table.region'), App.t('table.rain')],
          s.precip_table.map(function (r) { return [r[0], App.fmt(r[1], 2)]; }));

        const map = parcelsMap(el.querySelector('.mini-map-wrapper'), el.querySelector('#parcels-map'), s, ctx);
        return function cleanup() { map.remove(); };
      });
    },
  };
})();
