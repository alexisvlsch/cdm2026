/**
 * app.js — Shared logic for WC2026 Pronos
 * World Cup 2026 Mini Betting Platform
 */

// === DEBUG MODE ===
const DEBUG = localStorage.getItem('debug') === 'true';

// === FIREBASE INTEGRATION ===

/**
 * Firestore database instance (null when Firebase is not configured).
 * @type {firebase.firestore.Firestore|null}
 */
let db = null;

/**
 * Return true if cfg contains all required Firebase fields with non-empty values.
 * @param {*} cfg
 * @returns {boolean}
 */
function isValidFirebaseConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return false;
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  return required.every(k => typeof cfg[k] === 'string' && cfg[k].trim() !== '');
}

/**
 * Initialize Firebase if window.__FIREBASE_CONFIG__ is available and valid.
 * Sets the `db` variable for use by other functions.
 * Falls back to localStorage (db = null) if config is absent or incomplete.
 * @returns {boolean} True if Firebase was successfully initialized
 */
function initFirebase() {
  if (typeof window === 'undefined') return false;
  if (!isValidFirebaseConfig(window.__FIREBASE_CONFIG__)) {
    console.info('[WC2026] Firebase config absent or incomplete — using localStorage');
    return false;
  }
  // firebase-app-compat.js and firebase-firestore-compat.js must be loaded before app.js
  // (they are listed as blocking <script> tags in HTML, so no race condition)
  if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') return false;
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(window.__FIREBASE_CONFIG__);
    }
    db = firebase.firestore();
    debugLog('Firebase initialized — shared database active');
    return true;
  } catch (e) {
    console.warn('[WC2026] Firebase init failed, falling back to localStorage:', e);
    db = null;
    return false;
  }
}

/**
 * Save a user document to Firestore (fire-and-forget).
 * @param {Object} user - User object to persist
 */
function fbSaveUser(user) {
  if (!db) return;
  db.collection('users').doc(user.id).set(user)
    .catch(e => debugLog('Firestore: save user failed', e));
}

/**
 * Save a bet document to Firestore (fire-and-forget).
 * @param {Object} bet - Bet object to persist
 */
function fbSaveBet(bet) {
  if (!db) return;
  db.collection('bets').doc(bet.id).set(bet)
    .catch(e => debugLog('Firestore: save bet failed', e));
}

/**
 * Save a match result to Firestore (fire-and-forget).
 * Only the id and result fields are stored to avoid overwriting fixture metadata.
 * @param {Object} match - Match object with result set
 */
function fbSaveMatchResult(match) {
  if (!db) return;
  db.collection('matches').doc(match.id).set({ id: match.id, result: match.result })
    .catch(e => debugLog('Firestore: save match result failed', e));
}

/**
 * Batch-update multiple bet documents in Firestore (fire-and-forget).
 * @param {Array} bets - Array of bet objects to update
 */
function fbSaveBets(bets) {
  if (!db || bets.length === 0) return;
  const batch = db.batch();
  for (const bet of bets) {
    batch.set(db.collection('bets').doc(bet.id), bet);
  }
  batch.commit().catch(e => debugLog('Firestore: batch save bets failed', e));
}

/**
 * Batch-update multiple user documents in Firestore (fire-and-forget).
 * @param {Array} users - Array of user objects to update
 */
function fbSaveUsers(users) {
  if (!db || users.length === 0) return;
  const batch = db.batch();
  for (const user of users) {
    batch.set(db.collection('users').doc(user.id), user);
  }
  batch.commit().catch(e => debugLog('Firestore: batch save users failed', e));
}

/**
 * Log a message only in debug mode.
 * @param {...*} args - Arguments to log
 */
function debugLog(...args) {
  if (DEBUG) console.log('[WC2026]', ...args);
}

// === CONSTANTS ===
const KEYS = {
  USERS: 'wc2026_users',
  BETS: 'wc2026_bets',
  CURRENT_USER: 'wc2026_currentUser',
  MATCHES: 'wc2026_matches',
};

const BET_DEADLINE_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// === STORAGE HELPERS ===

/**
 * Safely parse JSON from localStorage.
 * @param {string} key - localStorage key
 * @param {*} fallback - Default value if key missing or parse fails
 * @returns {*} Parsed value or fallback
 */
function storageGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    debugLog('storageGet error for key', key, e);
    return fallback;
  }
}

/**
 * Serialize and save a value to localStorage.
 * @param {string} key - localStorage key
 * @param {*} value - Value to save
 */
function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    debugLog('storageSet error for key', key, e);
  }
}

// === DATA LOADING ===

