import { useState, useEffect, useMemo, useRef } from 'react';

// ---------- persistence ----------

const STORAGE_KEY = 'cafehub_v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load Café Hub data', e);
  }
  return null;
}

function exportDataAsFile(data) {
  const bundle = { exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cafehub-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const ONBOARDED_KEY = 'cafehub_onboarded';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- default data ----------

const DEFAULT_OPENING_TEMPLATE = [
  {
    category: 'Exterior',
    tasks: ['Frontage clean', 'Outdoor furniture arranged', 'Signage placed', 'Exterior lights checked'],
  },
  {
    category: 'Front of house',
    tasks: ['Tables clean', 'Floors checked', 'Music on', 'Lighting correct', 'Menus available', 'Bins empty'],
  },
  {
    category: 'Coffee',
    tasks: ['Machine flushed', 'Grinders checked', 'Espresso dialled in', 'Filter coffee prepared', 'Milk stocked', 'Backup coffee available'],
  },
  {
    category: 'Food',
    tasks: ['Fridge temperatures logged', 'Displays stocked', 'Labels checked', 'Allergens available'],
  },
  {
    category: 'Cash',
    tasks: ['Till float confirmed', 'POS online', 'Card terminal tested'],
  },
];

const DEFAULT_CLOSING_TEMPLATE = [
  {
    category: 'Coffee station',
    tasks: ['Backflush machine', 'Clean group heads', 'Clean steam wands', 'Empty knockbox', 'Clean grinders', 'Hopper coffee stored', 'Filter brewer cleaned'],
  },
  {
    category: 'Front of house',
    tasks: ['Tables cleaned', 'Floors swept/mopped', 'Bins removed', 'Outside furniture secured', 'Toilets checked'],
  },
  {
    category: 'Food',
    tasks: ['Waste logged', 'Food wrapped/stored', 'Fridge temperatures logged', 'Date labels checked'],
  },
  {
    category: 'Security',
    tasks: ['Windows checked', 'Rear doors locked', 'Alarm set', 'Lights off'],
  },
];

const DEFAULT_HACCP_DEVICES = [
  { id: 'fridge1', name: 'Fridge 1', min: 0, max: 5 },
  { id: 'fridge2', name: 'Fridge 2', min: 0, max: 5 },
  { id: 'milkfridge', name: 'Milk fridge', min: 0, max: 5 },
  { id: 'pastrydisplay', name: 'Pastry display', min: 0, max: 5 },
];

const DEFAULT_COFFEE = {
  id: 'house-espresso',
  name: 'House Espresso',
  origin: 'Colombia El Faro',
  detail: 'Castillo · Washed · 1,750m',
  targetDose: 18.5,
  targetYield: 39,
  targetTimeMin: 27,
  targetTimeMax: 30,
};

const TASTE_OPTIONS = ['balanced', 'sour', 'bitter', 'thin', 'dry', 'sweet', 'strong', 'weak', 'other'];

const STOCK_CATEGORIES = ['Coffee', 'Milk', 'Alternative milk', 'Food', 'Bakery', 'Dry goods', 'Packaging', 'Cleaning', 'Retail', 'Other'];
const STOCK_UNITS = ['kg', 'g', 'L', 'ml', 'case', 'carton', 'bag', 'unit', 'sleeve', 'box'];
const WASTE_REASONS = ['Expired', 'Damaged', 'Overproduction', 'Quality', 'Staff error', 'Customer return', 'Spillage', 'Other'];

const STAFF_ROLES = ['Owner', 'Manager', 'Supervisor', 'Barista', 'Kitchen', 'Staff'];

const DEFAULT_SOPS = [
  {
    id: 'sop-espresso-open',
    title: 'Opening the espresso machine',
    category: 'Coffee',
    steps: ['Power on and let heat for 20 minutes', 'Flush all group heads', 'Check steam wand pressure', 'Purge portafilters', 'Dial in first shot before service'],
  },
  {
    id: 'sop-milk-steaming',
    title: 'Milk steaming standard',
    category: 'Coffee',
    steps: ['Cold milk only, fresh pitcher', 'Purge wand before and after', 'Texture to fine microfoam, no large bubbles', 'Target 60–65°C, never above 70°C', 'Wipe wand immediately after use'],
  },
  {
    id: 'sop-complaint',
    title: 'Handling a customer complaint',
    category: 'Front of house',
    steps: ['Listen fully before responding', 'Apologise and offer to remake or refund', 'Involve a manager if the customer remains unhappy', 'Log the incident if it involves food safety'],
  },
];

const DEFAULT_RECIPES = [
  {
    id: 'flat-white',
    name: 'Flat White',
    cupSize: '8oz',
    sellingPrice: 4.1,
    ingredients: [
      { id: uid(), name: 'Coffee', packSize: 1000, packUnit: 'g', packCost: 21, qtyUsed: 18.5, qtyUnit: 'g' },
      { id: uid(), name: 'Milk', packSize: 2000, packUnit: 'ml', packCost: 2.9, qtyUsed: 150, qtyUnit: 'ml' },
      { id: uid(), name: 'Cup', packSize: 1, packUnit: 'unit', packCost: 0.12, qtyUsed: 1, qtyUnit: 'unit' },
      { id: uid(), name: 'Lid', packSize: 1, packUnit: 'unit', packCost: 0.06, qtyUsed: 1, qtyUnit: 'unit' },
    ],
  },
];

const DEFAULT_PRODUCTS = [
  { id: 'oat-milk', name: 'Oat milk', category: 'Alternative milk', supplier: 'Musgrave', unit: 'case', par: 12, current: 4.5, cost: 22.5 },
  { id: 'whole-milk', name: 'Whole milk', category: 'Milk', supplier: 'Musgrave', unit: 'case', par: 8, current: 6, cost: 14 },
  { id: '12oz-cups', name: '12oz cups', category: 'Packaging', supplier: 'Musgrave', unit: 'case', par: 6, current: 1.4, cost: 38 },
  { id: 'lids', name: '12oz lids', category: 'Packaging', supplier: 'Musgrave', unit: 'case', par: 6, current: 5, cost: 22 },
  { id: 'napkins', name: 'Napkins', category: 'Packaging', supplier: 'Musgrave', unit: 'case', par: 4, current: 3, cost: 12 },
];

function defaultState() {
  return {
    cafeName: '',
    remindersEnabled: false,
    tasks: {},
    openingTemplate: DEFAULT_OPENING_TEMPLATE,
    closingTemplate: DEFAULT_CLOSING_TEMPLATE,
    haccpDevices: DEFAULT_HACCP_DEVICES,
    haccpReadings: [],
    coffees: [DEFAULT_COFFEE],
    dialIns: [],
    products: DEFAULT_PRODUCTS,
    waste: [],
    orders: [],
    deliveries: [],
    recipes: DEFAULT_RECIPES,
    filterRecipes: [],
    dailyCloses: [],
    priceAlerts: [],
    incidents: [],
    handoverNotes: [],
    sops: DEFAULT_SOPS,
    staff: [],
  };
}

// ---------- small utils ----------

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function taskId(listType, category, task) {
  return `${listType}::${category}::${task}`;
}

// ---------- SETUP WIZARD (first run only) ----------

function SetupWizard({ cafeName, setCafeName, openingTemplate, updateOpeningTemplate, devices, addHaccpDevice, updateHaccpDevice, removeHaccpDevice, onFinish }) {
  const [step, setStep] = useState(0);
  const steps = ['Welcome', 'Your café', 'Your fridges', 'Your opening checklist', 'Done'];

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-ivory)',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 16,
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 16px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 11, letterSpacing: 1, color: 'var(--copper)', fontWeight: 500, marginBottom: 8 }}>
        SETUP · STEP {step + 1} OF {steps.length}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, marginBottom: 20 }}>{steps[step]}</div>

      {step === 0 && (
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
            Café Hub adapts to how your café actually runs. This takes two minutes — confirm your fridges and your opening
            checklist so they match reality from day one. Everything here can be changed again later in Operations → Settings.
          </p>
        </div>
      )}

      {step === 1 && (
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Café name</div>
          <input value={cafeName} onChange={(e) => setCafeName(e.target.value)} placeholder="e.g. Ranelagh" style={inputStyle} />
        </div>
      )}

      {step === 2 && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
            These came pre-filled as a starting point — rename them, change the temperature ranges, remove what you don't have, or add more.
          </p>
          <HaccpDeviceEditor devices={devices} addHaccpDevice={addHaccpDevice} updateHaccpDevice={updateHaccpDevice} removeHaccpDevice={removeHaccpDevice} />
        </div>
      )}

      {step === 3 && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
            Same idea — edit categories and tasks to match your actual opening routine. Closing works the same way, editable
            later in Operations → Settings.
          </p>
          <ChecklistEditor template={openingTemplate} onChange={updateOpeningTemplate} />
        </div>
      )}

      {step === 4 && (
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
            You're set up. Everything here — checklists, fridges, and everything else in the app — stays editable any time
            from Operations → Settings.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-ivory)', fontSize: 13, padding: '10px 20px', borderRadius: 8 }}
          >
            Back
          </button>
        )}
        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            style={{ background: 'var(--copper)', color: '#3C2E22', border: 'none', fontSize: 13, fontWeight: 500, padding: '10px 24px', borderRadius: 8, marginLeft: 'auto' }}
          >
            Continue →
          </button>
        ) : (
          <button
            onClick={onFinish}
            style={{ background: 'var(--copper)', color: '#3C2E22', border: 'none', fontSize: 13, fontWeight: 500, padding: '10px 24px', borderRadius: 8, marginLeft: 'auto' }}
          >
            Enter Café Hub →
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- app ----------

export default function App() {
  const [data, setData] = useState(() => {
    const merged = { ...defaultState(), ...(loadState() || {}) };
    // Migrate any orders saved before Deliveries existed (old shape had
    // `itemIds` only, no `items`/`status`) so old data can't crash the
    // new Orders/Deliveries screens the way missing fields did before.
    merged.orders = (merged.orders || []).map((o) =>
      o.items
        ? o
        : { ...o, status: o.status || 'ordered', items: (o.itemIds || []).map((id) => ({ productId: id, name: 'Unknown item', unit: '', qtyOrdered: 0 })) }
    );
    return merged;
  });
  const [tab, setTab] = useState('today');
  const [opsSubTab, setOpsSubTab] = useState('opening');
  const [showWizard, setShowWizard] = useState(() => !loadState() && localStorage.getItem(ONBOARDED_KEY) !== 'true');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const dateKey = todayKey();
  const todaysTasks = data.tasks[dateKey] || {};

  function setTaskStatus(listType, category, task, status, note = '') {
    const id = taskId(listType, category, task);
    setData((d) => ({
      ...d,
      tasks: {
        ...d.tasks,
        [dateKey]: {
          ...(d.tasks[dateKey] || {}),
          [id]: { status, note, timestamp: Date.now() },
        },
      },
    }));
  }

  function progressFor(template, listType) {
    const total = template.reduce((sum, cat) => sum + cat.tasks.length, 0);
    const done = template.reduce((sum, cat) => {
      return (
        sum +
        cat.tasks.filter((t) => {
          const s = todaysTasks[taskId(listType, cat.category, t)];
          return s && (s.status === 'complete' || s.status === 'na');
        }).length
      );
    }, 0);
    return { done, total };
  }

  const openingProgress = progressFor(data.openingTemplate, 'opening');
  const closingProgress = progressFor(data.closingTemplate, 'closing');

  function addHaccpReading(deviceId, reading) {
    const device = data.haccpDevices.find((d) => d.id === deviceId);
    const inRange = reading >= device.min && reading <= device.max;
    const entry = {
      id: uid(),
      deviceId,
      reading,
      timestamp: Date.now(),
      status: inRange ? 'pass' : 'fail',
      correctiveAction: null,
    };
    setData((d) => ({ ...d, haccpReadings: [entry, ...d.haccpReadings] }));
    return entry;
  }

  function setCorrectiveAction(readingId, action) {
    setData((d) => ({
      ...d,
      haccpReadings: d.haccpReadings.map((r) => (r.id === readingId ? { ...r, correctiveAction: action } : r)),
    }));
  }

  // ---------- adaptable config ----------

  function updateOpeningTemplate(template) {
    setData((d) => ({ ...d, openingTemplate: template }));
  }

  function updateClosingTemplate(template) {
    setData((d) => ({ ...d, closingTemplate: template }));
  }

  function addHaccpDevice(device) {
    setData((d) => ({ ...d, haccpDevices: [...d.haccpDevices, { id: uid(), min: 0, max: 5, ...device }] }));
  }

  function updateHaccpDevice(id, patch) {
    setData((d) => ({ ...d, haccpDevices: d.haccpDevices.map((dev) => (dev.id === id ? { ...dev, ...patch } : dev)) }));
  }

  function removeHaccpDevice(id) {
    setData((d) => ({ ...d, haccpDevices: d.haccpDevices.filter((dev) => dev.id !== id) }));
  }

  function addDialIn(coffeeId, dose, yield_, time, taste, note) {
    const entry = { id: uid(), coffeeId, dose, yield: yield_, time, taste, note, timestamp: Date.now() };
    setData((d) => ({ ...d, dialIns: [entry, ...d.dialIns] }));
  }

  // ---------- stock ----------

  function addProduct(product) {
    const entry = { id: uid(), current: 0, par: 0, cost: 0, ...product };
    setData((d) => ({ ...d, products: [...d.products, entry] }));
  }

  function updateProduct(id, patch) {
    setData((d) => {
      const existing = d.products.find((p) => p.id === id);
      let priceAlerts = d.priceAlerts;
      if (existing && patch.cost !== undefined && patch.cost !== existing.cost && existing.cost > 0) {
        const pctChange = Math.round(((patch.cost - existing.cost) / existing.cost) * 1000) / 10;
        priceAlerts = [
          { id: uid(), productId: id, productName: existing.name, oldCost: existing.cost, newCost: patch.cost, pctChange, timestamp: Date.now(), dismissed: false },
          ...priceAlerts,
        ];
      }
      return { ...d, products: d.products.map((p) => (p.id === id ? { ...p, ...patch } : p)), priceAlerts };
    });
  }

  function removeProduct(id) {
    setData((d) => ({ ...d, products: d.products.filter((p) => p.id !== id) }));
  }

  function setStockCount(id, current) {
    updateProduct(id, { current, lastCounted: Date.now() });
  }

  function logWaste(productId, qty, reason) {
    const product = data.products.find((p) => p.id === productId);
    const cost = product ? Math.round(qty * (product.cost || 0) * 100) / 100 : 0;
    const entry = { id: uid(), productId, qty, reason, cost, timestamp: Date.now() };
    setData((d) => ({
      ...d,
      waste: [entry, ...d.waste],
      products: d.products.map((p) => (p.id === productId ? { ...p, current: Math.max(0, p.current - qty) } : p)),
    }));
    return entry;
  }

  function markOrdered(supplier, items) {
    const entry = { id: uid(), supplier, items, status: 'ordered', timestamp: Date.now() };
    setData((d) => ({ ...d, orders: [entry, ...d.orders] }));
  }

  function receiveDelivery(orderId, receivedItems, tempC, notes) {
    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return;
    const delivery = {
      id: uid(),
      orderId,
      supplier: order.supplier,
      items: receivedItems,
      tempC: tempC || null,
      notes: notes || '',
      timestamp: Date.now(),
    };
    setData((d) => ({
      ...d,
      deliveries: [delivery, ...d.deliveries],
      orders: d.orders.map((o) => (o.id === orderId ? { ...o, status: 'received' } : o)),
      products: d.products.map((p) => {
        const received = receivedItems.find((r) => r.productId === p.id);
        return received ? { ...p, current: Math.round((p.current + (received.qtyReceived || 0)) * 100) / 100 } : p;
      }),
    }));
  }

  // ---------- money ----------

  function addRecipe(recipe) {
    const entry = { id: uid(), ingredients: [], sellingPrice: 0, ...recipe };
    setData((d) => ({ ...d, recipes: [...d.recipes, entry] }));
  }

  function updateRecipe(id, patch) {
    setData((d) => ({ ...d, recipes: d.recipes.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }

  function removeRecipe(id) {
    setData((d) => ({ ...d, recipes: d.recipes.filter((r) => r.id !== id) }));
  }

  function saveDailyClose(close) {
    const entry = { id: uid(), date: dateKey, timestamp: Date.now(), ...close };
    setData((d) => ({ ...d, dailyCloses: [entry, ...d.dailyCloses.filter((c) => c.date !== dateKey)] }));
  }

  // ---------- team ----------

  function addHandoverNote(author, note) {
    const entry = { id: uid(), author, note, timestamp: Date.now(), acknowledgedBy: null };
    setData((d) => ({ ...d, handoverNotes: [entry, ...d.handoverNotes] }));
  }

  function acknowledgeHandoverNote(id, by) {
    setData((d) => ({ ...d, handoverNotes: d.handoverNotes.map((n) => (n.id === id ? { ...n, acknowledgedBy: by } : n)) }));
  }

  function addSop(sop) {
    const entry = { id: uid(), version: 1, updatedAt: dateKey, ...sop };
    setData((d) => ({ ...d, sops: [...d.sops, entry] }));
  }

  function removeSop(id) {
    setData((d) => ({ ...d, sops: d.sops.filter((s) => s.id !== id) }));
  }

  // ---------- incidents ----------

  function addIncident(incident) {
    const entry = { id: uid(), status: 'open', timestamp: Date.now(), ...incident };
    setData((d) => ({ ...d, incidents: [entry, ...d.incidents] }));
  }

  function updateIncident(id, patch) {
    setData((d) => ({ ...d, incidents: d.incidents.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }

  function removeIncident(id) {
    setData((d) => ({ ...d, incidents: d.incidents.filter((i) => i.id !== id) }));
  }

  // ---------- filter recipes ----------

  function addFilterRecipe(recipe) {
    setData((d) => ({ ...d, filterRecipes: [...d.filterRecipes, { id: uid(), ...recipe }] }));
  }

  function updateFilterRecipe(id, patch) {
    setData((d) => ({ ...d, filterRecipes: d.filterRecipes.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }

  function removeFilterRecipe(id) {
    setData((d) => ({ ...d, filterRecipes: d.filterRecipes.filter((r) => r.id !== id) }));
  }

  // ---------- price alerts ----------

  function dismissPriceAlert(id) {
    setData((d) => ({ ...d, priceAlerts: d.priceAlerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)) }));
  }

  function applyPriceAlertToIngredient(alertId, recipeId, ingredientId, pctChange) {
    setData((d) => ({
      ...d,
      recipes: d.recipes.map((r) =>
        r.id === recipeId
          ? { ...r, ingredients: r.ingredients.map((ing) => (ing.id === ingredientId ? { ...ing, packCost: Math.round(ing.packCost * (1 + pctChange / 100) * 100) / 100 } : ing)) }
          : r
      ),
    }));
  }

  function addStaffMember(member) {
    const entry = { id: uid(), role: 'Staff', ...member };
    setData((d) => ({ ...d, staff: [...d.staff, entry] }));
  }

  function removeStaffMember(id) {
    setData((d) => ({ ...d, staff: d.staff.filter((s) => s.id !== id) }));
  }

  const latestReadings = useMemo(() => {
    const map = {};
    for (const r of data.haccpReadings) {
      const device = data.haccpDevices.find((d) => d.id === r.deviceId);
      if (!device) continue;
      const rDate = new Date(r.timestamp).toISOString().slice(0, 10);
      if (rDate !== dateKey) continue;
      if (!map[r.deviceId] || r.timestamp > map[r.deviceId].timestamp) {
        map[r.deviceId] = r;
      }
    }
    return map;
  }, [data.haccpReadings, data.haccpDevices, dateKey]);

  const openHaccpExceptions = data.haccpReadings.filter((r) => r.status === 'fail' && !r.correctiveAction);

  const latestDialIn = data.dialIns[0];

  const lowStockProducts = data.products.filter((p) => p.par > 0 && p.current / p.par < 0.3);

  const attentionItems = [];
  if (openHaccpExceptions.length > 0) {
    attentionItems.push(`${openHaccpExceptions.length} HACCP reading${openHaccpExceptions.length > 1 ? 's' : ''} outside range, unresolved`);
  }
  const missedOpening = data.openingTemplate.flatMap((cat) => cat.tasks).length - openingProgress.done;
  const now = new Date();
  if (missedOpening > 0 && now.getHours() >= 10) {
    attentionItems.push(`${missedOpening} opening task${missedOpening > 1 ? 's' : ''} still outstanding`);
  }
  lowStockProducts.forEach((p) => attentionItems.push(`${p.name} below par`));
  const unackedHandover = data.handoverNotes.filter((n) => !n.acknowledgedBy);
  if (unackedHandover.length > 0) {
    attentionItems.push(`${unackedHandover.length} handover note${unackedHandover.length > 1 ? 's' : ''} unread`);
  }
  const openIncidents = data.incidents.filter((i) => i.status === 'open');
  if (openIncidents.length > 0) {
    attentionItems.push(`${openIncidents.length} open incident${openIncidents.length > 1 ? 's' : ''}`);
  }

  // ---------- reminders (best-effort, only while this tab is open) ----------
  // There's no backend/push infrastructure behind this — it's a plain
  // browser Notification fired from a periodic check while the tab is
  // open (including backgrounded/minimized). It will NOT fire if the
  // browser or tab is fully closed. Honest limitation, not a bug.
  const lastNotifiedRef = useRef(0);
  useEffect(() => {
    if (!data.remindersEnabled) return;
    if (typeof Notification === 'undefined') return;
    const checkInterval = setInterval(() => {
      if (Notification.permission !== 'granted') return;
      if (attentionItems.length === 0) return;
      const now = Date.now();
      if (now - lastNotifiedRef.current < 55 * 60 * 1000) return; // at most once an hour
      lastNotifiedRef.current = now;
      new Notification('Café Hub — needs attention', { body: attentionItems.slice(0, 4).join('\n') });
    }, 5 * 60 * 1000); // check every 5 minutes
    return () => clearInterval(checkInterval);
  }, [data.remindersEnabled, attentionItems.join('|')]);

  function setCafeName(name) {
    setData((d) => ({ ...d, cafeName: name }));
  }

  function setRemindersEnabled(enabled) {
    if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    setData((d) => ({ ...d, remindersEnabled: enabled }));
  }

  function finishWizard() {
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setShowWizard(false);
  }

  function restoreFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const incoming = parsed.data || parsed; // accept either the wrapped backup shape or a raw data object
        setData((d) => ({ ...d, ...incoming }));
      } catch (err) {
        alert('Could not read that file — make sure it is a Café Hub backup JSON.');
      }
    };
    reader.readAsText(file);
  }

  const [stockSubTab, setStockSubTab] = useState('live');
  const [moneySubTab, setMoneySubTab] = useState('close');
  const [teamSubTab, setTeamSubTab] = useState('handover');

  if (showWizard) {
    return (
      <SetupWizard
        cafeName={data.cafeName}
        setCafeName={setCafeName}
        openingTemplate={data.openingTemplate}
        updateOpeningTemplate={updateOpeningTemplate}
        devices={data.haccpDevices}
        addHaccpDevice={addHaccpDevice}
        updateHaccpDevice={updateHaccpDevice}
        removeHaccpDevice={removeHaccpDevice}
        onFinish={finishWizard}
      />
    );
  }

  const yesterdayKey = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const yesterdayClose = data.dailyCloses.find((c) => c.date === yesterdayKey);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 60 }}>
      <Header
        dateKey={dateKey}
        cafeName={data.cafeName}
        remindersEnabled={data.remindersEnabled}
        setRemindersEnabled={setRemindersEnabled}
        onExport={() => exportDataAsFile(data)}
        onImportFile={restoreFromFile}
      />
      <TabNav tab={tab} setTab={setTab} />

      <div style={{ padding: '0 16px' }}>
        {tab === 'today' && (
          <TodayScreen
            attentionItems={attentionItems}
            openingProgress={openingProgress}
            closingProgress={closingProgress}
            latestReadings={latestReadings}
            devices={data.haccpDevices}
            coffee={data.coffees[0]}
            latestDialIn={latestDialIn}
            lowStockProducts={lowStockProducts}
            yesterdayClose={yesterdayClose}
            goToOps={(subtab) => {
              setTab('operations');
              setOpsSubTab(subtab);
            }}
            goToCoffee={() => setTab('coffee')}
            goToStock={() => setTab('stock')}
          />
        )}

        {tab === 'operations' && (
          <OperationsScreen
            subTab={opsSubTab}
            setSubTab={setOpsSubTab}
            todaysTasks={todaysTasks}
            setTaskStatus={setTaskStatus}
            openingTemplate={data.openingTemplate}
            closingTemplate={data.closingTemplate}
            updateOpeningTemplate={updateOpeningTemplate}
            updateClosingTemplate={updateClosingTemplate}
            devices={data.haccpDevices}
            readings={data.haccpReadings}
            latestReadings={latestReadings}
            addHaccpReading={addHaccpReading}
            setCorrectiveAction={setCorrectiveAction}
            addHaccpDevice={addHaccpDevice}
            updateHaccpDevice={updateHaccpDevice}
            removeHaccpDevice={removeHaccpDevice}
            incidents={data.incidents}
            addIncident={addIncident}
            updateIncident={updateIncident}
            removeIncident={removeIncident}
          />
        )}

        {tab === 'coffee' && (
          <CoffeeScreen
            coffees={data.coffees}
            dialIns={data.dialIns}
            addDialIn={addDialIn}
            recipes={data.recipes}
            filterRecipes={data.filterRecipes}
            addFilterRecipe={addFilterRecipe}
            updateFilterRecipe={updateFilterRecipe}
            removeFilterRecipe={removeFilterRecipe}
          />
        )}

        {tab === 'stock' && (
          <StockScreen
            subTab={stockSubTab}
            setSubTab={setStockSubTab}
            products={data.products}
            waste={data.waste}
            orders={data.orders}
            deliveries={data.deliveries}
            addProduct={addProduct}
            updateProduct={updateProduct}
            removeProduct={removeProduct}
            setStockCount={setStockCount}
            logWaste={logWaste}
            markOrdered={markOrdered}
            receiveDelivery={receiveDelivery}
          />
        )}

        {tab === 'money' && (
          <MoneyScreen
            subTab={moneySubTab}
            setSubTab={setMoneySubTab}
            recipes={data.recipes}
            addRecipe={addRecipe}
            updateRecipe={updateRecipe}
            removeRecipe={removeRecipe}
            dailyCloses={data.dailyCloses}
            saveDailyClose={saveDailyClose}
            todaysWasteCost={data.waste
              .filter((w) => new Date(w.timestamp).toISOString().slice(0, 10) === dateKey)
              .reduce((sum, w) => sum + (w.cost || 0), 0)}
            dateKey={dateKey}
            priceAlerts={data.priceAlerts}
            dismissPriceAlert={dismissPriceAlert}
            applyPriceAlertToIngredient={applyPriceAlertToIngredient}
          />
        )}

        {tab === 'team' && (
          <TeamScreen
            subTab={teamSubTab}
            setSubTab={setTeamSubTab}
            handoverNotes={data.handoverNotes}
            addHandoverNote={addHandoverNote}
            acknowledgeHandoverNote={acknowledgeHandoverNote}
            sops={data.sops}
            addSop={addSop}
            removeSop={removeSop}
            staff={data.staff}
            addStaffMember={addStaffMember}
            removeStaffMember={removeStaffMember}
          />
        )}
      </div>
    </div>
  );
}

// ---------- header + nav ----------

function Header({ dateKey, cafeName, remindersEnabled, setRemindersEnabled, onExport, onImportFile }) {
  const d = new Date(dateKey);
  const dateLabel = d.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  return (
    <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1, color: 'var(--copper)', fontWeight: 500 }}>FDC OPERATIONS</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, color: 'var(--text-ivory)', lineHeight: 1.1, marginTop: 2 }}>
            Café Hub
          </div>
          {cafeName && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{cafeName}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setRemindersEnabled(!remindersEnabled)}
            title={remindersEnabled ? 'Reminders on — tap to turn off' : 'Reminders off — tap to turn on (only fires while this tab is open)'}
            style={{ background: 'none', border: 'none', fontSize: 16, color: remindersEnabled ? 'var(--copper)' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            {remindersEnabled ? '🔔' : '🔕'}
          </button>
          <button onClick={onExport} title="Download a backup of all your data" style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
            ⤓
          </button>
          <label title="Restore from a backup file" style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
            ⤒
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files[0]) onImportFile(e.target.files[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
        <span>{dateLabel}</span>
        <span style={{ color: 'var(--status-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-green)', display: 'inline-block' }} />
          synced
        </span>
      </div>
    </div>
  );
}

function TabNav({ tab, setTab }) {
  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'operations', label: 'Operations' },
    { id: 'stock', label: 'Stock' },
    { id: 'money', label: 'Money' },
    { id: 'coffee', label: 'Coffee' },
    { id: 'team', label: 'Team' },
  ];
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          style={{
            background: 'none',
            border: 'none',
            color: tab === t.id ? 'var(--text-ivory)' : 'var(--text-muted)',
            padding: '12px 14px',
            fontSize: 13,
            fontWeight: 500,
            borderBottom: tab === t.id ? '2px solid var(--copper)' : '2px solid transparent',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------- shared bits ----------

function Card({ children, style }) {
  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 0.3 }}>{children}</div>;
}

