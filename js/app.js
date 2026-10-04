/**
 * Sri Harshitha Constructions Log Report - Application Controller
 * Live Two-Way Cloud Sync with Google Apps Script, Fault-Tolerant Search & Smooth Redirection
 */

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwRw42iwcsYINjZhcxutFKWB1CcPZELYyc9QZyZ_cNsj7nt9FEBDDxD_qGPfVJ-Rbpu/exec";
const STORAGE_KEY = 'shc_prod_clean_db_v3';

// Clean State Initialized Empty
let state = {
  todos: [],
  flats: [],
  payments: [],
  labour: [],
  materials: [],
  expenses: [],
  snags: []
};

let currentTab = 'todos';
let todoFilter = 'all';
let currentSearchTerm = '';
let currentChoicesList = [];

// ==========================================
// 1. INITIALIZATION & CLEAN ENGINE
// ==========================================

function initApp() {
  initTheme();
  initClock();
  loadLocalState();
  initSearch();
  initDateDefaults();
  initModalEnterKeyBindings();
  renderAll();

  // Cloud sync
  fetchMasterFromGoogleSheets();

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('dataActionsMenu');
    const btn = document.getElementById('dataActionsBtn');
    if (menu && !menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.add('hidden');
    }

    const debitMenu = document.getElementById('debitQuickMenu');
    const debitBtn = document.getElementById('debitQuickBtn');
    if (debitMenu && !debitMenu.contains(e.target) && (!debitBtn || !debitBtn.contains(e.target))) {
      debitMenu.classList.add('hidden');
    }

    const recBox = document.getElementById('searchRecommendationsBox');
    const searchInput = document.getElementById('globalSearchInput');
    if (recBox && !recBox.contains(e.target) && !searchInput.contains(e.target)) {
      recBox.classList.add('hidden');
    }
  });

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const input = document.getElementById('globalSearchInput');
      input.focus();
      input.select();
    }
  });
}

function loadLocalState() {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      state = JSON.parse(cached);
      if (!state.todos) state.todos = [];
      if (!state.flats) state.flats = [];
      if (!state.payments) state.payments = [];
      if (!state.labour) state.labour = [];
      if (!state.materials) state.materials = [];
      if (!state.expenses) state.expenses = [];
      if (!state.snags) state.snags = [];
      return;
    } catch (err) {
      console.warn("Cleared corrupt local cache, starting fresh", err);
    }
  }

  state = {
    todos: [],
    flats: [],
    payments: [],
    labour: [],
    materials: [],
    expenses: [],
    snags: []
  };
  saveState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ==========================================
// 2. GOOGLE SHEETS LIVE SYNC
// ==========================================

async function fetchMasterFromGoogleSheets() {
  updateSyncStatus("Syncing...", "amber");
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    const data = await res.json();

    if (data.flats && data.flats.length) {
      state.flats = data.flats.map(f => ({
        ...f,
        choices: typeof f.choices === 'string' ? f.choices.split(',').map(s => s.trim()).filter(Boolean) : (f.choices || [])
      }));
    }
    if (data.payments && data.payments.length) state.payments = data.payments;
    if (data.siteLogs && data.siteLogs.length) {
      state.labour = data.siteLogs.filter(s => s.category === 'Labour').map(s => ({
        id: s.id,
        date: s.date,
        person: s.item_or_role || s.person || '',
        purpose: s.remarks || '',
        amount: Number(s.total || s.amount) || 0,
        remarks: s.remarks || ''
      }));
      state.materials = data.siteLogs.filter(s => s.category === 'Material').map(s => ({
        id: s.id,
        date: s.date,
        name: s.item_or_role || s.name || '',
        quantity: s.quantity || s.qty || s.unit || '1 Unit',
        supplier: s.vendor_or_worker || s.supplier || '',
        purpose: s.remarks || '',
        amount: Number(s.total || s.amount) || 0,
        remarks: s.remarks || ''
      }));
      state.expenses = data.siteLogs.filter(s => s.category === 'Expense' || s.category === 'Other Expenses').map(s => ({
        id: s.id,
        date: s.date,
        name: s.item_or_role || s.name || '',
        amount: Number(s.total || s.amount) || 0,
        purpose: s.remarks || ''
      }));
    }
    if (data.tasks && data.tasks.length) state.snags = data.tasks;

    saveState();
    renderAll();
    updateSyncStatus("LIVE", "emerald");
  } catch (err) {
    console.warn("Offline fallback ready:", err);
    updateSyncStatus("OFFLINE", "slate");
  }
}

function pushRowToSheet(sheetName, rowArray) {
  if (!GOOGLE_SCRIPT_URL) return;
  fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheetName: sheetName, row: rowArray })
  }).catch(e => console.error("Sheet push error:", e));
}

function updateSyncStatus(text, color) {
  const pill = document.getElementById('syncPill');
  const txt = document.getElementById('syncText');
  if (!pill || !txt) return;

  txt.innerText = text;
  pill.className = `hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
    color === 'emerald' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
    color === 'amber' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
    'bg-slate-800 text-slate-400 border border-slate-700'
  }`;
}

// ==========================================
// 3. TOAST & INTERACTION HELPERS
// ==========================================

let toastTimer = null;
function showToast(message = "Successfully added!") {
  const toast = document.getElementById('toastNotification');
  const toastMsg = document.getElementById('toastMessage');
  if (!toast || !toastMsg) return;

  if (toastTimer) clearTimeout(toastTimer);

  toastMsg.innerText = message;
  toast.classList.remove('translate-y-10', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100');

  toastTimer = setTimeout(() => {
    toast.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, 2200);
}

function toggleDebitQuickMenu() {
  const menu = document.getElementById('debitQuickMenu');
  if (menu) menu.classList.toggle('hidden');
}

// ==========================================
// 4. ENTER-TO-SAVE INTERCEPTORS
// ==========================================

function initModalEnterKeyBindings() {
  const choiceInput = document.getElementById('newChoiceInput');
  if (choiceInput) {
    choiceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        addChoiceTagFromInput();
      }
    });
  }

  const flatHistory = document.getElementById('flatHistory');
  if (flatHistory) {
    flatHistory.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const form = flatHistory.closest('form');
        if (form) form.requestSubmit();
      }
    });
  }
}

// ==========================================
// 5. UI RENDERING & NUMBERS
// ==========================================

function renderAll() {
  renderKPIs();
  renderTodos();
  renderFlats();
  renderPayments();
  renderLabour();
  renderMaterials();
  renderExpenses();
  renderSnags();
  updateBadgeCounts();
  renderSparkline();
}

