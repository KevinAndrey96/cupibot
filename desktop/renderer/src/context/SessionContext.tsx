import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type { AppMode, LogEntry, RunCupiBotResult, SwipeProgress } from "../../../shared/types.js";
import type { BrowserSessionStatus } from "../../../shared/ipc.js";
import { useSound } from "./SoundContext";

const MAX_LOGS = 500;

interface SessionContextValue {
  lastResult: RunCupiBotResult | null;
  logs: LogEntry[];
  clearLogs: () => void;
  appendLog: (entry: Omit<LogEntry, "ts"> & { ts?: Date }) => void;
  running: boolean;
  setRunning: (running: boolean) => void;
  loginRunning: boolean;
  setLoginRunning: (running: boolean) => void;
  progress: SwipeProgress | null;
  setProgress: (progress: SwipeProgress | null) => void;
  resetRunTracking: () => void;
  selectedMode: AppMode;
  setSelectedMode: (mode: AppMode) => void;
  loginPlatform: keyof BrowserSessionStatus;
  setLoginPlatform: (platform: keyof BrowserSessionStatus) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { play } = useSound();
  const [lastResult, setLastResult] = useState<RunCupiBotResult | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [loginRunning, setLoginRunning] = useState(false);
  const [progress, setProgress] = useState<SwipeProgress | null>(null);
  const [selectedMode, setSelectedMode] = useState<AppMode>("tinder-swipe");
  const [loginPlatform, setLoginPlatform] = useState<keyof BrowserSessionStatus>("tinder");
  const lastMatchesRef = useRef(0);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const appendLog = useCallback((entry: Omit<LogEntry, "ts"> & { ts?: Date }) => {
    setLogs((prev) => [
      ...prev.slice(-(MAX_LOGS - 1)),
      { ...entry, ts: entry.ts ?? new Date() },
    ]);
  }, []);

  const resetRunTracking = useCallback(() => {
    setProgress(null);
    lastMatchesRef.current = 0;
  }, []);

  useEffect(() => {
    if (!window.cupibot?.onLog) {
      return;
    }

    const unsubLog = window.cupibot.onLog((entry) => {
      setLogs((prev) => [
        ...prev.slice(-(MAX_LOGS - 1)),
        { ...entry, ts: new Date(entry.ts) },
      ]);
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

    const unsubLoginComplete = window.cupibot.onBrowserLoginComplete(() => {
      setLoginRunning(false);
      play("success");
    });

    return () => {
      unsubLog();
      unsubProgress();
      unsubComplete();
      unsubLoginComplete();
    };
  }, [navigate, play]);

  const value = useMemo(
    () => ({
      lastResult,
      logs,
      clearLogs,
      appendLog,
      running,
      setRunning,
      loginRunning,
      setLoginRunning,
      progress,
      setProgress,
      resetRunTracking,
      selectedMode,
      setSelectedMode,
      loginPlatform,
      setLoginPlatform,
    }),
    [
      lastResult,
      logs,
      clearLogs,
      appendLog,
      running,
      loginRunning,
      progress,
      resetRunTracking,
      selectedMode,
      loginPlatform,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }

  return context;
}

export function useSessionResult() {
  const { lastResult } = useSession();

  return { lastResult };
}
