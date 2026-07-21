// dashboard-toolbar.js — the floating "Edit" / "+" buttons that sit on top
// of a dashboard. Shared between recorder.html and overlay.html.

function attachDashboardToolbar(dashboard, mountEl) {
  const toolbar = document.createElement('div');
  toolbar.className = 'ro-toolbar';
  toolbar.innerHTML = `
    <div id="roAddMenu" class="ro-add-menu" style="display:none;"></div>
    <button class="ro-fab secondary" id="roEditBtn" title="Edit layout">&#9998;</button>
    <button class="ro-fab" id="roAddBtn" title="Add widget">+</button>
  `;
  mountEl.appendChild(toolbar);

  const menu = toolbar.querySelector('#roAddMenu');
  Object.keys(WidgetRegistry).forEach((type) => {
    const btn = document.createElement('button');
    btn.textContent = '+ ' + WidgetRegistry[type].label;
    btn.onclick = () => { dashboard.addWidget(type); menu.style.display = 'none'; };
    menu.appendChild(btn);
  });

  const editBtn = toolbar.querySelector('#roEditBtn');
  const addBtn = toolbar.querySelector('#roAddBtn');

  editBtn.onclick = () => {
    const on = dashboard.toggleEdit();
    editBtn.style.background = on ? '#f5c518' : '';
    editBtn.style.color = on ? '#0b0d10' : '';
    menu.style.display = 'none';
  };
  addBtn.onclick = () => { menu.style.display = menu.style.display === 'none' ? 'flex' : 'none'; };

  return toolbar;
}
