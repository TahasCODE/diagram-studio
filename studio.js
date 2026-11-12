const example = {
  nodes: [
    { id: 'request', label: 'Request refund', x: 16, y: 50 },
    { id: 'review', label: 'Review request', x: 49, y: 50 },
    { id: 'approved', label: 'Issue refund', x: 82, y: 28 },
    { id: 'declined', label: 'Decline refund', x: 82, y: 72 },
    { id: 'timeout', label: 'Payment times out', x: 18, y: 78 },
    { id: 'retry', label: 'Retry payment', x: 48, y: 81 },
  ],
  scenarios: [
    { name: 'Approved refund', steps: ['request', 'review', 'approved'] },
    { name: 'Declined refund', steps: ['request', 'review', 'declined'] },
    { name: 'Retry after a timeout', steps: ['request', 'review', 'timeout', 'retry', 'approved'] },
  ],
};

const $ = id => document.getElementById(id);
const demos = {
  refund: example,
  checkout: {
    nodes: [
      { id: 'cart', label: 'Submit order', x: 16, y: 45 },
      { id: 'pay', label: 'Charge payment', x: 48, y: 45 },
      { id: 'ship', label: 'Confirm order', x: 82, y: 22 },
      { id: 'fail', label: 'Payment declined', x: 82, y: 50 },
      { id: 'duplicate', label: 'Return existing order', x: 48, y: 78 },
    ],
    scenarios: [
      { name: 'Successful checkout', steps: ['cart', 'pay', 'ship'] },
      { name: 'Declined payment', steps: ['cart', 'pay', 'fail'] },
      { name: 'Duplicate request', steps: ['cart', 'duplicate'] },
    ],
  },
  webhook: {
    nodes: [
      { id: 'event', label: 'Publish event', x: 16, y: 40 },
      { id: 'deliver', label: 'Deliver webhook', x: 48, y: 40 },
      { id: 'ack', label: 'Receive acknowledgment', x: 82, y: 22 },
      { id: 'wait', label: 'Wait before retry', x: 48, y: 75 },
      { id: 'dead', label: 'Send to dead-letter queue', x: 82, y: 75 },
    ],
    scenarios: [
      { name: 'Delivered first time', steps: ['event', 'deliver', 'ack'] },
      { name: 'Recovered after timeout', steps: ['event', 'deliver', 'wait', 'deliver', 'ack'] },
      { name: 'Retries exhausted', steps: ['event', 'deliver', 'wait', 'deliver', 'dead'] },
    ],
  },
};
const storageKey = 'diagram-studio-v1';

function readProject(raw) {
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.scenarios) || !data.scenarios.length ||
    (data.title !== undefined && typeof data.title !== 'string')) return null;
  const ids = new Set(data.nodes.map(node => node?.id));
  if (ids.size !== data.nodes.length || !data.nodes.every(node =>
    typeof node?.id === 'string' && typeof node.label === 'string' &&
    (node.notes === undefined || typeof node.notes === 'string') &&
    [node.x, node.y].every(value => Number.isFinite(value) && value >= 0 && value <= 100)
  )) return null;
  return data.scenarios.every(scenario => typeof scenario?.name === 'string' &&
    (scenario.description === undefined || typeof scenario.description === 'string') &&
    Array.isArray(scenario.steps) && scenario.steps.every(id => ids.has(id)) &&
    (scenario.review === undefined || (Array.isArray(scenario.review) && scenario.review.every(reason => typeof reason === 'string')))) ? data : null;
}