function renderKPIs() {
  const totalCredits = state.payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const totalLabour = state.labour.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
  const totalMaterials = state.materials.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
  const totalExpenses = (state.expenses || []).reduce((acc, x) => acc + (Number(x.amount) || 0), 0);
  
  const totalDebits = totalLabour + totalMaterials + totalExpenses;
  const netBalance = totalCredits - totalDebits;
  const pendingTodos = state.todos.filter(t => !t.completed).length;

  document.getElementById('statInflow').innerText = `₹ ${totalCredits.toLocaleString('en-IN')}`;
  document.getElementById('statOutflow').innerText = `₹ ${totalDebits.toLocaleString('en-IN')}`;

  const balEl = document.getElementById('statBalance');
  const badgeEl = document.getElementById('statBalanceBadge');
  balEl.innerText = `${netBalance < 0 ? '-₹ ' : '₹ '}${Math.abs(netBalance).toLocaleString('en-IN')}`;

  if (netBalance > 0) {
    balEl.className = 'font-display text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight font-mono';
    badgeEl.innerText = 'SURPLUS LIQUIDITY';
    badgeEl.className = 'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
  } else if (netBalance < 0) {
    balEl.className = 'font-display text-2xl sm:text-3xl font-black text-rose-400 tracking-tight font-mono';
    badgeEl.innerText = 'DEFICIT (OVERDRAWN)';
    badgeEl.className = 'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30';
  } else {
    balEl.className = 'font-display text-2xl sm:text-3xl font-black text-white tracking-tight font-mono';
    badgeEl.innerText = 'NET BALANCED';
    badgeEl.className = 'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
  }

  document.getElementById('statPendingTodos').innerText = pendingTodos;
  document.getElementById('statTotalFlats').innerText = state.flats.length;

  const openSnags = state.snags.filter(s => s.status !== 'Completed').length;
  document.getElementById('statOpenSnagsCount').innerText = `${openSnags} pending snags`;

  const pendingList = state.todos.filter(t => !t.completed);
  const snippetEl = document.getElementById('statRecentTodoSnippet');
  if (snippetEl) {
    snippetEl.innerText = pendingList.length ? pendingList[0].text : 'All tasks cleared';
  }
}

function updateBadgeCounts() {
  document.getElementById('badge-todos').innerText = state.todos.filter(t => !t.completed).length;
  document.getElementById('badge-flats').innerText = state.flats.length;
  document.getElementById('badge-payments').innerText = state.payments.length;
  document.getElementById('badge-labour').innerText = state.labour.length;
  document.getElementById('badge-materials').innerText = state.materials.length;
  document.getElementById('badge-expenses').innerText = (state.expenses || []).length;
  document.getElementById('badge-snags').innerText = state.snags.filter(s => s.status !== 'Completed').length;
}

// ------------------------------------------
// DYNAMIC SPARKLINE VISUAL & EMPTY STATE
// ------------------------------------------

