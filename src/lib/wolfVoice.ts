// ==========================
// 🐺 W.O.L.F CORE — RESEMBLE AI VOICE
// ==========================

export type VoiceMode = "intelligence" | "war" | "relax";

const RESEMBLE_API_KEY = import.meta.env.VITE_RESEMBLE_API_KEY || "";
const RESEMBLE_VOICE_UUID = "aa8053cc";
const RESEMBLE_URL = "https://p.cluster.resemble.ai/synthesize";

let onModeChangeCallback: ((mode: VoiceMode) => void) | null = null;
export function onModeChange(cb: (mode: VoiceMode) => void) {
  onModeChangeCallback = cb;
}

let isAwake = false;
let currentMode: VoiceMode = "intelligence";
let commandCallback: ((text: string) => void) | null = null;
let currentAudio: HTMLAudioElement | null = null;

// ==========================
// 🔊 RESEMBLE AI SPEAK
// ==========================

async function wolfSpeak(text: string): Promise<void> {
  const clean = text.replace(/\n/g, " ").trim();

  if (!clean) return Promise.resolve();

  // Stop any current audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    import("./brainEvents").then((m) => m.setSpeakingActive(true)).catch(() => {});

    const response = await fetch(RESEMBLE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEMBLE_API_KEY}`,
      },
      body: JSON.stringify({
        voice_uuid: RESEMBLE_VOICE_UUID,
        data: clean,
      }),
    });

    if (!response.ok) {
      console.log("❌ Resemble error:", response.status);
      // Fallback to browser voice
      return browserSpeak(clean);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;

    return new Promise<void>((resolve) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        import("./brainEvents").then((m) => m.setSpeakingActive(false)).catch(() => {});
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        import("./brainEvents").then((m) => m.setSpeakingActive(false)).catch(() => {});
        resolve();
      };
      audio.play().catch(() => {
        browserSpeak(clean).then(resolve);
      });
    });
  } catch (err) {
    console.log("❌ Resemble failed, using browser voice:", err);
    import("./brainEvents").then((m) => m.setSpeakingActive(false)).catch(() => {});
    return browserSpeak(clean);
  }
}

// Browser voice fallback
function browserSpeak(text: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.12;
    utter.pitch = 0.95;
    utter.volume = 1;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  });
}

if (typeof window !== "undefined") {
  (window as any).wolfSpeak = wolfSpeak;
}

// ==========================
// 🎯 MODE SWITCH
// ==========================

function setMode(mode: VoiceMode) {
  currentMode = mode;
  document.body.classList.remove("mode-war", "mode-relax", "mode-intelligence");
  document.body.classList.add(`mode-${mode}`);
  document.documentElement.setAttribute("data-mode", mode);
  const colorMap: Record<VoiceMode, string> = {
    war: "#ff3b3b",
    relax: "#00ffc6",
    intelligence: "#ffd700",
  };
  const color = colorMap[mode];
  document.documentElement.style.setProperty("--wolf-glow", color);
  onModeChangeCallback?.(mode);
  console.log("MODE:", mode);
}

// ==========================
// 🎯 EXTERNAL TRIGGERS
// ==========================

export function triggerWake() {
  if (isAwake) return;
  isAwake = true;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  wolfSpeak(`${greeting}, SK. WOLF online.`).catch(() => {});
}

export function triggerSleep() {
  isAwake = false;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

export function processVoiceCommand(text: string): "mode" | "sleep" | "command" | "none" {
  const t = text.toLowerCase().trim();
  if (!t) return "none";
  if (t.includes("war mode")) {
    setMode("war");
    wolfSpeak("War mode activated").catch(() => {});
    return "mode";
  }
  if (t.includes("relax mode")) {
    setMode("relax");
    wolfSpeak("Relax mode activated").catch(() => {});
    return "mode";
  }
  if (t.includes("intelligence mode")) {
    setMode("intelligence");
    wolfSpeak("Intelligence mode activated").catch(() => {});
    return "mode";
  }
  if (t.includes("go to sleep") || t.includes("sleep")) return "sleep";
  if (commandCallback) {
    commandCallback(text);
    return "command";
  }
  return "none";
}

// ==========================
// 🔊 PUBLIC API
// ==========================

export const speak = wolfSpeak;
export function getIsSpeaking() {
  return currentAudio !== null;
}
export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  speechSynthesis.cancel();
}
export function getCurrentVoiceMode(): VoiceMode {
  return currentMode;
}
export function setVoiceMode(mode: VoiceMode) {
  setMode(mode);
  wolfSpeak(`${mode} mode activated`);
}
export function testVoice() {
  wolfSpeak("Wolf fully operational, SK.");
}
export function isWolfActive() {
  return isAwake;
}
export function isListening(): boolean {
  return false;
}
export function isRecognitionSupported(): boolean {
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}
export function startHandsFree(onWake: () => void, onCommand: (text: string) => void): boolean {
  if (!isRecognitionSupported()) return false;
  commandCallback = onCommand;
  return true;
}
export function stopHandsFree() {
  isAwake = false;
  commandCallback = null;
}
export function stopListening() {
  stopHandsFree();
}
export function startListening(onResult: (text: string) => void): boolean {
  commandCallback = onResult;
  return true;
}
export function replayLast() {
  const msgs = document.querySelectorAll(".ai-message");
  const last = msgs[msgs.length - 1];
  if (last) wolfSpeak(last.textContent || "");
}

if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    setMode("intelligence");
  });
}
