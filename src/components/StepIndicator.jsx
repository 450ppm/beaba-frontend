import './StepIndicator.css';

const STEPS = ['Preparation', 'Pieces', 'Temp', 'CO2', 'Prises', 'Resume'];

export default function StepIndicator({ current }) {
  return (
    <div className="step-indicator">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
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