/**
 * Fetch a JSON file from the server, merge with localStorage (localStorage takes precedence).
 * @param {string} url - URL of the JSON file to fetch
 * @param {string} localKey - localStorage key to merge with
 * @param {string} idField - Field name used as unique identifier
 * @returns {Promise<Array>} Merged array
 */
async function fetchAndMerge(url, localKey, idField = 'id') {
  let localData = storageGet(localKey, null);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const remoteData = await response.json();
    if (!Array.isArray(remoteData)) throw new Error('Not an array');

    if (localData === null) {
      // First load: use remote data as base, save to localStorage
      storageSet(localKey, remoteData);
      return remoteData;
    }

    // Merge: remote provides new items, localStorage overrides existing ones
    const localMap = new Map(localData.map(item => [item[idField], item]));
    for (const remoteItem of remoteData) {
      if (!localMap.has(remoteItem[idField])) {
        localMap.set(remoteItem[idField], remoteItem);
      }
    }
    const merged = Array.from(localMap.values());
    storageSet(localKey, merged);
    return merged;
  } catch (e) {
    debugLog('fetchAndMerge error for', url, e);
    // Fall back to localStorage if available
    return localData || [];
  }
}

/**
 * Load all application data (users, matches, bets).
 * - Matches: always loaded from data/fixtures.json. Remote metadata always wins
 *   (to pick up fixture corrections), but locally-set `result` values are preserved.
 *   When Firebase is configured, match results from Firestore also take precedence
 *   so that admin-set results are shared across all devices.
 * - Users & Bets: loaded from Firestore when Firebase is configured.
 *   Firestore wins for items that exist in Firestore; items present only in
 *   localStorage (e.g. pending fire-and-forget writes) are preserved to avoid
 *   data loss due to timing races.
 * - Falls back to data/users.json + data/bets.json merged with localStorage when
 *   Firebase is not configured.
 * @returns {Promise<{users: Array, matches: Array, bets: Array}>}
 */
async function loadAllData() {
  const base = getBasePath();

  // Matches: remote fixture metadata wins, but preserve locally-stored results
  const matches = await fetchAndMergeFixtures(`${base}data/fixtures.json`);

  let users, bets;

  if (db) {
    // Load users, bets, and match results from Firestore for shared persistence
    try {
      const [usersSnap, betsSnap, matchResultsSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('bets').get(),
        db.collection('matches').get(),
      ]);

      // Merge users: Firestore wins for existing items; preserve local-only items
      // (e.g. a user created just before this load whose write hasn't landed yet).
      const remoteUsers = usersSnap.docs.map(d => d.data());
      const localUsers = storageGet(KEYS.USERS, []);
      const userMap = new Map(remoteUsers.map(u => [u.id, u]));
      const localOnlyUsers = [];
      for (const lu of localUsers) {
        if (!userMap.has(lu.id)) {
          userMap.set(lu.id, lu);
          localOnlyUsers.push(lu);
        }
      }
      users = Array.from(userMap.values());
      // Migrate local-only users (created before Firestore was set up) to Firestore
      if (localOnlyUsers.length > 0) {
        debugLog('Migrating local-only users to Firestore', localOnlyUsers.map(u => u.username));
        fbSaveUsers(localOnlyUsers);
      }

      // Merge bets: same strategy as users.
      const remoteBets = betsSnap.docs.map(d => d.data());
      const localBets = storageGet(KEYS.BETS, []);
      const betMap = new Map(remoteBets.map(b => [b.id, b]));
      const localOnlyBets = [];
      for (const lb of localBets) {
        if (!betMap.has(lb.id)) {
          betMap.set(lb.id, lb);
          localOnlyBets.push(lb);
        }
      }
      bets = Array.from(betMap.values());
      // Migrate local-only bets to Firestore
      if (localOnlyBets.length > 0) {
        debugLog('Migrating local-only bets to Firestore', localOnlyBets.length);
        fbSaveBets(localOnlyBets);
      }

      // Apply Firestore match results so admin-set results are visible everywhere.
      const firestoreResults = new Map(
        matchResultsSnap.docs.map(d => [d.data().id, d.data().result])
      );
      for (const m of matches) {
        if (firestoreResults.has(m.id)) {
          m.result = firestoreResults.get(m.id);
        }
      }

      // Cache locally for offline resilience
      storageSet(KEYS.USERS, users);
      storageSet(KEYS.BETS, bets);
      storageSet(KEYS.MATCHES, matches);
      debugLog('Firestore data loaded', { users: users.length, bets: bets.length });
    } catch (e) {
      console.warn('[WC2026] Firestore load failed, falling back to localStorage:', e);
      users = storageGet(KEYS.USERS, []);
      bets = storageGet(KEYS.BETS, []);
    }
  } else {
    // Fallback: local JSON files merged with localStorage
    [users, bets] = await Promise.all([
      fetchAndMerge(`${base}data/users.json`, KEYS.USERS),
      fetchAndMerge(`${base}data/bets.json`, KEYS.BETS),
    ]);
  }

  debugLog('Data loaded', { users: users.length, matches: matches.length, bets: bets.length });
  return { users, matches, bets };
}

