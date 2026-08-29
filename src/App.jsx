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

function defaultState() {
  return {
    tasks: {},
    haccpDevices: DEFAULT_HACCP_DEVICES,
    haccpReadings: [],
    coffees: [DEFAULT_COFFEE],
    dialIns: [],
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

  const attentionItems = [];
  if (openHaccpExceptions.length > 0) {
    attentionItems.push(`${openHaccpExceptions.length} HACCP reading${openHaccpExceptions.length > 1 ? 's' : ''} outside range, unresolved`);
  }
  const missedOpening = OPENING_TEMPLATE.flatMap((cat) => cat.tasks).length - openingProgress.done;
  const now = new Date();
  if (missedOpening > 0 && now.getHours() >= 10) {
    attentionItems.push(`${missedOpening} opening task${missedOpening > 1 ? 's' : ''} still outstanding`);
  }

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
            goToOps={(subtab) => {
              setTab('operations');
              setOpsSubTab(subtab);
            }}
            goToCoffee={() => setTab('coffee')}
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

function TodayScreen({ attentionItems, openingProgress, closingProgress, latestReadings, devices, coffee, latestDialIn, goToOps, goToCoffee }) {
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
