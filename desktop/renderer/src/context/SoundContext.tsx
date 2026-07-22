import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { soundManager, type SoundId } from "../services/sounds";

interface SoundContextValue {
  enabled: boolean;
  toggle: () => void;
  play: (id: SoundId) => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(soundManager.isEnabled());

  const toggle = useCallback(() => {
    const next = !soundManager.isEnabled();

    soundManager.setEnabled(next);
    setEnabled(next);

    if (next) {
      soundManager.play("toggle");
    }
  }, []);

  const play = useCallback((id: SoundId) => {
    soundManager.play(id);
  }, []);

  const value = useMemo(() => ({ enabled, toggle, play }), [enabled, toggle, play]);

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() {
  const context = useContext(SoundContext);

  if (!context) {
    throw new Error("useSound must be used within SoundProvider");
  }

  return context;
}
