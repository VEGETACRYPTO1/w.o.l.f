import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface WakeContextType {
  awake: boolean;
  transitioning: "waking" | "sleeping" | null;
  wake: () => void;
  sleep: () => void;
}

const WakeContext = createContext<WakeContextType | undefined>(undefined);

const STORAGE_KEY = "wolf-awake";

export function WakeProvider({ children }: { children: React.ReactNode }) {
  const [awake, setAwake] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [transitioning, setTransitioning] = useState<"waking" | "sleeping" | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, awake ? "1" : "0");
    } catch {}
  }, [awake]);

  const wake = useCallback(() => {
    if (awake || transitioning) return;
    setTransitioning("waking");
    // burst → fade in UI
    setTimeout(() => {
      setAwake(true);
      setTimeout(() => setTransitioning(null), 1200);
    }, 700);
  }, [awake, transitioning]);

  const sleep = useCallback(() => {
    if (!awake || transitioning) return;
    setTransitioning("sleeping");
    // fade UI out, then unmount
    setTimeout(() => {
      setAwake(false);
      setTimeout(() => setTransitioning(null), 600);
    }, 700);
  }, [awake, transitioning]);

  return (
    <WakeContext.Provider value={{ awake, transitioning, wake, sleep }}>
      {children}
    </WakeContext.Provider>
  );
}

export function useWake() {
  const ctx = useContext(WakeContext);
  if (!ctx) throw new Error("useWake must be used within WakeProvider");
  return ctx;
}
