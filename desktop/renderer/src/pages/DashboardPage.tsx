import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AppMode, LogEntry, SwipeProgress } from "../../../shared/types.js";
import { BRAND } from "../constants/branding";
import { PageShell } from "../components/PageShell";
import { useSound } from "../context/SoundContext";
import { useSessionResult } from "../context/SessionContext.js";

const MODES: Array<{ mode: AppMode; label: string; description: string }> = [
  { mode: "tinder-swipe", label: "Swipe Tinder", description: "Swipes con filtro AI" },
  { mode: "tinder-chat", label: "Chat Tinder", description: "Responder conversaciones" },
  { mode: "bumble-swipe", label: "Swipe Bumble", description: "Swipes en Bumble" },
  { mode: "tinder-swipe-chat", label: "Swipe + Chat", description: "Swipes con pausas de chat" },
  { mode: "tinder-analisis", label: "Análisis", description: "Sync + informe AI" },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const { setLastResult } = useSessionResult();
  const { play } = useSound();
  const [selectedMode, setSelectedMode] = useState<AppMode>("tinder-swipe");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState<SwipeProgress | null>(null);
  const [bootstrap, setBootstrap] = useState<{ chromium: boolean; ollama: boolean } | null>(null);
  const lastMatchesRef = useRef(0);

  const refreshBootstrap = () => {
    window.cupibot.checkBootstrap().then(setBootstrap);
  };

  useEffect(() => {
    refreshBootstrap();

    const unsubscribe = window.cupibot.onBootstrapProgress((p) => {
      if (p.step === "complete") {
        refreshBootstrap();
      }
    });

    const unsubLog = window.cupibot.onLog((entry) => {
      setLogs((prev) => [...prev.slice(-500), { ...entry, ts: new Date(entry.ts) }]);
    });
    const unsubProgress = window.cupibot.onProgress((value) => {
      setProgress(value);

      if (value.stats.matches > lastMatchesRef.current) {
        lastMatchesRef.current = value.stats.matches;
        play("notify");
      }
    });
    const unsubComplete = window.cupibot.onComplete((result) => {
      setRunning(false);
      setLastResult(result);
      play(result.ok ? "success" : "error");
      navigate("/summary");
    });

    return () => {
      unsubscribe();
      unsubLog();
      unsubProgress();
      unsubComplete();
    };
  }, [navigate, play, setLastResult]);

  const selectMode = (mode: AppMode) => {
    if (running) {
      return;
    }

    setSelectedMode(mode);
    play("select");
  };

  const start = async () => {
    setLogs([]);
    setProgress(null);
    lastMatchesRef.current = 0;
    setRunning(true);
    play("start");

    try {
      await window.cupibot.runCupiBot(selectedMode);
    } catch (error) {
      setRunning(false);
      play("error");
      setLogs((prev) => [
        ...prev,
        {
          level: "error",
          tag: BRAND.name,
          message: error instanceof Error ? error.message : String(error),
          ts: new Date(),
        },
      ]);
    }
  };

  const stop = () => {
    play("stop");
    window.cupibot.abortCupiBot();
  };

  const progressPercent = progress
    ? Math.round((progress.current / Math.max(progress.max, 1)) * 100)
    : 0;

  return (
    <PageShell
      title="Ejecutar CupiBot"
      subtitle="Elige un modo, inicia la sesión y sigue el progreso en tiempo real."
      hero={BRAND.banner2}
      heroClassName="page-hero page-hero--center"
    >
      <div className="card card-glow">
        <h3>Estado del sistema</h3>
        <div className="status-row">
          <span className={`status-pill ${bootstrap?.chromium ? "ok" : "bad"}`}>
            <span className="status-dot" />
            Chromium {bootstrap?.chromium ? "listo" : "pendiente"}
          </span>
          <span className={`status-pill ${bootstrap?.ollama ? "ok" : "bad"}`}>
            <span className="status-dot" />
            Ollama {bootstrap?.ollama ? "listo" : "pendiente"}
          </span>
        </div>
      </div>

      <div className={`card ${running ? "card-running" : ""}`}>
        <h3>Modo de ejecución</h3>
        <div className="mode-grid">
          {MODES.map((item) => (
            <div
              key={item.mode}
              className={`mode-card ${selectedMode === item.mode ? "selected" : ""}`}
              onClick={() => selectMode(item.mode)}
            >
              <strong>{item.label}</strong>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          <button onClick={start} disabled={running}>
            {running ? "Ejecutando..." : "Iniciar sesión"}
          </button>
          <button className="danger" onClick={stop} disabled={!running}>
            Detener
          </button>
        </div>
      </div>

      {progress && (
        <div className="card">
          <h3>Progreso en vivo</h3>
          <div className="swipe-progress">
            <div className="swipe-progress-meta">
              <span>{progress.current}/{progress.max} swipes</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <p style={{ marginTop: 12, color: "var(--brand-text-muted)", fontSize: "0.9rem" }}>
              Likes {progress.stats.likes} · Matches {progress.stats.matches} · Filtrados {progress.stats.filtered}
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Logs en vivo</h3>
        <div className="log-panel">
          {logs.length === 0 && (
            <div className="log-line" style={{ color: "var(--brand-text-muted)" }}>
              Los logs de la sesión aparecerán aquí cuando inicies CupiBot.
            </div>
          )}
          {logs.map((entry, index) => (
            <div key={`${entry.ts.toISOString()}-${index}`} className={`log-line ${entry.level}`}>
              [{entry.tag}] {entry.message}
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
