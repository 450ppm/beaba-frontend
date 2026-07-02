import './StepIndicator.css';

const STEPS = ['Preparation', 'Compteurs', 'Pieces', 'Temp', 'CO2', 'Prises', 'Resume'];

export default function StepIndicator({ current, editMode = false }) {
  // En mode edition on n'affiche pas Preparation / Compteurs : la config
  // demarre a l'etape Pieces (numero 3), on decale donc l'index de base.
  const base = editMode ? 3 : 1;
  const visible = editMode ? STEPS.slice(2) : STEPS;
  return (
    <div className="step-indicator">
      {visible.map((label, i) => {
        const stepNum = base + i;
        const isCompleted = stepNum < current;
        const isCurrent = stepNum === current;
        return (
          <div key={label} className="step-item">
            {i > 0 && (
              <div className={`step-line ${stepNum <= current ? 'active' : ''}`} />
            )}
            <div
              className={`step-circle ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}`}
            >
              {isCompleted ? '\u2713' : stepNum}
            </div>
            <div className={`step-label ${isCurrent ? 'current' : ''}`}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
