import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { onModeChange } from "@/lib/wolfVoice";

export type Mode = "intelligence" | "war" | "rebuild" | "expansion" | "relax";

interface ModeConfig {
  label: string;
  description: string;
  icon: string;
  tone: string;
}

export const MODE_CONFIGS: Record<Mode, ModeConfig> = {
  intelligence: {
    label: "Intelligence Mode",
    description: "Cold data. Precise answers. No noise.",
    icon: "🧠",
    tone: "Factual, minimal, system-like. Data only.",
  },
  war: {
    label: "War Mode",
    description: "Maximum intensity. No distractions. Execute.",
    icon: "⚔️",
    tone: "Direct, aggressive, no-nonsense. Push harder.",
  },
  rebuild: {
    label: "Rebuild Mode",
    description: "Recovery & strategic planning. Reset and reload.",
    icon: "🔧",
    tone: "Calm, analytical, methodical. Focus on systems.",
  },
  expansion: {
    label: "Expansion Mode",
    description: "Growth & creativity. Explore new territory.",
    icon: "🌱",
    tone: "Encouraging, creative, forward-thinking. Think bigger.",
  },
  relax: {
    label: "Relax Mode",
    description: "Balanced, calm, sustainable progress.",
    icon: "🧘",
    tone: "Calm, supportive, balanced. Sustainable pace.",
  },
};

interface ModeContextType {
  mode: Mode;
  setMode: (mode: Mode) => void;
  config: ModeConfig;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>("intelligence");

  // On mount: default to intelligence
  useEffect(() => {
    localStorage.removeItem("jarvis-mode");
    document.documentElement.setAttribute("data-mode", "intelligence");
  }, []);

  const setMode = useCallback((newMode: Mode) => {
    setModeState(newMode);
    localStorage.setItem("jarvis-mode", newMode);
    document.documentElement.setAttribute("data-mode", newMode);
  }, []);

  // Bridge voice system mode changes to React state
  useEffect(() => {
    onModeChange((voiceMode) => {
      if (voiceMode === "intelligence" || voiceMode === "war" || voiceMode === "relax") {
        setModeState(voiceMode);
      }
    });
  }, []);

  return (
    <ModeContext.Provider value={{ mode, setMode, config: MODE_CONFIGS[mode] }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
}