let shared;
let saved;
const remixKey = storageKey + '-remix';
const isRemix = new URLSearchParams(location.search).has('remix');
const activeStorageKey = isRemix ? remixKey : storageKey;
try { shared = readProject(decodeURIComponent(location.hash.slice(1))); } catch {}
try { saved = readProject(localStorage.getItem(activeStorageKey)); } catch {}
const project = structuredClone(shared || saved || example);
let scenarioIndex = 0;
let stepIndex = 0;
let selected = project.nodes[0]?.id;
const current = () => project.scenarios[scenarioIndex];
const history = [JSON.stringify(project)];
let historyIndex = 0;
let pendingImport = null;
let pendingDelete = null;
let darkTheme = false;
try { darkTheme = localStorage.getItem(storageKey + '-theme') === 'dark'; } catch {}
function applyTheme() {
  document.documentElement.dataset.theme = darkTheme ? 'dark' : 'light';
  $('theme-toggle').textContent = darkTheme ? 'Light Theme' : 'Dark Theme';
  $('theme-toggle').setAttribute('aria-pressed', String(darkTheme));
}
applyTheme();
$('theme-toggle').onclick = () => {
  darkTheme = !darkTheme;
  applyTheme();
  try { localStorage.setItem(storageKey + '-theme', darkTheme ? 'dark' : 'light'); } catch {}
};
$('save-state').textContent = shared ? 'Shared Snapshot' : saved ? 'Saved in This Browser' : 'Not Saved Yet';
$('editor').hidden = Boolean(shared);
$('examples').hidden = Boolean(shared);
$('history-tools').hidden = Boolean(shared);
$('project-files').hidden = Boolean(shared);
$('remix').hidden = !shared;
$('remix').onclick = () => {
  try {
    localStorage.setItem(remixKey, JSON.stringify(project));
    const editorUrl = new URL(location.href);
    editorUrl.hash = '';
    editorUrl.searchParams.set('remix', '1');
    location.assign(editorUrl);
  } catch {
    $('status').textContent = 'Enable browser storage to remix this diagram.';
  }
};

function save() {
  try {
    localStorage.setItem(activeStorageKey, JSON.stringify(project));
    $('save-state').textContent = 'Saved in This Browser';
    $('save-state').classList.remove('save-error');
  } catch {
    $('save-state').textContent = 'Changes Not Saved';
    $('save-state').classList.add('save-error');
    $('status').textContent = 'Local storage is unavailable. Copy a playback link to keep this version.';
  }
}

function commitHistory() {
  const snapshot = JSON.stringify(project);
  if (snapshot === history[historyIndex]) return;
  history.splice(historyIndex + 1);
  history.push(snapshot);
  if (history.length > 50) history.shift();
  historyIndex = history.length - 1;
}

function restoreHistory(direction) {
  if (shared) return;
  const target = historyIndex + direction;
  if (target < 0 || target >= history.length) return;
  historyIndex = target;
  const snapshot = JSON.parse(history[historyIndex]);
  project.nodes = snapshot.nodes;
  project.scenarios = snapshot.scenarios;
  if (snapshot.title === undefined) delete project.title;
  else project.title = snapshot.title;
  scenarioIndex = Math.min(scenarioIndex, project.scenarios.length - 1);
  stepIndex = Math.max(0, Math.min(stepIndex, current().steps.length - 1));
  if (!project.nodes.some(node => node.id === selected)) selected = project.nodes[0]?.id;
  save();
  render();
  $('status').textContent = direction < 0 ? 'Last edit undone.' : 'Edit restored.';
}
$('undo').onclick = () => restoreHistory(-1);
$('redo').onclick = () => restoreHistory(1);

function projectFileContents() {
  return JSON.stringify({ format: 'diagram-studio', version: 1, project }, null, 2);
}

function parseProjectFile(raw) {
  const data = JSON.parse(raw);
  if (data?.format === 'diagram-studio') {
    if (data.version !== 1) throw new Error('Unsupported project version.');
    return readProject(JSON.stringify(data.project));
  }
  return readProject(raw);
}

