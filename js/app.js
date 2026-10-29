import { loadState, saveState, normalise, newId, defaultRules } from './store.js';
import { unlockAudio, dingOut, dingBack, buzz } from './sound.js';
import { checkLeave, openEntries } from './rules.js';

const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const toastEl = document.getElementById('toast');

let state;
const ui = {
  tab: 'classes',
  editClassId: null,
  lastGender: '',
  historyClassId: 'all',
  historyFrom: localDate(Date.now()),
  historyTo: localDate(Date.now()),
};

// ---------- helpers ----------

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = s => String(s ?? '').trim().replace(/\s+/g, ' ');
const same = (a, b) => norm(a).toLocaleLowerCase() === norm(b).toLocaleLowerCase();
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
const minutes = ms => Math.max(0, Math.round(ms / 60000));
const fmtTime = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDate = t => new Date(t).toLocaleDateString();
const genderLabel = g => ({ M: 'Boy', F: 'Girl' })[g] || '';

function localDate(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfLocalDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

const findClass = id => state.classes.find(c => c.id === id) || null;
const activeClass = () => findClass(state.activeClassId);
const editingClass = () => findClass(ui.editClassId) || activeClass() || state.classes[0] || null;

function persist() {
  saveState(state);
}

function toast(message, kind = 'ok') {
  toastEl.textContent = message;
  toastEl.className = `toast show ${kind}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (toastEl.className = 'toast'), 3200);
}

function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

function returnEntry(entry) {
  entry.backAt = Date.now();
}

// ---------- rendering ----------

function render() {
  if (state.mode === 'class' && activeClass()) renderClassScreen();
  else {
    state.mode = 'settings';
    renderSettings();
  }
}

function renderClassScreen() {
  const cls = activeClass();
  const now = Date.now();
  const r = cls.rules;
  const open = openEntries(state.log)
    .filter(e => e.classId === cls.id)
    .sort((a, b) => a.outAt - b.outAt);
  const outIds = new Set(open.map(e => e.childId));
  const count = g => open.filter(e => e.gender === g).length;

  const chips = [];
  if (r.maxBoys != null) chips.push(`<span class="chip">Boys ${count('M')}/${r.maxBoys}</span>`);
  if (r.maxGirls != null) chips.push(`<span class="chip">Girls ${count('F')}/${r.maxGirls}</span>`);
  chips.push(`<span class="chip">Out ${open.length}${r.maxTotal != null ? '/' + r.maxTotal : ''}</span>`);

  const names = cls.children
    .slice()
    .sort(byName)
    .map(ch => {
      const isOut = outIds.has(ch.id);
      return `<button class="name-btn${isOut ? ' is-out' : ''}" data-action="leave" data-id="${ch.id}"${isOut ? ' aria-disabled="true"' : ''}>
        <span>${esc(ch.name)}</span>${isOut ? '<small>out</small>' : ''}</button>`;
    })
    .join('');

  const outButtons = open
    .map(
      e => `<button class="out-btn" data-action="return" data-id="${e.id}">
        <span class="out-name">${esc(e.childName)}</span>
        <span class="out-time">${fmtTime(e.outAt)} · ${minutes(now - e.outAt)} min</span>
      </button>`,
    )
    .join('');

  app.innerHTML = `
    <div class="class-screen">
      <header class="cs-header">
        <h1 class="cs-title">${esc(cls.name)}</h1>
        <div class="cs-chips">${chips.join('')}</div>
        <div class="cs-clock">${fmtTime(now)}</div>
        <button class="lock-btn" data-action="exit-class" aria-label="Teacher settings" title="Teacher settings">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        </button>
      </header>
      <main class="cs-body">
        <section class="cs-list" aria-label="Tap your name to go out">
          <h2 class="cs-heading">Tap your name to go out</h2>
          <div class="name-grid">${names || '<p class="empty">This class list is empty.</p>'}</div>
        </section>
        <section class="cs-out" aria-label="Out of class">
          <h2 class="cs-heading">Out of class · tap when back</h2>
          <div class="out-list">${outButtons || '<p class="empty">Everyone is in class</p>'}</div>
        </section>
      </main>
    </div>`;
}

function renderSettings() {
  const tabs = [
    ['classes', 'Class lists'],
    ['rules', 'Rules'],
    ['history', 'History'],
    ['device', 'PIN & data'],
  ];
  const sorted = state.classes.slice().sort(byName);
  const panes = { classes: classesTab, rules: rulesTab, history: historyTab, device: deviceTab };

  app.innerHTML = `
    <div class="settings">
      <header class="st-header">
        <div class="brand"><img src="icons/icon.svg" alt="" width="32" height="32"><span>Hallpass</span><span class="muted">Teacher</span></div>
        <div class="st-start">
          <select data-change="active-class" aria-label="Class list for the class screen" ${sorted.length ? '' : 'disabled'}>
            ${sorted.length ? sorted.map(c => `<option value="${c.id}"${c.id === state.activeClassId ? ' selected' : ''}>${esc(c.name)}</option>`).join('') : '<option>No class lists yet</option>'}
          </select>
          <button class="btn primary" data-action="start"${activeClass() ? '' : ' disabled'}>Start class screen</button>
        </div>
      </header>
      <nav class="tabs" role="tablist">
        ${tabs.map(([k, label]) => `<button role="tab" class="tab${ui.tab === k ? ' active' : ''}" aria-selected="${ui.tab === k}" data-action="tab" data-tab="${k}">${label}</button>`).join('')}
      </nav>
      <main class="st-main">${panes[ui.tab]()}</main>
    </div>`;
}

function genderSelect(value, attrs) {
  return `<select ${attrs} aria-label="Boy or girl">
    <option value=""${!value ? ' selected' : ''}>Not set</option>
    <option value="M"${value === 'M' ? ' selected' : ''}>Boy</option>
    <option value="F"${value === 'F' ? ' selected' : ''}>Girl</option>
  </select>`;
}

function classPicker(current) {
  if (state.classes.length < 2) return '';
  return `<label class="field picker"><span>Class list</span>
    <select data-change="edit-class">${state.classes
      .slice()
      .sort(byName)
      .map(c => `<option value="${c.id}"${c.id === current.id ? ' selected' : ''}>${esc(c.name)}</option>`)
      .join('')}</select></label>`;
}

const noClassCard = () => `<section class="card"><p class="muted">Add a class list on the <b>Class lists</b> tab first.</p></section>`;

function classesTab() {
  const ec = editingClass();
  const list = state.classes
    .slice()
    .sort(byName)
    .map(
      c => `<li><button class="class-item${ec && c.id === ec.id ? ' selected' : ''}" data-action="edit-class" data-id="${c.id}">
        <span>${esc(c.name)}</span><span class="muted">${c.children.length} ${c.children.length === 1 ? 'child' : 'children'}</span>
      </button></li>`,
    )
    .join('');

  return `<div class="two-col">
    <section class="card">
      <h2>Class lists</h2>
      <ul class="class-list">${list || '<li class="muted">No class lists yet. Add one below.</li>'}</ul>
      <form data-form="add-class" class="inline-form">
        <input name="name" placeholder="e.g. Class 3B" maxlength="60" required aria-label="New class list name" autocomplete="off">
        <button class="btn">Add list</button>
      </form>
    </section>
    ${ec ? classEditor(ec) : ''}
  </div>`;
}

function classEditor(c) {
  const kids = c.children.slice().sort(byName);
  return `<section class="card">
    <div class="row-between">
      <h2>Edit list</h2>
      <button class="btn danger subtle" data-action="delete-class" data-id="${c.id}">Delete list</button>
    </div>
    <label class="field"><span>List name</span>
      <input value="${esc(c.name)}" data-change="rename-class" data-id="${c.id}" maxlength="60" autocomplete="off"></label>
    <h3>Children (${kids.length})</h3>
    <form data-form="add-child" data-id="${c.id}" class="inline-form">
      <input id="add-child-name" name="name" placeholder="Child's name" maxlength="40" required aria-label="Child's name" autocomplete="off">
      ${genderSelect(ui.lastGender, 'name="gender"')}
      <button class="btn">Add</button>
    </form>
    <details class="bulk">
      <summary>Add several at once</summary>
      <form data-form="add-many" data-id="${c.id}">
        <p class="muted">One name per line. Put <b>, B</b> or <b>, G</b> after a name to set boy or girl.</p>
        <textarea name="names" rows="6" placeholder="Amy Smith, G&#10;Ben Jones, B&#10;Charlie Brown"></textarea>
        <button class="btn">Add names</button>
      </form>
    </details>
    ${
      kids.length
        ? `<table class="kids"><thead><tr><th>Name</th><th>Boy / girl</th><th><span class="sr-only">Remove</span></th></tr></thead><tbody>
      ${kids
        .map(
          k => `<tr>
        <td><input value="${esc(k.name)}" data-change="rename-child" data-class="${c.id}" data-id="${k.id}" maxlength="40" aria-label="Name" autocomplete="off"></td>
        <td>${genderSelect(k.gender, `data-change="child-gender" data-class="${c.id}" data-id="${k.id}"`)}</td>
        <td><button class="icon-btn" data-action="remove-child" data-class="${c.id}" data-id="${k.id}" aria-label="Remove ${esc(k.name)}">✕</button></td>
      </tr>`,
        )
        .join('')}
      </tbody></table>`
        : '<p class="muted">No children yet.</p>'
    }
  </section>`;
}

function rulesTab() {
  const c = editingClass();
  if (!c) return noClassCard();
  const r = c.rules;
  const field = (key, label, hint, placeholder = 'No limit') => `
    <label class="field"><span>${label}</span>
      <input type="number" inputmode="numeric" min="0" max="999" value="${r[key] ?? ''}" placeholder="${placeholder}"
        data-change="rule" data-key="${key}" data-id="${c.id}">
      <small class="muted">${hint}</small></label>`;

  return `<section class="card narrow">
    ${classPicker(c)}
    <h2>Leaving rules for ${esc(c.name)}</h2>
    ${field('maxBoys', 'Boys out at once', 'Leave blank for no limit.')}
    ${field('maxGirls', 'Girls out at once', 'Leave blank for no limit.')}
    ${field('maxTotal', 'Children out at once in total', 'Counts everyone, including children with no boy/girl set. Leave blank for no limit.')}
    ${field('cooldownMins', 'Minutes before a child can go out again', 'Counted from when they last went out. 0 turns this off.', '0')}
    <button class="btn subtle" data-action="reset-rules" data-id="${c.id}">Reset to defaults (2 boys, 2 girls, 4 total, 45 min)</button>
  </section>`;
}

function filteredLog() {
  const from = ui.historyFrom ? startOfLocalDay(ui.historyFrom) : -Infinity;
  const to = ui.historyTo ? startOfLocalDay(ui.historyTo) + 86400000 : Infinity;
  return state.log
    .filter(e => (ui.historyClassId === 'all' || e.classId === ui.historyClassId) && e.outAt >= from && e.outAt < to)
    .sort((a, b) => b.outAt - a.outAt);
}

function historyTab() {
  const now = Date.now();
  const open = openEntries(state.log).sort((a, b) => a.outAt - b.outAt);
  const rows = filteredLog();
  const MAX_ROWS = 500;

  const totals = new Map();
  for (const e of rows) {
    const key = `${e.classId}|${e.childId}`;
    const t = totals.get(key) || { name: e.childName, className: e.className, trips: 0, mins: 0 };
    t.trips++;
    t.mins += minutes((e.backAt ?? now) - e.outAt);
    totals.set(key, t);
  }
  const summary = [...totals.values()].sort((a, b) => b.mins - a.mins);

  return `<div class="stack">
    <section class="card">
      <div class="row-between">
        <h2>Out right now (${open.length})</h2>
        ${open.length ? '<button class="btn subtle" data-action="all-back">Mark everyone back</button>' : ''}
      </div>
      ${
        open.length
          ? `<ul class="now-out">${open
              .map(
                e => `<li><span><b>${esc(e.childName)}</b> <span class="muted">${esc(e.className)} · out since ${fmtTime(e.outAt)} (${minutes(now - e.outAt)} min)</span></span>
            <button class="btn small" data-action="return" data-id="${e.id}">Back</button></li>`,
              )
              .join('')}</ul>`
          : '<p class="muted">Nobody is out.</p>'
      }
    </section>

    <section class="card">
      <h2>History</h2>
      <div class="filters">
        <label class="field"><span>Class list</span>
          <select data-change="hist-class">
            <option value="all">All lists</option>
            ${state.classes
              .slice()
              .sort(byName)
              .map(c => `<option value="${c.id}"${c.id === ui.historyClassId ? ' selected' : ''}>${esc(c.name)}</option>`)
              .join('')}
          </select></label>
        <label class="field"><span>From</span><input type="date" value="${ui.historyFrom}" data-change="hist-from"></label>
        <label class="field"><span>To</span><input type="date" value="${ui.historyTo}" data-change="hist-to"></label>
      </div>
      <div class="row-between">
        <p class="muted">${rows.length} ${rows.length === 1 ? 'trip' : 'trips'} out</p>
        <div class="btn-row">
          <button class="btn" data-action="export-csv"${rows.length ? '' : ' disabled'}>Export CSV</button>
          <button class="btn danger subtle" data-action="clear-history"${state.log.length ? '' : ' disabled'}>Clear history…</button>
        </div>
      </div>

      ${
        summary.length
          ? `<h3>Totals per child</h3>
        <div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th>Class</th><th>Trips</th><th>Minutes out</th></tr></thead><tbody>
        ${summary.map(t => `<tr><td>${esc(t.name)}</td><td>${esc(t.className)}</td><td>${t.trips}</td><td>${t.mins}</td></tr>`).join('')}
        </tbody></table></div>`
          : ''
      }

      ${
        rows.length
          ? `<h3>Every trip</h3>
        <div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Name</th><th>Class</th><th>Out</th><th>Back</th><th>Minutes</th></tr></thead><tbody>
        ${rows
          .slice(0, MAX_ROWS)
          .map(
            e => `<tr><td>${fmtDate(e.outAt)}</td><td>${esc(e.childName)}${e.override ? ' <span class="tag">override</span>' : ''}</td><td>${esc(e.className)}</td>
          <td>${fmtTime(e.outAt)}</td><td>${e.backAt ? fmtTime(e.backAt) : '<i>still out</i>'}</td><td>${minutes((e.backAt ?? now) - e.outAt)}</td></tr>`,
          )
          .join('')}
        </tbody></table></div>
        ${rows.length > MAX_ROWS ? `<p class="muted">Showing the latest ${MAX_ROWS}. Export CSV to see them all.</p>` : ''}`
          : '<p class="muted">No trips in this period.</p>'
      }
    </section>
  </div>`;
}

function deviceTab() {
  return `<div class="stack narrow">
    <section class="card">
      <h2>Class screen PIN</h2>
      <p>${state.pin ? 'A PIN is set. You need it to leave the class screen.' : 'No PIN yet. You will be asked to choose one when you first start the class screen.'}</p>
      <button class="btn" data-action="change-pin">${state.pin ? 'Change PIN' : 'Set PIN'}</button>
    </section>
    <section class="card">
      <h2>Backup</h2>
      <p>Everything is stored only on this device. Save a backup file now and then, or to move your lists to another device.</p>
      <div class="btn-row">
        <button class="btn" data-action="backup">Save backup file</button>
        <label class="btn">Restore from backup…<input type="file" accept=".json,application/json" data-change="restore" hidden></label>
      </div>
    </section>
    <section class="card">
      <h2>Privacy</h2>
      <p>Hallpass works fully offline. It has no accounts, sends nothing over the internet, and does not share data with anyone. Names and history stay in this browser on this device.</p>
    </section>
  </div>`;
}

// ---------- PIN pad ----------

function pinPad(title, subtitle = '') {
  return new Promise(resolve => {
    let value = '';
    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal pin-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <h2>${esc(title)}</h2>
          <p class="pin-sub${subtitle.startsWith('Wrong') ? ' error' : ''}">${esc(subtitle)}</p>
          <div class="pin-dots"><span></span><span></span><span></span><span></span></div>
          <div class="pin-grid">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
            <button data-k="cancel" class="pin-text">Cancel</button>
            <button data-k="0">0</button>
            <button data-k="del" class="pin-text" aria-label="Delete">⌫</button>
          </div>
        </div>
      </div>`;
    const dots = [...modalRoot.querySelectorAll('.pin-dots span')];

    const close = result => {
      document.removeEventListener('keydown', onKey);
      modalRoot.innerHTML = '';
      resolve(result);
    };
    const press = k => {
      if (k === 'cancel') return close(null);
      if (k === 'del') value = value.slice(0, -1);
      else if (value.length < 4) value += k;
      dots.forEach((d, i) => d.classList.toggle('filled', i < value.length));
      if (value.length === 4) setTimeout(() => close(value), 150);
    };
    const onKey = e => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Escape') press('cancel');
    };
    modalRoot.querySelector('.pin-grid').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b) press(b.dataset.k);
    });
    document.addEventListener('keydown', onKey);
  });
}

