/**
 * utils.js — Small, dependency-free UI helpers used across the app.
 * Globals: esc, downloadBlob, pulseInvalid, welcomeEmptyState, showToast.
 */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Generates the empty-state HTML for tabs when no team is selected. */
function welcomeEmptyState(message) {
  return `<p>${message}</p><button class="btn btn-outline" style="margin-top:12px" onclick="openContextPicker()">Select Team</button>`;
}

/** Pulse a form field red to indicate invalid input. */
function pulseInvalid(el) {
  if (!el) return;
  el.classList.remove("field-invalid");
  void el.offsetWidth; /* force reflow */
  el.classList.add("field-invalid");
  el.focus();
  setTimeout(() => el.classList.remove("field-invalid"), 600);
}

/**
 * HTML-escape a string for safe interpolation into innerHTML text bodies
 * AND into double-quoted HTML attribute values. Encodes the five standard
 * characters (&, <, >, ", '). For values embedded inside an onclick= JS
 * string literal, use esc(JSON.stringify(value)) — JSON.stringify emits a
 * valid JS string and esc() then makes it attribute-safe.
 */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
