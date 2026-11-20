/* Page « Prédictions » (adresse #/predictions).
 * Reprend pages/results.py et graphs/graphs.py (plot_results, graph_plot_yield) :
 *   - choix du trimestre ;
 *   - couches Parcelles (cultivées / non agricoles), Cultures (maïs, soja) et Rendements ;
 *   - fond de carte (Open Street Map, Satellite, Carto Positron) ;
 *   - panneau « Récapitulatif » (surfaces) et graphique des rendements par région (ridgeplot) ;
 *   - export CSV / GeoJSON de ce qui est affiché, fabriqué dans le navigateur.
 * Tout fonctionne sans serveur : les données de chaque trimestre sont lues à la demande.
 */
(function () {
  'use strict';
  const App = window.App;

  const CROPS = { MAIS: '🌽 Maïs', SOJA: '🌱 Soja' };
  const CROP_COLORS = { MAIS: 'yellow', SOJA: 'blue' };
  const CROP_BITS = { MAIS: { known: 8, yes: 2 }, SOJA: { known: 16, yes: 4 } };
  // Couleurs Viridis « plotly.express » utilisées par la bibliothèque ridgeplot
  const PX_VIRIDIS = ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'];
  const N_COLORS = 64;

  function round(v, d) { const f = Math.pow(10, d); return Math.round(v * f) / f; }

  /* ---------- Couches de la carte ---------- */

  function buildBaseLayers(grid, parc) {
    const agri = [], non = [], mais = [], soja = [];
    const missing = new Set(parc.missing || []);
    for (let i = 0; i < grid.n; i++) {
      if (missing.has(i)) continue;
      const c = parc.code[i];
      ((c & 1) ? agri : non).push(i);
      if (c & 2) mais.push(i);
      if (c & 4) soja.push(i);
    }
    const hover = function (k, i) {
      return '<b>' + App.fmt(parc.pct[i], 2) + ' %</b> de surface cultivée<br>Région : '
        + App.esc(grid.regionTitle[grid.region[i]]);
    };
    return {
      agri: { id: 'agri', group: 'parcel', name: 'Cultivées', color: 'darkgreen', radius: 2.5, indices: Int32Array.from(agri), hover: hover },
      non: { id: 'non', group: 'parcel', name: 'Non agricoles', color: 'grey', radius: 2.5, indices: Int32Array.from(non), hover: hover },
      MAIS: { id: 'MAIS', group: 'crop', name: CROPS.MAIS, color: CROP_COLORS.MAIS, radius: 2.5, indices: Int32Array.from(mais), hover: null },
      SOJA: { id: 'SOJA', group: 'crop', name: CROPS.SOJA, color: CROP_COLORS.SOJA, radius: 2.5, indices: Int32Array.from(soja), hover: null },
    };
  }

  /** Couche des rendements : couleur selon le logarithme du rendement (comme l'original). */
  function buildYieldLayer(grid, rend, crop) {
    const c = rend.crops[crop];
    const n = c.didx.length;
    const idx = new Int32Array(n);
    let acc = 0;
    for (let k = 0; k < n; k++) { acc += c.didx[k]; idx[k] = acc; }
    const logs = c.v.map(function (v) { return Math.log1p(v); });
    let cmin = Infinity, cmax = -Infinity;
    for (const l of logs) { if (l < cmin) cmin = l; if (l > cmax) cmax = l; }
    const palette = [];
    for (let j = 0; j < N_COLORS; j++) palette.push(App.viridis(j / (N_COLORS - 1)));
    const colorIndex = new Uint8Array(n);
    const span = cmax - cmin || 1;
    for (let k = 0; k < n; k++) colorIndex[k] = Math.round((logs[k] - cmin) / span * (N_COLORS - 1));
    return {
      id: 'yield-' + crop, group: 'yield', name: 'Rendement - ' + CROPS[crop], radius: 2.5,
      indices: idx, values: c.v, palette: palette, colorIndex: colorIndex,
      swatch: App.viridisCSS('to right'), cmin: cmin, cmax: cmax, crop: crop,
      hover: function (k, i) {
        return '<b>Rendement</b> : ' + App.fmt(c.v[k], 0) + ' kg/ha<br>Région : ' + App.esc(grid.regionTitle[grid.region[i]]);
      },
    };
  }

  /** Barre de couleurs : échelle logarithmique, graduée en kg/ha (valeurs réelles). */
  function yieldColorbar(layer) {
    const lo = Math.expm1(layer.cmin), hi = Math.expm1(layer.cmax);
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, lo))));
    function pick(factors) {
      const out = [];
      for (let m = mag; m <= hi * 10; m *= 10) {
        factors.forEach(function (f) { const v = m * f; if (v >= lo && v <= hi) out.push(v); });
      }
      return out;
    }
    let candidates = pick([1, 2, 5]);
    if (candidates.length < 3) candidates = pick([1, 1.5, 2, 3, 5, 7]);
    let ticks = candidates.map(function (v) { return { v: Math.log1p(v), label: App.fmt(v, 0) }; });
    if (ticks.length < 2) {
      ticks = [{ v: layer.cmin, label: App.fmt(lo, 0) }, { v: layer.cmax, label: App.fmt(hi, 0) }];
    }
    return { title: 'kg/ha (échelle log)', min: layer.cmin, max: layer.cmax, ticks: ticks };
  }

  /* ---------- Graphique des rendements par région (ridgeplot) ---------- */

  function hexRgb(h) { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function interpScale(p) {
    const x = p * (PX_VIRIDIS.length - 1);
    const k = Math.min(PX_VIRIDIS.length - 2, Math.floor(x));
    const f = x - k, a = hexRgb(PX_VIRIDIS[k]), b = hexRgb(PX_VIRIDIS[k + 1]);
    return 'rgb(' + a.map(function (c, i) { return round(c + f * (b[i] - c), 3); }).join(',') + ')';
  }
  /** Morceau de l'échelle Viridis correspondant à l'étendue d'une région (comme ridgeplot). */
  function sliceViridis(pl, pu) {
    const out = [[0, interpScale(pl)]];
    PX_VIRIDIS.forEach(function (c, k) {
      const p = k / (PX_VIRIDIS.length - 1);
      if (p > pl && p < pu) out.push([(p - pl) / (pu - pl), c]);
    });
    out.push([1, interpScale(pu)]);
    return out;
  }

  function ridgeFigure(el, ridge, crop) {
    if (!ridge) {
      el.innerHTML = '<p class="text-muted small p-2 mb-0">Pas assez de rendements pour tracer les courbes.</p>';
      return;
    }
    const spacing = 0.5, yMax = ridge.y_max, x0 = ridge.x_min, x1 = ridge.x_max, span = (x1 - x0) || 1;
    const traces = [], tickvals = [], ticktext = [];
    ridge.rows.forEach(function (row, i) {
      const n = row.d.length, yBase = -i * yMax * spacing;
      const x = new Array(n), base = new Array(n), y = new Array(n), dens = new Array(n);
      for (let k = 0; k < n; k++) {
        x[k] = row.x0 + (row.x1 - row.x0) * k / (n - 1);
        dens[k] = row.d[k] * yMax / 10000;
        base[k] = yBase;
        y[k] = yBase + dens[k];
      }
      tickvals.push(yBase);
      ticktext.push(row.label);
      traces.push({ type: 'scatter', x: x, y: base, mode: 'lines', line: { color: 'rgba(0,0,0,0)', width: 0 }, hoverinfo: 'skip', showlegend: false });
      traces.push({
        type: 'scatter', x: x, y: y, mode: 'lines', fill: 'tonexty', name: row.label,
        fillgradient: { type: 'horizontal', colorscale: sliceViridis((row.x0 - x0) / span, (row.x1 - x0) / span) },
        line: { color: 'black', width: 1.5 }, customdata: dens,
        hovertemplate: '<b>' + row.label + '</b><br>%{x:,.0f} kg/ha<br>' + App.fmt(row.n, 0) + ' cellules<extra></extra>',
      });
    });
    App.plot(el, traces, App.layout({
      font: { size: 16 },
      title: { text: 'Rendement - ' + CROPS[crop], font: { size: 14 } },
      xaxis: { title: { text: 'kg/ha', font: { size: 13 } }, range: [x0 - 0.05 * span, x1 + 0.05 * span], zeroline: false },
      yaxis: { tickmode: 'array', tickvals: tickvals, ticktext: ticktext, tickfont: { size: 10 }, title: { text: 'Régions', font: { size: 13 } }, zeroline: false, showgrid: true },
      showlegend: false,
      margin: { r: 10, t: 40, l: 10, b: 10 },
      height: 300,
    }), App.plotConfig({ displayModeBar: false }));
  }

  /* ---------- Export ---------- */

  function exportTable(state, grid, parc, rend) {
    const Q = state.quarter;
    const missing = new Set(parc.missing || []);
    const cells = [];
    for (let i = 0; i < grid.n; i++) if (!missing.has(i)) cells.push(i);
    const reg = function (i) { return grid.regions[grid.region[i]]; };
    const pct = function (i) { return parc.pct[i]; };
    const nonag = function (i) { return parc.pct[i] === null ? null : round(100 - parc.pct[i], 2); };
    const crop = function (i, c) {
      const b = CROP_BITS[c], code = parc.code[i];
      return (code & b.known) ? ((code & b.yes) ? 1 : 0) : null;
    };
    if (state.yld) {
      const c = rend.crops[state.yieldCrop];
      const rows = [];
      let acc = 0;
      for (let k = 0; k < c.didx.length; k++) {
        acc += c.didx[k];
        const i = acc;
        rows.push([grid.id(i), grid.lat[i], grid.lon[i], grid.regionTitle[grid.region[i]], Q, state.yieldCrop, c.v[k], round(Math.log1p(c.v[k]), 6)]);
      }
      return { suffix: '_yields_' + state.yieldCrop,
        columns: ['unique_id', 'lat', 'lon', 'Region', 'quarter', 'nom_culture', 'yield', 'log_yield'], rows: rows };
    }
    if (state.crop) {
      return { suffix: '_crops',
        columns: ['unique_id', 'lat', 'lon', 'region', 'quarter', 'MAIS', 'SOJA'],
        rows: cells.map(function (i) { return [grid.id(i), grid.lat[i], grid.lon[i], reg(i), Q, crop(i, 'MAIS'), crop(i, 'SOJA')]; }) };
    }
    if (state.parcel) {
      return { suffix: '_parcels',
        columns: ['unique_id', 'lat', 'lon', 'region', 'pct_agri', 'pct_nonag', 'area', 'quarter'],
        rows: cells.map(function (i) { return [grid.id(i), grid.lat[i], grid.lon[i], reg(i), pct(i), nonag(i), grid.area[i], Q]; }) };
    }
    return { suffix: '',
      columns: ['unique_id', 'lat', 'lon', 'region', 'pct_agri', 'pct_nonag', 'maj_cls', 'quarter', 'MAIS', 'SOJA', 'area'],
      rows: cells.map(function (i) {
        return [grid.id(i), grid.lat[i], grid.lon[i], reg(i), pct(i), nonag(i), parc.code[i] & 1, Q, crop(i, 'MAIS'), crop(i, 'SOJA'), grid.area[i]];
      }) };
  }

  /* ---------- Page ---------- */

  function switchHTML(id, label, checked) {
    return '<div class="form-check form-switch pred-switch"><input class="form-check-input" type="checkbox" role="switch" id="' + id + '"'
      + (checked ? ' checked' : '') + '><label class="form-check-label" for="' + id + '">' + label + '</label></div>';
  }

  App.pages['/predictions'] = {
    title: 'Prédictions',
    render: function (ctx) {
      const el = ctx.el;
      return Promise.all([App.data('summary.json'), App.grid()]).then(function (res) {
        if (!ctx.alive()) return;
        const s = res[0], grid = res[1];
        const quarters = s.quarters_desc;
        const state = { quarter: quarters[0], parcel: true, crop: false, yld: false, yieldCrop: 'MAIS', basemap: 'open-street-map' };
        const hiddenIds = new Set();

        el.innerHTML = '<h3>Prédictions</h3>'
          + '<div class="filter-bar">'
          + '<div class="filter-group"><label class="filter-label" for="res-quarter">Trimestre</label>'
          + '<select id="res-quarter" class="form-select form-select-sm quarter-dropdown">'
          + quarters.map(function (q) { return '<option value="' + q + '">' + q + '</option>'; }).join('') + '</select></div>'
          + switchHTML('sw-parcel', 'Parcelles', true) + switchHTML('sw-crop', 'Cultures', false) + switchHTML('sw-yield', 'Rendements', false)
          + '<div class="ms-auto dropdown export-menu">'
          + '<button type="button" class="btn btn-primary btn-sm dropdown-toggle" data-dropdown-toggle aria-expanded="false">'
          + App.icon('download', 'me-1') + 'Exporter</button>'
          + '<ul class="dropdown-menu dropdown-menu-end">'
          + '<li><button type="button" class="dropdown-item" data-format="csv">CSV (.csv)</button></li>'
          + '<li><button type="button" class="dropdown-item" data-format="geojson">GeoJSON (.geojson)</button></li>'
          + '<li><hr class="dropdown-divider"></li><li><span class="dropdown-item-text export-hint"></span></li>'
          + '</ul></div></div>'
          + '<div class="map-wrapper">'
          + '<div id="res-map" class="pred-map" aria-label="Carte des prédictions"></div>'
          + '<div class="map-controls">'
          + '<select id="map-style" class="form-select form-select-sm map-control" aria-label="Fond de carte">'
          + Object.keys(App.BASEMAPS).map(function (k) { return '<option value="' + k + '">' + App.BASEMAPS[k].label + '</option>'; }).join('')
          + '</select>'
          + '<select id="yield-crop" class="form-select form-select-sm map-control" aria-label="Culture des rendements" hidden>'
          + Object.keys(CROPS).map(function (k) { return '<option value="' + k + '">Rendement - ' + CROPS[k] + '</option>'; }).join('')
          + '</select></div>'
          + '<div class="recap-panel">'
          + '<div class="recap-header" role="button" tabindex="0" aria-expanded="true" aria-controls="recap-body">'
          + '<span>Récapitulatif</span>' + App.icon('chevron-up', 'recap-chevron') + '</div>'
          + '<div id="recap-body" class="recap-body"><div class="recap-table"></div>'
          + '<div class="parcel-ridgeplot" hidden></div></div></div>'
          + '</div>'
          + '<p class="small text-muted mt-2 mb-0">Survolez (ou touchez) un point pour afficher ses valeurs. '
          + 'Cliquez sur une entrée de la légende pour masquer ou afficher la couche correspondante.</p>';

        const $ = function (sel) { return el.querySelector(sel); };
        const wrapper = $('.map-wrapper');
        const map = App.createMap($('#res-map'));
        const loading = App.mapLoading(wrapper);
        const legend = new App.MapLegend().addTo(map);
        const pointLayer = new App.PointLayer(grid).addTo(map);
        App.attachHover(map, pointLayer);
        App.addRegionOutlines(map).catch(function () { /* contours facultatifs */ });
        const exportMenu = App.dropdown($('.export-menu'));

        let base = null, parc = null, rend = null, yieldLayer = null, token = 0;

        function setSwitches() {
          $('#sw-parcel').checked = state.parcel;
          $('#sw-crop').checked = state.crop;
          $('#sw-yield').checked = state.yld;
          $('#yield-crop').hidden = !state.yld;
        }

        function render() {
          if (!base) return;
          const layers = [base.agri, base.non, base.MAIS, base.SOJA];
          base.agri.visible = base.non.visible = state.parcel;
          base.MAIS.visible = base.SOJA.visible = state.crop;
          if (state.yld && yieldLayer) { yieldLayer.visible = true; layers.push(yieldLayer); }
          layers.forEach(function (l) { l.hidden = hiddenIds.has(l.id); });
          pointLayer.setLayers(layers);

          // Légende : seulement les groupes affichés (comme la légende Plotly)
          const groups = [];
          if (state.parcel) groups.push({ title: 'Parcelles', items: [base.agri, base.non] });
          if (state.crop) groups.push({ title: 'Cultures', items: [base.MAIS, base.SOJA] });
          if (state.yld && yieldLayer) groups.push({ title: 'Rendements', items: [yieldLayer], colorbar: yieldColorbar(yieldLayer) });
          legend.update(groups, function (it) {
            if (it.hidden) hiddenIds.add(it.id); else hiddenIds.delete(it.id);
            pointLayer.refresh();
          });

          // Récapitulatif
          const show = [];
          if (state.parcel) show.push('Cultivées');
          if (state.crop) show.push(CROPS.MAIS, CROPS.SOJA);
          const rows = (s.insights[state.quarter] || []).filter(function (r) { return show.indexOf(r[0]) >= 0; });
          const tableBox = $('.recap-table');
          if (rows.length) {
            tableBox.innerHTML = App.table(['Surfaces', 'Superficie (km²)', 'Superficie (%)'],
              rows.map(function (r) { return [r[0], App.fmt(r[1], 0), App.fmt(r[2], 0)]; }), 'recap');
          } else if (state.yld) {
            tableBox.innerHTML = '';
          } else {
            tableBox.innerHTML = '<p class="text-muted small p-3 mb-0">Activez « Parcelles » ou « Cultures » pour afficher les surfaces.</p>';
          }
          const ridgeBox = $('.parcel-ridgeplot');
          ridgeBox.hidden = !(state.yld && rend);
          if (state.yld && rend) ridgeFigure(ridgeBox, rend.crops[state.yieldCrop].ridge, state.yieldCrop);
          else if (ridgeBox.classList.contains('js-plotly-plot')) Plotly.purge(ridgeBox);

          // Ce que l'export va contenir
          const what = state.yld ? 'rendements (' + CROPS[state.yieldCrop] + ')' : state.crop ? 'cultures (maïs, soja)'
            : state.parcel ? 'parcelles' : 'toutes les colonnes';
          $('.export-hint').textContent = 'Exporte : ' + what + ', ' + state.quarter;
        }

        function load() {
          const my = ++token;
          loading.show();
          const needs = [App.data('parcelles/' + state.quarter + '.json')];
          if (state.yld) needs.push(App.data('rendements/' + state.quarter + '.json'));
          return Promise.all(needs).then(function (r) {
            if (my !== token || !ctx.alive()) return;
            if (r[0] !== parc) { parc = r[0]; base = buildBaseLayers(grid, parc); }
            if (r[1]) {
              if (r[1] !== rend || !yieldLayer || yieldLayer.crop !== state.yieldCrop) {
                rend = r[1];
                yieldLayer = buildYieldLayer(grid, rend, state.yieldCrop);
              }
            }
            loading.hide();
            render();
          }).catch(function (err) {
            if (my !== token || !ctx.alive()) return;
            loading.hide();
            $('.recap-table').innerHTML = App.errorBox(err);
          });
        }

        $('#res-quarter').addEventListener('change', function (e) {
          state.quarter = e.target.value;
          rend = null; yieldLayer = null;
          load();
        });
        $('#sw-parcel').addEventListener('change', function (e) {
          state.parcel = e.target.checked;
          if (state.parcel) state.yld = false;   // les rendements s'affichent seuls
          setSwitches(); load();
        });
        $('#sw-crop').addEventListener('change', function (e) {
          state.crop = e.target.checked;
          if (state.crop) state.yld = false;
          setSwitches(); load();
        });
        $('#sw-yield').addEventListener('change', function (e) {
          state.yld = e.target.checked;
          if (state.yld) { state.parcel = false; state.crop = false; }
          setSwitches(); load();
        });
        $('#yield-crop').addEventListener('change', function (e) {
          state.yieldCrop = e.target.value;
          yieldLayer = null;
          load();
        });
        $('#map-style').addEventListener('change', function (e) {
          state.basemap = e.target.value;
          map.setBasemap(state.basemap);
        });
        const recapHeader = $('.recap-header');
        function toggleRecap() {
          const body = $('#recap-body');
          body.hidden = !body.hidden;
          recapHeader.setAttribute('aria-expanded', String(!body.hidden));
          recapHeader.querySelector('use').setAttribute('href', body.hidden ? '#bi-chevron-down' : '#bi-chevron-up');
        }
        recapHeader.addEventListener('click', toggleRecap);
        recapHeader.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRecap(); } });

        el.querySelectorAll('[data-format]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            exportMenu.close();
            if (!parc || (state.yld && !rend)) return;   // données encore en cours de chargement
            const t = exportTable(state, grid, parc, rend);
            const name = 'prediction_data_' + state.quarter + t.suffix;
            if (btn.dataset.format === 'csv') {
              App.download(name + '.csv', App.toCSV(t.columns, t.rows), 'text/csv;charset=utf-8');
            } else {
              App.download(name + '.geojson', App.toPointGeoJSON(t.columns, t.rows, 'lat', 'lon'), 'application/geo+json');
            }
          });
        });

        setSwitches();
        load();
        return function cleanup() { exportMenu.destroy(); map.remove(); };
      });
    },
  };
})();
