/**
 * firebase-config.example.js
 *
 * INSTRUCTIONS:
 * 1. Copie ce fichier en `firebase-config.js`
 * 2. Remplace les valeurs par celles de ton projet Firebase
 * 3. Ne commite JAMAIS firebase-config.js (il est dans .gitignore)
 *
 * Pour créer un projet Firebase :
 *  https://console.firebase.google.com
 *  → Créer un projet → Ajouter une app Web → Copier les infos de config
 *
 * Dans Firestore (console.firebase.google.com) :
 *  → Créer une base Firestore en mode production
 *  → Mettre les règles de sécurité suivantes (onglet Règles) :
 *
 *    rules_version = '2';
 *    service cloud.firestore {
 *      match /databases/{database}/documents {
 *        match /users/{userId} {
 *          allow read: if true;
 *          allow write: if true;
 *        }
 *        match /bets/{betId} {
 *          allow read: if true;
 *          allow write: if true;
 *        }
 *      }
 *    }
 *
 * ⚠️ Vie privée : avec ces règles, tous les utilisateurs (et visiteurs)
 * peuvent lire les paris et profils de tout le monde. C'est intentionnel
 * pour une app entre amis (classement partagé). Pour un usage public,
 * renforcer les règles avec Firebase Auth.
 */
window.__FIREBASE_CONFIG__ = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
