// Neon Bay — saving and loading through localStorage. It keeps money,
// health, mission progress, the player's spot and the wanted level. It never
// stores keys or secrets.

import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const snapshot = {
      version: 1,
      money: state.money,
      health: state.health,
      missionIndex: state.missionIndex,
      playerX: state.playerX,
      playerZ: state.playerZ,
      wanted: state.wanted,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    if (!snapshot || snapshot.version !== 1) return null;
    return snapshot;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (err) { return false; }
}