async function choosePin() {
  const first = await pinPad('Choose a 4-digit PIN', "You'll need it to leave the class screen.");
  if (!first) return false;
  const again = await pinPad('Type the PIN again');
  if (!again) return false;
  if (first !== again) {
    buzz();
    alert("Those PINs didn't match. Please try again.");
    return false;
  }
  state.pin = first;
  persist();
  return true;
}

// ---------- class screen lock-down ----------

let wakeLock = null;
const isStandalone = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;

async function keepScreenOn() {
  try {
    if (navigator.wakeLock && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    }
  } catch {}
}

function goFullscreen() {
  if (isStandalone() || document.fullscreenElement || document.webkitFullscreenElement) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  try {
    req?.call(el)?.catch?.(() => {});
  } catch {}
}

function lockDown() {
  history.pushState({ hallpass: true }, '');
  goFullscreen();
  keepScreenOn();
}

async function startClassScreen() {
  if (!activeClass()) return;
  if (!state.pin && !(await choosePin())) return;
  state.mode = 'class';
  persist();
  lockDown();
  render();
}

async function exitClassScreen() {
  let subtitle = '';
  for (;;) {
    const pin = await pinPad('Teacher PIN', subtitle);
    if (pin == null) return;
    if (pin === state.pin) break;
    buzz();
    subtitle = 'Wrong PIN. Try again.';
  }
  state.mode = 'settings';
  persist();
  wakeLock?.release().catch(() => {});
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  render();
}

