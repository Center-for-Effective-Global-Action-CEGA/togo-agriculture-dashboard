# Dashboard du Ministère de l'Agriculture – version statique (GitHub Pages)

Ce dossier `docs/` contient le tableau de bord du Ministère de l'Agriculture en **site statique** : HTML, CSS, JavaScript et
fichiers de données JSON. Il ne demande **ni Python, ni serveur, ni installation** pour fonctionner.

> Version de démonstration : les prédictions, rendements, prix et données météo sont **simulés**.

## Publier le site uniquement depuis le site web de GitHub

Aucun logiciel n'est nécessaire (ni VS Code, ni Git, ni ligne de commande) : tout se fait dans le navigateur,
de préférence Chrome, Edge ou Firefox.

### Étape 1 – Décompresser le ZIP sur l'ordinateur

- **Windows** : clic droit sur `dashboard_ministere_agriculture.zip` → **Extraire tout…** → **Extraire**.
- **Mac** : double-clic sur le fichier ZIP.

Vous obtenez le dossier **`docs`** : c'est le site complet. Il doit garder ce nom, car GitHub Pages ne sait
publier que le dossier `docs` (ou la racine du dépôt).

### Étape 2 – Envoyer le dossier `docs` dans le dépôt

1. Ouvrez la page du dépôt sur <https://github.com>, sur la branche `main` (à la racine du dépôt).
2. Cliquez sur **Add file** → **Upload files**.
3. **Glissez le dossier `docs` entier** (le dossier lui-même, pas son contenu) dans la zone
   « Drag files here ». GitHub garde l'organisation en sous-dossiers.
4. Attendez que la liste des fichiers ait fini de s'afficher (52 fichiers).
5. En bas de la page, écrivez un message (par exemple « Ajout du site statique »), laissez
   **Commit directly to the main branch** coché, puis cliquez sur **Commit changes**.

Le bouton **Choose your files** ne permet pas de choisir un dossier : il faut bien **glisser-déposer**.
Si le dépôt contient déjà un dossier `docs`, ce n'est pas un problème : les fichiers s'y ajoutent.

### Étape 3 – Activer GitHub Pages (une seule fois)

1. Dans le dépôt, cliquez sur **Settings** (onglet en haut à droite), puis **Pages** dans le menu de gauche.
2. Dans **Build and deployment** :
   - **Source** : `Deploy from a branch`
   - **Branch** : `main`, puis le dossier **`/docs`**, puis **Save**.
3. Attendez une à deux minutes et rechargez la page : l'adresse du site s'affiche en haut,
   sous la forme `https://<utilisateur-ou-organisation>.github.io/<nom-du-repo>/`.

Seuls les **administrateurs** du dépôt voient l'onglet **Settings**. Si vous êtes seulement collaborateur et ne le
voyez pas, demandez au propriétaire du dépôt de faire cette étape 3 (une seule fois) ; ensuite, chaque fichier que
vous envoyez dans `docs/` met le site à jour tout seul.

L'onglet **Actions** du dépôt montre la publication en cours (« pages build and deployment ») : une coche verte
indique que le site est en ligne.

### Mettre à jour un fichier plus tard

Ouvrez le dossier concerné dans le dépôt (par exemple `docs/data`), cliquez sur **Add file** → **Upload files**,
glissez le nouveau fichier (même nom) et validez avec **Commit changes** : il remplace l'ancien.

## Langues (anglais / français)

Le site s'affiche en **anglais par défaut**. Le sélecteur **FR | EN** en haut à droite change la langue
immédiatement ; le choix est gardé pendant la navigation et pour les visites suivantes. Pour partager un lien
dans une langue précise, ajoutez `?lang=fr` ou `?lang=en` à l'adresse (ex. `…/<nom-du-repo>/?lang=fr`).

Tous les textes affichés sont dans deux fichiers : `js/i18n/en.js` (anglais) et `js/i18n/fr.js` (français).
Pour corriger une traduction, modifiez le texte à droite des deux-points dans le fichier concerné (directement
sur GitHub : ouvrez le fichier, cliquez sur le crayon ✏️, puis **Commit changes**). Les textes des modèles
(page « Performances des modèles ») sont dans `data/models.json`, produit par le script de préparation.

## Adresses des pages

`…/<nom-du-repo>/` (tableau de bord), `#/predictions`, `#/price`, `#/ndvi-map`, `#/modeles`, `#/aide`.
Elles fonctionnent sans réglage particulier, même dans un sous-dossier.

## Voir le site sur son ordinateur (facultatif)

Les navigateurs refusent de lire les fichiers de données si l'on ouvre `index.html` par un double-clic.
Pour un aperçu local, lancez un petit serveur depuis le dossier `docs/` : `python -m http.server 8000`,
puis ouvrez <http://localhost:8000>. Ce n'est pas nécessaire pour publier.

## Mettre à jour les données (facultatif, demande Python)

Les fichiers de `docs/data/` sont fabriqués à partir du dossier `data/` de l'application Dash d'origine par le
script `build_static_data.py` (fourni à part, à placer dans le dossier `scripts/` du dépôt) :

```bash
pip install -r scripts/requirements-static.txt
python scripts/build_static_data.py          # lit data/ et models/, écrit docs/data/
```

Envoyez ensuite les nouveaux fichiers de `docs/data/` sur GitHub (voir « Mettre à jour un fichier plus tard »).

## Contenu du dossier

| Élément | Rôle |
|---|---|
| `index.html` | point d'entrée : menu, barre du haut, avertissement « Version de démonstration » |
| `css/custom.css` | style de l'application Dash d'origine, conservé tel quel |
| `css/static.css` | compléments (icônes, tableaux, cartes, légendes) |
| `js/` | navigation et langue (`main.js`), outils communs (`app.js`), cartes (`maps.js`), une page par fichier (`pages/`), traductions (`i18n/`) |
| `data/` | données pré-calculées (JSON / GeoJSON), chargées seulement quand une page en a besoin |
| `lib/` | bibliothèques copiées localement (aucun CDN) : Plotly.js 3.7, Leaflet 1.9.4, Bootstrap 5.3 (CSS), police Inter |
| `assets/` | logo |
| `404.html` | redirige les anciennes adresses (`…/predictions`) vers les nouvelles (`…/#/predictions`) |
| `.nojekyll` | fichier vide (caché) qui indique à GitHub de publier les fichiers tels quels ; le site fonctionne aussi s'il manque |

Services externes appelés par le navigateur : les fonds de carte (OpenStreetMap, CARTO, Esri) et
l'application Google Earth Engine de la page « Indices de Végétation ».
