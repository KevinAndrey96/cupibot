import type { BootstrapProgress } from "../../../shared/bootstrap-progress.js";

interface BootstrapProgressBarProps {
  progress: BootstrapProgress | null;
}

export function BootstrapProgressBar({ progress }: BootstrapProgressBarProps) {
  if (!progress || progress.step === "complete") {
    return null;
  }

  const showPercent = progress.percent !== null;

  return (
    <div className="bootstrap-progress card">
      <div className="bootstrap-progress-header">
        <strong>Instalando dependencias</strong>
        {showPercent && <span className="bootstrap-progress-percent">{progress.percent}%</span>}
      </div>
      <p className="bootstrap-progress-message">{progress.message}</p>
      <div className="progress-track" aria-hidden="true">
        {showPercent ? (
          <div
            className="progress-fill"
            style={{ width: `${progress.percent}%` }}
          />
        ) : (
          <div className="progress-fill indeterminate" />
        )}
      </div>
    </div>
  );
}