// ---------- TODAY ----------

function TodayScreen({ attentionItems, openingProgress, closingProgress, latestReadings, devices, coffee, latestDialIn, lowStockProducts, yesterdayClose, goToOps, goToCoffee, goToStock }) {
  return (
    <div style={{ paddingTop: 14 }}>
      {attentionItems.length > 0 && (
        <div
          style={{
            background: '#3C2E22',
            border: '1px solid var(--copper)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Needs attention</span>
            <span style={{ fontSize: 11, background: 'var(--copper)', color: '#3C2E22', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
              {attentionItems.length}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#E9D9C6', lineHeight: 1.7 }}>
            {attentionItems.map((item, i) => (
              <div key={i}>{item}</div>
            ))}
          </div>
        </div>
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Opening</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {openingProgress.done} / {openingProgress.total}
          </span>
        </div>
        <ProgressBar done={openingProgress.done} total={openingProgress.total} />
        <button onClick={() => goToOps('opening')} style={ghostButtonStyle}>
          Continue opening →
        </button>
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Closing</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {closingProgress.done} / {closingProgress.total}
          </span>
        </div>
        <ProgressBar done={closingProgress.done} total={closingProgress.total} />
        <button onClick={() => goToOps('closing')} style={ghostButtonStyle}>
          Continue closing →
        </button>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Card style={{ marginBottom: 0 }}>
          <SectionLabel>HACCP</SectionLabel>
          {devices.slice(0, 3).map((dev) => {
            const r = latestReadings[dev.id];
            return (
              <div
                key={dev.id}
                style={{
                  fontSize: 12,
                  color: r ? (r.status === 'pass' ? 'var(--text-secondary)' : 'var(--copper)') : 'var(--text-muted)',
                  lineHeight: 1.7,
                }}
              >
                {r ? (r.status === 'pass' ? '' : '⚠ ') : '· '}
                {dev.name} {r ? `${r.reading}°C` : 'not checked'}
              </div>
            );
          })}
          <button onClick={() => goToOps('haccp')} style={ghostButtonStyle}>
            View HACCP →
          </button>
        </Card>

        <Card style={{ marginBottom: 0 }}>
          <SectionLabel>Coffee</SectionLabel>
          {latestDialIn ? (
            <>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
                {latestDialIn.dose}g → {latestDialIn.yield}g
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {latestDialIn.time} sec · {fmtTime(latestDialIn.timestamp)}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No dial-in logged yet</div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{coffee.origin}</div>
          <button onClick={goToCoffee} style={ghostButtonStyle}>
            Coffee station →
          </button>
        </Card>
      </div>

      <Card>
        <SectionLabel>Stock exceptions</SectionLabel>
        {lowStockProducts.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>All stock above par</div>
        ) : (
          lowStockProducts.map((p) => (
            <div key={p.id} style={{ fontSize: 12, color: 'var(--copper)', lineHeight: 1.7 }}>
              ⚠ {p.name} — {p.current} {p.unit}{p.unit === 'unit' ? '' : 's'} (par {p.par})
            </div>
          ))
        )}
        <button onClick={goToStock} style={ghostButtonStyle}>
          View stock →
        </button>
      </Card>

      {yesterdayClose && (
        <Card>
          <SectionLabel>Yesterday</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Sales</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>€{yesterdayClose.posSales}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cash variance</div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  color: Math.abs(yesterdayClose.variance) > 10 ? 'var(--status-red)' : Math.abs(yesterdayClose.variance) > 5 ? 'var(--copper)' : 'var(--status-green)',
                }}
              >
                {yesterdayClose.variance >= 0 ? '+' : ''}€{yesterdayClose.variance}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Waste</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>€{yesterdayClose.wasteCost}</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function ProgressBar({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, margin: '8px 0 10px', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--status-green)' }} />
    </div>
  );
}

const ghostButtonStyle = {
  background: 'none',
  border: '1px solid var(--border)',
  color: 'var(--text-ivory)',
  fontSize: 12,
  padding: '8px 10px',
  borderRadius: 8,
  width: '100%',
  marginTop: 4,
};

// ---------- OPERATIONS ----------

function OperationsScreen({
  subTab,
  setSubTab,
  todaysTasks,
  setTaskStatus,
  openingTemplate,
  closingTemplate,
  updateOpeningTemplate,
  updateClosingTemplate,
  devices,
  readings,
  latestReadings,
  addHaccpReading,
  setCorrectiveAction,
  addHaccpDevice,
  updateHaccpDevice,
  removeHaccpDevice,
  incidents,
  addIncident,
  updateIncident,
  removeIncident,
}) {
  const subTabs = [
    { id: 'opening', label: 'Opening' },
    { id: 'closing', label: 'Closing' },
    { id: 'haccp', label: 'HACCP' },
    { id: 'incidents', label: 'Incidents' },
    { id: 'settings', label: 'Settings' },
  ];
  return (
    <div style={{ paddingTop: 14 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {subTabs.map((s) => (
          <button
            key={s.id}
            onClick={() => setSubTab(s.id)}
            style={{
              background: subTab === s.id ? 'var(--bg-elevated)' : 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-ivory)',
              fontSize: 12,
              padding: '8px 12px',
              borderRadius: 8,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {subTab === 'opening' && (
        <Checklist listType="opening" template={openingTemplate} todaysTasks={todaysTasks} setTaskStatus={setTaskStatus} />
      )}
      {subTab === 'closing' && (
        <Checklist listType="closing" template={closingTemplate} todaysTasks={todaysTasks} setTaskStatus={setTaskStatus} />
      )}
      {subTab === 'haccp' && (
        <HaccpPanel
          devices={devices}
          readings={readings}
          latestReadings={latestReadings}
          addHaccpReading={addHaccpReading}
          setCorrectiveAction={setCorrectiveAction}
        />
      )}
      {subTab === 'incidents' && (
        <Incidents incidents={incidents} addIncident={addIncident} updateIncident={updateIncident} removeIncident={removeIncident} />
      )}
      {subTab === 'settings' && (
        <OperationsSettings
          openingTemplate={openingTemplate}
          closingTemplate={closingTemplate}
          updateOpeningTemplate={updateOpeningTemplate}
          updateClosingTemplate={updateClosingTemplate}
          devices={devices}
          addHaccpDevice={addHaccpDevice}
          updateHaccpDevice={updateHaccpDevice}
          removeHaccpDevice={removeHaccpDevice}
        />
      )}
    </div>
  );
}

function Checklist({ listType, template, todaysTasks, setTaskStatus }) {
  return (
    <div>
      {template.map((cat) => (
        <Card key={cat.category}>
          <SectionLabel>{cat.category}</SectionLabel>
          {cat.tasks.map((task) => {
            const id = taskId(listType, cat.category, task);
            const state = todaysTasks[id];
            const status = state?.status;
            return (
              <div
                key={task}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: status === 'complete' ? 'var(--text-secondary)' : status === 'issue' ? 'var(--copper)' : 'var(--text-ivory)',
                    textDecoration: status === 'complete' || status === 'na' ? 'line-through' : 'none',
                  }}
                >
                  {status === 'issue' ? '⚠ ' : ''}
                  {task}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <TaskButton active={status === 'complete'} onClick={() => setTaskStatus(listType, cat.category, task, 'complete')}>
                    ✓
                  </TaskButton>
                  <TaskButton active={status === 'issue'} danger onClick={() => setTaskStatus(listType, cat.category, task, 'issue')}>
                    !
                  </TaskButton>
                  <TaskButton active={status === 'na'} onClick={() => setTaskStatus(listType, cat.category, task, 'na')}>
                    n/a
                  </TaskButton>
                </div>
              </div>
            );
          })}
        </Card>
      ))}
    </div>
  );
}

function TaskButton({ children, active, danger, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        minWidth: 30,
        height: 28,
        fontSize: 11,
        borderRadius: 6,
        border: `1px solid ${active ? (danger ? 'var(--copper)' : 'var(--status-green)') : 'var(--border)'}`,
        background: active ? (danger ? 'var(--copper)' : 'var(--status-green)') : 'none',
        color: active ? '#22241C' : 'var(--text-muted)',
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

function HaccpPanel({ devices, readings, latestReadings, addHaccpReading, setCorrectiveAction }) {
  const [inputs, setInputs] = useState({});
  const openExceptions = readings.filter((r) => r.status === 'fail' && !r.correctiveAction);

  return (
    <div>
      {openExceptions.length > 0 && (
        <Card style={{ borderColor: 'var(--copper)' }}>
          <SectionLabel>Corrective action required</SectionLabel>
          {openExceptions.map((r) => {
            const device = devices.find((d) => d.id === r.deviceId);
            return (
              <div key={r.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
                <div style={{ fontSize: 13, color: 'var(--copper)', marginBottom: 6 }}>
                  {device?.name}: {r.reading}°C at {fmtTime(r.timestamp)} — outside {device?.min}–{device?.max}°C
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['Reading retaken', 'Product moved', 'Appliance adjusted', 'Product discarded', 'Manager notified'].map((action) => (
                    <button
                      key={action}
                      onClick={() => setCorrectiveAction(r.id, action)}
                      style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-ivory)' }}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {devices.map((dev) => {
        const r = latestReadings[dev.id];
        return (
          <Card key={dev.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{dev.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Target {dev.min}–{dev.max}°C
                </div>
              </div>
              {r && (
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: r.status === 'pass' ? 'var(--status-green)' : 'var(--copper)' }}>
                  {r.reading}°C
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                type="number"
                step="0.1"
                placeholder="Reading °C"
                value={inputs[dev.id] || ''}
                onChange={(e) => setInputs((prev) => ({ ...prev, [dev.id]: e.target.value }))}
                style={{
                  flex: 1,
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-ivory)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 13,
                }}
              />
              <button
                onClick={() => {
                  const val = parseFloat(inputs[dev.id]);
                  if (isNaN(val)) return;
                  addHaccpReading(dev.id, val);
                  setInputs((prev) => ({ ...prev, [dev.id]: '' }));
                }}
                style={{ ...ghostButtonStyle, width: 'auto', marginTop: 0, padding: '8px 14px' }}
              >
                Log
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- OPERATIONS SETTINGS (adaptable config) ----------

const INCIDENT_CATEGORIES = ['Equipment failure', 'Customer complaint', 'Accident', 'Food-safety incident', 'Staff injury', 'Property issue', 'Supplier issue'];

function Incidents({ incidents, addIncident, updateIncident, removeIncident }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: 'Equipment failure', description: '', reportedBy: '', actionTaken: '' });

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-ivory)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
  };

  function submit() {
    if (!form.description.trim()) return;
    addIncident(form);
    setForm({ category: 'Equipment failure', description: '', reportedBy: '', actionTaken: '' });
    setShowForm(false);
  }

  const open = incidents.filter((i) => i.status === 'open');
  const resolved = incidents.filter((i) => i.status === 'resolved');

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showForm ? 12 : 0 }}>
          <SectionLabel>Report an incident</SectionLabel>
          <button onClick={() => setShowForm((v) => !v)} style={{ ...ghostButtonStyle, width: 'auto', marginTop: 0, padding: '6px 12px', fontSize: 11 }}>
            {showForm ? 'Cancel' : '+ New'}
          </button>
        </div>
        {showForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={inputStyle}>
              {INCIDENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <textarea
              placeholder="What happened?"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            />
            <input placeholder="Reported by" value={form.reportedBy} onChange={(e) => setForm((f) => ({ ...f, reportedBy: e.target.value }))} style={inputStyle} />
            <input placeholder="Action taken (optional)" value={form.actionTaken} onChange={(e) => setForm((f) => ({ ...f, actionTaken: e.target.value }))} style={inputStyle} />
            <button onClick={submit} style={{ ...ghostButtonStyle, background: 'var(--copper)', color: '#3C2E22', border: 'none', fontWeight: 500 }}>
              Log incident
            </button>
          </div>
        )}
      </Card>

      <Card>
        <SectionLabel>Open</SectionLabel>
        {open.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing open.</div>
        ) : (
          open.map((i) => (
            <div key={i.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--copper)', marginBottom: 4 }}>
                <span>{i.category}</span>
                <span>{fmtTime(i.timestamp)}</span>
              </div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>{i.description}</div>
              {i.reportedBy && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Reported by {i.reportedBy}</div>}
              {i.actionTaken && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Action: {i.actionTaken}</div>}
              <button
                onClick={() => updateIncident(i.id, { status: 'resolved' })}
                style={{ ...ghostButtonStyle, width: 'auto', marginTop: 8, padding: '6px 12px', fontSize: 11 }}
              >
                Mark resolved
              </button>
            </div>
          ))
        )}
      </Card>

      {resolved.length > 0 && (
        <Card>
          <SectionLabel>Resolved</SectionLabel>
          {resolved.map((i) => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <span>
                {i.category} — {i.description}
              </span>
              <button onClick={() => removeIncident(i.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11 }}>
                Remove
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function OperationsSettings({ openingTemplate, closingTemplate, updateOpeningTemplate, updateClosingTemplate, devices, addHaccpDevice, updateHaccpDevice, removeHaccpDevice }) {
  const [editing, setEditing] = useState('opening'); // 'opening' | 'closing' | 'haccp'

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
        Every café runs differently — edit these to match how yours actually works. Changes apply immediately.
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          ['opening', 'Opening checklist'],
          ['closing', 'Closing checklist'],
          ['haccp', 'HACCP devices'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setEditing(id)}
            style={{
              background: editing === id ? 'var(--copper)' : 'none',
              color: editing === id ? '#3C2E22' : 'var(--text-muted)',
              border: `1px solid ${editing === id ? 'var(--copper)' : 'var(--border)'}`,
              fontSize: 11,
              padding: '6px 10px',
              borderRadius: 8,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {editing === 'opening' && <ChecklistEditor template={openingTemplate} onChange={updateOpeningTemplate} />}
      {editing === 'closing' && <ChecklistEditor template={closingTemplate} onChange={updateClosingTemplate} />}
      {editing === 'haccp' && (
        <HaccpDeviceEditor devices={devices} addHaccpDevice={addHaccpDevice} updateHaccpDevice={updateHaccpDevice} removeHaccpDevice={removeHaccpDevice} />
      )}
    </div>
  );
}

function ChecklistEditor({ template, onChange }) {
  const [newCategoryName, setNewCategoryName] = useState('');

  const inputSm = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-ivory)',
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 12,
  };

  function renameCategory(catIdx, name) {
    const next = template.map((c, i) => (i === catIdx ? { ...c, category: name } : c));
    onChange(next);
  }

  function removeCategory(catIdx) {
    onChange(template.filter((_, i) => i !== catIdx));
  }

  function addTask(catIdx) {
    const next = template.map((c, i) => (i === catIdx ? { ...c, tasks: [...c.tasks, 'New task'] } : c));
    onChange(next);
  }

  function renameTask(catIdx, taskIdx, value) {
    const next = template.map((c, i) => (i === catIdx ? { ...c, tasks: c.tasks.map((t, j) => (j === taskIdx ? value : t)) } : c));
    onChange(next);
  }

  function removeTask(catIdx, taskIdx) {
    const next = template.map((c, i) => (i === catIdx ? { ...c, tasks: c.tasks.filter((_, j) => j !== taskIdx) } : c));
    onChange(next);
  }

  function addCategory() {
    if (!newCategoryName.trim()) return;
    onChange([...template, { category: newCategoryName.trim(), tasks: [] }]);
    setNewCategoryName('');
  }

  return (
    <div>
      {template.map((cat, catIdx) => (
        <Card key={catIdx}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input
              value={cat.category}
              onChange={(e) => renameCategory(catIdx, e.target.value)}
              style={{ ...inputSm, flex: 1, fontSize: 13, fontWeight: 500 }}
            />
            <button
              onClick={() => removeCategory(catIdx)}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, padding: '6px 8px', borderRadius: 6 }}
            >
              Remove category
            </button>
          </div>
          {cat.tasks.map((task, taskIdx) => (
            <div key={taskIdx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input value={task} onChange={(e) => renameTask(catIdx, taskIdx, e.target.value)} style={{ ...inputSm, flex: 1 }} />
              <button
                onClick={() => removeTask(catIdx, taskIdx)}
                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 14, padding: '2px 10px', borderRadius: 6 }}
              >
                ×
              </button>
            </div>
          ))}
          <button onClick={() => addTask(catIdx)} style={{ ...ghostButtonStyle, width: 'auto', marginTop: 4, padding: '6px 12px', fontSize: 11 }}>
            + Add task
          </button>
        </Card>
      ))}

      <Card>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="New category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            style={{ ...inputSm, flex: 1 }}
          />
          <button onClick={addCategory} style={{ ...ghostButtonStyle, width: 'auto', marginTop: 0, padding: '8px 14px', fontSize: 12 }}>
            + Add category
          </button>
        </div>
      </Card>
    </div>
  );
}

function HaccpDeviceEditor({ devices, addHaccpDevice, updateHaccpDevice, removeHaccpDevice }) {
  const [form, setForm] = useState({ name: '', min: 0, max: 5 });

  const inputSm = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-ivory)',
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 12,
  };

  function submit() {
    if (!form.name.trim()) return;
    addHaccpDevice({ name: form.name, min: parseFloat(form.min) || 0, max: parseFloat(form.max) || 5 });
    setForm({ name: '', min: 0, max: 5 });
  }

  return (
    <div>
      {devices.map((dev) => (
        <Card key={dev.id}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={dev.name} onChange={(e) => updateHaccpDevice(dev.id, { name: e.target.value })} style={{ ...inputSm, flex: 2 }} />
            <input
              type="number"
              value={dev.min}
              onChange={(e) => updateHaccpDevice(dev.id, { min: parseFloat(e.target.value) || 0 })}
              style={{ ...inputSm, width: 60 }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>to</span>
            <input
              type="number"
              value={dev.max}
              onChange={(e) => updateHaccpDevice(dev.id, { max: parseFloat(e.target.value) || 0 })}
              style={{ ...inputSm, width: 60 }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>°C</span>
            <button
              onClick={() => removeHaccpDevice(dev.id)}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, padding: '6px 8px', borderRadius: 6 }}
            >
              Remove
            </button>
          </div>
        </Card>
      ))}

      <Card>
        <SectionLabel>Add a device</SectionLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input placeholder="Name (e.g. Display fridge)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ ...inputSm, flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input type="number" placeholder="Min °C" value={form.min} onChange={(e) => setForm((f) => ({ ...f, min: e.target.value }))} style={{ ...inputSm, width: 80 }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>to</span>
          <input type="number" placeholder="Max °C" value={form.max} onChange={(e) => setForm((f) => ({ ...f, max: e.target.value }))} style={{ ...inputSm, width: 80 }} />
        </div>
        <button onClick={submit} style={{ ...ghostButtonStyle, background: 'var(--copper)', color: '#3C2E22', border: 'none', fontWeight: 500 }}>
          Add device
        </button>
      </Card>
    </div>
  );
}

// ---------- COFFEE ----------

function CoffeeScreen({ coffees, dialIns, addDialIn, recipes, filterRecipes, addFilterRecipe, updateFilterRecipe, removeFilterRecipe }) {
  const [subTab, setSubTab] = useState('dialin');
  const subTabs = [
    { id: 'dialin', label: 'Dial-in' },
    { id: 'recipes', label: 'Recipes' },
    { id: 'filter', label: 'Filter' },
  ];

  return (
    <div style={{ paddingTop: 14 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {subTabs.map((s) => (
          <button
            key={s.id}
            onClick={() => setSubTab(s.id)}
            style={{
              background: subTab === s.id ? 'var(--bg-elevated)' : 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-ivory)',
              fontSize: 12,
              padding: '8px 12px',
              borderRadius: 8,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {subTab === 'dialin' && <DialInScreen coffees={coffees} dialIns={dialIns} addDialIn={addDialIn} />}
      {subTab === 'recipes' && <StaffRecipeCards recipes={recipes} />}
      {subTab === 'filter' && (
        <FilterRecipes filterRecipes={filterRecipes} addFilterRecipe={addFilterRecipe} updateFilterRecipe={updateFilterRecipe} removeFilterRecipe={removeFilterRecipe} />
      )}
    </div>
  );
}

function DialInScreen({ coffees, dialIns, addDialIn }) {
  const coffee = coffees[0];
  const [dose, setDose] = useState(coffee.targetDose);
  const [yield_, setYield] = useState(coffee.targetYield);
  const [time, setTime] = useState(coffee.targetTimeMin);
  const [taste, setTaste] = useState('balanced');
  const [note, setNote] = useState('');

  const history = dialIns.filter((d) => d.coffeeId === coffee.id).slice(0, 8);

  function logDialIn() {
    addDialIn(coffee.id, parseFloat(dose), parseFloat(yield_), parseFloat(time), taste, note);
    setNote('');
  }

  return (
    <div>
      <Card>
        <SectionLabel>Today's coffee</SectionLabel>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600 }}>{coffee.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{coffee.origin}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{coffee.detail}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
          Target {coffee.targetDose}g → {coffee.targetYield}g · {coffee.targetTimeMin}–{coffee.targetTimeMax} sec
        </div>
      </Card>

      <Card>
        <SectionLabel>Log a dial-in</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          <LabeledInput label="Dose (g)" value={dose} onChange={setDose} />
          <LabeledInput label="Yield (g)" value={yield_} onChange={setYield} />
          <LabeledInput label="Time (s)" value={time} onChange={setTime} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {TASTE_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTaste(t)}
              style={{
                fontSize: 11,
                padding: '6px 10px',
                borderRadius: 20,
                border: `1px solid ${taste === t ? 'var(--copper)' : 'var(--border)'}`,
                background: taste === t ? 'var(--copper)' : 'none',
                color: taste === t ? '#3C2E22' : 'var(--text-muted)',
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text-ivory)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 13,
            marginBottom: 10,
          }}
        />
        <button onClick={logDialIn} style={{ ...ghostButtonStyle, background: 'var(--copper)', color: '#3C2E22', border: 'none', fontWeight: 500 }}>
          Log dial-in
        </button>
      </Card>

      <Card>
        <SectionLabel>Dial-in history</SectionLabel>
        {history.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No dial-ins logged yet today.</div>}
        {history.map((d) => (
          <div key={d.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0', fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>
                {fmtTime(d.timestamp)} — {d.dose}g → {d.yield}g, {d.time} sec
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{d.taste}</span>
            </div>
            {d.note && <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{d.note}</div>}
          </div>
        ))}
      </Card>
    </div>
  );
}

function StaffRecipeCards({ recipes }) {
  return (
    <div>
      {recipes.length === 0 ? (
        <Card>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No recipes added yet — add one in Money → Recipes & COGS.</div>
        </Card>
      ) : (
        recipes.map((r) => (
          <Card key={r.id}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>{r.name}</div>
            {r.cupSize && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{r.cupSize}</div>}
            <div style={{ marginTop: 10 }}>
              {r.ingredients.map((ing) => (
                <div key={ing.id} style={{ fontSize: 13, color: 'var(--text-ivory)', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                  {ing.name} — {ing.qtyUsed}
                  {ing.qtyUnit}
                </div>
              ))}
            </div>
            {r.notes && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', lineHeight: 1.5 }}>
                {r.notes}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

const BREWER_TYPES = ['Batch brew', 'V60', 'Aeropress', 'Chemex', 'French press', 'Other'];

function FilterRecipes({ filterRecipes, addFilterRecipe, updateFilterRecipe, removeFilterRecipe }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ coffee: '', brewer: 'V60', dose: '', water: '', temp: '', grindRef: '', bloom: '', totalTime: '', steps: '', notes: '' });

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-ivory)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
  };

  function submit() {
    if (!form.coffee.trim()) return;
    addFilterRecipe({
      ...form,
      dose: parseFloat(form.dose) || 0,
      water: parseFloat(form.water) || 0,
      steps: form.steps.split('\n').map((s) => s.trim()).filter(Boolean),
    });
    setForm({ coffee: '', brewer: 'V60', dose: '', water: '', temp: '', grindRef: '', bloom: '', totalTime: '', steps: '', notes: '' });
    setShowForm(false);
  }

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showForm ? 12 : 0 }}>
          <SectionLabel>Filter recipes</SectionLabel>
          <button onClick={() => setShowForm((v) => !v)} style={{ ...ghostButtonStyle, width: 'auto', marginTop: 0, padding: '6px 12px', fontSize: 11 }}>
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        </div>
        {showForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Coffee (e.g. Colombia El Faro)" value={form.coffee} onChange={(e) => setForm((f) => ({ ...f, coffee: e.target.value }))} style={inputStyle} />
            <select value={form.brewer} onChange={(e) => setForm((f) => ({ ...f, brewer: e.target.value }))} style={inputStyle}>
              {BREWER_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <input type="number" step="0.1" placeholder="Dose (g)" value={form.dose} onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))} style={inputStyle} />
              <input type="number" step="1" placeholder="Water (g)" value={form.water} onChange={(e) => setForm((f) => ({ ...f, water: e.target.value }))} style={inputStyle} />
              <input placeholder="Temp (°C)" value={form.temp} onChange={(e) => setForm((f) => ({ ...f, temp: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input placeholder="Grind reference" value={form.grindRef} onChange={(e) => setForm((f) => ({ ...f, grindRef: e.target.value }))} style={inputStyle} />
              <input placeholder="Bloom (e.g. 30g / 30s)" value={form.bloom} onChange={(e) => setForm((f) => ({ ...f, bloom: e.target.value }))} style={inputStyle} />
            </div>
            <input placeholder="Total brew time" value={form.totalTime} onChange={(e) => setForm((f) => ({ ...f, totalTime: e.target.value }))} style={inputStyle} />
            <textarea
              placeholder="Steps — one per line"
              value={form.steps}
              onChange={(e) => setForm((f) => ({ ...f, steps: e.target.value }))}
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            />
            <input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={inputStyle} />
            <button onClick={submit} style={{ ...ghostButtonStyle, background: 'var(--copper)', color: '#3C2E22', border: 'none', fontWeight: 500 }}>
              Add filter recipe
            </button>
          </div>
        )}
      </Card>

      {filterRecipes.map((r) => {
        const ratio = r.dose > 0 ? Math.round((r.water / r.dose) * 10) / 10 : null;
        return (
          <Card key={r.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{r.coffee}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.brewer}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              {r.dose}g : {r.water}g{ratio ? ` · 1:${ratio}` : ''} · {r.temp}°C
              {r.bloom ? ` · bloom ${r.bloom}` : ''}
              {r.totalTime ? ` · ${r.totalTime}` : ''}
            </div>
            {r.grindRef && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Grind: {r.grindRef}</div>}
            {r.steps && r.steps.length > 0 && (
              <ol style={{ margin: '10px 0 0', paddingLeft: 18 }}>
                {r.steps.map((step, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.5 }}>
                    {step}
                  </li>
                ))}
              </ol>
            )}
            {r.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{r.notes}</div>}
            <button
              onClick={() => removeFilterRecipe(r.id)}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, padding: '6px 10px', borderRadius: 8, marginTop: 10 }}
            >
              Remove
            </button>
          </Card>
        );
      })}
    </div>
  );
}

function LabeledInput({ label, value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          color: 'var(--text-ivory)',
          borderRadius: 8,
          padding: '8px 10px',
          fontSize: 13,
        }}
      />
    </div>
  );
}

// ---------- STOCK ----------

function StockScreen({ subTab, setSubTab, products, waste, orders, deliveries, addProduct, updateProduct, removeProduct, setStockCount, logWaste, markOrdered, receiveDelivery }) {
  const subTabs = [
    { id: 'live', label: 'Live' },
    { id: 'count', label: 'Count' },
    { id: 'orders', label: 'Orders' },
    { id: 'deliveries', label: 'Deliveries' },
    { id: 'waste', label: 'Waste' },
    { id: 'products', label: 'Products' },
  ];
  return (
    <div style={{ paddingTop: 14 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {subTabs.map((s) => (
          <button
            key={s.id}
            onClick={() => setSubTab(s.id)}
            style={{
              background: subTab === s.id ? 'var(--bg-elevated)' : 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-ivory)',
              fontSize: 12,
              padding: '8px 12px',
              borderRadius: 8,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {subTab === 'live' && <LiveStock products={products} />}
      {subTab === 'count' && <StockCount products={products} setStockCount={setStockCount} />}
      {subTab === 'orders' && <Orders products={products} orders={orders} markOrdered={markOrdered} />}
      {subTab === 'deliveries' && <Deliveries orders={orders} deliveries={deliveries} receiveDelivery={receiveDelivery} />}
      {subTab === 'waste' && <WasteLog products={products} waste={waste} logWaste={logWaste} />}
      {subTab === 'products' && (
        <Products products={products} addProduct={addProduct} updateProduct={updateProduct} removeProduct={removeProduct} />
      )}
    </div>
  );
}

function daysRemaining(product) {
  // Without usage history yet, this is a simple par-based estimate rather
  // than a real average-daily-use figure — good enough to flag urgency,
  // refine once real count-over-time data exists.
  if (!product.par || product.par <= 0) return null;
  const pctLeft = product.current / product.par;
  if (pctLeft >= 1) return null;
  return Math.max(0, Math.round(pctLeft * 7 * 10) / 10); // rough week-based estimate
}

function LiveStock({ products }) {
  const exceptions = products.filter((p) => p.par > 0 && p.current / p.par < 0.3);
  const ok = products.filter((p) => !(p.par > 0 && p.current / p.par < 0.3));

  return (
    <div>
      <Card>
        <SectionLabel>Needs ordering</SectionLabel>
        {exceptions.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Nothing below par.</div>
        ) : (
          exceptions.map((p) => {
            const days = daysRemaining(p);
            return (
              <div key={p.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--copper)' }}>⚠ {p.name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {p.current} / {p.par} {p.unit}
                  </span>
                </div>
                {days !== null && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    ~{days} day{days === 1 ? '' : 's'} remaining at this rate
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>

      <Card>
        <SectionLabel>Everything else</SectionLabel>
        {ok.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</div>
        ) : (
          ok.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--text-secondary)',
                padding: '6px 0',
                borderTop: '1px solid var(--border)',
              }}
            >
              <span>{p.name}</span>
              <span>
                {p.current} {p.unit}
              </span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function StockCount({ products, setStockCount }) {
  const [counts, setCounts] = useState({});
  const [savedId, setSavedId] = useState(null);

  function save(id) {
    const val = parseFloat(counts[id]);
    if (isNaN(val)) return;
    setStockCount(id, val);
    setSavedId(id);
    setTimeout(() => setSavedId(null), 1200);
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Walk the shelves and enter what you've actually got. Previous count shown for reference.
      </div>
      {products.map((p) => (
        <Card key={p.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              was {p.current} {p.unit}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              step="0.1"
              placeholder={`${p.current}`}
              value={counts[p.id] ?? ''}
              onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))}
              style={{
                flex: 1,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                color: 'var(--text-ivory)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 15,
              }}
            />
            <button
              onClick={() => save(p.id)}
              style={{
                ...ghostButtonStyle,
                width: 'auto',
                marginTop: 0,
                padding: '10px 16px',
                background: savedId === p.id ? 'var(--status-green)' : 'none',
              }}
            >
              {savedId === p.id ? '✓' : 'Save'}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Orders({ products, orders, markOrdered }) {
  const bySupplier = {};
  products
    .filter((p) => p.par > 0 && p.current < p.par)
    .forEach((p) => {
      const key = p.supplier || 'No supplier set';
      if (!bySupplier[key]) bySupplier[key] = [];
      bySupplier[key].push(p);
    });

  const suppliers = Object.keys(bySupplier);

  return (
    <div>
      {suppliers.length === 0 ? (
        <Card>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nothing needs ordering right now.</div>
        </Card>
      ) : (
        suppliers.map((supplier) => {
          const items = bySupplier[supplier];
          const estValue = items.reduce((sum, p) => sum + Math.max(0, p.par - p.current) * (p.cost || 0), 0);
          return (
            <Card key={supplier}>
              <SectionLabel>{supplier}</SectionLabel>
              {items.map((p) => {
                const suggestQty = Math.max(0, Math.round((p.par - p.current) * 10) / 10);
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      padding: '6px 0',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <span>{p.name}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      order {suggestQty} {p.unit}
                    </span>
                  </div>
                );
              })}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                Estimated value: €{Math.round(estValue * 100) / 100}
              </div>
              <button
                onClick={() => markOrdered(supplier, items.map((p) => ({ productId: p.id, name: p.name, unit: p.unit, qtyOrdered: Math.max(0, Math.round((p.par - p.current) * 10) / 10) })))}
                style={{ ...ghostButtonStyle, background: 'var(--copper)', color: '#3C2E22', border: 'none', fontWeight: 500 }}
              >
                Mark ordered
              </button>
            </Card>
          );
        })
      )}

      {orders.length > 0 && (
        <Card>
          <SectionLabel>Recent orders</SectionLabel>
          {orders.slice(0, 8).map((o) => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <span>
                {fmtTime(o.timestamp)} — {o.supplier} ({o.items.length} item{o.items.length === 1 ? '' : 's'})
              </span>
              <span style={{ color: o.status === 'received' ? 'var(--status-green)' : 'var(--copper)' }}>{o.status}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function Deliveries({ orders, deliveries, receiveDelivery }) {
  const pending = orders.filter((o) => o.status === 'ordered');
  const [receivingId, setReceivingId] = useState(null);

  return (
    <div>
      <Card>
        <SectionLabel>Awaiting delivery</SectionLabel>
        {pending.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing outstanding.</div>
        ) : (
          pending.map((o) => (
            <div key={o.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{o.supplier}</span>
                <span style={{ color: 'var(--text-muted)' }}>{fmtTime(o.timestamp)}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {o.items.map((i) => i.name).join(', ')}
              </div>
              <button
                onClick={() => setReceivingId(receivingId === o.id ? null : o.id)}
                style={{ ...ghostButtonStyle, width: 'auto', marginTop: 8, padding: '8px 14px', fontSize: 12 }}
              >
                {receivingId === o.id ? 'Cancel' : 'Receive delivery'}
              </button>
              {receivingId === o.id && (
                <ReceiveForm
                  order={o}
                  onSubmit={(receivedItems, tempC, notes) => {
                    receiveDelivery(o.id, receivedItems, tempC, notes);
                    setReceivingId(null);
                  }}
                />
              )}
            </div>
          ))
        )}
      </Card>

      {deliveries.length > 0 && (
        <Card>
          <SectionLabel>Delivery history</SectionLabel>
          {deliveries.slice(0, 8).map((d) => {
            const hasIssue = d.items.some((i) => i.missing || i.damaged || i.qtyReceived !== i.qtyOrdered);
            return (
              <div key={d.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>{d.supplier}</span>
                  <span style={{ color: hasIssue ? 'var(--copper)' : 'var(--status-green)' }}>{hasIssue ? '⚠ discrepancy' : '✓ as expected'}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {fmtTime(d.timestamp)}
                  {d.tempC ? ` · ${d.tempC}°C on arrival` : ''}
                </div>
                {d.items.filter((i) => i.missing || i.damaged || i.qtyReceived !== i.qtyOrdered).map((i) => (
                  <div key={i.productId} style={{ fontSize: 11, color: 'var(--copper)', marginTop: 2 }}>
                    {i.name}: ordered {i.qtyOrdered}, received {i.qtyReceived}
                    {i.missing ? ' · missing' : ''}
                    {i.damaged ? ' · damaged' : ''}
                  </div>
                ))}
                {d.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{d.notes}</div>}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function ReceiveForm({ order, onSubmit }) {
  const [rows, setRows] = useState(order.items.map((i) => ({ ...i, qtyReceived: i.qtyOrdered, missing: false, damaged: false })));
  const [tempC, setTempC] = useState('');
  const [notes, setNotes] = useState('');

  function updateRow(productId, patch) {
    setRows((rs) => rs.map((r) => (r.productId === productId ? { ...r, ...patch } : r)));
  }

  const inputStyleSm = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-ivory)',
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 12,
    width: 60,
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      {rows.map((r) => (
        <div key={r.productId} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12 }}>{r.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ordered {r.qtyOrdered} {r.unit}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              step="0.1"
              value={r.qtyReceived}
              onChange={(e) => updateRow(r.productId, { qtyReceived: parseFloat(e.target.value) || 0 })}
              style={inputStyleSm}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={r.missing} onChange={(e) => updateRow(r.productId, { missing: e.target.checked })} /> Missing
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={r.damaged} onChange={(e) => updateRow(r.productId, { damaged: e.target.checked })} /> Damaged
            </label>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          type="number"
          step="0.1"
          placeholder="Delivery temp °C (if applicable)"
          value={tempC}
          onChange={(e) => setTempC(e.target.value)}
          style={{ ...inputStyleSm, width: '100%', flex: 1 }}
        />
      </div>
      <input
        placeholder="Notes (price discrepancy, etc.)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ ...inputStyleSm, width: '100%', marginBottom: 8 }}
      />
      <button
        onClick={() => onSubmit(rows, tempC, notes)}
        style={{ ...ghostButtonStyle, background: 'var(--copper)', color: '#3C2E22', border: 'none', fontWeight: 500, width: '100%' }}
      >
        Confirm receipt — updates stock
      </button>
    </div>
  );
}

function WasteLog({ products, waste, logWaste }) {
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('Expired');

  const todaysWaste = waste.filter((w) => new Date(w.timestamp).toISOString().slice(0, 10) === todayKey());
  const todaysCost = todaysWaste.reduce((sum, w) => sum + (w.cost || 0), 0);

  function submit() {
    const q = parseFloat(qty);
    if (!q || !productId) return;
    logWaste(productId, q, reason);
    setQty('');
  }

  return (
    <div>
      <Card>
        <SectionLabel>Log waste</SectionLabel>
        <div style={{ marginBottom: 8 }}>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              color: 'var(--text-ivory)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            type="number"
            step="0.1"
            placeholder="Quantity"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              color: 'var(--text-ivory)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 15,
            }}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {WASTE_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              style={{
                fontSize: 11,
                padding: '6px 10px',
                borderRadius: 20,
                border: `1px solid ${reason === r ? 'var(--copper)' : 'var(--border)'}`,
                background: reason === r ? 'var(--copper)' : 'none',
                color: reason === r ? '#3C2E22' : 'var(--text-muted)',
              }}
            >
              {r}
            </button>
          ))}
        </div>
        <button onClick={submit} style={{ ...ghostButtonStyle, background: 'var(--copper)', color: '#3C2E22', border: 'none', fontWeight: 500 }}>
          Log waste
        </button>
      </Card>

      <Card>
        <SectionLabel>Today's waste</SectionLabel>
        {todaysWaste.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing logged yet today.</div>
        ) : (
          <>
            {todaysWaste.map((w) => {
              const p = products.find((pr) => pr.id === w.productId);
              return (
                <div
                  key={w.id}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderTop: '1px solid var(--border)' }}
                >
                  <span>
                    {p?.name || 'Unknown'} — {w.qty} {p?.unit}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {w.reason} · €{w.cost}
                  </span>
                </div>
              );
            })}
            <div style={{ fontSize: 12, color: 'var(--copper)', marginTop: 8, fontWeight: 500 }}>
              Total today: €{Math.round(todaysCost * 100) / 100}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Products({ products, addProduct, updateProduct, removeProduct }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Other', supplier: '', unit: 'unit', par: '', current: '', cost: '' });

  function submit() {
    if (!form.name.trim()) return;
    addProduct({
      name: form.name,
      category: form.category,
      supplier: form.supplier,
      unit: form.unit,
      par: parseFloat(form.par) || 0,
      current: parseFloat(form.current) || 0,
      cost: parseFloat(form.cost) || 0,
    });
    setForm({ name: '', category: 'Other', supplier: '', unit: 'unit', par: '', current: '', cost: '' });
    setShowForm(false);
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-ivory)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
  };

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showForm ? 12 : 0 }}>
          <SectionLabel>Product catalogue</SectionLabel>
          <button onClick={() => setShowForm((v) => !v)} style={{ ...ghostButtonStyle, width: 'auto', marginTop: 0, padding: '6px 12px', fontSize: 11 }}>
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        </div>
        {showForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={inputStyle}>
                {STOCK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} style={inputStyle}>
                {STOCK_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <input placeholder="Supplier" value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <input type="number" step="0.1" placeholder="Par" value={form.par} onChange={(e) => setForm((f) => ({ ...f, par: e.target.value }))} style={inputStyle} />
              <input type="number" step="0.1" placeholder="Current" value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} style={inputStyle} />
              <input type="number" step="0.01" placeholder="Cost (€)" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} style={inputStyle} />
            </div>
            <button onClick={submit} style={{ ...ghostButtonStyle, background: 'var(--copper)', color: '#3C2E22', border: 'none', fontWeight: 500 }}>
              Add product
            </button>
          </div>
        )}
      </Card>

      {products.map((p) => (
        <Card key={p.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {p.category} · {p.supplier || 'no supplier'} · par {p.par} {p.unit}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>€</span>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={p.cost}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val !== p.cost) updateProduct(p.id, { cost: val });
                  }}
                  style={{ ...inputStyle, width: 70, padding: '5px 6px' }}
                />
              </div>
              <button
                onClick={() => removeProduct(p.id)}
                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, padding: '6px 10px', borderRadius: 8 }}
              >
                Remove
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------- MONEY ----------

function ingredientCost(ing) {
  if (!ing.packSize) return 0;
  return Math.round((ing.packCost / ing.packSize) * ing.qtyUsed * 100) / 100;
}

function recipeCost(recipe) {
  return Math.round(recipe.ingredients.reduce((sum, ing) => sum + ingredientCost(ing), 0) * 100) / 100;
}

function MoneyScreen({ subTab, setSubTab, recipes, addRecipe, updateRecipe, removeRecipe, dailyCloses, saveDailyClose, todaysWasteCost, dateKey, priceAlerts, dismissPriceAlert, applyPriceAlertToIngredient }) {
  const subTabs = [
    { id: 'close', label: 'Daily Close' },
    { id: 'recipes', label: 'Recipes & COGS' },
  ];
  return (
    <div style={{ paddingTop: 14 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {subTabs.map((s) => (
          <button
            key={s.id}
            onClick={() => setSubTab(s.id)}
            style={{
              background: subTab === s.id ? 'var(--bg-elevated)' : 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-ivory)',
              fontSize: 12,
              padding: '8px 12px',
              borderRadius: 8,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {subTab === 'close' && (
        <DailyClose dailyCloses={dailyCloses} saveDailyClose={saveDailyClose} todaysWasteCost={todaysWasteCost} recipes={recipes} dateKey={dateKey} />
      )}
      {subTab === 'recipes' && (
        <Recipes
          recipes={recipes}
          addRecipe={addRecipe}
          updateRecipe={updateRecipe}
          removeRecipe={removeRecipe}
          priceAlerts={priceAlerts}
          dismissPriceAlert={dismissPriceAlert}
          applyPriceAlertToIngredient={applyPriceAlertToIngredient}
        />
      )}
    </div>
  );
}

function varianceStatus(v) {
  const abs = Math.abs(v);
  if (abs <= 5) return { label: 'Normal', color: 'var(--status-green)' };
  if (abs <= 10) return { label: 'Review', color: 'var(--copper)' };
  return { label: 'Manager attention', color: 'var(--status-red)' };
}

function DailyClose({ dailyCloses, saveDailyClose, todaysWasteCost, recipes, dateKey }) {
  const existing = dailyCloses.find((c) => c.date === dateKey);
  const [posSales, setPosSales] = useState(existing?.posSales ?? '');
  const [openingFloat, setOpeningFloat] = useState(existing?.openingFloat ?? '');
  const [cashSales, setCashSales] = useState(existing?.cashSales ?? '');
  const [paidOuts, setPaidOuts] = useState(existing?.paidOuts ?? '');
  const [refunds, setRefunds] = useState(existing?.refunds ?? '');
  const [countedCash, setCountedCash] = useState(existing?.countedCash ?? '');
  const [explanation, setExplanation] = useState(existing?.explanation ?? '');
  const [saved, setSaved] = useState(false);

  const expectedCash =
    Math.round(((parseFloat(openingFloat) || 0) + (parseFloat(cashSales) || 0) - (parseFloat(paidOuts) || 0) - (parseFloat(refunds) || 0)) * 100) / 100;
  const variance = countedCash !== '' ? Math.round((parseFloat(countedCash) - expectedCash) * 100) / 100 : null;
  const status = variance !== null ? varianceStatus(variance) : null;

  const avgCogsPct = (() => {
    const withPrice = recipes.filter((r) => r.sellingPrice > 0);
    if (withPrice.length === 0) return null;
    const pct = withPrice.reduce((sum, r) => sum + (recipeCost(r) / r.sellingPrice) * 100, 0) / withPrice.length;
    return Math.round(pct * 10) / 10;
  })();

  function close() {
    if (variance !== null && Math.abs(variance) > 10 && !explanation.trim()) {
      alert('Variance exceeds €10 — add a note explaining it before closing.');
      return;
    }
    saveDailyClose({
      posSales: parseFloat(posSales) || 0,
      openingFloat: parseFloat(openingFloat) || 0,
      cashSales: parseFloat(cashSales) || 0,
      paidOuts: parseFloat(paidOuts) || 0,
      refunds: parseFloat(refunds) || 0,
      expectedCash,
      countedCash: parseFloat(countedCash) || 0,
      variance: variance ?? 0,
      wasteCost: Math.round(todaysWasteCost * 100) / 100,
      estimatedCogsPct: avgCogsPct,
      explanation,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-ivory)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 15,
  };

  return (
    <div>
      <Card>
        <SectionLabel>Today's close</SectionLabel>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>POS sales (€)</div>
          <input type="number" step="0.01" value={posSales} onChange={(e) => setPosSales(e.target.value)} style={inputStyle} />
        </div>
      </Card>

      <Card>
        <SectionLabel>Cash reconciliation</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          {[
            ['Opening float', openingFloat, setOpeningFloat],
            ['Cash sales', cashSales, setCashSales],
            ['Paid-outs', paidOuts, setPaidOuts],
            ['Refunds', refunds, setRefunds],
          ].map(([label, val, set]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label} (€)</div>
              <input type="number" step="0.01" value={val} onChange={(e) => set(e.target.value)} style={inputStyle} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Expected cash</span>
          <span>€{expectedCash}</span>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Cash counted (€)</div>
          <input type="number" step="0.01" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} style={{ ...inputStyle, fontSize: 20 }} />
        </div>

        {variance !== null && (
          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 8,
              background: 'var(--bg-elevated)',
              border: `1px solid ${status.color}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Variance</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: status.color }}>
                {variance >= 0 ? '+' : ''}€{variance}
              </span>
            </div>
            <div style={{ fontSize: 11, color: status.color, marginTop: 2 }}>{status.label}</div>
          </div>
        )}

        {variance !== null && Math.abs(variance) > 5 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Explanation (required above €10)</div>
            <input value={explanation} onChange={(e) => setExplanation(e.target.value)} style={inputStyle} placeholder="What happened?" />
          </div>
        )}
      </Card>

      <Card>
        <SectionLabel>Summary</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Waste today</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>€{Math.round(todaysWasteCost * 100) / 100}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Estimated COGS</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{avgCogsPct !== null ? `${avgCogsPct}%` : '—'}</div>
          </div>
        </div>
        {avgCogsPct === null && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
            Add selling prices to your recipes to see an estimated COGS here.
          </div>
        )}
      </Card>

      <button
        onClick={close}
        style={{ ...ghostButtonStyle, background: saved ? 'var(--status-green)' : 'var(--copper)', color: saved ? '#fff' : '#3C2E22', border: 'none', fontWeight: 500, padding: '12px' }}
      >
        {saved ? '✓ Closed' : existing ? 'Update close' : 'Close day'}
      </button>

      {dailyCloses.length > 0 && (
        <Card style={{ marginTop: 12 }}>
          <SectionLabel>Recent closes</SectionLabel>
          {dailyCloses.slice(0, 7).map((c) => {
            const st = varianceStatus(c.variance);
            return (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{c.date}</span>
                <span>€{c.posSales}</span>
                <span style={{ color: st.color }}>
                  {c.variance >= 0 ? '+' : ''}€{c.variance}
                </span>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function Recipes({ recipes, addRecipe, updateRecipe, removeRecipe, priceAlerts, dismissPriceAlert, applyPriceAlertToIngredient }) {
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', cupSize: '', sellingPrice: '' });

  function submit() {
    if (!form.name.trim()) return;
    addRecipe({ name: form.name, cupSize: form.cupSize, sellingPrice: parseFloat(form.sellingPrice) || 0, ingredients: [], notes: '' });
    setForm({ name: '', cupSize: '', sellingPrice: '' });
    setShowForm(false);
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-ivory)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
  };

  const activeAlerts = (priceAlerts || []).filter((a) => !a.dismissed);

  return (
    <div>
      {activeAlerts.length > 0 && (
        <Card style={{ borderColor: 'var(--copper)' }}>
          <SectionLabel>Price changes</SectionLabel>
          {activeAlerts.map((alert) => {
            const affected = recipes
              .map((r) => ({
                recipe: r,
                ingredient: r.ingredients.find((ing) => ing.name.toLowerCase().includes(alert.productName.toLowerCase()) || alert.productName.toLowerCase().includes(ing.name.toLowerCase())),
              }))
              .filter((x) => x.ingredient);
            return (
              <div key={alert.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, color: 'var(--copper)', marginBottom: 6 }}>
                  {alert.productName}: €{alert.oldCost} → €{alert.newCost} ({alert.pctChange >= 0 ? '+' : ''}
                  {alert.pctChange}%)
                </div>
                {affected.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No recipes reference this ingredient by name.</div>
                ) : (
                  affected.map(({ recipe, ingredient }) => {
                    const newIngCost = Math.round(ingredientCost(ingredient) * (1 + alert.pctChange / 100) * 100) / 100;
                    const currentCost = recipeCost(recipe);
                    const estNewCost = Math.round((currentCost - ingredientCost(ingredient) + newIngCost) * 100) / 100;
                    const estNewMarginPct = recipe.sellingPrice > 0 ? Math.round(((recipe.sellingPrice - estNewCost) / recipe.sellingPrice) * 1000) / 10 : null;
                    return (
                      <div key={recipe.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0' }}>
                        <span>
                          {recipe.name} — est. margin {estNewMarginPct !== null ? `${estNewMarginPct}%` : '—'}
                        </span>
                        <button
                          onClick={() => applyPriceAlertToIngredient(alert.id, recipe.id, ingredient.id, alert.pctChange)}
                          style={{ ...ghostButtonStyle, width: 'auto', marginTop: 0, padding: '5px 10px', fontSize: 10 }}
                        >
                          Apply to recipe
                        </button>
                      </div>
                    );
                  })
                )}
                <button onClick={() => dismissPriceAlert(alert.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, marginTop: 6 }}>
                  Dismiss
                </button>
              </div>
            );
          })}
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showForm ? 12 : 0 }}>
          <SectionLabel>Drink recipes</SectionLabel>
          <button onClick={() => setShowForm((v) => !v)} style={{ ...ghostButtonStyle, width: 'auto', marginTop: 0, padding: '6px 12px', fontSize: 11 }}>
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        </div>
        {showForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Name (e.g. Cappuccino)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input placeholder="Cup size (e.g. 8oz)" value={form.cupSize} onChange={(e) => setForm((f) => ({ ...f, cupSize: e.target.value }))} style={inputStyle} />
              <input type="number" step="0.01" placeholder="Selling price (€)" value={form.sellingPrice} onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))} style={inputStyle} />
            </div>
            <button onClick={submit} style={{ ...ghostButtonStyle, background: 'var(--copper)', color: '#3C2E22', border: 'none', fontWeight: 500 }}>
              Add recipe
            </button>
          </div>
        )}
      </Card>

      {recipes.map((r) => {
        const cost = recipeCost(r);
        const margin = Math.round((r.sellingPrice - cost) * 100) / 100;
        const marginPct = r.sellingPrice > 0 ? Math.round((margin / r.sellingPrice) * 1000) / 10 : null;
        const isOpen = expandedId === r.id;
        return (
          <Card key={r.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpandedId(isOpen ? null : r.id)}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {r.cupSize} · cost €{cost} · sells €{r.sellingPrice}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: marginPct !== null && marginPct < 60 ? 'var(--copper)' : 'var(--status-green)' }}>
                  {marginPct !== null ? `${marginPct}%` : '—'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>margin</div>
              </div>
            </div>

            {isOpen && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                {r.ingredients.map((ing, i) => (
                  <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', color: 'var(--text-secondary)' }}>
                    <span>
                      {ing.name} — {ing.qtyUsed}
                      {ing.qtyUnit}
                    </span>
                    <span>€{ingredientCost(ing)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, padding: '8px 0', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  <span>Total cost</span>
                  <span>€{cost}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Gross margin</span>
                  <span style={{ color: 'var(--status-green)' }}>€{margin}</span>
                </div>
                <AddIngredient recipeId={r.id} updateRecipe={updateRecipe} ingredients={r.ingredients} />
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Staff-facing notes (texture, serve temp, etc.)</div>
                  <textarea
                    defaultValue={r.notes || ''}
                    onBlur={(e) => updateRecipe(r.id, { notes: e.target.value })}
                    placeholder="e.g. Fine microfoam, serve 65°C max"
                    style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }}
                  />
                </div>
                <button
                  onClick={() => removeRecipe(r.id)}
                  style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, padding: '6px 10px', borderRadius: 8, marginTop: 10 }}
                >
                  Remove recipe
                </button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function AddIngredient({ recipeId, updateRecipe, ingredients }) {
  const [form, setForm] = useState({ name: '', packSize: '', packUnit: 'g', packCost: '', qtyUsed: '', qtyUnit: 'g' });
  const inputStyle = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-ivory)',
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 12,
  };

  function add() {
    if (!form.name.trim() || !form.packSize || !form.qtyUsed) return;
    const ing = {
      id: uid(),
      name: form.name,
      packSize: parseFloat(form.packSize),
      packUnit: form.packUnit,
      packCost: parseFloat(form.packCost) || 0,
      qtyUsed: parseFloat(form.qtyUsed),
      qtyUnit: form.qtyUnit,
    };
    updateRecipe(recipeId, { ingredients: [...ingredients, ing] });
    setForm({ name: '', packSize: '', packUnit: 'g', packCost: '', qtyUsed: '', qtyUnit: 'g' });
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>Add ingredient</div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
        <input type="number" step="0.01" placeholder="Pack cost €" value={form.packCost} onChange={(e) => setForm((f) => ({ ...f, packCost: e.target.value }))} style={inputStyle} />
        <input type="number" step="0.1" placeholder="Pack size" value={form.packSize} onChange={(e) => setForm((f) => ({ ...f, packSize: e.target.value }))} style={inputStyle} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        <input type="number" step="0.1" placeholder="Qty used" value={form.qtyUsed} onChange={(e) => setForm((f) => ({ ...f, qtyUsed: e.target.value }))} style={inputStyle} />
        <input placeholder="Unit (g/ml/unit)" value={form.qtyUnit} onChange={(e) => setForm((f) => ({ ...f, qtyUnit: e.target.value, packUnit: e.target.value }))} style={inputStyle} />
        <button onClick={add} style={{ ...inputStyle, background: 'var(--copper)', color: '#3C2E22', fontWeight: 500, border: 'none', cursor: 'pointer' }}>
          Add
        </button>
      </div>
    </div>
  );
}

// ---------- TEAM ----------

function TeamScreen({ subTab, setSubTab, handoverNotes, addHandoverNote, acknowledgeHandoverNote, sops, addSop, removeSop, staff, addStaffMember, removeStaffMember }) {
  const subTabs = [
    { id: 'handover', label: 'Handover' },
    { id: 'sops', label: 'SOPs' },
    { id: 'staff', label: 'Staff' },
  ];
  return (
    <div style={{ paddingTop: 14 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {subTabs.map((s) => (
          <button
            key={s.id}
            onClick={() => setSubTab(s.id)}
            style={{
              background: subTab === s.id ? 'var(--bg-elevated)' : 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-ivory)',
              fontSize: 12,
              padding: '8px 12px',
              borderRadius: 8,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {subTab === 'handover' && <Handover notes={handoverNotes} addNote={addHandoverNote} acknowledge={acknowledgeHandoverNote} />}
      {subTab === 'sops' && <SopLibrary sops={sops} addSop={addSop} removeSop={removeSop} />}
      {subTab === 'staff' && <Staff staff={staff} addStaffMember={addStaffMember} removeStaffMember={removeStaffMember} />}
    </div>
  );
}

const inputStyleShared = {
  width: '100%',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  color: 'var(--text-ivory)',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
};

function Handover({ notes, addNote, acknowledge }) {
  const [author, setAuthor] = useState('');
  const [note, setNote] = useState('');
  const [ackName, setAckName] = useState('');

  function submit() {
    if (!note.trim()) return;
    addNote(author.trim() || 'Unnamed', note.trim());
    setNote('');
  }

  return (
    <div>
      <Card>
        <SectionLabel>Leave a note for the next shift</SectionLabel>
        <div style={{ marginBottom: 8 }}>
          <input placeholder="Your name" value={author} onChange={(e) => setAuthor(e.target.value)} style={{ ...inputStyleShared, marginBottom: 8 }} />
          <textarea
            placeholder="e.g. Grinder 2 running slightly slow, oat milk delivery arrived short 1 case"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ ...inputStyleShared, minHeight: 70, resize: 'vertical' }}
          />
        </div>
        <button onClick={submit} style={{ ...ghostButtonStyle, background: 'var(--copper)', color: '#3C2E22', border: 'none', fontWeight: 500 }}>
          Leave note
        </button>
      </Card>

      <Card>
        <SectionLabel>Notes</SectionLabel>
        {notes.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing left for the next shift.</div>
        ) : (
          notes.map((n) => (
            <div key={n.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                <span>{n.author}</span>
                <span>{fmtTime(n.timestamp)}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-ivory)', marginBottom: 6 }}>{n.note}</div>
              {n.acknowledgedBy ? (
                <div style={{ fontSize: 11, color: 'var(--status-green)' }}>✓ Acknowledged by {n.acknowledgedBy}</div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    placeholder="Your name to acknowledge"
                    value={ackName}
                    onChange={(e) => setAckName(e.target.value)}
                    style={{ ...inputStyleShared, fontSize: 12, padding: '6px 8px', flex: 1 }}
                  />
                  <button
                    onClick={() => {
                      if (!ackName.trim()) return;
                      acknowledge(n.id, ackName.trim());
                      setAckName('');
                    }}
                    style={{ ...ghostButtonStyle, width: 'auto', marginTop: 0, padding: '6px 12px', fontSize: 11 }}
                  >
                    Acknowledge
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function SopLibrary({ sops, addSop, removeSop }) {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({ title: '', category: '', stepsText: '' });

  function submit() {
    if (!form.title.trim()) return;
    addSop({
      title: form.title,
      category: form.category || 'General',
      steps: form.stepsText.split('\n').map((s) => s.trim()).filter(Boolean),
    });
    setForm({ title: '', category: '', stepsText: '' });
    setShowForm(false);
  }

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showForm ? 12 : 0 }}>
          <SectionLabel>SOP library</SectionLabel>
          <button onClick={() => setShowForm((v) => !v)} style={{ ...ghostButtonStyle, width: 'auto', marginTop: 0, padding: '6px 12px', fontSize: 11 }}>
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        </div>
        {showForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={{ ...inputStyleShared, fontSize: 13, padding: '8px 10px' }} />
            <input placeholder="Category (e.g. Coffee, Food safety)" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={{ ...inputStyleShared, fontSize: 13, padding: '8px 10px' }} />
            <textarea
              placeholder="One step per line"
              value={form.stepsText}
              onChange={(e) => setForm((f) => ({ ...f, stepsText: e.target.value }))}
              style={{ ...inputStyleShared, fontSize: 13, padding: '8px 10px', minHeight: 90, resize: 'vertical' }}
            />
            <button onClick={submit} style={{ ...ghostButtonStyle, background: 'var(--copper)', color: '#3C2E22', border: 'none', fontWeight: 500 }}>
              Add SOP
            </button>
          </div>
        )}
      </Card>

      {sops.map((sop) => {
        const isOpen = expandedId === sop.id;
        return (
          <Card key={sop.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpandedId(isOpen ? null : sop.id)}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{sop.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sop.category}</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {sop.steps.map((step, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>
                      {step}
                    </li>
                  ))}
                </ol>
                <button
                  onClick={() => removeSop(sop.id)}
                  style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, padding: '6px 10px', borderRadius: 8, marginTop: 8 }}
                >
                  Remove SOP
                </button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Staff({ staff, addStaffMember, removeStaffMember }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', role: 'Staff' });

  function submit() {
    if (!form.name.trim()) return;
    addStaffMember({ name: form.name, role: form.role });
    setForm({ name: '', role: 'Staff' });
    setShowForm(false);
  }

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showForm ? 12 : 0 }}>
          <SectionLabel>Staff</SectionLabel>
          <button onClick={() => setShowForm((v) => !v)} style={{ ...ghostButtonStyle, width: 'auto', marginTop: 0, padding: '6px 12px', fontSize: 11 }}>
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        </div>
        {showForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ ...inputStyleShared, fontSize: 13, padding: '8px 10px' }} />
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} style={{ ...inputStyleShared, fontSize: 13, padding: '8px 10px' }}>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button onClick={submit} style={{ ...ghostButtonStyle, background: 'var(--copper)', color: '#3C2E22', border: 'none', fontWeight: 500 }}>
              Add staff member
            </button>
          </div>
        )}
      </Card>

      {staff.length === 0 ? (
        <Card>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No staff added yet.</div>
        </Card>
      ) : (
        staff.map((member) => (
          <Card key={member.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{member.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{member.role}</div>
              </div>
              <button
                onClick={() => removeStaffMember(member.id)}
                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, padding: '6px 10px', borderRadius: 8 }}
              >
                Remove
              </button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
