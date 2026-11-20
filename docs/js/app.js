/* Mosaiks – noyau de l'application statique.
 *
 * Ce fichier remplace la partie « serveur » de l'application Dash :
 *   - lecture des fichiers de données (dossier data/, produits par scripts/build_static_data.py) ;
 *   - mise en forme des nombres en français ;
 *   - téléchargements CSV / GeoJSON fabriqués dans le navigateur ;
 *   - style commun des graphiques Plotly (même apparence que le thème « plotly » de Dash).
 *
 * Toutes les adresses sont RELATIVES (data/…, lib/…) : le site fonctionne aussi bien à la racine
 * d'un domaine que dans un sous-dossier comme https://utilisateur.github.io/nom-du-repo/.
 */
(function () {
  'use strict';

  const App = (window.App = {
    pages: {},        // pages enregistrées : chemin -> { titleKey, render(ctx) }
    _cache: {},       // fichiers de données déjà téléchargés
  });

  /* ------------------------------------------------------------------ */
  /* Langue (anglais par défaut, français au choix)                     */
  /* ------------------------------------------------------------------ */

  App.I18N = {};                 // dictionnaires : js/i18n/en.js et js/i18n/fr.js
  App.LANGS = ['en', 'fr'];
  App.LANG_KEY = 'dashboard-lang';
  App.lang = (function () {
    let l = null;
    try { l = new URLSearchParams(location.search).get('lang'); } catch (e) { /* navigateur ancien */ }
    if (App.LANGS.indexOf(l) >= 0) {
      try { localStorage.setItem(App.LANG_KEY, l); } catch (e) { /* stockage indisponible */ }
      return l;
    }
    try { l = localStorage.getItem(App.LANG_KEY); } catch (e) { l = null; }
    return App.LANGS.indexOf(l) >= 0 ? l : 'en';
  })();

  /** Texte traduit. Les {paramètres} sont remplacés par les valeurs données. */
  App.t = function (key, params) {
    const d = App.I18N[App.lang] || {}, fb = App.I18N.en || {};
    let s = d[key] !== undefined ? d[key] : (fb[key] !== undefined ? fb[key] : key);
    if (params) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) { return params[k] !== undefined ? params[k] : m; });
    }
    return s;
  };

  /** Nom d'une denrée dans la langue choisie (les données gardent le nom français d'origine). */
  App.product = function (name) {
    const p = (App.I18N[App.lang] || {}).products || {};
    return p[name] || name;
  };

  /** Tri alphabétique selon la langue choisie. */
  App.sortBy = function (arr, label) {
    return arr.slice().sort(function (a, b) {
      return label(a).localeCompare(label(b), App.lang, { sensitivity: 'base' });
    });
  };

  /* ------------------------------------------------------------------ */
  /* Données                                                             */
  /* ------------------------------------------------------------------ */

  /** Télécharge (une seule fois) un fichier JSON du dossier data/. */
  App.data = function (path) {
    if (!App._cache[path]) {
      App._cache[path] = fetch('data/' + path)
        .then(function (r) {
          if (!r.ok) throw new Error(App.t('error.file', { path: path, status: r.status }));
          return r.json();
        })
        .catch(function (err) {
          delete App._cache[path];
          throw err;
        });
    }
    return App._cache[path];
  };

  /** Décode les séries « valeur, nombre, valeur, nombre… » produites par le script Python. */
  App.unrle = function (pairs, n, ArrayType) {
    const out = new (ArrayType || Int32Array)(n);
    let i = 0;
    for (let k = 0; k < pairs.length; k += 2) {
      out.fill(pairs[k], i, i + pairs[k + 1]);
      i += pairs[k + 1];
    }
    return out;
  };

  /** Grille des cellules (positions, régions, surfaces), décodée une seule fois. */
  App.grid = function () {
    if (!App._gridPromise) {
      App._gridPromise = App.data('grid.json').then(function (g) {
        const n = g.n, s = g.scale;
        const lat = new Float64Array(n), lon = new Float64Array(n);
        if (g.rows) {
          let i = 0;
          for (const row of g.rows) {
            const la = row[0] / s;
            for (let k = 1; k < row.length; k += 2) {
              for (let j = 0; j < row[k + 1]; j++) {
                lat[i] = la;
                lon[i] = (row[k] + j * g.step) / s;
                i++;
              }
            }
          }
        } else {
          for (let i = 0; i < n; i++) { lat[i] = g.lat[i] / s; lon[i] = g.lon[i] / s; }
        }
        let area;
        if (g.area_values) {
          const codes = App.unrle(g.area_rle, n);
          area = new Float64Array(n);
          for (let i = 0; i < n; i++) area[i] = g.area_values[codes[i]];
        } else {
          area = Float64Array.from(g.area);
        }
        const regionCode = App.unrle(g.region_rle, n, Uint8Array);
        const regionTitle = g.regions.map(App.titleCase);
        return {
          n: n, lat: lat, lon: lon, area: area,
          regions: g.regions, regionTitle: regionTitle, region: regionCode,
          /** Identifiant d'une cellule, au même format que les données d'origine (lat_6--115__lon_1--205). */
          id: function (i) {
            if (g.ids) return g.ids[i];
            return 'lat_' + lat[i].toFixed(3).replace('.', '--') + '__lon_' + lon[i].toFixed(3).replace('.', '--');
          },
        };
      }).catch(function (err) { App._gridPromise = null; throw err; });
    }
    return App._gridPromise;
  };

  /* ------------------------------------------------------------------ */
  /* Mise en forme                                                       */
  /* ------------------------------------------------------------------ */

  const formatters = {};
  /** Nombre dans la langue choisie : 16 801 / 16,801 ; 2,6 / 2.6 ; « — » si la valeur manque. */
  App.fmt = function (v, digits) {
    digits = digits || 0;
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    const key = App.lang + digits;
    if (!formatters[key]) {
      formatters[key] = new Intl.NumberFormat(App.lang === 'fr' ? 'fr-FR' : 'en-US', {
        minimumFractionDigits: digits, maximumFractionDigits: digits,
      });
    }
    return formatters[key].format(v).replace(/\u202f/g, '\u00a0');
  };

  /** Pourcentage : « 1,5 % » en français, « 1.5% » en anglais. */
  App.pct = function (v, digits) {
    return App.fmt(v, digits) + (App.lang === 'fr' ? '\u00a0%' : '%');
  };

  App.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  App.titleCase = function (s) {
    return String(s).toLowerCase().replace(/(^|[\s\-'])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); });
  };

  App.icon = function (name, cls) {
    return '<svg class="bi ' + (cls || '') + '" aria-hidden="true"><use href="#bi-' + name + '"></use></svg>';
  };

  /** Crée des éléments à partir d'un morceau de HTML. */
  App.h = function (html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.childElementCount === 1 ? t.content.firstElementChild : t.content;
  };

  /** Bloc d'erreur lisible (affiché à la place d'un graphique ou d'une page). */
  App.errorBox = function (err) {
    let hint = '';
    if (location.protocol === 'file:') hint = '<br><small>' + App.t('error.fileProtocol') + '</small>';
    return '<div class="alert alert-danger mb-0" role="alert">' + App.icon('exclamation-triangle-fill', 'me-2')
      + App.t('error.load') + ' ' + App.esc(err && err.message ? err.message : err) + hint + '</div>';
  };

  /* ------------------------------------------------------------------ */
  /* Téléchargements (fabriqués dans le navigateur)                      */
  /* ------------------------------------------------------------------ */

  App.download = function (filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  };

  function csvCell(v) {
    if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** CSV (séparateur virgule, point décimal), comme pandas.DataFrame.to_csv(index=False). */
  App.toCSV = function (columns, rows) {
    const lines = [columns.map(csvCell).join(',')];
    for (const r of rows) lines.push(r.map(csvCell).join(','));
    return lines.join('\n') + '\n';
  };

  /** GeoJSON de points (EPSG:4326) ; les colonnes deviennent des propriétés. */
  App.toPointGeoJSON = function (columns, rows, latCol, lonCol) {
    const iLat = columns.indexOf(latCol), iLon = columns.indexOf(lonCol);
    const parts = [];
    for (const r of rows) {
      const props = {};
      for (let c = 0; c < columns.length; c++) {
        const v = r[c];
        props[columns[c]] = (v === undefined || (typeof v === 'number' && Number.isNaN(v))) ? null : v;
      }
      parts.push('{"type":"Feature","properties":' + JSON.stringify(props)
        + ',"geometry":{"type":"Point","coordinates":[' + r[iLon] + ',' + r[iLat] + ']}}');
    }
    return '{"type":"FeatureCollection","crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:OGC:1.3:CRS84"}},'
      + '"features":[\n' + parts.join(',\n') + '\n]}\n';
  };

  /* ------------------------------------------------------------------ */
  /* Graphiques Plotly                                                   */
  /* ------------------------------------------------------------------ */

  /** Couleurs par défaut de Plotly (identiques à l'application Dash). */
  App.COLORWAY = ['#636EFA', '#EF553B', '#00CC96', '#AB63FA', '#FFA15A', '#19D3F3', '#FF6692', '#B6E880', '#FF97FF', '#FECB52'];

  const AXIS = {
    gridcolor: 'white', linecolor: 'white', zerolinecolor: 'white', zerolinewidth: 2,
    ticks: '', automargin: true, title: { standoff: 15 },
  };

  function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function merge(a, b) {
    const out = Object.assign({}, a);
    for (const k of Object.keys(b || {})) out[k] = isObj(a[k]) && isObj(b[k]) ? merge(a[k], b[k]) : b[k];
    return out;
  }

  /** Mise en page « thème plotly » (fond bleuté, grille blanche) utilisée par Dash par défaut. */
  App.layout = function (extra) {
    const base = {
      font: { family: 'Inter, system-ui, sans-serif', color: '#2a3f5f', size: 12 },
      paper_bgcolor: 'white', plot_bgcolor: '#E5ECF6',
      colorway: App.COLORWAY,
      hovermode: 'closest', hoverlabel: { align: 'left' },
      separators: App.lang === 'fr' ? ', ' : '.,',
      xaxis: AXIS, yaxis: AXIS,
      title: { x: 0.05 },
    };
    return merge(base, extra || {});
  };

  /** Légende à droite sur grand écran, horizontale (au-dessus ou en dessous) sur téléphone. */
  /** Écran de téléphone (moins de 576 px de large) : graphiques en version compacte. */
  App.isNarrow = function () { return window.innerWidth < 576; };

  App.legend = function (el, title, where) {
    const narrow = App.isNarrow(el);
    const legend = !narrow ? {}
      : where === 'bottom' ? { orientation: 'h', x: 0, xanchor: 'left', y: -0.12, yanchor: 'top' }
        : { orientation: 'h', x: 0, xanchor: 'left', y: 1.02, yanchor: 'bottom' };
    if (title && !narrow) legend.title = { text: title };
    return legend;
  };

  App.plotConfig = function (extra) {
    return Object.assign({ displaylogo: false, responsive: true, locale: App.lang === 'fr' ? 'fr' : 'en' }, extra || {});
  };

  /** Couleurs « Viridis » de Plotly. */
  const VIRIDIS = [
    [0, '#440154'], [0.06274509803921569, '#48186a'], [0.12549019607843137, '#472d7b'],
    [0.18823529411764706, '#424086'], [0.25098039215686274, '#3b528b'], [0.3137254901960784, '#33638d'],
    [0.3764705882352941, '#2c728e'], [0.4392156862745098, '#26828e'], [0.5019607843137255, '#21918c'],
    [0.5647058823529412, '#1fa088'], [0.6274509803921569, '#28ae80'], [0.6901960784313725, '#3fbc73'],
    [0.7529411764705882, '#5ec962'], [0.8156862745098039, '#84d44b'], [0.8784313725490196, '#addc30'],
    [0.9411764705882353, '#d8e219'], [1, '#fde725'],
  ];
  App.VIRIDIS = VIRIDIS;

  function hexToRgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const VIRIDIS_RGB = VIRIDIS.map(function (s) { return [s[0], hexToRgb(s[1])]; });

  /** Couleur Viridis pour une valeur entre 0 et 1. */
  App.viridis = function (t) {
    t = Math.max(0, Math.min(1, t));
    for (let k = 1; k < VIRIDIS_RGB.length; k++) {
      if (t <= VIRIDIS_RGB[k][0]) {
        const a = VIRIDIS_RGB[k - 1], b = VIRIDIS_RGB[k];
        const f = (t - a[0]) / (b[0] - a[0] || 1);
        return 'rgb(' + a[1].map(function (c, i) { return Math.round(c + f * (b[1][i] - c)); }).join(',') + ')';
      }
    }
    return VIRIDIS[VIRIDIS.length - 1][1];
  };

  /** Dégradé CSS Viridis (légendes des cartes). */
  App.viridisCSS = function (direction) {
    return 'linear-gradient(' + (direction || 'to top') + ','
      + VIRIDIS.map(function (s) { return s[1] + ' ' + (s[0] * 100).toFixed(1) + '%'; }).join(',') + ')';
  };

  /** Texte noir ou blanc selon la couleur de fond (étiquettes de survol). */
  App.textColorFor = function (color) {
    const ctx = App._colorCtx || (App._colorCtx = document.createElement('canvas').getContext('2d'));
    ctx.fillStyle = '#000';
    ctx.fillStyle = color;
    const c = ctx.fillStyle;
    let rgb;
    if (c[0] === '#') rgb = hexToRgb(c);
    else rgb = c.match(/\d+/g).slice(0, 3).map(Number);
    const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    return lum > 0.6 ? '#1f2937' : '#ffffff';
  };

  /** Petit tableau HTML au style des DataTable de Dash (« list view »). */
  App.table = function (columns, rows, cls) {
    return '<div class="table-responsive"><table class="data-table ' + (cls || '') + '"><thead><tr>'
      + columns.map(function (c) { return '<th scope="col">' + App.esc(c) + '</th>'; }).join('')
      + '</tr></thead><tbody>'
      + rows.map(function (r) { return '<tr>' + r.map(function (v) { return '<td>' + App.esc(v) + '</td>'; }).join('') + '</tr>'; }).join('')
      + '</tbody></table></div>';
  };

  /** Petit menu déroulant (remplace le composant JavaScript de Bootstrap). */
  App.dropdown = function (root) {
    const btn = root.querySelector('[data-dropdown-toggle]');
    const menu = root.querySelector('.dropdown-menu');
    function close() { menu.classList.remove('show'); btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const open = !menu.classList.contains('show');
      menu.classList.toggle('show', open);
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', close);
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close(); btn.focus(); } });
    return { close: close, destroy: function () { document.removeEventListener('click', close); } };
  };

  /** Observe la taille d'un élément (redimensionne cartes et graphiques). */
  App.onResize = function (el, fn) {
    if (!('ResizeObserver' in window)) {
      window.addEventListener('resize', fn);
      return function () { window.removeEventListener('resize', fn); };
    }
    let raf = 0;
    const ro = new ResizeObserver(function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fn);
    });
    ro.observe(el);
    return function () { ro.disconnect(); };
  };

  /** Plotly.react protégé : n'échoue pas si l'élément a disparu (changement de page). */
  App.plot = function (el, data, layout, config) {
    if (!el || !el.isConnected) return Promise.resolve();
    config = config || App.plotConfig();
    // Sur téléphone, la barre d'outils Plotly cacherait la légende : on la retire
    if (App.isNarrow(el)) {
      config = Object.assign({}, config, { displayModeBar: false });
      // marges par défaut de Plotly (80 px) trop larges pour un téléphone
      layout = Object.assign({}, layout, { margin: Object.assign({ l: 50, r: 12, t: 70, b: 40 }, layout.margin || {}) });
    }
    return Plotly.react(el, data, layout, config);
  };
})();
