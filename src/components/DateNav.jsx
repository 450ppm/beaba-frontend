import { useMemo } from 'react';
import './DateNav.css';

const PERIODS = [
  { id: 'day', label: 'Jour' },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDate(d) {
  return startOfDay(d).toISOString().slice(0, 10);
}

function isSameDay(a, b) {
  return isoDate(a) === isoDate(b);
}

// Lundi de la semaine de la date (ISO : la semaine commence le lundi).
function startOfIsoWeek(d) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // 0 = lundi
  x.setDate(x.getDate() - day);
  return x;
}

function endOfIsoWeek(d) {
  const s = startOfIsoWeek(d);
  s.setDate(s.getDate() + 6);
  return s;
}

function startOfMonth(d) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function endOfMonth(d) {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0); // dernier jour du mois precedent = dernier jour du mois cible
  return x;
}

/* Calcule la fenetre [from, to] pour une vue donnee. */
export function viewWindow({ date, period }) {
  if (period === 'week') {
    return { from: startOfIsoWeek(date), to: endOfIsoWeek(date) };
  }
  if (period === 'month') {
    return { from: startOfMonth(date), to: endOfMonth(date) };
  }
  return { from: startOfDay(date), to: startOfDay(date) };
}

/* La vue couvre-t-elle aujourd'hui (donc on garde le live) ? */
export function isLiveView({ date, period }) {
  const now = new Date();
  const w = viewWindow({ date, period });
  return now >= w.from && now <= new Date(w.to.getTime() + 86399999);
}

function formatLabel({ date, period }) {
  const w = viewWindow({ date, period });
  const fmtShort = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' });
  const fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
  const fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  if (period === 'week') {
    return `Semaine du ${fmtShort.format(w.from)} → ${fmtShort.format(w.to)}`;
  }
  if (period === 'month') {
    return fmtMonth.format(w.from).replace(/^./, (c) => c.toUpperCase());
  }
  const today = startOfDay(new Date());
  if (isSameDay(w.from, today)) return `Aujourd'hui · ${fmtLong.format(w.from)}`;
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (isSameDay(w.from, yest)) return `Hier · ${fmtLong.format(w.from)}`;
  return fmtLong.format(w.from).replace(/^./, (c) => c.toUpperCase());
}

export default function DateNav({ view, onChange }) {
  const { date, period } = view;

  const step = useMemo(() => {
    if (period === 'week') return 7;
    if (period === 'month') return 'month';
    return 1;
  }, [period]);

  const shift = (delta) => {
    const next = new Date(date);
    if (step === 'month') {
      next.setMonth(next.getMonth() + delta);
    } else {
      next.setDate(next.getDate() + delta * step);
    }
    onChange({ ...view, date: next });
  };

  const setToday = () => onChange({ ...view, date: new Date() });

  const onDatePick = (e) => {
    const v = e.target.value;
    if (!v) return;
    const [y, m, d] = v.split('-').map(Number);
    onChange({ ...view, date: new Date(y, m - 1, d) });
  };

  const setPeriod = (p) => onChange({ ...view, period: p });

  const today = startOfDay(new Date());
  const window = viewWindow(view);
  const isFuture = window.to >= today;

  return (
    <div className="dn-wrap" role="toolbar" aria-label="Selection de la periode">
      <div className="dn-period">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`dn-period-btn ${period === p.id ? 'active' : ''}`}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="dn-nav">
        <button type="button" className="dn-arrow" onClick={() => shift(-1)} aria-label="Periode precedente">‹</button>
        <span className="dn-label">{formatLabel(view)}</span>
        <button
          type="button"
          className="dn-arrow"
          onClick={() => shift(1)}
          disabled={isFuture}
          aria-label="Periode suivante"
        >›</button>
      </div>

      <div className="dn-tools">
        <input
          type="date"
          className="dn-picker"
          value={isoDate(date)}
          max={isoDate(today)}
          onChange={onDatePick}
        />
        <button
          type="button"
          className="dn-today"
          onClick={setToday}
          disabled={isLiveView(view) && period === 'day'}
        >
          Aujourd'hui
        </button>
      </div>
    </div>
  );
}