$('export-project').onclick = () => {
  const blob = new Blob([projectFileContents()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'diagram-studio-project.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('status').textContent = 'Project export downloaded.';
};
$('import-project').onclick = () => $('project-file').click();
$('project-file').onchange = async event => {
  const file = event.target.files?.[0];
  pendingImport = null;
  $('import-confirm').hidden = true;
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('File too large.');
    const imported = parseProjectFile(await file.text());
    if (!imported) throw new Error('Invalid diagram.');
    pendingImport = imported;
    $('import-summary').textContent = 'Import ' + imported.nodes.length + ' nodes and ' + imported.scenarios.length + ' scenarios?';
    $('import-confirm').hidden = false;
  } catch {
    $('status').textContent = 'Could not import this file. Choose a valid Diagram Studio JSON project under 5 MB.';
  } finally {
    event.target.value = '';
  }
};
$('cancel-import').onclick = () => { pendingImport = null; $('import-confirm').hidden = true; };
$('confirm-import').onclick = () => {
  if (!pendingImport || shared) return;
  project.nodes = pendingImport.nodes;
  project.scenarios = pendingImport.scenarios;
  if (pendingImport.title === undefined) delete project.title;
  else project.title = pendingImport.title;
  scenarioIndex = 0;
  stepIndex = 0;
  selected = project.nodes[0]?.id;
  pendingImport = null;
  $('import-confirm').hidden = true;
  update();
  $('status').textContent = 'Project imported and saved in this browser.';
};

function flagScenarios(nodeId, reason) {
  for (const scenario of project.scenarios) {
    if (!scenario.steps.includes(nodeId)) continue;
    scenario.review = [...new Set([...(scenario.review || []), reason])];
  }
}

$('load-demo').onclick = () => { $('demo-confirm').hidden = false; };
$('cancel-demo').onclick = () => { $('demo-confirm').hidden = true; };
$('confirm-demo').onclick = () => {
  const demo = structuredClone(demos[$('demo').value]);
  project.nodes = demo.nodes;
  project.scenarios = demo.scenarios;
  project.title = { refund: 'Refunds and Retries', checkout: 'Checkout and Payment', webhook: 'Webhook Delivery' }[$('demo').value];
  scenarioIndex = 0;
  stepIndex = 0;
  selected = project.nodes[0]?.id;
  $('demo-confirm').hidden = true;
  update();
  $('status').textContent = 'Example opened. Changes save in this browser.';
};
$('reviewed').onclick = () => {
  delete current().review;
  update();
  $('status').textContent = 'Current scenario marked reviewed.';
};

function renderGraph() {
  const nodeLayer = $('nodes');
  const lines = $('lines');
  const { width, height } = nodeLayer.getBoundingClientRect();
  nodeLayer.replaceChildren();
  lines.replaceChildren();
  const byId = new Map(project.nodes.map(node => [node.id, node]));
  const path = current().steps;
  const drawn = new Set();

  for (const scenario of project.scenarios) {
    for (let index = 1; index < scenario.steps.length; index++) {
      const from = byId.get(scenario.steps[index - 1]);
      const to = byId.get(scenario.steps[index]);
      const key = JSON.stringify([from.id, to.id]);
      if (from === to || drawn.has(key)) continue;
      drawn.add(key);
      const x = from.x * width / 100;
      const y = from.y * height / 100;
      const dx = (to.x - from.x) * width / 100;
      const dy = (to.y - from.y) * height / 100;
      const inset = Math.min(.45, Math.min(Math.min(width * .12, 70) / Math.abs(dx), 26 / Math.abs(dy)));
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      for (const [name, value] of Object.entries({
        x1: x + dx * inset, y1: y + dy * inset,
        x2: x + dx * (1 - inset), y2: y + dy * (1 - inset),
      })) line.setAttribute(name, value);
      if (from.id === path[stepIndex - 1] && to.id === path[stepIndex]) line.classList.add('active-edge');
      lines.append(line);
    }
  }

  for (const node of project.nodes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'node';
    button.style.left = node.x + '%';
    button.style.top = node.y + '%';
    button.textContent = node.label;
    button.classList.toggle('active', path[stepIndex] === node.id);
    button.classList.toggle('selected', !shared && selected === node.id);
    if (shared) {
      button.tabIndex = -1;
      button.disabled = true;
    } else {
      button.addEventListener('click', () => {
        selected = node.id;
        render();
        $('label').focus();
      });
      button.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        button.setPointerCapture(event.pointerId);
        const bounds = nodeLayer.getBoundingClientRect();
        const startX = event.clientX;
        const startY = event.clientY;
        const originalX = node.x;
        const originalY = node.y;
        let moved = false;
        button.onpointermove = move => {
          if (!moved && Math.hypot(move.clientX - startX, move.clientY - startY) < 4) return;
          moved = true;
          node.x = Math.max(13, Math.min(87, originalX + (move.clientX - startX) * 100 / bounds.width));
          node.y = Math.max(10, Math.min(90, originalY + (move.clientY - startY) * 100 / bounds.height));
          button.style.left = node.x + '%';
          button.style.top = node.y + '%';
        };
        const finish = () => {
          button.onpointermove = null;
          if (!moved) return;
          selected = node.id;
          update();
        };
        button.onpointerup = finish;
        button.onpointercancel = finish;
      });
    }
    nodeLayer.append(button);
  }
}