// ---------- actions ----------

// Tapping a refused name this many times within the window asks for the teacher PIN to override.
const OVERRIDE_TAPS = 3;
const OVERRIDE_WINDOW_MS = 20000;
const refusedTaps = new Map(); // childId -> recent refused tap times

function tapLeave(btn) {
  const cls = activeClass();
  const child = cls?.children.find(c => c.id === btn.dataset.id);
  if (!child) return;
  const now = Date.now();
  const result = checkLeave(state.log, cls, child, now);
  if (result.ok) return sendOut(cls, child, false);

  buzz();
  shake(btn);
  toast(result.message, 'error');
  if (result.alreadyOut) return;

  const taps = (refusedTaps.get(child.id) || []).filter(t => now - t < OVERRIDE_WINDOW_MS);
  taps.push(now);
  refusedTaps.set(child.id, taps);
  if (taps.length >= OVERRIDE_TAPS) {
    refusedTaps.delete(child.id);
    overrideLeave(cls, child);
  }
}

async function overrideLeave(cls, child) {
  let subtitle = `Let ${child.name} go out anyway?`;
  for (;;) {
    const pin = await pinPad('Teacher override', subtitle);
    if (pin == null) return;
    if (pin === state.pin) break;
    buzz();
    subtitle = 'Wrong PIN. Try again.';
  }
  // The class list may have changed while the PIN pad was open.
  if (state.mode !== 'class' || activeClass() !== cls || !cls.children.includes(child)) return;
  if (openEntries(state.log).some(e => e.childId === child.id)) return;
  sendOut(cls, child, true);
}