function renderSparkline() {
  const svg = document.getElementById('sparklineSvg');
  const emptyState = document.getElementById('chartEmptyState');
  const loadingState = document.getElementById('chartLoadingState');

  if (loadingState) loadingState.classList.add('hidden');

  let transactions = [
    ...state.payments.map(p => ({ date: p.date, val: Number(p.amount) || 0, type: 'credit' })),
    ...state.labour.map(l => ({ date: l.date, val: -(Number(l.amount) || 0), type: 'debit' })),
    ...state.materials.map(m => ({ date: m.date, val: -(Number(m.amount) || 0), type: 'debit' })),
    ...(state.expenses || []).map(x => ({ date: x.date, val: -(Number(x.amount) || 0), type: 'debit' }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  if (transactions.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    if (svg) svg.innerHTML = '';
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  let balance = 0;
  let points = [{ x: 0, y: 0 }];
  transactions.forEach((t, i) => {
    balance += t.val;
    points.push({ x: i + 1, y: balance });
  });

  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  const rangeY = (maxY - minY) || 1;
  const width = svg.clientWidth || 300;
  const height = svg.clientHeight || 90;

  const coords = points.map((p, idx) => {
    const x = (idx / (points.length - 1)) * (width - 16) + 8;
    const y = height - 12 - (((p.y - minY) / rangeY) * (height - 28));
    return `${x},${y}`;
  });

  const pathD = `M ${coords.join(' L ')}`;
  const areaD = `M ${coords[0]} L ${coords.join(' L ')} L ${width - 8},${height} L 8,${height} Z`;

  svg.innerHTML = `
    <defs>
      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.38"/>
        <stop offset="100%" stop-color="#F59E0B" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaD}" fill="url(#areaGradient)" />
    <path d="${pathD}" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
  `;
}

// Safe string helper to prevent undefined / number toLowerCase exceptions
function safeStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).toLowerCase();
}

// ------------------------------------------
// TAB: TO-DO CHECKLIST
// ------------------------------------------

function renderTodos() {
  const container = document.getElementById('todoItemsContainer');
  let list = state.todos;

  if (todoFilter === 'pending') list = list.filter(t => !t.completed);
  if (todoFilter === 'completed') list = list.filter(t => t.completed);

  if (currentSearchTerm) {
    const q = currentSearchTerm.toLowerCase();
    list = list.filter(t => safeStr(t.text).includes(q));
  }

  if (list.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-500 text-xs">No active checklist items. Add one above!</div>`;
    return;
  }

  container.innerHTML = list.map(t => `
    <div id="item-todo-${t.id}" class="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition">
      <div class="flex items-center gap-3 flex-grow">
        <input 
          type="checkbox" 
          ${t.completed ? 'checked' : ''} 
          onchange="toggleTodoItem(${t.id})" 
          class="h-4 w-4 rounded text-amber-500 focus:ring-amber-400 border-slate-700 cursor-pointer"
        >
        <span class="text-xs font-medium ${t.completed ? 'line-through text-slate-500' : 'text-slate-200'}">
          ${t.text}
        </span>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
          t.priority === 'High' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
          t.priority === 'Medium' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
          'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
        }">${t.priority}</span>
        <button type="button" onclick="deleteTodoItem(${t.id})" class="text-slate-500 hover:text-rose-400 text-xs px-1">✕</button>
      </div>
    </div>
  `).join('');
}

function handleQuickTodoSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('quickTodoText');
  const prio = document.getElementById('quickTodoPriority').value;
  if (!input.value.trim()) return;

  const newTodo = {
    id: Date.now(),
    text: input.value.trim(),
    priority: prio,
    completed: false,
    created_at: new Date().toISOString().slice(0, 10)
  };

  state.todos.unshift(newTodo);
  saveState();
  renderTodos();
  renderKPIs();
  updateBadgeCounts();

  pushRowToSheet("Tasks", [newTodo.id, newTodo.text, "Supervisor", newTodo.priority, newTodo.created_at, "Pending"]);
  input.value = '';
  showToast("Task successfully added!");
}

function toggleTodoItem(id) {
  const t = state.todos.find(item => item.id === id);
  if (t) {
    t.completed = !t.completed;
    saveState();
    renderTodos();
    renderKPIs();
    updateBadgeCounts();
  }
}

function deleteTodoItem(id) {
  state.todos = state.todos.filter(item => item.id !== id);
  saveState();
  renderTodos();
  renderKPIs();
  updateBadgeCounts();
}

function setTodoFilter(mode) {
  todoFilter = mode;
  ['All', 'Pending', 'Completed'].forEach(m => {
    const btn = document.getElementById(`todoFilter${m}`);
    if (m.toLowerCase() === mode) {
      btn.className = "px-2.5 py-1 rounded bg-slate-800 text-white font-bold";
    } else {
      btn.className = "px-2.5 py-1 rounded text-slate-400 hover:text-white";
    }
  });
  renderTodos();
}

// ------------------------------------------
// TAB: UNIT DIRECTORY
// ------------------------------------------

function renderFlats() {
  const grid = document.getElementById('flatsGrid');
  let list = state.flats;

  if (currentSearchTerm) {
    const q = currentSearchTerm.toLowerCase();
    list = list.filter(f => 
      safeStr(f.unit_no).includes(q) ||
      safeStr(f.owner_name).includes(q) ||
      (f.choices && f.choices.some(c => safeStr(c).includes(q)))
    );
  }

  if (list.length === 0) {
    grid.innerHTML = `<div class="col-span-3 p-8 text-center text-slate-500 text-xs">No registered flats yet. Click '+ Register Unit' to add one.</div>`;
    return;
  }

  grid.innerHTML = list.map(f => `
    <div id="item-flat-${f.id}" class="bg-[#0c1426] border border-slate-800 rounded-card p-4 shadow-sm relative">
      <div class="flex justify-between items-start mb-2">
        <div>
          <span class="text-xs font-black font-display text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-lg border border-amber-500/25">${f.unit_no}</span>
          <h3 class="text-sm font-bold font-display text-white mt-1.5">${f.owner_name}</h3>
          <p class="text-[11px] text-slate-400">${f.contact || 'No phone recorded'}</p>
        </div>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">${f.status || 'Active'}</span>
      </div>

      <div class="mt-3">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Custom Specs:</span>
        <div class="flex flex-wrap gap-1">
          ${(f.choices && f.choices.length > 0) ? f.choices.map(c => `
            <span class="text-[11px] font-medium bg-slate-900 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-lg flex items-center gap-1">
              <span class="text-amber-500">•</span> ${c}
            </span>
          `).join('') : '<span class="text-[11px] text-slate-500 italic">Standard builder specifications</span>'}
        </div>
      </div>

      <div class="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
        ${f.history || 'No milestones logged'}
      </div>

      <div class="no-print mt-3 flex justify-end gap-2.5">
        <button type="button" onclick="editFlat(${f.id})" class="text-slate-400 hover:text-amber-400 text-xs font-semibold">Edit</button>
        <button type="button" onclick="deleteFlat(${f.id})" class="text-slate-500 hover:text-rose-400 text-xs font-semibold">Delete</button>
      </div>
    </div>
  `).join('');
}

function handleFlatSubmit(e) {
  e.preventDefault();
  const idField = document.getElementById('editFlatId').value;
  const isEdit = Boolean(idField);
  const flat = {
    id: idField ? Number(idField) : Date.now(),
    unit_no: document.getElementById('flatUnitNo').value || 'Unassigned',
    owner_name: document.getElementById('flatOwner').value || 'General Allottee',
    contact: document.getElementById('flatContact').value || '',
    status: document.getElementById('flatStatus').value,
    choices: [...currentChoicesList],
    history: document.getElementById('flatHistory').value || ''
  };

  if (isEdit) {
    const idx = state.flats.findIndex(f => f.id === Number(idField));
    if (idx !== -1) state.flats[idx] = flat;
  } else {
    state.flats.unshift(flat);
  }

  saveState();
  closeModal('flatModal');
  renderFlats();
  updateBadgeCounts();

  pushRowToSheet("Flats", [flat.id, flat.unit_no, flat.owner_name, flat.contact, flat.choices.join(', '), flat.history]);
  showToast(isEdit ? "Unit successfully updated!" : "Unit successfully added!");
}

function editFlat(id) {
  const f = state.flats.find(item => item.id === id);
  if (!f) return;

  document.getElementById('editFlatId').value = f.id;
  document.getElementById('flatUnitNo').value = f.unit_no;
  document.getElementById('flatOwner').value = f.owner_name;
  document.getElementById('flatContact').value = f.contact || '';
  document.getElementById('flatStatus').value = f.status || 'Interior Fit-Out Phase';
  document.getElementById('flatHistory').value = f.history || '';

  currentChoicesList = Array.isArray(f.choices) ? [...f.choices] : [];
  renderChoiceTags();
  document.getElementById('flatModalTitle').innerText = `Edit Unit ${f.unit_no}`;
  openModal('flatModal');
}

function deleteFlat(id) {
  if (confirm("Delete this unit record?")) {
    state.flats = state.flats.filter(f => f.id !== id);
    saveState();
    renderFlats();
    updateBadgeCounts();
  }
}

function renderChoiceTags() {
  const container = document.getElementById('choiceTagsList');
  if (currentChoicesList.length === 0) {
    container.innerHTML = '<span class="text-slate-500 italic text-[11px]">No specific bullet choices added.</span>';
    return;
  }
  container.innerHTML = currentChoicesList.map((tag, idx) => `
    <span class="inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-md text-[11px] font-medium">
      ${tag}
      <button type="button" onclick="removeChoiceTag(${idx})" class="hover:text-rose-400 text-xs">✕</button>
    </span>
  `).join('');
}

function addChoiceTagFromInput() {
  const input = document.getElementById('newChoiceInput');
  const val = input.value.trim();
  if (val && !currentChoicesList.includes(val)) {
    currentChoicesList.push(val);
    renderChoiceTags();
    input.value = '';
  }
}

function addChoicePreset(name) {
  if (!currentChoicesList.includes(name)) {
    currentChoicesList.push(name);
    renderChoiceTags();
  }
}

function removeChoiceTag(idx) {
  currentChoicesList.splice(idx, 1);
  renderChoiceTags();
}

// ------------------------------------------
// TAB: FINANCIAL PAYMENTS LEDGER
// ------------------------------------------

function renderPayments() {
  const tbody = document.getElementById('paymentsTableBody');
  let list = state.payments;

  if (currentSearchTerm) {
    const q = currentSearchTerm.toLowerCase();
    list = list.filter(p => 
      safeStr(p.voucher_id).includes(q) ||
      safeStr(p.entity).includes(q) ||
      safeStr(p.remarks).includes(q) ||
      safeStr(p.amount).includes(q)
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-500 text-xs">No vouchers logged yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => `
    <tr id="item-payment-${p.id}" class="hover:bg-slate-800/40 transition">
      <td class="p-3 text-slate-400 font-mono">${p.date}</td>
      <td class="p-3 font-bold font-mono text-amber-400">${p.voucher_id}</td>
      <td class="p-3 font-semibold text-white">${p.entity}</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-semibold text-slate-300">${p.category}</span></td>
      <td class="p-3 text-slate-400">${p.payment_mode}</td>
      <td class="p-3 font-bold font-mono text-emerald-400">₹ ${Number(p.amount).toLocaleString('en-IN')}</td>
      <td class="p-3 text-slate-400 max-w-xs truncate">${p.remarks || '-'}</td>
      <td class="p-3 text-right no-print">
        <button type="button" onclick="editPayment(${p.id})" class="text-slate-400 hover:text-amber-400 mr-2">Edit</button>
        <button type="button" onclick="deletePayment(${p.id})" class="text-slate-500 hover:text-rose-400">Delete</button>
      </td>
    </tr>
  `).join('');
}

function handlePaymentSubmit(e) {
  e.preventDefault();
  const idField = document.getElementById('editPaymentId').value;
  const isEdit = Boolean(idField);
  const payment = {
    id: idField ? Number(idField) : Date.now(),
    date: document.getElementById('payDate').value || new Date().toISOString().slice(0, 10),
    voucher_id: document.getElementById('payVoucher').value || `SHC-PAY-${Math.floor(1000 + Math.random() * 9000)}`,
    entity: document.getElementById('payEntity').value || 'General Payee',
    amount: Number(document.getElementById('payAmount').value) || 0,
    category: document.getElementById('payCategory').value,
    payment_mode: document.getElementById('payMode').value,
    remarks: document.getElementById('payRemarks').value || ''
  };

  if (isEdit) {
    const idx = state.payments.findIndex(p => p.id === Number(idField));
    if (idx !== -1) state.payments[idx] = payment;
  } else {
    state.payments.unshift(payment);
  }

  saveState();
  closeModal('paymentModal');
  renderPayments();
  renderKPIs();
  updateBadgeCounts();

  pushRowToSheet("Payments", [payment.id, payment.date, payment.voucher_id, 1, payment.amount, payment.category, payment.payment_mode, payment.remarks]);
  showToast(isEdit ? "Voucher successfully updated!" : "Payment voucher successfully added!");
}

function editPayment(id) {
  const p = state.payments.find(item => item.id === id);
  if (!p) return;

  document.getElementById('editPaymentId').value = p.id;
  document.getElementById('payDate').value = p.date;
  document.getElementById('payVoucher').value = p.voucher_id;
  document.getElementById('payEntity').value = p.entity;
  document.getElementById('payAmount').value = p.amount;
  document.getElementById('payCategory').value = p.category;
  document.getElementById('payMode').value = p.payment_mode;
  document.getElementById('payRemarks').value = p.remarks || '';

  document.getElementById('paymentModalTitle').innerText = `Edit Voucher ${p.voucher_id}`;
  openModal('paymentModal');
}

function deletePayment(id) {
  if (confirm("Delete this payment voucher?")) {
    state.payments = state.payments.filter(p => p.id !== id);
    saveState();
    renderPayments();
    renderKPIs();
    updateBadgeCounts();
  }
}

// ------------------------------------------
// TAB: DAILY LABOUR LOG
// ------------------------------------------

function renderLabour() {
  const tbody = document.getElementById('labourTableBody');
  let list = state.labour;

  if (currentSearchTerm) {
    const q = currentSearchTerm.toLowerCase();
    list = list.filter(l => 
      safeStr(l.person).includes(q) ||
      safeStr(l.purpose).includes(q) ||
      safeStr(l.remarks).includes(q) ||
      safeStr(l.amount).includes(q)
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500 text-xs">No daily labour entries match.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(l => `
    <tr id="item-labour-${l.id}" class="hover:bg-slate-800/40 transition">
      <td class="p-3 text-slate-400 font-mono">${l.date}</td>
      <td class="p-3 font-bold text-white">${l.person}</td>
      <td class="p-3 text-slate-300">${l.purpose}</td>
      <td class="p-3 font-bold font-mono text-rose-400">₹ ${Number(l.amount).toLocaleString('en-IN')}</td>
      <td class="p-3 text-slate-400">${l.remarks || '-'}</td>
      <td class="p-3 text-right no-print">
        <button type="button" onclick="editLabour(${l.id})" class="text-slate-400 hover:text-amber-400 mr-2">Edit</button>
        <button type="button" onclick="deleteLabour(${l.id})" class="text-slate-500 hover:text-rose-400">Delete</button>
      </td>
    </tr>
  `).join('');
}

function handleLabourSubmit(e) {
  e.preventDefault();
  const idField = document.getElementById('editLabourId').value;
  const isEdit = Boolean(idField);
  const record = {
    id: idField ? Number(idField) : Date.now(),
    date: document.getElementById('labourDate').value || new Date().toISOString().slice(0, 10),
    person: document.getElementById('labourPerson').value || 'Site Labour Crew',
    purpose: document.getElementById('labourPurpose').value || 'Civil site works',
    amount: Number(document.getElementById('labourAmount').value) || 0,
    remarks: document.getElementById('labourRemarks').value || ''
  };

  if (isEdit) {
    const idx = state.labour.findIndex(l => l.id === Number(idField));
    if (idx !== -1) state.labour[idx] = record;
  } else {
    state.labour.unshift(record);
  }

  saveState();
  closeModal('labourModal');
  renderLabour();
  renderKPIs();
  updateBadgeCounts();

  pushRowToSheet("Daily_Site_Logs", [record.id, record.date, "Labour", record.person, 1, record.amount, record.amount, record.person, record.purpose]);
  showToast(isEdit ? "Labour entry successfully updated!" : "Labour entry successfully added!");
}

function editLabour(id) {
  const l = state.labour.find(item => item.id === id);
  if (!l) return;

  document.getElementById('editLabourId').value = l.id;
  document.getElementById('labourDate').value = l.date;
  document.getElementById('labourPerson').value = l.person;
  document.getElementById('labourPurpose').value = l.purpose;
  document.getElementById('labourAmount').value = l.amount;
  document.getElementById('labourRemarks').value = l.remarks || '';

  document.getElementById('labourModalTitle').innerText = `Edit Labour Entry`;
  openModal('labourModal');
}

function deleteLabour(id) {
  if (confirm("Delete this labour record?")) {
    state.labour = state.labour.filter(l => l.id !== id);
    saveState();
    renderLabour();
    renderKPIs();
    updateBadgeCounts();
  }
}

// ------------------------------------------
// TAB: DAILY MATERIALS LOG (WITH QUANTITY)
// ------------------------------------------

function renderMaterials() {
  const tbody = document.getElementById('materialsTableBody');
  let list = state.materials;

  if (currentSearchTerm) {
    const q = currentSearchTerm.toLowerCase();
    list = list.filter(m => 
      safeStr(m.name).includes(q) ||
      safeStr(m.quantity).includes(q) ||
      safeStr(m.supplier).includes(q) ||
      safeStr(m.purpose).includes(q) ||
      safeStr(m.remarks).includes(q) ||
      safeStr(m.amount).includes(q)
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-500 text-xs">No daily material invoices logged yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(m => `
    <tr id="item-material-${m.id}" class="hover:bg-slate-800/40 transition">
      <td class="p-3 text-slate-400 font-mono">${m.date}</td>
      <td class="p-3 font-bold text-white">${m.name}</td>
      <td class="p-3 font-bold font-mono text-amber-400">${m.quantity || '-'}</td>
      <td class="p-3 text-slate-400">${m.supplier}</td>
      <td class="p-3 text-slate-300">${m.purpose}</td>
      <td class="p-3 font-bold font-mono text-rose-400">₹ ${Number(m.amount).toLocaleString('en-IN')}</td>
      <td class="p-3 text-slate-400">${m.remarks || '-'}</td>
      <td class="p-3 text-right no-print">
        <button type="button" onclick="editMaterial(${m.id})" class="text-slate-400 hover:text-amber-400 mr-2">Edit</button>
        <button type="button" onclick="deleteMaterial(${m.id})" class="text-slate-500 hover:text-rose-400">Delete</button>
      </td>
    </tr>
  `).join('');
}

function handleMaterialsSubmit(e) {
  e.preventDefault();
  const idField = document.getElementById('editMaterialId').value;
  const isEdit = Boolean(idField);
  const record = {
    id: idField ? Number(idField) : Date.now(),
    date: document.getElementById('matDate').value || new Date().toISOString().slice(0, 10),
    name: document.getElementById('matName').value || 'Building Material',
    quantity: document.getElementById('matQuantity').value || '1 Unit',
    supplier: document.getElementById('matSupplier').value || 'Material Supplier',
    purpose: document.getElementById('matPurpose').value || 'Construction work',
    amount: Number(document.getElementById('matAmount').value) || 0,
    remarks: document.getElementById('matRemarks').value || ''
  };

  if (isEdit) {
    const idx = state.materials.findIndex(m => m.id === Number(idField));
    if (idx !== -1) state.materials[idx] = record;
  } else {
    state.materials.unshift(record);
  }

  saveState();
  closeModal('materialsModal');
  renderMaterials();
  renderKPIs();
  updateBadgeCounts();

  pushRowToSheet("Daily_Site_Logs", [record.id, record.date, "Material", record.name, record.quantity, record.amount, record.amount, record.supplier, record.purpose]);
  showToast(isEdit ? "Material record successfully updated!" : "Material record successfully added!");
}

function editMaterial(id) {
  const m = state.materials.find(item => item.id === id);
  if (!m) return;

  document.getElementById('editMaterialId').value = m.id;
  document.getElementById('matDate').value = m.date;
  document.getElementById('matName').value = m.name;
  document.getElementById('matQuantity').value = m.quantity || '';
  document.getElementById('matSupplier').value = m.supplier;
  document.getElementById('matPurpose').value = m.purpose;
  document.getElementById('matAmount').value = m.amount;
  document.getElementById('matRemarks').value = m.remarks || '';

  document.getElementById('materialsModalTitle').innerText = `Edit Material Record`;
  openModal('materialsModal');
}

function deleteMaterial(id) {
  if (confirm("Delete this material record?")) {
    state.materials = state.materials.filter(m => m.id !== id);
    saveState();
    renderMaterials();
    renderKPIs();
    updateBadgeCounts();
  }
}

// ------------------------------------------
// TAB: OTHER SITE EXPENSES
// ------------------------------------------

function renderExpenses() {
  const tbody = document.getElementById('expensesTableBody');
  let list = state.expenses || [];

  if (currentSearchTerm) {
    const q = currentSearchTerm.toLowerCase();
    list = list.filter(x => 
      safeStr(x.name).includes(q) ||
      safeStr(x.purpose).includes(q) ||
      safeStr(x.amount).includes(q)
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500 text-xs">No extra expenses recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(x => `
    <tr id="item-expense-${x.id}" class="hover:bg-slate-800/40 transition">
      <td class="p-3 text-slate-400 font-mono">${x.date}</td>
      <td class="p-3 font-bold text-white">${x.name}</td>
      <td class="p-3 font-bold font-mono text-rose-400">₹ ${Number(x.amount).toLocaleString('en-IN')}</td>
      <td class="p-3 text-slate-300">${x.purpose || '-'}</td>
      <td class="p-3 text-right no-print">
        <button type="button" onclick="editExpense(${x.id})" class="text-slate-400 hover:text-amber-400 mr-2">Edit</button>
        <button type="button" onclick="deleteExpense(${x.id})" class="text-slate-500 hover:text-rose-400">Delete</button>
      </td>
    </tr>
  `).join('');
}

function handleExpenseSubmit(e) {
  e.preventDefault();
  const idField = document.getElementById('editExpenseId').value;
  const isEdit = Boolean(idField);
  const record = {
    id: idField ? Number(idField) : Date.now(),
    date: document.getElementById('expenseDate').value || new Date().toISOString().slice(0, 10),
    name: document.getElementById('expenseName').value || 'Site Miscellaneous',
    amount: Number(document.getElementById('expenseAmount').value) || 0,
    purpose: document.getElementById('expensePurpose').value || 'Site Expense'
  };

  if (!state.expenses) state.expenses = [];

  if (isEdit) {
    const idx = state.expenses.findIndex(x => x.id === Number(idField));
    if (idx !== -1) state.expenses[idx] = record;
  } else {
    state.expenses.unshift(record);
  }

  saveState();
  closeModal('expenseModal');
  renderExpenses();
  renderKPIs();
  updateBadgeCounts();

  pushRowToSheet("Daily_Site_Logs", [record.id, record.date, "Expense", record.name, 1, record.amount, record.amount, record.name, record.purpose]);
  showToast(isEdit ? "Expense entry successfully updated!" : "Expense entry successfully added!");
}

function editExpense(id) {
  const x = (state.expenses || []).find(item => item.id === id);
  if (!x) return;

  document.getElementById('editExpenseId').value = x.id;
  document.getElementById('expenseDate').value = x.date;
  document.getElementById('expenseName').value = x.name;
  document.getElementById('expenseAmount').value = x.amount;
  document.getElementById('expensePurpose').value = x.purpose || '';

  document.getElementById('expenseModalTitle').innerText = `Edit Expense Record`;
  openModal('expenseModal');
}

function deleteExpense(id) {
  if (confirm("Delete this expense entry?")) {
    state.expenses = (state.expenses || []).filter(x => x.id !== id);
    saveState();
    renderExpenses();
    renderKPIs();
    updateBadgeCounts();
  }
}

// ------------------------------------------
// TAB: QUALITY SNAGS & TASKS
// ------------------------------------------

function renderSnags() {
  const container = document.getElementById('snagsContainer');
  let list = state.snags;

  if (currentSearchTerm) {
    const q = currentSearchTerm.toLowerCase();
    list = list.filter(s => 
      safeStr(s.title).includes(q) ||
      safeStr(s.assigned_to).includes(q)
    );
  }

  if (list.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-500 text-xs">No snags flagged. All civil sections certified.</div>`;
    return;
  }

  container.innerHTML = list.map(s => `
    <div id="item-snag-${s.id}" class="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition">
      <div class="flex items-center gap-3">
        <input 
          type="checkbox" 
          ${s.status === 'Completed' ? 'checked' : ''} 
          onchange="toggleSnagStatus(${s.id})" 
          class="h-4 w-4 rounded text-amber-500 focus:ring-amber-400 border-slate-700 cursor-pointer"
        >
        <div>
          <span class="text-xs font-semibold ${s.status === 'Completed' ? 'line-through text-slate-500' : 'text-white'}">
            ${s.title}
          </span>
          <p class="text-[11px] text-slate-400 mt-0.5">Lead: ${s.assigned_to || 'Unassigned'} • Due: ${s.due_date || 'No target date'}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
          s.priority === 'High' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-300'
        }">${s.priority}</span>
        <button type="button" onclick="editSnag(${s.id})" class="text-slate-400 hover:text-amber-400 text-xs px-1">Edit</button>
        <button type="button" onclick="deleteSnag(${s.id})" class="text-slate-500 hover:text-rose-400 text-xs px-1">✕</button>
      </div>
    </div>
  `).join('');
}

function handleSnagSubmit(e) {
  e.preventDefault();
  const idField = document.getElementById('editSnagId').value;
  const isEdit = Boolean(idField);
  const snag = {
    id: idField ? Number(idField) : Date.now(),
    title: document.getElementById('snagTitle').value || 'Quality Snag Inspection',
    assigned_to: document.getElementById('snagAssigned').value || 'Site Lead',
    priority: document.getElementById('snagPriority').value,
    due_date: document.getElementById('snagDueDate').value || new Date().toISOString().slice(0, 10),
    status: 'Pending'
  };

  if (isEdit) {
    const idx = state.snags.findIndex(s => s.id === Number(idField));
    if (idx !== -1) state.snags[idx] = snag;
  } else {
    state.snags.unshift(snag);
  }

  saveState();
  closeModal('snagModal');
  renderSnags();
  updateBadgeCounts();

  pushRowToSheet("Tasks", [snag.id, snag.title, snag.assigned_to, snag.priority, snag.due_date, snag.status]);
  showToast(isEdit ? "Snag successfully updated!" : "Snag successfully added!");
}

function toggleSnagStatus(id) {
  const s = state.snags.find(item => item.id === id);
  if (s) {
    s.status = s.status === 'Completed' ? 'Pending' : 'Completed';
    saveState();
    renderSnags();
    updateBadgeCounts();
  }
}

function editSnag(id) {
  const s = state.snags.find(item => item.id === id);
  if (!s) return;

  document.getElementById('editSnagId').value = s.id;
  document.getElementById('snagTitle').value = s.title;
  document.getElementById('snagAssigned').value = s.assigned_to;
  document.getElementById('snagPriority').value = s.priority;
  document.getElementById('snagDueDate').value = s.due_date;

  document.getElementById('snagModalTitle').innerText = 'Edit Quality Snag';
  openModal('snagModal');
}

function deleteSnag(id) {
  if (confirm("Delete this snag item?")) {
    state.snags = state.snags.filter(s => s.id !== id);
    saveState();
    renderSnags();
    updateBadgeCounts();
  }
}

// ==========================================
// 6. ROBUST PREDICTIVE SEARCH & REDIRECTION
// ==========================================

function initSearch() {
  const input = document.getElementById('globalSearchInput');
  const box = document.getElementById('searchRecommendationsBox');
  if (!input || !box) return;

  input.addEventListener('input', () => {
    const term = input.value.trim();
    currentSearchTerm = term;
    toggleClearButton(Boolean(term));

    if (term.length > 0) {
      showRecommendations(term);
      showFilterBanner(term);
    } else {
      box.classList.add('hidden');
      hideFilterBanner();
    }
    renderAll();
  });

  input.addEventListener('focus', () => {
    const term = input.value.trim();
    if (term.length > 0) {
      showRecommendations(term);
    }
  });

  // Delegated click listener to safely handle search result clicks
  box.addEventListener('click', (e) => {
    const item = e.target.closest('.search-result-row');
    if (item) {
      const tabName = item.getAttribute('data-tab');
      const targetId = item.getAttribute('data-target');
      if (tabName && targetId) {
        redirectToMatch(tabName, targetId);
      }
    }
  });
}

function showRecommendations(query) {
  const box = document.getElementById('searchRecommendationsBox');
  if (!box) return;
  const q = query.toLowerCase();
  let matches = [];

  // 1. Flats search
  (state.flats || []).forEach(f => {
    if (
      safeStr(f.unit_no).includes(q) || 
      safeStr(f.owner_name).includes(q) || 
      safeStr(f.contact).includes(q) || 
      (f.choices && f.choices.some(c => safeStr(c).includes(q)))
    ) {
      matches.push({
        tab: 'flats',
        targetId: `item-flat-${f.id}`,
        title: `Unit ${f.unit_no || ''} - ${f.owner_name || 'Allottee'}`,
        subtitle: f.choices && f.choices.length ? f.choices.join(', ') : 'Standard specs',
        icon: '🏢',
        tag: 'UNIT'
      });
    }
  });

  // 2. Payments search
  (state.payments || []).forEach(p => {
    if (
      safeStr(p.voucher_id).includes(q) || 
      safeStr(p.entity).includes(q) || 
      safeStr(p.remarks).includes(q) || 
      safeStr(p.amount).includes(q)
    ) {
      matches.push({
        tab: 'payments',
        targetId: `item-payment-${p.id}`,
        title: `${p.voucher_id || 'Voucher'}: ${p.entity || ''}`,
        subtitle: `₹ ${Number(p.amount || 0).toLocaleString('en-IN')} • ${p.category || 'Payment'}`,
        icon: '💳',
        tag: 'PAYMENT'
      });
    }
  });

  // 3. Labour search
  (state.labour || []).forEach(l => {
    if (
      safeStr(l.person).includes(q) || 
      safeStr(l.purpose).includes(q) || 
      safeStr(l.remarks).includes(q) || 
      safeStr(l.amount).includes(q)
    ) {
      matches.push({
        tab: 'labour',
        targetId: `item-labour-${l.id}`,
        title: `${l.person || 'Labour'} (Labour Log)`,
        subtitle: `${l.purpose || ''} • ₹ ${Number(l.amount || 0).toLocaleString('en-IN')}`,
        icon: '👷',
        tag: 'LABOUR'
      });
    }
  });

  // 4. Materials search
  (state.materials || []).forEach(m => {
    if (
      safeStr(m.name).includes(q) || 
      safeStr(m.quantity).includes(q) || 
      safeStr(m.supplier).includes(q) || 
      safeStr(m.purpose).includes(q) || 
      safeStr(m.remarks).includes(q) || 
      safeStr(m.amount).includes(q)
    ) {
      matches.push({
        tab: 'materials',
        targetId: `item-material-${m.id}`,
        title: `${m.name || 'Material'} [${m.quantity || '1 Unit'}]`,
        subtitle: `${m.supplier || ''} • ${m.purpose || ''} • ₹ ${Number(m.amount || 0).toLocaleString('en-IN')}`,
        icon: '🧱',
        tag: 'MATERIAL'
      });
    }
  });

  // 5. Other Expenses search
  (state.expenses || []).forEach(x => {
    if (
      safeStr(x.name).includes(q) || 
      safeStr(x.purpose).includes(q) || 
      safeStr(x.amount).includes(q)
    ) {
      matches.push({
        tab: 'expenses',
        targetId: `item-expense-${x.id}`,
        title: `${x.name || 'Expense'} (Site Expense)`,
        subtitle: `${x.purpose || ''} • ₹ ${Number(x.amount || 0).toLocaleString('en-IN')}`,
        icon: '💸',
        tag: 'EXPENSE'
      });
    }
  });

  // 6. To-Do tasks search
  (state.todos || []).forEach(t => {
    if (safeStr(t.text).includes(q)) {
      matches.push({
        tab: 'todos',
        targetId: `item-todo-${t.id}`,
        title: t.text || 'Task',
        subtitle: `Priority: ${t.priority || 'Medium'} • Status: ${t.completed ? 'Done' : 'Active'}`,
        icon: '☑️',
        tag: 'TO-DO'
      });
    }
  });

  if (matches.length === 0) {
    box.innerHTML = `<div class="p-3 text-center text-slate-400 text-xs">No direct records found for "${query}"</div>`;
    box.classList.remove('hidden');
    return;
  }

  box.innerHTML = matches.slice(0, 8).map(m => `
    <div 
      class="search-result-row p-2.5 flex items-center justify-between hover:bg-slate-800 cursor-pointer transition text-xs"
      data-tab="${m.tab}"
      data-target="${m.targetId}"
    >
      <div class="flex items-center gap-2.5 truncate pointer-events-none">
        <span class="text-sm flex-shrink-0">${m.icon}</span>
        <div class="truncate">
          <div class="font-bold text-white truncate">${highlightText(m.title, query)}</div>
          <div class="text-[10px] text-slate-400 truncate">${highlightText(m.subtitle, query)}</div>
        </div>
      </div>
      <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 tracking-wider ml-2 flex-shrink-0 pointer-events-none">${m.tag}</span>
    </div>
  `).join('');

  box.classList.remove('hidden');
}

function redirectToMatch(tabName, targetElementId) {
  // 1. Clear search input and filter so the target record is rendered in the DOM
  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) searchInput.value = '';
  currentSearchTerm = '';
  toggleClearButton(false);
  hideFilterBanner();

  const box = document.getElementById('searchRecommendationsBox');
  if (box) box.classList.add('hidden');

  // 2. Switch tab and re-render so all elements are present
  switchTab(tabName);
  renderAll();

  // 3. Locate target element, scroll to it, and trigger glow highlight
  setTimeout(() => {
    const el = document.getElementById(targetElementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('search-target-highlight');
      setTimeout(() => el.classList.remove('search-target-highlight'), 2200);
    }
  }, 100);
}

function highlightText(text, query) {
  if (!query || !text) return text || '';
  try {
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text).replace(regex, '<mark class="bg-amber-500/30 text-amber-300 font-bold px-0.5 rounded">$1</mark>');
  } catch (e) {
    return text;
  }
}