function render() {
  pendingDelete = null;
  $('delete-confirm').hidden = true;
  const routeIndex = $('route').selectedIndex;
  const steps = current().steps;
  const active = project.nodes.find(node => node.id === steps[stepIndex]);
  const editing = project.nodes.find(node => node.id === selected);
  $('project-heading').textContent = project.title || 'One Diagram. Every Path.';
  document.title = project.title ? project.title + ' — Diagram Studio' : 'Diagram Studio — Interactive System Diagrams';
  $('project-title').value = project.title || '';
  $('scenario-description').value = current().description || '';
  $('scenario-context').textContent = current().description || '';
  $('scenario-context').hidden = !current().description;
  $('node-notes').value = editing?.notes || '';
  $('node-notes').disabled = !editing;
  $('active-note-text').textContent = active?.notes || '';
  $('active-note').hidden = !active?.notes;
  $('delete-scenario').disabled = project.scenarios.length <= 1;
  $('auto-arrange').disabled = !project.nodes.length;
  $('scenario').replaceChildren(...project.scenarios.map(item => new Option(item.name + (!shared && item.review?.length ? ' — needs review' : ''))));
  $('scenario').selectedIndex = scenarioIndex;
  $('scenario-name').value = current().name;
  $('undo').disabled = historyIndex === 0;
  $('redo').disabled = historyIndex >= history.length - 1;
  $('progress').max = Math.max(1, steps.length);
  $('progress').value = steps.length ? stepIndex + 1 : 0;
  $('progress').setAttribute('aria-valuetext', steps.length ? 'Step ' + (stepIndex + 1) + ' of ' + steps.length : 'No steps');
  $('restart').disabled = stepIndex === 0;
  $('step').textContent = active ? (stepIndex + 1) + ' / ' + steps.length + ' · ' + active.label : 'This scenario has no steps yet.';
  $('prev').disabled = stepIndex === 0;
  $('next').disabled = stepIndex + 1 >= steps.length;
  $('timeline').replaceChildren(...steps.map((id, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = project.nodes.find(node => node.id === id).label;
    button.setAttribute('aria-label', 'Step ' + (index + 1) + ': ' + button.textContent);
    if (index === stepIndex) button.setAttribute('aria-current', 'step');
    button.onclick = () => { stepIndex = index; render(); };
    item.append(button);
    return item;
  }));
  $('label').value = editing?.label ?? '';
  $('label').disabled = !editing;
  $('remove').disabled = !editing;
  $('append').disabled = !editing;
  $('route').replaceChildren(...steps.map(id => new Option(project.nodes.find(node => node.id === id).label)));
  $('route').selectedIndex = Math.min(Math.max(0, routeIndex), steps.length - 1);
  $('drop').disabled = !steps.length;
  renderRouteControls();
  $('reviews').replaceChildren();
  project.scenarios.forEach((scenario, index) => {
    if (!scenario.review?.length) return;
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = scenario.name;
    button.onclick = () => { scenarioIndex = index; stepIndex = 0; render(); };
    const detail = document.createElement('p');
    detail.textContent = scenario.review.join(' ');
    item.append(button, detail);
    $('reviews').append(item);
  });
  if (!$('reviews').children.length) {
    const item = document.createElement('li');
    item.textContent = 'All scenarios reviewed.';
    $('reviews').append(item);
  }
  $('reviewed').disabled = !current().review?.length;
  renderGraph();
}

