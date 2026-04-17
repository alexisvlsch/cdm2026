# ⚽ World Cup 2026 — Pronos

**La plateforme de pronostics entre amis pour la Coupe du Monde 2026 !**

Une web app statique hébergée sur GitHub Pages.
Pas d'argent — uniquement un système de points (1 point par bon pronostic).
Avec support optionnel de **Firebase Firestore** pour une base de données partagée (tous les utilisateurs voient les stats de tout le monde).

---

## 🚀 Déploiement sur GitHub Pages

1. **Fork** ou clone ce dépôt sur ton compte GitHub.
2. Va dans **Settings → Pages**.
3. Sous **Source**, sélectionne la branche `main` (ou `master`) et le dossier `/ (root)`.
4. Clique **Save** — GitHub Pages génère l'URL en quelques secondes.
5. Partage l'URL avec tes amis !

> Sans Firebase configuré, chaque navigateur stocke ses propres données (localStorage).
> Avec Firebase, tous les utilisateurs partagent la même base de données.

---

## 📁 Structure du projet

```
/
├── index.html                 ← Page de connexion / inscription
├── bets.html                  ← Liste des matchs + formulaire de paris
├── stats.html                 ← Classement et statistiques
├── style.css                  ← Feuille de style globale
├── app.js                     ← Logique JS partagée (+ intégration Firebase)
├── firebase-config.example.js ← Exemple de config Firebase (à copier)
└── data/
    ├── fixtures.json          ← 104 matchs officiels CDM 2026 (source de vérité)
    ├── matches.json           ← Copie de fixtures.json (utilisée par l'app)
    ├── users.json             ← Comptes utilisateurs fallback (vide)
    └── bets.json              ← Paris fallback (vide)
```

---

## 🔥 Configuration Firebase (base de données partagée)

> **Sans Firebase** : l'app fonctionne en mode `localStorage` — chaque navigateur a ses propres données.
> **Avec Firebase** : tous les utilisateurs partagent une base commune et voient les stats/paris de tout le monde.

### Étape 1 — Créer un projet Firebase

1. Va sur https://console.firebase.google.com
2. Crée un nouveau projet (ex: `cdm2026-pronos`).
3. Dans le projet, clique **Ajouter une application Web** (`</>`).
4. Copie les informations de config affichées.

### Étape 2 — Créer la base Firestore