function clearSearch() {
  const input = document.getElementById('globalSearchInput');
  if (input) input.value = '';
  currentSearchTerm = '';
  toggleClearButton(false);
  const box = document.getElementById('searchRecommendationsBox');
  if (box) box.classList.add('hidden');
  hideFilterBanner();
  renderAll();
}

function toggleClearButton(show) {
  const btn = document.getElementById('clearSearchBtn');
  if (!btn) return;
  if (show) btn.classList.remove('hidden');
  else btn.classList.add('hidden');
}

function showFilterBanner(term) {
  const banner = document.getElementById('activeFilterPill');
  const termEl = document.getElementById('activeFilterTerm');
  if (banner && termEl) {
    banner.classList.remove('hidden');
    termEl.innerText = `"${term}"`;
  }
}

function hideFilterBanner() {
  const banner = document.getElementById('activeFilterPill');
  if (banner) banner.classList.add('hidden');
}

// ==========================================
// 7. TABS & THEME CONTROLLERS
// ==========================================

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.tab-button').forEach(b => {
    b.className = "tab-button flex items-center gap-1.5 px-3.5 py-2 rounded-lg whitespace-nowrap text-slate-400 hover:text-white transition";
  });

  const activeView = document.getElementById(`view-${tab}`);
  const activeBtn = document.getElementById(`tab-${tab}`);
  if (activeView) activeView.classList.remove('hidden');
  if (activeBtn) {
    activeBtn.className = "tab-button flex items-center gap-1.5 px-3.5 py-2 rounded-lg whitespace-nowrap bg-slate-800 text-white shadow-xs font-bold transition";
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.classList.contains('dark');
  if (isDark) {
    html.classList.remove('dark');
    localStorage.setItem('shc_theme', 'light');
    document.getElementById('themeIcon').innerText = '🌙';
  } else {
    html.classList.add('dark');
    localStorage.setItem('shc_theme', 'dark');
    document.getElementById('themeIcon').innerText = '☀️';
  }
}

