/* Mosaiks – cartes (Leaflet).
 *
 * Remplace les cartes Plotly « scattermap » de l'application Dash :
 *   - App.PointLayer : dessine des dizaines de milliers de points (cellules de la grille) sur un
 *     calque <canvas> découpé en tuiles, avec infobulle au survol (recherche rapide par index spatial) ;
 *   - App.MapLegend  : légende cliquable (comme la légende Plotly : un clic masque / affiche une couche) ;
 *   - App.createMap  : carte Leaflet avec les fonds Open Street Map / Satellite / Carto Positron.
 */
(function () {
  'use strict';
  const App = window.App;

  /** Limites approximatives du Togo (cadrage initial des cartes). */
  App.TOGO_BOUNDS = [[6.08, -0.17], [11.16, 1.83]];

  /** Fonds de carte. Les trois choix de l'application d'origine. */
  App.BASEMAPS = {
    'open-street-map': {
      label: 'Open Street Map',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' },
    },
    'satellite': {
      label: 'Satellite',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      options: { maxZoom: 18, attribution: 'Imagerie &copy; Esri, Maxar, Earthstar Geographics' },
    },
    'carto-positron': {
      label: 'Carto Positron',
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      options: {
        subdomains: 'abcd', maxZoom: 20,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      },
    },
  };

  /** Crée une carte Leaflet cadrée sur le Togo. */
  App.createMap = function (el, opts) {
    opts = opts || {};
    const map = L.map(el, {
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      preferCanvas: false,
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: opts.zoomPosition || 'topright', zoomInTitle: 'Zoom avant', zoomOutTitle: 'Zoom arrière' }).addTo(map);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    map.createPane('points').style.zIndex = 350;      // au-dessus du fond de carte, sous les contours
    map.fitBounds(App.TOGO_BOUNDS, { padding: [8, 8] });
    let base = null;
    map.setBasemap = function (key) {
      const def = App.BASEMAPS[key] || App.BASEMAPS['open-street-map'];
      if (base) map.removeLayer(base);
      base = L.tileLayer(def.url, def.options).addTo(map);
      return base;
    };
    map.setBasemap(opts.basemap || 'open-street-map');
    // Quand la carte change de taille (fenêtre, rotation du téléphone…), on garde le même centre
    const stop = App.onResize(el, function () { map.invalidateSize({ animate: false }); });
    map.on('unload', stop);
    return map;
  };

  /** Contours des régions (traits noirs, comme dans l'application d'origine). */
  App.addRegionOutlines = function (map) {
    return App.data('regions.geojson').then(function (gj) {
      return L.geoJSON(gj, {
        interactive: false,
        style: { color: '#000', weight: 1, opacity: 1, fill: false },
      }).addTo(map);
    });
  };

  /* ------------------------------------------------------------------ */
  /* Calque de points sur canvas                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Couches attendues par setLayers() (dessinées dans l'ordre, la dernière au-dessus) :
   *   { id, name, group, visible, radius,
   *     indices: Int32Array (numéros des cellules de la grille, triés),
   *     color: '#rrggbb'                      → une seule couleur
   *     ou palette: [couleurs], colorIndex: Uint8Array (une entrée par point),
   *     hover: function(k, i) → HTML de l'infobulle (k = rang dans la couche, i = cellule) ou null }
   */
  App.PointLayer = L.GridLayer.extend({
    options: {
      pane: 'points',
      tileSize: 256,
      updateWhenZooming: false,
      updateWhenIdle: false,
      keepBuffer: 2,
      noWrap: true,
    },

    initialize: function (grid, options) {
      L.GridLayer.prototype.initialize.call(this, options);
      this._grid = grid;
      const n = grid.n;
      // Coordonnées « Web Mercator » normalisées entre 0 et 1 (calculées une fois)
      this._mx = new Float64Array(n);
      this._my = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const s = Math.sin(grid.lat[i] * Math.PI / 180);
        this._mx[i] = (grid.lon[i] + 180) / 360;
        this._my[i] = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
      }
      // Index spatial : cellules regroupées par carrés de 0,05°
      this._B = 0.05;
      this._buckets = new Map();
      for (let i = 0; i < n; i++) {
        const key = Math.floor(grid.lat[i] / this._B) * 100000 + Math.floor(grid.lon[i] / this._B);
        let arr = this._buckets.get(key);
        if (!arr) this._buckets.set(key, (arr = []));
        arr.push(i);
      }
      this._layers = [];
    },

    /** Remplace la liste des couches et redessine. */
    setLayers: function (layers) {
      const n = this._grid.n;
      for (const layer of layers) {
        if (!layer.pos) {
          layer.pos = new Int32Array(n).fill(-1);
          for (let k = 0; k < layer.indices.length; k++) layer.pos[layer.indices[k]] = k;
        }
      }
      this._layers = layers;
      this.refresh();
    },

    layers: function () { return this._layers; },

    /** Redessine les tuiles déjà affichées (sans les recréer : pas de clignotement). */
    refresh: function () {
      if (!this._map) return;
      const tiles = this._tiles || {};
      for (const key in tiles) {
        const t = tiles[key];
        if (t.el && t.coords) this._paint(t.el, t.coords);
      }
    },

    createTile: function (coords) {
      const tile = document.createElement('canvas');
      const size = this.getTileSize();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      tile.width = size.x * dpr;
      tile.height = size.y * dpr;
      tile._dpr = dpr;
      this._paint(tile, coords);
      return tile;
    },

    _paint: function (tile, coords) {
      const size = this.getTileSize();
      const dpr = tile._dpr || 1;
      const ctx = tile.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, tile.width, tile.height);
      ctx.scale(dpr, dpr);
      const scale = size.x * Math.pow(2, coords.z);
      const x0 = coords.x * size.x, y0 = coords.y * size.y;
      const mx = this._mx, my = this._my;
      for (const layer of this._layers) {
        if (!layer.visible || layer.hidden || !layer.indices.length) continue;
        const r = layer.radius || 2.5, m = r + 1;
        const paths = layer.palette ? layer.palette.map(function () { return null; }) : [null];
        const idx = layer.indices;
        // Les cellules sont triées du sud au nord : on ne parcourt que la bande de la tuile
        const kStart = lowerBoundMy(idx, my, (y0 + size.y + m) / scale);
        for (let k = kStart; k < idx.length; k++) {
          const i = idx[k];
          const py = my[i] * scale - y0;
          if (py < -m) break;
          if (py > size.y + m) continue;
          const px = mx[i] * scale - x0;
          if (px < -m || px > size.x + m) continue;
          const c = layer.palette ? layer.colorIndex[k] : 0;
          let p = paths[c];
          if (!p) p = paths[c] = new Path2D();
          p.moveTo(px + r, py);
          p.arc(px, py, r, 0, 2 * Math.PI);
        }
        for (let c = 0; c < paths.length; c++) {
          if (!paths[c]) continue;
          ctx.fillStyle = layer.palette ? layer.palette[c] : layer.color;
          ctx.fill(paths[c]);
        }
      }
    },

    /** Cellule visible la plus proche d'un point de la carte (pour l'infobulle). */
    pick: function (latlng, maxPx) {
      const map = this._map;
      if (!map) return null;
      const zoom = map.getZoom();
      const scale = 256 * Math.pow(2, zoom);
      const s = Math.sin(latlng.lat * Math.PI / 180);
      const qx = ((latlng.lng + 180) / 360) * scale;
      const qy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
      const pxPerDeg = scale / 360;
      const dDeg = (maxPx + 4) / pxPerDeg / Math.max(0.5, Math.cos(latlng.lat * Math.PI / 180));
      const B = this._B;
      const bi0 = Math.floor((latlng.lat - dDeg) / B), bi1 = Math.floor((latlng.lat + dDeg) / B);
      const bj0 = Math.floor((latlng.lng - dDeg) / B), bj1 = Math.floor((latlng.lng + dDeg) / B);
      const active = this._layers.filter(function (l) { return l.visible && !l.hidden && l.hover; }).reverse();
      if (!active.length) return null;
      let best = null, bestD = Infinity;
      for (let bi = bi0; bi <= bi1; bi++) {
        for (let bj = bj0; bj <= bj1; bj++) {
          const arr = this._buckets.get(bi * 100000 + bj);
          if (!arr) continue;
          for (const i of arr) {
            const dx = this._mx[i] * scale - qx, dy = this._my[i] * scale - qy;
            const d = Math.sqrt(dx * dx + dy * dy);
            for (const layer of active) {
              const k = layer.pos[i];
              if (k < 0) continue;
              if (d <= (layer.radius || 2.5) + maxPx && d < bestD) { bestD = d; best = { layer: layer, k: k, i: i }; }
              break; // couche la plus haute qui contient ce point
            }
          }
        }
      }
      return best;
    },
  });

  /** Premier rang k tel que my[idx[k]] <= limite (my décroît quand la latitude augmente). */
  function lowerBoundMy(idx, my, limit) {
    let lo = 0, hi = idx.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (my[idx[mid]] > limit) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  /** Infobulle au survol (et au toucher sur mobile) pour un PointLayer. */
  App.attachHover = function (map, pointLayer) {
    const box = L.DomUtil.create('div', 'map-hover', map.getContainer());
    box.setAttribute('role', 'tooltip');
    box.hidden = true;
    let raf = 0, last = null;
    function show(e) {
      const hit = pointLayer.pick(e.latlng, 3);
      const html = hit ? hit.layer.hover(hit.k, hit.i) : null;
      if (!html) { box.hidden = true; return; }
      const color = hit.layer.palette ? hit.layer.palette[hit.layer.colorIndex[hit.k]] : hit.layer.color;
      box.innerHTML = html;
      box.style.background = color;
      box.style.color = App.textColorFor(color);
      box.hidden = false;
      const size = map.getSize();
      const p = e.containerPoint;
      const w = box.offsetWidth, h = box.offsetHeight;
      let left = p.x + 14, top = p.y - h / 2;
      if (left + w > size.x - 4) left = p.x - w - 14;
      top = Math.max(4, Math.min(size.y - h - 4, top));
      box.style.left = left + 'px';
      box.style.top = top + 'px';
    }
    map.on('mousemove', function (e) {
      last = e;
      if (!raf) raf = requestAnimationFrame(function () { raf = 0; show(last); });
    });
    map.on('click', show);
    map.on('mouseout movestart zoomstart', function () { box.hidden = true; });
    return box;
  };

  /* ------------------------------------------------------------------ */
  /* Légende                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Légende façon Plotly : groupes (Parcelles, Cultures, Rendements), un clic sur une entrée
   * masque ou affiche la couche correspondante. Une barre de couleurs peut être ajoutée.
   */
  App.MapLegend = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function () {
      const div = L.DomUtil.create('div', 'map-legend');
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      this._div = div;
      div.addEventListener('click', this._onClick.bind(this));
      return div;
    },
    /** groups = [{ title, items: [layer…], colorbar: {title, min, max, ticks:[{v,label}]} }] */
    update: function (groups, onToggle) {
      this._onToggle = onToggle;
      this._items = {};
      const self = this;
      const html = groups.filter(function (g) { return g.items.length || g.colorbar; }).map(function (g) {
        let s = '<div class="legend-group"><div class="legend-title">' + App.esc(g.title) + '</div>';
        for (const it of g.items) {
          self._items[it.id] = it;
          s += '<button type="button" class="legend-item' + (it.hidden ? ' is-hidden' : '') + '" data-id="' + App.esc(it.id)
            + '" aria-pressed="' + (!it.hidden) + '" title="Cliquer pour masquer / afficher">'
            + '<span class="legend-swatch" style="background:' + (it.swatch || it.color) + '"></span>' + App.esc(it.name) + '</button>';
        }
        if (g.colorbar) s += colorbarHTML(g.colorbar);
        return s + '</div>';
      }).join('');
      this._div.innerHTML = html;
      this._div.hidden = !html;
    },
    _onClick: function (e) {
      const btn = e.target.closest('.legend-item');
      if (!btn) return;
      const it = this._items[btn.dataset.id];
      it.hidden = !it.hidden;
      btn.classList.toggle('is-hidden', it.hidden);
      btn.setAttribute('aria-pressed', String(!it.hidden));
      if (this._onToggle) this._onToggle(it);
    },
  });

  function colorbarHTML(cb) {
    const ticks = cb.ticks.map(function (t) {
      const pos = cb.max > cb.min ? (t.v - cb.min) / (cb.max - cb.min) * 100 : 50;
      return '<span class="cb-tick" style="bottom:' + pos.toFixed(1) + '%">' + App.esc(t.label) + '</span>';
    }).join('');
    return '<div class="legend-colorbar"><div class="cb-title">' + App.esc(cb.title) + '</div>'
      + '<div class="cb-body"><div class="cb-bar" style="background:' + App.viridisCSS('to top') + '"></div>'
      + '<div class="cb-ticks">' + ticks + '</div></div></div>';
  }
  App.colorbarHTML = colorbarHTML;

  /** Graduations « jolies » entre min et max (pour les barres de couleurs). */
  App.niceTicks = function (min, max, count) {
    if (!(max > min)) return [min];
    const span = max - min;
    const step0 = span / (count || 5);
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map(function (m) { return m * mag; }).find(function (s) { return s >= step0; });
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  };

  /** Petit voile « Chargement… » posé sur une carte. */
  App.mapLoading = function (wrapper) {
    const el = App.h('<div class="map-loading" role="status"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Chargement des données…</div>');
    wrapper.appendChild(el);
    return {
      show: function (msg) { el.lastChild.textContent = msg || 'Chargement des données…'; el.hidden = false; },
      hide: function () { el.hidden = true; },
    };
  };
})();