function sendOut(cls, child, override) {
  state.log.push({
    id: newId(),
    classId: cls.id,
    className: cls.name,
    childId: child.id,
    childName: child.name,
    gender: child.gender,
    outAt: Date.now(),
    backAt: null,
    ...(override && { override: true }),
  });
  persist();
  dingOut();
  render();
  toast(override ? `${child.name} is out (teacher override)` : `${child.name} is out`);
}

function tapReturn(id) {
  const entry = state.log.find(e => e.id === id);
  if (!entry || entry.backAt) return;
  returnEntry(entry);
  persist();
  dingBack();
  render();
  toast(`Welcome back, ${entry.childName}`);
}

function deleteClass(id) {
  const c = findClass(id);
  if (!c) return;
  const outCount = openEntries(state.log).filter(e => e.classId === id).length;
  const extra = outCount ? `\n\n${outCount} ${outCount === 1 ? 'child is' : 'children are'} still out and will be marked back.` : '';
  if (!confirm(`Delete the list "${c.name}"? Its history is kept.${extra}`)) return;
  openEntries(state.log)
    .filter(e => e.classId === id)
    .forEach(returnEntry);
  state.classes = state.classes.filter(x => x.id !== id);
  if (state.activeClassId === id) state.activeClassId = state.classes.slice().sort(byName)[0]?.id ?? null;
  if (ui.editClassId === id) ui.editClassId = null;
  persist();
  render();
}