function initTheme() {
  const saved = localStorage.getItem('shc_theme') || 'dark';
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
    document.getElementById('themeIcon').innerText = '☀️';
  } else {
    document.documentElement.classList.remove('dark');
    document.getElementById('themeIcon').innerText = '🌙';
  }
}

function toggleDataActionsMenu() {
  const menu = document.getElementById('dataActionsMenu');
  menu.classList.toggle('hidden');
}

// ==========================================
// 8. EXCEL AUTOMATION (SHEETJS)
// ==========================================

function downloadSampleTemplate() {
  toggleDataActionsMenu();
  const wb = XLSX.utils.book_new();

  const wsFlats = XLSX.utils.json_to_sheet([
    { unit_no: "601", owner_name: "K. Suresh", contact: "9876543210", status: "Under Construction", choices: "Teak Doors, Italian Marble", history: "Booking completed Oct 2026" }
  ]);
  const wsPayments = XLSX.utils.json_to_sheet([
    { date: "2026-10-04", voucher_id: "SHC-PAY-9901", entity: "K. Suresh (601)", amount: 500000, category: "Booking Advance", payment_mode: "NEFT / RTGS", remarks: "1st milestone advance" }
  ]);
  const wsLabour = XLSX.utils.json_to_sheet([
    { date: "2026-10-04", person: "Anand Masons", purpose: "Brickwork 6th floor", amount: 12500, remarks: "6 masons headcount" }
  ]);
  const wsMaterials = XLSX.utils.json_to_sheet([
    { date: "2026-10-04", name: "Ready Mix Concrete M25", quantity: "14 CuM", supplier: "ACC Concrete", purpose: "Columns pour", amount: 68000, remarks: "Invoice #ACC-101" }
  ]);
  const wsExpenses = XLSX.utils.json_to_sheet([
    { date: "2026-10-04", name: "Generator Diesel", amount: 4500, purpose: "Power backup fuel" }
  ]);

  XLSX.utils.book_append_sheet(wb, wsFlats, "Flats_Directory");
  XLSX.utils.book_append_sheet(wb, wsPayments, "Payments_Ledger");
  XLSX.utils.book_append_sheet(wb, wsLabour, "Daily_Labour");
  XLSX.utils.book_append_sheet(wb, wsMaterials, "Daily_Materials");
  XLSX.utils.book_append_sheet(wb, wsExpenses, "Other_Expenses");

  XLSX.writeFile(wb, "Sri_Harshitha_Constructions_Template.xlsx");
}

