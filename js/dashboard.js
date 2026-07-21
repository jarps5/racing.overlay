// dashboard.js — a small drag/resize/color-editable widget grid.
// Used by both recorder.html (phone, personal layout, saved locally) and
// overlay.html (OBS, layout synced through Firebase so edits from any
// device update what OBS is showing live).
//
// A "storage" adapter is passed in with { load(), save(layout), subscribe(cb) }
// so the engine itself doesn't care whether layout lives in localStorage or
// Firebase.

function createDashboard({ container, storage, registry, getData }) {
  let layout = [];
  let editMode = false;
  let suppressSave = false; // true while applying a remote (Firebase) update

  function uid() { return 'w_' + Math.random().toString(36).slice(2, 9); }

  function defaultColors() {
    return { accent: '#f5c518', text: '#e8eaed', bgAlpha: 0.82 };
  }

  function widgetEl(id) { return container.querySelector(`[data-id="${id}"]`); }

  function render() {
    container.innerHTML = '';
    layout.forEach((w) => container.appendChild(buildWidgetEl(w)));
    container.classList.toggle('ro-edit-mode', editMode);
  }

  function buildWidgetEl(w) {
    const def = registry[w.type];
    const el = document.createElement('div');
    el.className = 'ro-widget';
    el.dataset.id = w.id;
    el.style.left = w.x + '%';
    el.style.top = w.y + '%';
    el.style.width = w.w + '%';
    el.style.height = w.h + '%';
    el.style.setProperty('--w-accent', w.colors.accent);
    el.style.setProperty('--w-text', w.colors.text);
    el.style.setProperty('--w-bg', `rgba(11,13,16,${w.colors.bgAlpha})`);

    const body = document.createElement('div');
    body.className = 'ro-widget-body';
    el.appendChild(body);

    if (editMode) {
      const bar = document.createElement('div');
      bar.className = 'ro-widget-bar';
      bar.innerHTML = `
        <span class="ro-widget-label">${def ? def.label : w.type}</span>
        <button class="ro-w-btn ro-w-color" title="Colors">&#9679;</button>
        <button class="ro-w-btn ro-w-del" title="Remove">&times;</button>
      `;
      el.appendChild(bar);
      const resizer = document.createElement('div');
      resizer.className = 'ro-widget-resize';
      el.appendChild(resizer);

      bar.querySelector('.ro-w-del').onclick = (e) => { e.stopPropagation(); removeWidget(w.id); };
      bar.querySelector('.ro-w-color').onclick = (e) => { e.stopPropagation(); openColorPopover(w, e.currentTarget); };
      attachDrag(el, w);
      attachResize(resizer, el, w);
    }

    if (def) def.render(body, getData ? getData() : {}, w.colors);
    return el;
  }

  function attachDrag(el, w) {
    let startX, startY, startLeft, startTop, dragging = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.ro-w-btn') || e.target.closest('.ro-widget-resize')) return;
      dragging = true;
      el.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY;
      startLeft = w.x; startTop = w.y;
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const rect = container.getBoundingClientRect();
      const dxPct = ((e.clientX - startX) / rect.width) * 100;
      const dyPct = ((e.clientY - startY) / rect.height) * 100;
      w.x = clamp(startLeft + dxPct, 0, 100 - w.w);
      w.y = clamp(startTop + dyPct, 0, 100 - w.h);
      el.style.left = w.x + '%';
      el.style.top = w.y + '%';
    });
    el.addEventListener('pointerup', () => { if (dragging) { dragging = false; persist(); } });
  }

  function attachResize(handle, el, w) {
    let startX, startY, startW, startH, resizing = false;
    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      resizing = true;
      handle.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY;
      startW = w.w; startH = w.h;
    });
    handle.addEventListener('pointermove', (e) => {
      if (!resizing) return;
      const rect = container.getBoundingClientRect();
      const dwPct = ((e.clientX - startX) / rect.width) * 100;
      const dhPct = ((e.clientY - startY) / rect.height) * 100;
      w.w = clamp(startW + dwPct, 10, 100 - w.x);
      w.h = clamp(startH + dhPct, 8, 100 - w.y);
      el.style.width = w.w + '%';
      el.style.height = w.h + '%';
    });
    handle.addEventListener('pointerup', () => { if (resizing) { resizing = false; persist(); } });
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function openColorPopover(w, anchorBtn) {
    document.querySelectorAll('.ro-color-pop').forEach((p) => p.remove());
    const pop = document.createElement('div');
    pop.className = 'ro-color-pop';
    pop.innerHTML = `
      <label>Accent<input type="color" class="cAccent" value="${w.colors.accent}"></label>
      <label>Text<input type="color" class="cText" value="${w.colors.text}"></label>
      <label>Background<input type="range" class="cBg" min="0" max="1" step="0.05" value="${w.colors.bgAlpha}"></label>
    `;
    document.body.appendChild(pop);
    const rect = anchorBtn.getBoundingClientRect();
    pop.style.left = rect.left + 'px';
    pop.style.top = (rect.bottom + 6) + 'px';

    pop.querySelector('.cAccent').oninput = (e) => { w.colors.accent = e.target.value; refreshOne(w); };
    pop.querySelector('.cText').oninput = (e) => { w.colors.text = e.target.value; refreshOne(w); };
    pop.querySelector('.cBg').oninput = (e) => { w.colors.bgAlpha = parseFloat(e.target.value); refreshOne(w); };

    const closeHandler = (e) => {
      if (!pop.contains(e.target) && e.target !== anchorBtn) {
        pop.remove();
        document.removeEventListener('pointerdown', closeHandler);
        persist();
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeHandler), 0);
  }

  function refreshOne(w) {
    const el = widgetEl(w.id);
    if (!el) return;
    el.style.setProperty('--w-accent', w.colors.accent);
    el.style.setProperty('--w-text', w.colors.text);
    el.style.setProperty('--w-bg', `rgba(11,13,16,${w.colors.bgAlpha})`);
  }

  function addWidget(type) {
    const def = registry[type];
    if (!def) return;
    layout.push({
      id: uid(), type,
      x: 5, y: 5, w: def.defaultW || 24, h: def.defaultH || 16,
      colors: defaultColors(),
    });
    render();
    persist();
  }

  function removeWidget(id) {
    layout = layout.filter((w) => w.id !== id);
    render();
    persist();
  }

  function persist() {
    if (suppressSave) return;
    storage.save(layout);
  }

  function toggleEdit() {
    editMode = !editMode;
    render();
    return editMode;
  }

  function update(data) {
    if (!getData) getData = () => data;
    layout.forEach((w) => {
      const def = registry[w.type];
      const el = widgetEl(w.id);
      if (def && el) def.render(el.querySelector('.ro-widget-body'), data, w.colors);
    });
  }

  async function init() {
    layout = (await storage.load()) || [];
    if (storage.subscribe) {
      storage.subscribe((remote) => {
        if (!remote) return;
        suppressSave = true;
        layout = remote;
        render();
        suppressSave = false;
      });
    }
    render();
  }

  return { init, update, toggleEdit, addWidget, removeWidget, get editMode() { return editMode; }, get layout() { return layout; } };
}

// ---- storage adapters ----

const LocalLayoutStorage = (key, defaultLayout) => ({
  load: async () => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultLayout;
  },
  save: async (layout) => localStorage.setItem(key, JSON.stringify(layout)),
});

const FirebaseLayoutStorage = (defaultLayout) => ({
  load: async () => {
    return new Promise((resolve) => {
      const ref = Live.roomRefPublic ? Live.roomRefPublic('layout') : null;
      if (!ref) { resolve(defaultLayout); return; }
      ref.once('value', (snap) => resolve(snap.val() || defaultLayout));
    });
  },
  save: async (layout) => {
    if (Live.roomRefPublic) Live.roomRefPublic('layout').set(layout);
  },
  subscribe: (cb) => {
    if (!Live.roomRefPublic) return;
    const ref = Live.roomRefPublic('layout');
    const handler = (snap) => cb(snap.val());
    ref.on('value', handler);
    return () => ref.off('value', handler);
  },
});