function renderRouteControls() {
  const index = $('route').selectedIndex;
  $('move-up').disabled = index <= 0;
  $('move-down').disabled = index < 0 || index >= current().steps.length - 1;
  $('branch').disabled = index < 0;
  const hasNode = project.nodes.some(node => node.id === selected);
  $('insert-step').disabled = index < 0 || !hasNode;
  $('replace-step').disabled = index < 0 || !hasNode;
}

$('project-title').onchange = event => {
  project.title = event.target.value.trim().slice(0, 80);
  update();
};
$('scenario-description').onchange = event => {
  current().description = event.target.value.trim().slice(0, 2000);
  update();
};
$('node-notes').onchange = event => {
  const node = project.nodes.find(node => node.id === selected);
  if (!node) return;
  const notes = event.target.value.trim().slice(0, 2000);
  if (notes !== (node.notes || '')) flagScenarios(node.id, 'Updated notes for “' + node.label + '”.');
  node.notes = notes;
  update();
};
$('duplicate-scenario').onclick = () => {
  const copy = structuredClone(current());
  const base = copy.name.slice(0, 36) + ' (Copy)';
  copy.name = base;
  let number = 2;
  while (project.scenarios.some(scenario => scenario.name === copy.name)) copy.name = base + ' ' + number++;
  project.scenarios.push(copy);
  scenarioIndex = project.scenarios.length - 1;
  stepIndex = 0;
  update();
  $('status').textContent = 'Scenario duplicated. Its steps can be edited independently.';
};
$('delete-scenario').onclick = () => {
  if (project.scenarios.length <= 1) return;
  pendingDelete = current();
  $('delete-summary').textContent = 'Delete “' + current().name + '”? The diagram nodes will be kept.';
  $('delete-confirm').hidden = false;
};
$('cancel-delete-scenario').onclick = () => { pendingDelete = null; $('delete-confirm').hidden = true; };
$('confirm-delete-scenario').onclick = () => {
  if (pendingDelete !== current() || project.scenarios.length <= 1) return;
  project.scenarios.splice(scenarioIndex, 1);
  scenarioIndex = Math.min(scenarioIndex, project.scenarios.length - 1);
  stepIndex = 0;
  update();
  $('status').textContent = 'Scenario deleted. Use Undo to restore it.';
};
function editSelectedStep(replace) {
  const index = $('route').selectedIndex;
  if (index < 0 || index >= current().steps.length || !project.nodes.some(node => node.id === selected)) return;
  current().steps.splice(index, replace ? 1 : 0, selected);
  stepIndex = index;
  update();
}
$('insert-step').onclick = () => editSelectedStep(false);
$('replace-step').onclick = () => editSelectedStep(true);
$('auto-arrange').onclick = () => {
  const orderedIds = [...new Set([...current().steps, ...project.nodes.map(node => node.id)])];
  const availableColumns = Math.max(1, Math.floor($('nodes').getBoundingClientRect().width / 170));
  const columns = Math.min(4, availableColumns, Math.max(1, Math.ceil(Math.sqrt(orderedIds.length))));
  const rows = Math.ceil(orderedIds.length / columns);
  const byId = new Map(project.nodes.map(node => [node.id, node]));
  orderedIds.forEach((id, index) => {
    const node = byId.get(id);
    node.x = columns === 1 ? 50 : 16 + (index % columns) * 68 / (columns - 1);
    node.y = rows === 1 ? 50 : 24 + Math.floor(index / columns) * 52 / (rows - 1);
  });
  update();
  $('status').textContent = 'Nodes arranged in scenario order. Use Undo to restore their positions.';
};