function handleExcelUpload(e) {
  toggleDataActionsMenu();
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      let importedCount = 0;

      workbook.SheetNames.forEach(name => {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
        if (!rows.length) return;

        const first = rows[0];
        if (first.voucher_id || (first.amount && first.entity)) {
          rows.forEach(r => {
            state.payments.unshift({
              id: Date.now() + Math.random(),
              date: r.date || new Date().toISOString().slice(0, 10),
              voucher_id: r.voucher_id || `SHC-PAY-${Math.floor(1000 + Math.random() * 9000)}`,
              entity: r.entity || r.payee || 'Imported Payee',
              amount: Number(r.amount) || 0,
              category: r.category || 'General',
              payment_mode: r.payment_mode || 'NEFT / RTGS',
              remarks: r.remarks || 'Monthly Excel Import'
            });
            importedCount++;
          });
        } else if (first.unit_no) {
          rows.forEach(r => {
            state.flats.unshift({
              id: Date.now() + Math.random(),
              unit_no: String(r.unit_no),
              owner_name: r.owner_name || 'Allottee',
              contact: r.contact || '',
              status: r.status || 'Active',
              choices: typeof r.choices === 'string' ? r.choices.split(',').map(s => s.trim()) : [],
              history: r.history || ''
            });
            importedCount++;
          });
        } else if (first.person) {
          rows.forEach(r => {
            state.labour.unshift({
              id: Date.now() + Math.random(),
              date: r.date || new Date().toISOString().slice(0, 10),
              person: r.person || 'Site Labour',
              purpose: r.purpose || 'Site civil works',
              amount: Number(r.amount) || 0,
              remarks: r.remarks || ''
            });
            importedCount++;
          });
        } else if (first.name && first.supplier) {
          rows.forEach(r => {
            state.materials.unshift({
              id: Date.now() + Math.random(),
              date: r.date || new Date().toISOString().slice(0, 10),
              name: r.name,
              quantity: r.quantity || r.qty || '1 Unit',
              supplier: r.supplier,
              purpose: r.purpose || 'Construction',
              amount: Number(r.amount) || 0,
              remarks: r.remarks || ''
            });
            importedCount++;
          });
        } else if (first.name && first.purpose && !first.supplier) {
          if (!state.expenses) state.expenses = [];
          rows.forEach(r => {
            state.expenses.unshift({
              id: Date.now() + Math.random(),
              date: r.date || new Date().toISOString().slice(0, 10),
              name: r.name || 'Expense',
              amount: Number(r.amount) || 0,
              purpose: r.purpose || 'General'
            });
            importedCount++;
          });
        }
      });

      saveState();
      renderAll();
      showToast(`Ingested ${importedCount} records from Excel!`);
    } catch (err) {
      alert("Spreadsheet parse error: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
  e.target.value = '';
}

function exportAuditWorkbook() {
  toggleDataActionsMenu();
  const wb = XLSX.utils.book_new();

  const flatsData = state.flats.map(f => ({ ...f, choices: (f.choices || []).join('; ') }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.todos), "Daily_Todos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatsData), "Units_Directory");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.payments), "Payments_Ledger");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.labour), "Daily_Labour");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.materials), "Daily_Materials");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.expenses || []), "Other_Expenses");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.snags), "Snags_Register");

  XLSX.writeFile(wb, `SHC_Site_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
  showToast("Audit workbook downloaded!");
}

// ==========================================
// 9. MODALS & UTILITIES
// ==========================================

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  const form = document.querySelector(`#${id} form`);
  if (form) form.reset();

  const hiddenEdit = document.querySelector(`#${id} input[type="hidden"]`);
  if (hiddenEdit) hiddenEdit.value = '';

  currentChoicesList = [];
  renderChoiceTags();
}

function initDateDefaults() {
  const today = new Date().toISOString().slice(0, 10);
  ['payDate', 'labourDate', 'matDate', 'expenseDate', 'snagDueDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
  const vEl = document.getElementById('payVoucher');
  if (vEl) vEl.value = `SHC-PAY-${Math.floor(1000 + Math.random() * 9000)}`;
}

function initClock() {
  setInterval(() => {
    const d = new Date();
    const timeStr = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
    const liveEl = document.getElementById('liveClock');
    if (liveEl) liveEl.innerText = `${timeStr} IST`;

    const printTimeEl = document.getElementById('printAuditTimestamp');
    if (printTimeEl) {
      printTimeEl.innerText = `${d.toLocaleDateString('en-IN')} ${timeStr} IST`;
    }
  }, 1000);
}

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', initApp);