import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { RunCupiBotResult } from "../../../shared/types.js";

interface SessionContextValue {
  lastResult: RunCupiBotResult | null;
  setLastResult: (result: RunCupiBotResult | null) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [lastResult, setLastResult] = useState<RunCupiBotResult | null>(null);
  const value = useMemo(() => ({ lastResult, setLastResult }), [lastResult]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionResult() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSessionResult must be used within SessionProvider");
  }

  return context;
}