/**
 * Fetch fixtures from the server. Remote metadata (teams, dates, venue, stage)
 * always takes precedence over localStorage to reflect any official schedule
 * corrections. Only the `result` field from localStorage is preserved (admin updates).
 * @param {string} url - URL of the fixtures JSON file
 * @returns {Promise<Array>} Array of match objects
 */
async function fetchAndMergeFixtures(url) {
  const localData = storageGet(KEYS.MATCHES, null);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const remoteData = await response.json();
    if (!Array.isArray(remoteData)) throw new Error('Not an array');

    // Build a result map from localStorage (preserves admin-set results)
    const resultMap = localData
      ? new Map(localData.map(m => [m.id, m.result]))
      : new Map();

    // Remote metadata wins; only re-apply preserved results
    const merged = remoteData.map(m => ({
      ...m,
      result: resultMap.has(m.id) ? resultMap.get(m.id) : m.result,
    }));

    storageSet(KEYS.MATCHES, merged);
    return merged;
  } catch (e) {
    debugLog('fetchAndMergeFixtures error', e);
    return localData || [];
  }
}

/**
 * Get the base path for fetching data files (supports GitHub Pages subdirectory).
 * @returns {string} Base path ending with /
 */
function getBasePath() {
  const path = window.location.pathname;
  // If hosted at /repo-name/, strip the HTML filename to get the base
  const base = path.substring(0, path.lastIndexOf('/') + 1);
  return base;
}

// === USER HELPERS ===

/**
 * Get the currently logged-in user from localStorage.
 * @returns {Object|null} Current user object or null
 */
function getCurrentUser() {
  return storageGet(KEYS.CURRENT_USER, null);
}

/**
 * Set the currently logged-in user in localStorage.
 * @param {Object} user - User object to set as current
 */
function setCurrentUser(user) {
  storageSet(KEYS.CURRENT_USER, user);
}

/**
 * Clear the current user session (logout).
 */
function logout() {
  localStorage.removeItem(KEYS.CURRENT_USER);
}

/**
 * Get all users from localStorage.
 * @returns {Array} Array of user objects
 */
function getUsers() {
  return storageGet(KEYS.USERS, []);
}

/**
 * Save updated users array to localStorage.
 * @param {Array} users - Updated users array
 */
function saveUsers(users) {
  storageSet(KEYS.USERS, users);
}

/**
 * Find a user by username (case-insensitive).
 * @param {string} username - Username to search
 * @returns {Object|null} Found user or null
 */
function findUserByUsername(username) {
  const users = getUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}

/**
 * Create a new user account.
 * @param {string} username - Desired username
 * @returns {{success: boolean, user?: Object, error?: string}}
 */
function createUser(username) {
  const trimmed = username.trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
    return { success: false, error: 'Le pseudo doit contenir 3 à 20 caractères alphanumériques ou underscores.' };
  }
  if (findUserByUsername(trimmed)) {
    return { success: false, error: 'Ce pseudo est déjà pris. Choisis-en un autre !' };
  }
  const user = {
    id: generateUUID(),
    username: trimmed,
    points: 0,
    createdAt: new Date().toISOString(),
  };
  const users = getUsers();
  users.push(user);
  saveUsers(users);
  // Persist to Firestore if available
  fbSaveUser(user);
  return { success: true, user };
}

// === BET HELPERS ===

/**
 * Get all bets from localStorage.
 * @returns {Array} Array of bet objects
 */
function getBets() {
  return storageGet(KEYS.BETS, []);
}

/**
 * Save updated bets array to localStorage.
 * @param {Array} bets - Updated bets array
 */
function saveBets(bets) {
  storageSet(KEYS.BETS, bets);
}

/**
 * Get a specific user's bet for a given match.
 * @param {string} userId - User ID
 * @param {string} matchId - Match ID
 * @returns {Object|null} Bet object or null
 */
function getUserBet(userId, matchId) {
  return getBets().find(b => b.userId === userId && b.matchId === matchId) || null;
}

