import { useState, useEffect, useMemo } from 'react';

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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- default data ----------

const OPENING_TEMPLATE = [
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

const CLOSING_TEMPLATE = [
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

const DEFAULT_PRODUCTS = [
  { id: 'oat-milk', name: 'Oat milk', category: 'Alternative milk', supplier: 'Musgrave', unit: 'case', par: 12, current: 4.5, cost: 22.5 },
  { id: 'whole-milk', name: 'Whole milk', category: 'Milk', supplier: 'Musgrave', unit: 'case', par: 8, current: 6, cost: 14 },
  { id: '12oz-cups', name: '12oz cups', category: 'Packaging', supplier: 'Musgrave', unit: 'case', par: 6, current: 1.4, cost: 38 },
  { id: 'lids', name: '12oz lids', category: 'Packaging', supplier: 'Musgrave', unit: 'case', par: 6, current: 5, cost: 22 },
  { id: 'napkins', name: 'Napkins', category: 'Packaging', supplier: 'Musgrave', unit: 'case', par: 4, current: 3, cost: 12 },
];

function defaultState() {
  return {
    tasks: {},
    haccpDevices: DEFAULT_HACCP_DEVICES,
    haccpReadings: [],
    coffees: [DEFAULT_COFFEE],
    dialIns: [],
    products: DEFAULT_PRODUCTS,
    waste: [],
    orders: [],
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

// ---------- app ----------

export default function App() {
  const [data, setData] = useState(() => loadState() || defaultState());
  const [tab, setTab] = useState('today');
  const [opsSubTab, setOpsSubTab] = useState('opening');

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

  const openingProgress = progressFor(OPENING_TEMPLATE, 'opening');
  const closingProgress = progressFor(CLOSING_TEMPLATE, 'closing');

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
    setData((d) => ({ ...d, products: d.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
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

  function markOrdered(supplier, itemIds) {
    const entry = { id: uid(), supplier, itemIds, timestamp: Date.now() };
    setData((d) => ({ ...d, orders: [entry, ...d.orders] }));
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
  const missedOpening = OPENING_TEMPLATE.flatMap((cat) => cat.tasks).length - openingProgress.done;
  const now = new Date();
  if (missedOpening > 0 && now.getHours() >= 10) {
    attentionItems.push(`${missedOpening} opening task${missedOpening > 1 ? 's' : ''} still outstanding`);
  }
  lowStockProducts.forEach((p) => attentionItems.push(`${p.name} below par`));

  const [stockSubTab, setStockSubTab] = useState('live');

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 60 }}>
      <Header dateKey={dateKey} />
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
            devices={data.haccpDevices}
            readings={data.haccpReadings}
            latestReadings={latestReadings}
            addHaccpReading={addHaccpReading}
            setCorrectiveAction={setCorrectiveAction}
          />
        )}

        {tab === 'coffee' && (
          <CoffeeScreen coffees={data.coffees} dialIns={data.dialIns} addDialIn={addDialIn} />
        )}

        {tab === 'stock' && (
          <StockScreen
            subTab={stockSubTab}
            setSubTab={setStockSubTab}
            products={data.products}
            waste={data.waste}
            orders={data.orders}
            addProduct={addProduct}
            updateProduct={updateProduct}
            removeProduct={removeProduct}
            setStockCount={setStockCount}
            logWaste={logWaste}
            markOrdered={markOrdered}
          />
        )}
      </div>
    </div>
  );
}

// ---------- header + nav ----------

function Header({ dateKey }) {
  const d = new Date(dateKey);
  const dateLabel = d.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  return (
    <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, letterSpacing: 1, color: 'var(--copper)', fontWeight: 500 }}>FDC OPERATIONS</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, color: 'var(--text-ivory)', lineHeight: 1.1, marginTop: 2 }}>
        Café Hub
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
    { id: 'coffee', label: 'Coffee' },
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

function TodayScreen({ attentionItems, openingProgress, closingProgress, latestReadings, devices, coffee, latestDialIn, lowStockProducts, goToOps, goToCoffee, goToStock }) {
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

function OperationsScreen({ subTab, setSubTab, todaysTasks, setTaskStatus, devices, readings, latestReadings, addHaccpReading, setCorrectiveAction }) {
  const subTabs = [
    { id: 'opening', label: 'Opening' },
    { id: 'closing', label: 'Closing' },
    { id: 'haccp', label: 'HACCP' },
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

      {subTab === 'opening' && (
        <Checklist listType="opening" template={OPENING_TEMPLATE} todaysTasks={todaysTasks} setTaskStatus={setTaskStatus} />
      )}
      {subTab === 'closing' && (
        <Checklist listType="closing" template={CLOSING_TEMPLATE} todaysTasks={todaysTasks} setTaskStatus={setTaskStatus} />
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

// ---------- COFFEE ----------

function CoffeeScreen({ coffees, dialIns, addDialIn }) {
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
    <div style={{ paddingTop: 14 }}>
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

function StockScreen({ subTab, setSubTab, products, waste, orders, addProduct, updateProduct, removeProduct, setStockCount, logWaste, markOrdered }) {
  const subTabs = [
    { id: 'live', label: 'Live' },
    { id: 'count', label: 'Count' },
    { id: 'orders', label: 'Orders' },
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
                onClick={() => markOrdered(supplier, items.map((p) => p.id))}
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
            <div key={o.id} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              {fmtTime(o.timestamp)} — {o.supplier} ({o.itemIds.length} item{o.itemIds.length === 1 ? '' : 's'})
            </div>
          ))}
        </Card>
      )}
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
            <button
              onClick={() => removeProduct(p.id)}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, padding: '6px 10px', borderRadius: 8 }}
            >
              Remove
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
