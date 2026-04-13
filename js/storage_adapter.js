/**
 * storage_adapter.js — Thin wrapper over localStorage.
 *
 * Capacitor's Preferences plugin falls back to localStorage on web,
 * so this adapter works identically in both environments. When we
 * later adopt Preferences on native, this is the single file to swap.
 *
 * Synchronous API by design — preserves existing call-site structure.
 */
const StorageAdapter = {
  get(key) {
    return localStorage.getItem(key);
  },
  set(key, value) {
    localStorage.setItem(key, value);
  },
  remove(key) {
    localStorage.removeItem(key);
  },
  clear() {
    localStorage.clear();
  },
  keys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null) out.push(k);
    }
    return out;
  },
};