/**
 * Place or update a bet for the current user on a match.
 * @param {string} userId - User ID
 * @param {string} matchId - Match ID
 * @param {string} prediction - One of 'teamA', 'teamB', 'draw'
 * @returns {{success: boolean, error?: string}}
 */
function placeBet(userId, matchId, prediction) {
  const matches = getMatches();
  const match = matches.find(m => m.id === matchId);
  if (!match) return { success: false, error: 'Match introuvable.' };
  if (isBetLocked(match)) return { success: false, error: 'Le pari est verrouillé pour ce match.' };

  const bets = getBets();
  const existing = bets.findIndex(b => b.userId === userId && b.matchId === matchId);
  const bet = {
    id: existing >= 0 ? bets[existing].id : generateUUID(),
    userId,
    matchId,
    prediction,
    placedAt: new Date().toISOString(),
    isCorrect: match.result !== null ? prediction === match.result : null,
  };

  if (existing >= 0) {
    bets[existing] = bet;
  } else {
    bets.push(bet);
  }
  saveBets(bets);
  // Persist to Firestore if available
  fbSaveBet(bet);
  return { success: true };
}

// === MATCH HELPERS ===

/**
 * Get all matches from localStorage.
 * @returns {Array} Array of match objects
 */
function getMatches() {
  return storageGet(KEYS.MATCHES, []);
}

/**
 * Save updated matches array to localStorage.
 * @param {Array} matches - Updated matches array
 */
function saveMatches(matches) {
  storageSet(KEYS.MATCHES, matches);
}

/**
 * Check if betting is locked for a match (1 hour before kickoff or result already set).
 * @param {Object} match - Match object
 * @returns {boolean} True if betting is locked
 */
function isBetLocked(match) {
  if (match.result !== null) return true;
  const kickoff = new Date(match.date).getTime();
  return Date.now() >= kickoff - BET_DEADLINE_MS;
}

/**
 * Format a date as a French locale string.
 * @param {string} isoDate - ISO date string
 * @returns {string} Formatted date string in French
 */
function formatDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
}

/**
 * Set a match result, persist it to localStorage and Firestore, and recalculate scores.
 * Use this instead of manually calling saveMatches + recalculateMatch so that the
 * result is shared across all devices via Firestore.
 * @param {string} matchId - Match ID
 * @param {string} result - 'teamA', 'draw', or 'teamB'
 * @returns {number} Count of correct bets
 */
function setMatchResult(matchId, result) {
  const matches = getMatches();
  const match = matches.find(m => m.id === matchId);
  if (!match) return 0;
  match.result = result;
  saveMatches(matches);
  fbSaveMatchResult(match);
  return recalculateMatch(matchId);
}

// === POINTS & SCORING ===

/**
 * Recalculate all bet results and user points for a specific match after its result is set.
 * @param {string} matchId - Match ID whose result was just set
 * @returns {number} Count of correct bets
 */
function recalculateMatch(matchId) {
  const matches = getMatches();
  const match = matches.find(m => m.id === matchId);
  if (!match || match.result === null) return 0;

  const bets = getBets();
  let correctCount = 0;

  for (const bet of bets) {
    if (bet.matchId === matchId) {
      bet.isCorrect = bet.prediction === match.result;
      if (bet.isCorrect) correctCount++;
    }
  }
  saveBets(bets);
  // Sync affected bets to Firestore
  fbSaveBets(bets.filter(b => b.matchId === matchId));

  // Recalculate all user points from scratch
  recalculateAllPoints();

  return correctCount;
}

/**
 * Recalculate all users' points from scratch based on all correct bets.
 */
function recalculateAllPoints() {
  const users = getUsers();
  const bets = getBets();

  const pointsMap = new Map(users.map(u => [u.id, 0]));
  for (const bet of bets) {
    if (bet.isCorrect === true && pointsMap.has(bet.userId)) {
      pointsMap.set(bet.userId, pointsMap.get(bet.userId) + 1);
    }
  }

  for (const user of users) {
    user.points = pointsMap.get(user.id) || 0;
  }
  saveUsers(users);
  // Sync updated user points to Firestore
  fbSaveUsers(users);
}

/**
 * Compute leaderboard stats for each user.
 * @returns {Array} Array of {user, totalBets, correctBets, successRate, points, streak}
 */
function computeLeaderboard() {
  const users = getUsers();
  const bets = getBets();
  const matches = getMatches();

  return users.map(user => {
    const userBets = bets.filter(b => b.userId === user.id);
    const totalBets = userBets.length;
    const correctBets = userBets.filter(b => b.isCorrect === true).length;
    const successRate = totalBets > 0 ? Math.round((correctBets / totalBets) * 100) : 0;
    const streak = computeStreak(userBets, matches);
    return { user, totalBets, correctBets, successRate, points: user.points, streak };
  }).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.successRate - a.successRate;
  });
}

