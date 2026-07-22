import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AppMode, LogEntry, SwipeProgress } from "../../../shared/types.js";
import type { BrowserSessionStatus } from "../../../shared/ipc.js";
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

const LOGIN_PLATFORMS: Array<{ id: keyof BrowserSessionStatus; label: string }> = [
  { id: "tinder", label: "Tinder" },
  { id: "bumble", label: "Bumble" },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const { setLastResult } = useSessionResult();
  const { play } = useSound();
  const [selectedMode, setSelectedMode] = useState<AppMode>("tinder-swipe");
  const [loginPlatform, setLoginPlatform] = useState<keyof BrowserSessionStatus>("tinder");
  const [running, setRunning] = useState(false);
  const [loginRunning, setLoginRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState<SwipeProgress | null>(null);
  const [bootstrap, setBootstrap] = useState<{ chromium: boolean; ollama: boolean } | null>(null);
  const [browserSessions, setBrowserSessions] = useState<BrowserSessionStatus | null>(null);
  const lastMatchesRef = useRef(0);

  const refreshBootstrap = () => {
    window.cupibot.checkBootstrap().then(setBootstrap);
  };

  const refreshBrowserSessions = () => {
    window.cupibot.getBrowserSessionStatus().then(setBrowserSessions);
  };

  useEffect(() => {
    refreshBootstrap();
    refreshBrowserSessions();

    const unsubscribe = window.cupibot.onBootstrapProgress((p) => {
      if (p.step === "complete") {
        refreshBootstrap();
      }
    });

    const unsubLoginComplete = window.cupibot.onBrowserLoginComplete(() => {
      setLoginRunning(false);
      refreshBrowserSessions();
      play("success");
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
      unsubLoginComplete();
      unsubLog();
      unsubProgress();
      unsubComplete();
    };
  }, [navigate, play, setLastResult]);

  const selectMode = (mode: AppMode) => {
    if (running || loginRunning) {
      return;
    }

    setSelectedMode(mode);
    play("select");
  };

  const selectLoginPlatform = (platform: keyof BrowserSessionStatus) => {
    if (running || loginRunning) {
      return;
    }

    setLoginPlatform(platform);
    play("select");
  };

  const startBrowserLogin = async () => {
    setLogs([]);
    setLoginRunning(true);
    play("start");

    try {
      await window.cupibot.runBrowserLogin(loginPlatform);
    } catch (error) {
      setLoginRunning(false);
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

  const finishBrowserLogin = () => {
    play("stop");
    window.cupibot.abortCupiBot();
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
      subtitle="Primero inicia sesión en Tinder o Bumble (solo una vez). Luego elige un modo y ejecuta."
      hero={BRAND.banner2}
      heroClassName="page-hero page-hero--center"
    >
      <div className="card card-glow">
        <h3>Iniciar sesión en Tinder / Bumble</h3>
        <p className="login-help">
          Solo necesitas hacerlo la primera vez. CupiBot abrirá Chromium para que inicies sesión
          manualmente y guarde tu cuenta para las próximas ejecuciones.
        </p>
        <div className="status-row" style={{ marginBottom: 14 }}>
          <span className={`status-pill ${browserSessions?.tinder ? "ok" : "bad"}`}>
            <span className="status-dot" />
            Tinder {browserSessions?.tinder ? "sesión guardada" : "sin sesión"}
          </span>
          <span className={`status-pill ${browserSessions?.bumble ? "ok" : "bad"}`}>
            <span className="status-dot" />
            Bumble {browserSessions?.bumble ? "sesión guardada" : "sin sesión"}
          </span>
        </div>
        <div className="mode-grid login-platform-grid">
          {LOGIN_PLATFORMS.map((item) => (
            <div
              key={item.id}
              className={`mode-card ${loginPlatform === item.id ? "selected" : ""}`}
              onClick={() => selectLoginPlatform(item.id)}
            >
              <strong>{item.label}</strong>
              <p>Iniciar sesión aquí</p>
            </div>
          ))}
        </div>
        {loginRunning ? (
          <p className="login-active-hint">
            Inicia sesión en la ventana de Chromium. Cuando termines, pulsa <strong>Listo</strong>.
          </p>
        ) : null}
        <div className="actions" style={{ marginTop: 14 }}>
          <button
            className="secondary"
            onClick={startBrowserLogin}
            disabled={running || loginRunning}
          >
            {loginRunning ? "Esperando login..." : "Iniciar sesión"}
          </button>
          <button onClick={finishBrowserLogin} disabled={!loginRunning}>
            Listo
          </button>
        </div>
      </div>

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
          <button onClick={start} disabled={running || loginRunning}>
            {running ? "Ejecutando..." : "Ejecutar"}
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