function removeChild(classId, childId) {
  const c = findClass(classId);
  const k = c?.children.find(x => x.id === childId);
  if (!k || !confirm(`Remove ${k.name} from ${c.name}? Their history is kept.`)) return;
  openEntries(state.log)
    .filter(e => e.childId === childId)
    .forEach(returnEntry);
  c.children = c.children.filter(x => x.id !== childId);
  persist();
  render();
}

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheets treating names as formulas
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv() {
  const header = ['Class', 'Name', 'Boy/Girl', 'Date', 'Time out', 'Time back', 'Minutes out', 'Teacher override'];
  const now = Date.now();
  const lines = filteredLog()
    .reverse()
    .map(e => [
      e.className,
      e.childName,
      genderLabel(e.gender),
      localDate(e.outAt),
      fmtTime(e.outAt),
      e.backAt ? fmtTime(e.backAt) : 'still out',
      minutes((e.backAt ?? now) - e.outAt),
      e.override ? 'Yes' : '',
    ]);
  const csv = [header, ...lines].map(row => row.map(csvCell).join(',')).join('\r\n');
  download(`hallpass-history-${localDate(now)}.csv`, '﻿' + csv, 'text/csv');
}

function addChild(cls, name, gender) {
  if (!name) return 'empty';
  if (cls.children.some(k => same(k.name, name))) return 'duplicate';
  cls.children.push({ id: newId(), name, gender });
  return 'added';
}

