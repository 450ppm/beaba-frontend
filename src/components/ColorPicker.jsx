import './ColorPicker.css';

const PALETTE = [
  '#4A90D9', '#F5A623', '#7B68EE', '#50C878',
  '#FF6B6B', '#20B2AA', '#FF69B4', '#DEB887',
];

export default function ColorPicker({ value, onChange }) {
  return (
    <div className="color-picker">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          className={`color-swatch ${value === color ? 'selected' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
          aria-label={color}
        />
      ))}
    </div>
  );
}
