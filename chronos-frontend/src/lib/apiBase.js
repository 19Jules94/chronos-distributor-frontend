// src/lib/apiBase.js
// En Electron (file://) necesitamos URL ABSOLUTA.
// Si VITE_API_URL llega como "/" o vacío, forzamos http://127.0.0.1:5005.

const RAW = (import.meta.env?.VITE_API_URL ?? '').toString().trim();

// Si viene vacío o empieza por "/", NO es absoluto => usa 127.0.0.1:5005
const DEFAULT_ROOT = 'http://127.0.0.1:5005';
const ROOT = (!RAW || RAW.startsWith('/')) ? DEFAULT_ROOT : RAW;

export const API_ROOT = ROOT.replace(/\/$/, '');
const API_BASE = `${API_ROOT}/api`;
export default API_BASE;

// Debug útil en Electron
if (typeof window !== 'undefined') {
  console.info('[Chronos] API_ROOT =', API_ROOT, ' API_BASE =', API_BASE);
  // window.__API_ROOT__ = API_ROOT; // <- descomenta si quieres verlo siempre
}