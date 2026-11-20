/* Page « Carte des Prix » (adresse #/price).
 * Reprend pages/price.py :
 *   - onglet « Graphiques » : évolution mensuelle des prix (zone au choix) et boîtes à moustaches par zone ;
 *   - onglet « Cartes » : prix moyen annuel par préfecture, avec comparaison de deux cartes côte à côte.
 */
(function () {
  'use strict';
  const App = window.App;

  /* ---------- Onglet Graphiques ---------- */

  function decodeSeries(d) {
    // index : produit -> zone -> { t: [mois], v: [prix] } (tous les relevés, doublons compris)
    const out = d.products.map(function () { return {}; });
    for (const s of d.series) {
      const t = [], v = [];
      s[3].forEach(function (val, k) { if (val !== null) { t.push(s[2] + k); v.push(val); } });
      if (s[4]) s[4].forEach(function (e) { t.push(e[0]); v.push(e[1]); });
      out[s[0]][s[1]] = { t: t, v: v };
    }
    return out;
  }

  function monthToDate(base, t) {
    const y = base + Math.floor(t / 12), m = (t % 12) + 1;
    return y + '-' + (m < 10 ? '0' : '') + m + '-01';
  }

  function drawGraphs(root, d, idx, selected, zone) {
    const lineEl = root.querySelector('#price-graph'), boxEl = root.querySelector('#box-plot');
    const zi = d.zones.indexOf(zone);
    const narrow = App.isNarrow(lineEl);
    const common = { legend: App.legend(lineEl, 'Denrée', 'bottom') };
    if (!selected.length) {
      App.plot(lineEl, [], App.layout({ title: { text: 'Aucune denrée sélectionnée' } }));
      App.plot(boxEl, [], App.layout({}));
      return;
    }
    const colorOf = {};
    selected.forEach(function (p, k) { colorOf[p] = App.COLORWAY[k % App.COLORWAY.length]; });

    // Courbes : prix moyen par mois dans la zone choisie
    const lines = [];
    for (const p of selected) {
      const s = idx[d.products.indexOf(p)][zi];
      if (!s) continue;
      const agg = new Map();
      s.t.forEach(function (t, k) {
        const a = agg.get(t) || [0, 0];
        a[0] += s.v[k]; a[1] += 1;
        agg.set(t, a);
      });
      const ts = Array.from(agg.keys()).sort(function (a, b) { return a - b; });
      lines.push({
        type: 'scatter', mode: 'lines+markers', name: p,
        x: ts.map(function (t) { return monthToDate(d.base_year, t); }),
        y: ts.map(function (t) { const a = agg.get(t); return a[0] / a[1]; }),
        line: { color: colorOf[p] }, marker: { color: colorOf[p] },
        hovertemplate: '<b>' + App.esc(p) + '</b><br>%{x|%B %Y}<br>%{y:,.1f} FCFA/kg<extra></extra>',
      });
    }
    if (!lines.length) {
      App.plot(lineEl, [], App.layout({ title: { text: 'Aucune donnée disponible' } }));
      App.plot(boxEl, [], App.layout({}));
      return;
    }
    App.plot(lineEl, lines, App.layout(Object.assign({}, common, {
      title: { text: 'Prix des denrées sélectionnées' + (App.isNarrow(lineEl) ? '<br>' : ' ') + '(' + App.esc(zone) + ')' },
      xaxis: { title: { text: narrow ? '' : 'Date' }, type: 'date' },
      yaxis: { title: { text: 'Prix (FCFA/kg)' } },
    })));

    // Boîtes : répartition de tous les prix mensuels, par zone et par denrée
    const boxes = selected.map(function (p) {
      const pi = d.products.indexOf(p), x = [], y = [];
      d.zones.forEach(function (z, k) {
        const s = idx[pi][k];
        if (!s) return;
        for (const v of s.v) { x.push(z); y.push(v); }
      });
      return {
        type: 'box', name: p, x: x, y: y, marker: { color: colorOf[p] }, line: { color: colorOf[p] },
        boxpoints: 'outliers', offsetgroup: p, alignmentgroup: 'prix',
        hovertemplate: '<b>' + App.esc(p) + '</b><br>%{x}<br>%{y:,.1f} FCFA/kg<extra></extra>',
      };
    });
    App.plot(boxEl, boxes, App.layout(Object.assign({}, common, {
      title: { text: App.isNarrow(boxEl) ? 'Distribution des prix<br>par zone et denrée' : 'Distribution des prix par zone et denrée' },
      boxmode: 'group',
      xaxis: { title: { text: narrow ? '' : 'Zone' }, type: 'category', categoryorder: 'array', categoryarray: d.zones },
      yaxis: { title: { text: 'Prix (FCFA/kg)' } },
      height: 450,
    })));
  }

  function graphsTab(pane, ctx) {
    pane.innerHTML = '<div class="py-2">' + '<div class="spinner-border spinner-border-sm me-2"></div>Chargement…</div>';
    return App.data('prix_series.json').then(function (d) {
      if (!ctx.alive()) return;
      const idx = decodeSeries(d);
      const first = d.products[0];
      pane.innerHTML = '<div class="card mb-3 mt-2"><div class="card-body"><div class="row g-2 p-2 align-items-start">'
        + '<div class="col-12 col-md-auto"><div class="fw-bold p-2">Filtres Graphiques</div></div>'
        + '<div class="col-12 col-md-5"><fieldset><legend class="visually-hidden">Denrées</legend>'
        + '<div class="checklist" id="checklist-denree">'
        + d.products.map(function (p, k) {
          return '<div class="form-check"><input class="form-check-input" type="checkbox" id="den-' + k + '" value="' + App.esc(p) + '"'
            + (p === first ? ' checked' : '') + '><label class="form-check-label" for="den-' + k + '">' + App.esc(p) + '</label></div>';
        }).join('') + '</div></fieldset>'
        + '<button type="button" class="btn btn-link btn-sm px-0" id="clear-denrees">Tout désélectionner</button></div>'
        + '<div class="col-12 col-md-3"><label class="form-label small text-muted mb-1" for="dropdown-region">Zone</label>'
        + '<select class="form-select form-select-sm" id="dropdown-region">'
        + d.zones.map(function (z) { return '<option' + (z === 'National' ? ' selected' : '') + '>' + App.esc(z) + '</option>'; }).join('')
        + '</select></div></div></div></div>'
        + '<div id="price-graph" class="price-graph"></div>'
        + '<div id="box-plot" class="mt-3"></div>';
      function update() {
        const selected = Array.from(pane.querySelectorAll('#checklist-denree input:checked')).map(function (i) { return i.value; });
        drawGraphs(pane, d, idx, selected, pane.querySelector('#dropdown-region').value);
      }
      pane.querySelector('#checklist-denree').addEventListener('change', update);
      pane.querySelector('#dropdown-region').addEventListener('change', update);
      pane.querySelector('#clear-denrees').addEventListener('click', function () {
        pane.querySelectorAll('#checklist-denree input').forEach(function (i) { i.checked = false; });
        update();
      });
      update();
    });
  }

  /* ---------- Onglet Cartes ---------- */

  function mapsTab(pane, ctx, cleanups) {
    pane.innerHTML = '<div class="py-2"><div class="spinner-border spinner-border-sm me-2"></div>Chargement…</div>';
    return Promise.all([App.data('prix_prefectures.json'), App.data('prefectures.geojson')]).then(function (res) {
      if (!ctx.alive()) return;
      const P = res[0], gj = res[1];
      const products = P.products;
      const lastYear = P.years[P.years.length - 1];
      const prefIndex = {};
      P.prefectures.forEach(function (n, k) { prefIndex[n] = k; });

      pane.innerHTML = '<div class="card mb-3 mt-2"><div class="card-body"><div class="row g-2 p-2 align-items-center">'
        + '<div class="col-auto"><div class="fw-bold p-2">Cartes des prix</div></div>'
        + '<div class="col-auto"><div class="form-check form-switch mb-0"><input class="form-check-input" type="checkbox" role="switch" id="switch-compare">'
        + '<label class="form-check-label" for="switch-compare">Faire une comparaison</label></div></div>'
        + '<div class="col-auto" id="same-scale-box" hidden><div class="form-check mb-0"><input class="form-check-input" type="checkbox" id="same-scale">'
        + '<label class="form-check-label" for="same-scale">Même échelle de couleurs</label></div></div>'
        + '</div></div></div>'
        + '<div class="row g-2" id="map-container"></div>';

      const container = pane.querySelector('#map-container');
      const cards = [];
      let syncing = false;

      function makeCard(n, init, colClass) {
        const col = App.h('<div class="' + colClass + '"><div class="price-map-card">'
          + '<div class="row g-2 mb-2"><div class="col-sm-7"><label class="fw-bold" for="den-map-' + n + '">Denrée</label>'
          + '<select class="form-select form-select-sm" id="den-map-' + n + '">'
          + products.map(function (p) { return '<option' + (p === init.product ? ' selected' : '') + '>' + App.esc(p) + '</option>'; }).join('')
          + '</select></div><div class="col-sm-5"><label class="fw-bold" for="annee-map-' + n + '">Année</label>'
          + '<select class="form-select form-select-sm" id="annee-map-' + n + '">'
          + P.years.map(function (y) { return '<option' + (y === init.year ? ' selected' : '') + '>' + y + '</option>'; }).join('')
          + '</select></div></div>'
          + '<div class="price-map-title"></div>'
          + '<div class="price-map-wrapper"><div class="price-map" aria-label="Carte des prix par préfecture"></div></div>'
          + '<div class="map-message text-danger fw-bold p-2" role="status"></div></div></div>');
        container.appendChild(col);
        const map = App.createMap(col.querySelector('.price-map'), { basemap: 'carto-positron' });
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function () { const d = L.DomUtil.create('div', 'map-legend'); L.DomEvent.disableClickPropagation(d); return d; };
        legend.addTo(map);
        const layer = L.geoJSON(gj, { style: { weight: 1, color: '#444', fillOpacity: 0 } }).addTo(map);
        const card = { col: col, map: map, layer: layer, legend: legend, values: null };
        col.querySelectorAll('select').forEach(function (s) { s.addEventListener('change', refreshAll); });
        map.on('move', function () {
          if (syncing || cards.length < 2) return;
          syncing = true;
          cards.forEach(function (c) { if (c !== card) c.map.setView(map.getCenter(), map.getZoom(), { animate: false }); });
          syncing = false;
        });
        return card;
      }

      function cardValues(card) {
        const product = card.col.querySelector('select[id^="den-map"]').value;
        const year = +card.col.querySelector('select[id^="annee-map"]').value;
        const yi = P.years.indexOf(year);
        return { product: product, year: year, values: (P.values[product] && yi >= 0) ? P.values[product][yi] : [] };
      }

      function refreshAll() {
        const sameScale = cards.length > 1 && pane.querySelector('#same-scale').checked;
        const all = cards.map(cardValues);
        let gmin = Infinity, gmax = -Infinity;
        all.forEach(function (a) { a.values.forEach(function (v) { if (v !== null) { gmin = Math.min(gmin, v); gmax = Math.max(gmax, v); } }); });
        cards.forEach(function (card, k) { drawChoropleth(card, all[k], sameScale ? [gmin, gmax] : null); });
      }

      function drawChoropleth(card, sel, range) {
        const vals = sel.values.filter(function (v) { return v !== null; });
        const title = card.col.querySelector('.price-map-title');
        const msg = card.col.querySelector('.map-message');
        title.textContent = 'Prix moyen de ' + sel.product + ' - ' + sel.year;
        if (!vals.length) {
          msg.textContent = 'Aucune donnée disponible';
          card.layer.setStyle({ weight: 1, color: '#9CA3AF', fillOpacity: 0 });
          card.layer.eachLayer(function (l) { l.unbindTooltip(); });
          card.legend.getContainer().hidden = true;
          return;
        }
        msg.textContent = '';
        const min = range ? range[0] : Math.min.apply(null, vals);
        const max = range ? range[1] : Math.max.apply(null, vals);
        const span = (max - min) || 1;
        card.layer.eachLayer(function (l) {
          const name = l.feature.properties.prefecture;
          const v = sel.values[prefIndex[name]];
          const has = v !== null && v !== undefined;
          l.setStyle(has
            ? { fillColor: App.viridis((v - min) / span), fillOpacity: 0.85, color: '#444', weight: 1, dashArray: null }
            : { fillOpacity: 0, color: '#9CA3AF', weight: 1, dashArray: '3 3' });
          l.unbindTooltip();
          l.bindTooltip('<b>' + App.esc(name) + '</b><br>' + (has ? 'Prix (FCFA/kg) : ' + App.fmt(v, 1) : 'Pas de prix relevé'),
            { sticky: true, direction: 'top', className: 'price-tooltip' });
          l.off('mouseover mouseout');
          l.on('mouseover', function () { l.setStyle({ weight: 2.5, color: '#111' }); l.bringToFront(); });
          l.on('mouseout', function () { l.setStyle({ weight: 1, color: has ? '#444' : '#9CA3AF' }); });
        });
        const ticks = App.niceTicks(min, max, 5).map(function (v) { return { v: v, label: App.fmt(v, 0) }; });
        const div = card.legend.getContainer();
        div.hidden = false;
        div.innerHTML = '<div class="legend-group">' + App.colorbarHTML({ title: 'Prix (FCFA/kg)', min: min, max: max, ticks: ticks }) + '</div>';
      }

      function layout(compare) {
        const keep = cards.length ? cardValues(cards[0]) : { product: products[0], year: lastYear };
        while (cards.length) { const c = cards.pop(); c.map.remove(); c.col.remove(); }
        const colClass = compare ? 'col-12 col-lg-6' : 'col-12';
        cards.push(makeCard(1, keep, colClass));
        if (compare) cards.push(makeCard(2, { product: keep.product, year: P.years[Math.max(0, P.years.indexOf(keep.year) - 1)] }, colClass));
        pane.querySelector('#same-scale-box').hidden = !compare;
        refreshAll();
      }

      pane.querySelector('#switch-compare').addEventListener('change', function (e) { layout(e.target.checked); });
      pane.querySelector('#same-scale').addEventListener('change', refreshAll);
      layout(false);
      cleanups.push(function () { cards.forEach(function (c) { c.map.remove(); }); });
    });
  }

  /* ---------- Page ---------- */

  App.pages['/price'] = {
    title: 'Carte des Prix',
    render: function (ctx) {
      const el = ctx.el;
      const cleanups = [];
      el.innerHTML = '<h3>Carte des Prix</h3>'
        + '<div class="card mb-3"><div class="card-header bg-white border-bottom-0 pb-0">'
        + '<ul class="nav nav-tabs card-header-tabs" role="tablist">'
        + '<li class="nav-item" role="presentation"><button type="button" class="nav-link active" role="tab" id="tab-graphs" aria-controls="pane-graphs" aria-selected="true" data-tab="graphs">Graphiques</button></li>'
        + '<li class="nav-item" role="presentation"><button type="button" class="nav-link" role="tab" id="tab-maps" aria-controls="pane-maps" aria-selected="false" data-tab="maps">Cartes</button></li>'
        + '</ul></div><div class="card-body pt-2">'
        + '<div id="pane-graphs" role="tabpanel" aria-labelledby="tab-graphs"></div>'
        + '<div id="pane-maps" role="tabpanel" aria-labelledby="tab-maps" hidden></div>'
        + '</div></div>';
      const loaded = {};
      function open(tab) {
        el.querySelectorAll('[data-tab]').forEach(function (b) {
          const on = b.dataset.tab === tab;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', String(on));
          el.querySelector('#pane-' + b.dataset.tab).hidden = !on;
        });
        if (loaded[tab]) return;
        loaded[tab] = true;
        const pane = el.querySelector('#pane-' + tab);
        const p = tab === 'graphs' ? graphsTab(pane, ctx) : mapsTab(pane, ctx, cleanups);
        p.catch(function (err) { if (ctx.alive()) pane.innerHTML = App.errorBox(err); });
      }
      el.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { open(b.dataset.tab); }); });
      open('graphs');
      return function cleanup() { cleanups.forEach(function (f) { f(); }); };
    },
  };
})();
