import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { onModeChange, setVoiceMode, type VoiceMode } from "@/lib/wolfVoice";
import { emitModeBurst } from "@/lib/brainEvents";

const MODE_BURST_COLORS: Record<string, string> = {
  intelligence: "#FFD36B",
  war: "#ef4444",
  relax: "#00ffcc",
  rebuild: "#4090e0",
  expansion: "#40b870",
};

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
  const lastModeRef = useRef<Mode>("intelligence");

  // On mount: default to intelligence
  useEffect(() => {
    localStorage.removeItem("jarvis-mode");
    document.documentElement.setAttribute("data-mode", "intelligence");
  }, []);

  const setMode = useCallback((newMode: Mode) => {
    if (lastModeRef.current !== newMode) {
      lastModeRef.current = newMode;
      emitModeBurst(MODE_BURST_COLORS[newMode] || "#FFD36B");
    }
    setModeState(newMode);
    localStorage.setItem("jarvis-mode", newMode);
    document.documentElement.setAttribute("data-mode", newMode);
    // Sync voice system (CSS vars, body classes, globe)
    const voiceModes: VoiceMode[] = ["intelligence", "war", "relax"];
    if (voiceModes.includes(newMode as VoiceMode)) {
      setVoiceMode(newMode as VoiceMode);
    }
  }, []);

  // Bridge voice system mode changes to React state (voice-initiated only)
  useEffect(() => {
    onModeChange((voiceMode) => {
      if (voiceMode === "intelligence" || voiceMode === "war" || voiceMode === "relax") {
        if (lastModeRef.current !== voiceMode) {
          lastModeRef.current = voiceMode as Mode;
          emitModeBurst(MODE_BURST_COLORS[voiceMode] || "#FFD36B");
        }
        setModeState(voiceMode);
        document.documentElement.setAttribute("data-mode", voiceMode);
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