/**
 * Compute the best consecutive correct bets streak for a user.
 * @param {Array} userBets - Array of bets placed by the user
 * @param {Array} matches - All matches
 * @returns {number} Best streak count
 */
function computeStreak(userBets, matches) {
  // Sort bets by match date
  const resolved = userBets
    .filter(b => b.isCorrect !== null)
    .map(b => {
      const match = matches.find(m => m.id === b.matchId);
      return { ...b, matchDate: match ? new Date(match.date) : new Date(0) };
    })
    .sort((a, b) => a.matchDate - b.matchDate);

  let best = 0;
  let current = 0;
  for (const bet of resolved) {
    if (bet.isCorrect === true) {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

// === EXPORT / IMPORT ===

/**
 * Export the current user's profile and bets as a downloadable JSON file.
 * @param {Object} user - User object to export
 */
function exportProfile(user) {
  const bets = getBets().filter(b => b.userId === user.id);
  const data = { user, bets, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wc2026_${user.username}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import a user profile from a JSON file (File object).
 * @param {File} file - JSON file to import
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function importProfile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.user || !data.user.id || !data.user.username) {
      return { success: false, error: 'Fichier de profil invalide.' };
    }

    const users = getUsers();
    const idx = users.findIndex(u => u.id === data.user.id);
    if (idx >= 0) {
      users[idx] = data.user;
    } else {
      users.push(data.user);
    }
    saveUsers(users);

    if (data.bets && Array.isArray(data.bets)) {
      const bets = getBets();
      for (const importedBet of data.bets) {
        const existing = bets.findIndex(b => b.id === importedBet.id);
        if (existing >= 0) {
          bets[existing] = importedBet;
        } else {
          bets.push(importedBet);
        }
      }
      saveBets(bets);
    }

    setCurrentUser(data.user);
    return { success: true };
  } catch (e) {
    debugLog('importProfile error', e);
    return { success: false, error: 'Erreur lors de la lecture du fichier.' };
  }
}

// === UUID GENERATOR ===

/**
 * Generate a UUID v4 string.
 * @returns {string} UUID v4
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// === TOAST NOTIFICATIONS ===

/**
 * Show a brief toast notification.
 * @param {string} message - Message to display
 * @param {'success'|'error'|'info'} type - Toast type
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}

/**
 * Create and append the toast container to the document body.
 * @returns {HTMLElement} Toast container element
 */
function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// === NAVIGATION GUARD ===

/**
 * Redirect to index.html if no user is logged in.
 * Call this on pages that require authentication.
 */
function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = getBasePath() + 'index.html';
  }
  return user;
}

/**
 * Render the top navigation bar in the #navbar element.
 * @param {string} activePage - 'bets' or 'stats'
 */
function renderNavbar(activePage) {
  const user = getCurrentUser();
  const navbar = document.getElementById('navbar');
  if (!navbar || !user) return;

  const base = getBasePath();
  navbar.innerHTML = `
    <div class="nav-container">
      <a href="${base}bets.html" class="nav-logo">⚽ WC2026 Pronos</a>
      <button class="hamburger" id="hamburger-btn" aria-label="Menu">&#9776;</button>
      <nav class="nav-links" id="nav-links">
        <a href="${base}bets.html" class="${activePage === 'bets' ? 'active' : ''}">🏟️ Matchs</a>
        <a href="${base}stats.html" class="${activePage === 'stats' ? 'active' : ''}">🏆 Classement</a>
      </nav>
      <div class="nav-user" id="nav-user-menu">
        <span class="nav-username">👤 ${escapeHtml(user.username)}</span>
        <button class="btn btn-sm btn-outline" id="logout-btn">Déconnexion</button>
      </div>
    </div>
  `;

  document.getElementById('logout-btn').addEventListener('click', () => {
    logout();
    window.location.href = base + 'index.html';
  });

  document.getElementById('hamburger-btn').addEventListener('click', () => {
    document.getElementById('nav-links').classList.toggle('open');
    document.getElementById('nav-user-menu').classList.toggle('open');
  });
}

// === SECURITY HELPERS ===

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// === FIREBASE AUTO-INIT ===
// Attempt to initialize Firebase immediately when app.js is loaded.
// firebase-config.js (if present) must be loaded before app.js.
initFirebase();

/**
 * Return whether shared Firestore database is active.
 * @returns {boolean}
 */
function isFirebaseActive() {
  return db !== null;
}