function parseLine(line) {
  const m = line.match(/^(.*?)[,\t]\s*(b|g|boy|girl|m|f|male|female)\s*$/i);
  if (!m) return { name: norm(line), gender: '' };
  const g = m[2].toLowerCase();
  return { name: norm(m[1]), gender: ['b', 'boy', 'm', 'male'].includes(g) ? 'M' : 'F' };
}

async function restoreBackup(file) {
  try {
    const restored = normalise(JSON.parse(await file.text()));
    if (!confirm(`Replace everything on this device with this backup (${restored.classes.length} class lists, ${restored.log.length} trips)?`)) return;
    restored.mode = 'settings';
    state = restored;
    persist();
    render();
    toast('Backup restored');
  } catch {
    alert("That file isn't a Hallpass backup.");
  }
}

// ---------- events ----------

app.addEventListener('click', e => {
  unlockAudio();
  if (state.mode === 'class') goFullscreen();
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  const { action, id } = btn.dataset;

  switch (action) {
    case 'leave':
      return tapLeave(btn);
    case 'return':
      return tapReturn(id);
    case 'exit-class':
      return exitClassScreen();
    case 'start':
      return startClassScreen();
    case 'tab':
      ui.tab = btn.dataset.tab;
      return render();
    case 'edit-class':
      ui.editClassId = id;
      return render();
    case 'delete-class':
      return deleteClass(id);
    case 'remove-child':
      return removeChild(btn.dataset.class, id);
    case 'reset-rules':
      findClass(id).rules = defaultRules();
      persist();
      return render();
    case 'all-back':
      if (!confirm('Mark every child who is out as back now?')) return;
      openEntries(state.log).forEach(returnEntry);
      persist();
      return render();
    case 'export-csv':
      return exportCsv();
    case 'clear-history':
      if (!confirm('Delete all history on this device? Children who are out now will be kept. This cannot be undone.')) return;
      state.log = openEntries(state.log);
      persist();
      return render();
    case 'change-pin':
      return choosePin().then(ok => ok && (toast('PIN saved'), render()));
    case 'backup':
      return download(`hallpass-backup-${localDate(Date.now())}.json`, JSON.stringify({ ...state, mode: 'settings' }, null, 1), 'application/json');
  }
});

