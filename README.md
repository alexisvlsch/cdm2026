# ⚽ World Cup 2026 — Pronos

**La plateforme de pronostics entre amis pour la Coupe du Monde 2026 !**

Une web app statique hébergée sur GitHub Pages. Pas d'argent — uniquement un système de points (1 point par bon pronostic). Les données sont stockées en JSON et dans le `localStorage` du navigateur.

---

## 🚀 Déploiement sur GitHub Pages

1. **Fork** ou clone ce dépôt sur ton compte GitHub.
2. Va dans **Settings → Pages**.
3. Sous **Source**, sélectionne la branche `main` (ou `master`) et le dossier `/ (root)`.
4. Clique **Save** — GitHub Pages génère l'URL en quelques secondes.
5. Partage l'URL avec tes amis !

---

## 📁 Structure du projet

```
/
├── index.html          ← Page de connexion / inscription
├── bets.html           ← Liste des matchs + formulaire de paris
├── stats.html          ← Classement et statistiques
├── style.css           ← Feuille de style globale
├── app.js              ← Logique JS partagée
└── data/
    ├── users.json      ← Comptes utilisateurs (tableau vide au départ)
    ├── matches.json    ← Liste des matchs pré-remplie (17 matchs)
    └── bets.json       ← Paris enregistrés (tableau vide au départ)
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
- Tes paris sont sauvegardés automatiquement dans ton navigateur.

### Classement
- Va sur la page **Classement** (`stats.html`) pour voir le podium et le tableau général.
- Consulte tes statistiques personnelles et exporte ton profil.

---

## 🔧 Mettre à jour les résultats des matchs

### Option 1 — Panneau Admin intégré (rapide, local)
1. Va sur la page **Classement** (`stats.html`).
2. Appuie sur **Shift+A** pour afficher le panneau admin.
3. Sélectionne un match, choisis le résultat, puis clique **Valider le résultat**.
4. Les points sont recalculés automatiquement.

> ⚠️ Cette méthode sauvegarde les résultats dans le `localStorage` de ton navigateur uniquement.

### Option 2 — Édition directe du fichier JSON (persistant pour tous)
1. Édite `data/matches.json` et modifie le champ `result` du match concerné :
   - `"teamA"` — L'équipe A a gagné
   - `"teamB"` — L'équipe B a gagné
   - `"draw"` — Match nul
2. Commite et pousse les changements sur GitHub.
3. GitHub Pages se met à jour en quelques minutes.
4. Les joueurs verront les résultats lors de leur prochain chargement de page.

---

## 💾 Stratégie de stockage

- Au premier chargement, les fichiers JSON sont récupérés depuis le serveur.
- Toutes les modifications (paris, comptes) sont sauvegardées dans le `localStorage`.
- `localStorage` est le calque "écriture" — il prime sur les données du serveur.
- Clés utilisées :
  - `wc2026_users` — Liste des joueurs
  - `wc2026_bets` — Tous les paris
  - `wc2026_matches` — Données des matchs
  - `wc2026_currentUser` — Joueur connecté

### Export / Import de profil
- Sur la page **Classement**, utilise le bouton **Exporter mon profil** pour télécharger un fichier `.json`.
- Partage ce fichier ou importe-le sur un autre appareil avec **Importer un profil**.

---

## 🐛 Mode debug

Ouvre la console de ton navigateur et tape :
```js
localStorage.setItem('debug', 'true');
location.reload();
```
Cela active les logs détaillés dans la console.