1. Dans le menu gauche : **Firestore Database → Créer une base de données**.
2. Choisis le mode **production** et une région proche (ex: `europe-west1`).
3. Va dans l'onglet **Règles** et remplace le contenu par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if true;
      allow write: if true;
    }
    match /bets/{betId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

> ⚠️ **Note vie privée** : ces règles permettent à tout le monde de lire et écrire les profils et paris.
> C'est intentionnel pour une app entre amis (classement partagé visible par tous).
> Pour un usage public plus large, renforce avec Firebase Auth et restreins les écritures à l'utilisateur authentifié.

4. Clique **Publier**.

### Étape 3 — Configurer l'app

1. Copie `firebase-config.example.js` en `firebase-config.js` :

```bash
cp firebase-config.example.js firebase-config.js
```

2. Édite `firebase-config.js` et remplace les valeurs par celles de ton projet :

```js
window.__FIREBASE_CONFIG__ = {
  apiKey: "AIzaSy...",
  authDomain: "cdm2026-pronos.firebaseapp.com",
  projectId: "cdm2026-pronos",
  storageBucket: "cdm2026-pronos.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

3. **Ne commite jamais `firebase-config.js`** — il est dans `.gitignore`.

### Déploiement sur GitHub Pages avec Firebase

Pour que GitHub Pages charge le fichier de config, **commite `firebase-config.js`** une seule fois
(les clés Firebase côté client sont publiques par conception — la sécurité repose sur les Règles Firestore).

Ou, utilise GitHub Actions + Secrets pour injecter les clés automatiquement :

```yaml
# .github/workflows/deploy.yml
- name: Create firebase config
  run: |
    cat > firebase-config.js << EOF
    window.__FIREBASE_CONFIG__ = {
      apiKey: "${{ secrets.FIREBASE_API_KEY }}",
      projectId: "${{ secrets.FIREBASE_PROJECT_ID }}",
      ...
    };
    EOF
```

---

## 🎮 Utilisation

### Connexion / Inscription
- Ouvre `index.html` (ou la racine du site).
- Crée un compte avec un pseudo unique (3–20 caractères, lettres/chiffres/underscore).
- Ou connecte-toi si tu as déjà un compte.

### Parier sur les matchs
- Va sur la page **Matchs** (`bets.html`).
- Pour chaque match, clique sur **Équipe A gagne**, **Match nul** ou **Équipe B gagne**.
- Les paris sont verrouillés **1 heure avant le coup d'envoi**.
- Tes paris sont sauvegardés automatiquement (Firebase ou localStorage).

### Classement & stats globales
- Va sur la page **Classement** (`stats.html`) pour voir le podium et le tableau général.
- Avec Firebase activé, **tous les utilisateurs** sont visibles dans le classement.

---

## 🏟️ Banque de matchs (fixtures)

### Source de données
Le fichier `data/fixtures.json` contient les **104 matchs officiels** de la Coupe du Monde 2026 :
- **72 matchs de phase de groupes** (12 groupes A–L, 4 équipes chacun, 6 matchs par groupe)
- **16 huitièmes de finale**
- **8 matchs de la phase à élimination directe (R16)**
- **4 quarts de finale**
- **2 demi-finales**
- **1 match pour la 3e place** + **1 finale**

Source : openfootball/world-cup.json + calendrier officiel FIFA.

### Mettre à jour les fixtures

Si le calendrier officiel change (horaires, stades) :

1. Édite `data/fixtures.json`.
2. Copie dans `data/matches.json` :

```bash
cp data/fixtures.json data/matches.json
```

3. Commite et pousse — GitHub Pages se met à jour en quelques minutes.

> **Important** : les IDs de matchs (`match-001` à `match-104`) ne doivent pas changer (des paris y sont liés).

---

## 🔧 Mettre à jour les résultats des matchs

### Option 1 — Panneau Admin intégré (rapide)
1. Va sur la page **Classement** (`stats.html`).
2. Appuie sur **Shift+A** pour afficher le panneau admin.
3. Sélectionne un match, choisis le résultat, puis clique **Valider le résultat**.
4. Les points sont recalculés automatiquement.
5. Avec Firebase : les résultats se propagent à tous en temps réel.

> ⚠️ Sans Firebase, cette méthode sauvegarde dans le localStorage de ton navigateur uniquement.

### Option 2 — Édition directe du fichier JSON (persistant pour tous)
1. Édite `data/fixtures.json` et modifie le champ `result` du match concerné :
   - `"teamA"` — L'équipe A a gagné
   - `"teamB"` — L'équipe B a gagné
   - `"draw"` — Match nul
2. Copie dans `data/matches.json` : `cp data/fixtures.json data/matches.json`
3. Commite et pousse les changements sur GitHub.

---

## 💾 Stratégie de stockage

### Avec Firebase configuré (recommandé)
- **Utilisateurs et paris** stockés dans Firestore — partagés entre tous les appareils.
- **Matchs** chargés depuis `data/fixtures.json`.
- Le localStorage sert de cache hors-ligne.
- Tous les utilisateurs voient le classement complet.

### Sans Firebase (mode par défaut)
- Au premier chargement, les JSON sont récupérés depuis le serveur.
- Modifications sauvegardées dans `localStorage` (propre à chaque navigateur).
- Clés utilisées :
  - `wc2026_users` — Liste des joueurs
  - `wc2026_bets` — Tous les paris
  - `wc2026_matches` — Données des matchs
  - `wc2026_currentUser` — Joueur connecté

### Export / Import de profil
- Sur la page **Classement**, utilise **Exporter mon profil** pour télécharger un `.json`.
- Partage ce fichier ou importe-le sur un autre appareil avec **Importer un profil**.

---

## 🖥️ Lancer en local

Prérequis : un serveur HTTP statique (obligatoire pour que les `fetch()` fonctionnent).

```bash
# Python 3
python3 -m http.server 8080

# Node.js
npx serve .

# PHP
php -S localhost:8080
```

Puis ouvre http://localhost:8080

---

## 🐛 Mode debug

```js
localStorage.setItem('debug', 'true');
location.reload();
```