app.addEventListener('change', e => {
  const t = e.target;
  const kind = t.dataset.change;
  if (!kind) return;
  const cls = findClass(t.dataset.class || t.dataset.id);

  switch (kind) {
    case 'active-class':
      state.activeClassId = t.value;
      ui.editClassId = t.value;
      persist();
      return render();
    case 'edit-class':
      ui.editClassId = t.value;
      return render();
    case 'rename-class': {
      const name = norm(t.value);
      if (!name || state.classes.some(c => c.id !== cls.id && same(c.name, name))) {
        if (name) alert(`There is already a list called "${name}". List names must be different.`);
        t.value = cls.name;
        return;
      }
      cls.name = name;
      persist();
      return render();
    }
    case 'rename-child': {
      const kid = cls.children.find(k => k.id === t.dataset.id);
      const name = norm(t.value);
      if (!name || cls.children.some(k => k.id !== kid.id && same(k.name, name))) {
        if (name) alert(`${name} is already on this list. Names in a list must be different.`);
        t.value = kid.name;
        return;
      }
      kid.name = t.value = name;
      persist();
      return;
    }
    case 'child-gender':
      cls.children.find(k => k.id === t.dataset.id).gender = t.value;
      persist();
      return;
    case 'rule': {
      const key = t.dataset.key;
      const raw = t.value.trim();
      let v = raw === '' ? null : Math.floor(Number(raw));
      if (!Number.isFinite(v) || v < 0) v = null;
      if (key === 'cooldownMins') v = v ?? 0;
      cls.rules[key] = v;
      t.value = v ?? '';
      persist();
      return;
    }
    case 'hist-class':
      ui.historyClassId = t.value;
      return render();
    case 'hist-from':
      ui.historyFrom = t.value;
      return render();
    case 'hist-to':
      ui.historyTo = t.value;
      return render();
    case 'restore':
      if (t.files[0]) restoreBackup(t.files[0]);
      t.value = '';
      return;
  }
});

app.addEventListener('submit', e => {
  const form = e.target;
  e.preventDefault();
  const data = new FormData(form);

  switch (form.dataset.form) {
    case 'add-class': {
      const name = norm(data.get('name'));
      if (!name) return;
      if (state.classes.some(c => same(c.name, name))) return alert(`There is already a list called "${name}". List names must be different.`);
      const cls = { id: newId(), name, children: [], rules: defaultRules() };
      state.classes.push(cls);
      if (!activeClass()) state.activeClassId = cls.id;
      ui.editClassId = cls.id;
      persist();
      render();
      return document.getElementById('add-child-name')?.focus();
    }
    case 'add-child': {
      const cls = findClass(form.dataset.id);
      const name = norm(data.get('name'));
      ui.lastGender = data.get('gender') || '';
      if (addChild(cls, name, ui.lastGender) === 'duplicate') return alert(`${name} is already on this list. Names in a list must be different.`);
      persist();
      render();
      return document.getElementById('add-child-name')?.focus();
    }
    case 'add-many': {
      const cls = findClass(form.dataset.id);
      const skipped = [];
      let added = 0;
      for (const line of String(data.get('names') || '').split(/\r?\n/)) {
        if (!line.trim()) continue;
        const { name, gender } = parseLine(line);
        const res = addChild(cls, name, gender);
        if (res === 'added') added++;
        else if (res === 'duplicate') skipped.push(name);
      }
      persist();
      render();
      toast(`Added ${added} ${added === 1 ? 'name' : 'names'}`);
      if (skipped.length) alert(`These were already on the list, so they were skipped:\n\n${skipped.join('\n')}`);
      return;
    }
  }
});

// Keep the class screen in place: swallow the Back button, warn before closing, refresh timers.
window.addEventListener('popstate', () => {
  if (state?.mode === 'class') history.pushState({ hallpass: true }, '');
});
window.addEventListener('beforeunload', e => {
  if (state?.mode === 'class') {
    e.preventDefault();
    e.returnValue = '';
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state?.mode === 'class') {
    keepScreenOn();
    render();
  }
});
setInterval(() => state?.mode === 'class' && render(), 15000);

// ---------- start ----------

state = await loadState();
if (state.mode === 'class') lockDown();
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
