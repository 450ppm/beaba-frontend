import './ChartToggle.css';

export default function ChartToggle({ options, active, onChange }) {
  return (
    <div className="chart-toggle">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`chart-toggle-btn ${active === opt.value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