$('route').onchange = renderRouteControls;
function moveStep(direction) {
  const index = $('route').selectedIndex;
  const target = index + direction;
  const steps = current().steps;
  if (index < 0 || target < 0 || target >= steps.length) return;
  [steps[index], steps[target]] = [steps[target], steps[index]];
  stepIndex = target;
  $('route').selectedIndex = target;
  update();
}
$('move-up').onclick = () => moveStep(-1);
$('move-down').onclick = () => moveStep(1);
$('branch').onclick = () => {
  const index = $('route').selectedIndex;
  if (index < 0 || index >= current().steps.length) return;
  const name = $('branch-name').value.trim();
  if (!name) { $('branch-name').focus(); return; }
  const steps = current().steps.slice(0, index + 1);
  const review = current().review?.slice();
  project.scenarios.push({ name, steps, ...(review?.length ? { review } : {}) });
  scenarioIndex = project.scenarios.length - 1;
  stepIndex = steps.length - 1;
  $('branch-name').value = '';
  update();
  $('status').textContent = 'Alternate scenario created. Select a node and append it to continue this path.';
};

function update() {
  stepIndex = Math.max(0, Math.min(stepIndex, current().steps.length - 1));
  commitHistory();
  save();
  render();
}

$('scenario').onchange = event => {
  scenarioIndex = event.target.selectedIndex;
  stepIndex = 0;
  render();
};
$('prev').onclick = () => { stepIndex = Math.max(0, stepIndex - 1); render(); };
$('next').onclick = () => { stepIndex = Math.max(0, Math.min(current().steps.length - 1, stepIndex + 1)); render(); };
$('restart').onclick = () => { stepIndex = 0; render(); };
$('rename-scenario').onclick = () => {
  const name = $('scenario-name').value.trim();
  if (!name) { $('scenario-name').focus(); return; }
  current().name = name;
  update();
  $('status').textContent = 'Scenario renamed.';
};

document.addEventListener('keydown', event => {
  if (event.target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
  const key = event.key.toLowerCase();
  if (!shared && (event.ctrlKey || event.metaKey) && !event.altKey) {
    if (key === 'z') { event.preventDefault(); restoreHistory(event.shiftKey ? 1 : -1); }
    else if (key === 'y') { event.preventDefault(); restoreHistory(1); }
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); $('prev').onclick(); }
  if (event.key === 'ArrowRight') { event.preventDefault(); $('next').onclick(); }
  if (event.key === 'Home') { event.preventDefault(); $('restart').onclick(); }
});
$('label').onchange = event => {
  const node = project.nodes.find(item => item.id === selected);
  if (!node) return;
  const label = event.target.value.trim() || node.label;
  if (label !== node.label) flagScenarios(node.id, 'Renamed “' + node.label + '” to “' + label + '”.');
  node.label = label;
  update();
};
$('add').onclick = () => {
  selected = Date.now().toString(36) + Math.random().toString(36).slice(2);
  project.nodes.push({ id: selected, label: 'New node', x: 50, y: 76 });
  update();
  $('label').select();
};
$('remove').onclick = () => {
  const node = project.nodes.find(node => node.id === selected);
  if (node) flagScenarios(selected, 'Deleted “' + node.label + '”; its steps were removed.');
  project.nodes = project.nodes.filter(node => node.id !== selected);
  for (const scenario of project.scenarios) scenario.steps = scenario.steps.filter(id => id !== selected);
  selected = project.nodes[0]?.id;
  update();
};
$('append').onclick = () => { current().steps.push(selected); update(); };
$('drop').onclick = () => { current().steps.splice($('route').selectedIndex, 1); update(); };
$('create').onclick = () => {
  const name = $('name').value.trim();
  if (!name) { $('name').focus(); return; }
  project.scenarios.push({ name, steps: [] });
  scenarioIndex = project.scenarios.length - 1;
  stepIndex = 0;
  $('name').value = '';
  update();
};
$('share').onclick = async () => {
  const link = new URL(location.href);
  link.searchParams.delete('remix');
  const snapshot = { ...(project.title !== undefined ? { title: project.title } : {}), nodes: project.nodes,
    scenarios: project.scenarios.map(({ name, steps, description }) => ({ name, steps, ...(description !== undefined ? { description } : {}) })) };
  link.hash = encodeURIComponent(JSON.stringify(snapshot));
  try {
    await navigator.clipboard.writeText(link.href);
    $('status').textContent = 'Playback link copied.';
  } catch {
    window.prompt('Copy this playback link', link.href);
  }
};
new ResizeObserver(renderGraph).observe($('nodes'));
render();
