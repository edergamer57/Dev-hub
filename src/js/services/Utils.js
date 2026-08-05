/**
 * Utilitários diversos
 */

export function debounce(fn, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

export function throttle(fn, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function normalizePath(path) {
  return path.replace(/\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

export function getExtension(filename) {
  const idx = filename.lastIndexOf('.');
  return idx > 0 ? filename.slice(idx + 1).toLowerCase() : '';
}

export function getFilename(path) {
  const normalized = normalizePath(path);
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

export function getDirname(path) {
  const normalized = normalizePath(path);
  const idx = normalized.lastIndexOf('/');
  return idx > 0 ? normalized.slice(0, idx) : '/';
}

export function isJavaScriptFile(filename) {
  const ext = getExtension(filename);
  return ['js', 'mjs', 'cjs'].includes(ext);
}

export function isTypeScriptFile(filename) {
  const ext = getExtension(filename);
  return ['ts', 'tsx'].includes(ext);
}

export function getLanguageId(path) {
  const ext = getExtension(path);
  const map = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    json: 'json',
    md: 'markdown',
    html: 'html',
    css: 'css'
  };
  return map[ext] || 'plaintext';
}

export function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function pathJoin(...parts) {
  return normalizePath(parts.join('/'));
}

export function isDescendant(parent, child) {
  const p = normalizePath(parent) + '/';
  const c = normalizePath(child) + '/';
  return c.startsWith(p) && c !== p;
}

export async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
