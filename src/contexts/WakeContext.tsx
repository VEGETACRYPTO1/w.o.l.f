import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type WakePhase = "sleeping" | "waking" | "awake" | "sleeping-out";

interface WakeContextValue {
  phase: WakePhase;
  wake: () => void;
  sleep: () => void;
  setPhase: (p: WakePhase) => void;
}

const WakeContext = createContext<WakeContextValue | null>(null);

const STORAGE_KEY = "wolf:wake-phase";

export function WakeProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhaseState] = useState<WakePhase>(() => {
    if (typeof window === "undefined") return "sleeping";
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "awake" ? "awake" : "sleeping";
  });

  const setPhase = useCallback((p: WakePhase) => {
    setPhaseState(p);
  }, []);

  useEffect(() => {
    if (phase === "awake" || phase === "sleeping") {
      localStorage.setItem(STORAGE_KEY, phase);
    }
  }, [phase]);

  const wake = useCallback(() => {
    setPhaseState((cur) => (cur === "sleeping" ? "waking" : cur));
    // Charge 1.0s + flash 0.15s + crossfade with brain 1.2s = 2.4s total
    window.setTimeout(() => {
      setPhaseState((cur) => (cur === "waking" ? "awake" : cur));
    }, 2400);
  }, []);

  const sleep = useCallback(() => {
    setPhaseState((cur) => (cur === "awake" ? "sleeping-out" : cur));
    import("@/lib/wolfVoice").then((m) => {
      try { m.stopHandsFree(); } catch {}
    }).catch(() => {});
    // Long enough for the spiral suction to fully play out (2.7s)
    window.setTimeout(() => {
      setPhaseState((cur) => (cur === "sleeping-out" ? "sleeping" : cur));
    }, 2700);
  }, []);

  return (
    <WakeContext.Provider value={{ phase, wake, sleep, setPhase }}>
      {children}
    </WakeContext.Provider>
  );
}

export function useWake() {
  const ctx = useContext(WakeContext);
  if (!ctx) throw new Error("useWake must be used within WakeProvider");
  return ctx;
}
