// ==========================
// 🐺 W.O.L.F CORE FIXED SYSTEM
// ==========================

export type VoiceMode = "intelligence" | "war" | "relax";

let onModeChangeCallback: ((mode: VoiceMode) => void) | null = null;
export function onModeChange(cb: (mode: VoiceMode) => void) {
  onModeChangeCallback = cb;
}

let voices: SpeechSynthesisVoice[] = [];
let audioReady = false;
let isAwake = false;
let currentMode: VoiceMode = "intelligence";
let commandCallback: ((text: string) => void) | null = null;

// ==========================
// 🔊 LOAD VOICES
// ==========================

function loadVoices() {
  voices = speechSynthesis.getVoices();
  if (voices.length > 0) console.log("🔊 Voices loaded:", voices.length);
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

// ==========================
// 🔓 UNLOCK AUDIO
// ==========================

function unlockAudio() {
  if (audioReady) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    speechSynthesis.speak(u);
    speechSynthesis.cancel();
    speechSynthesis.resume();
    audioReady = true;
    console.log("🔓 Audio unlocked");
  } catch (e) {}
}

if (typeof window !== "undefined") {
  document.body?.addEventListener(
    "click",
    () => {
      unlockAudio();
    },
    { once: true },
  );
}

// ==========================
// 🎯 EXTERNAL TRIGGERS
// ==========================

export function triggerWake() {
  if (isAwake) return;
  isAwake = true;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  wolfSpeak(`${greeting}, SK. W.O.L.F online.`).catch(() => {});
}

export function triggerSleep() {
  isAwake = false;
}

// Single entry point for all voice commands when awake
export function processVoiceCommand(text: string): "mode" | "sleep" | "command" | "none" {
  const t = text.toLowerCase().trim();
  if (!t) return "none";
  if (t.includes("war mode")) {
    setMode("war");
    wolfSpeak("war mode activated").catch(() => {});
    return "mode";
  }
  if (t.includes("relax mode")) {
    setMode("relax");
    wolfSpeak("relax mode activated").catch(() => {});
    return "mode";
  }
  if (t.includes("intelligence mode")) {
    setMode("intelligence");
    wolfSpeak("intelligence mode activated").catch(() => {});
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
  const w = window as any;
  if (w.scene) {
    w.scene.traverse((obj: any) => {
      if (obj.material && obj.material.color) {
        obj.material.color.set(color);
      }
    });
  }
  onModeChangeCallback?.(mode);
  console.log("MODE:", mode);
}

// ==========================
// 🔊 SPEAK
// ==========================

function wolfSpeak(text: string): Promise<void> {
  const clean = text
    .replace(/\./g, "... ")
    .replace(/,/g, ", ")
    .replace(/!/g, "! ")
    .replace(/\?/g, "? ")
    .replace(/:/g, "... ")
    .replace(/\n/g, "... ")
    .trim();

  if (!clean) return Promise.resolve();

  if (voices.length === 0) {
    loadVoices();
    return new Promise((resolve) => {
      wolfSpeak(clean).then(resolve);
    });
  }

  try {
    speechSynthesis.cancel();
    speechSynthesis.pause();
    return new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(clean);
      utter.rate = 1.12;
      utter.pitch = 0.95;
      utter.volume = 1;
      const finish = () => {
        import("./brainEvents").then((m) => m.setSpeakingActive(false)).catch(() => {});
        resolve();
      };
      utter.onstart = () => {
        import("./brainEvents").then((m) => m.setSpeakingActive(true)).catch(() => {});
      };
      utter.onend = finish;
      utter.onerror = finish;
      speechSynthesis.resume();
      speechSynthesis.speak(utter);
      console.log("🐺 WOLF speaking:", clean.substring(0, 60));
    });
  } catch (err) {
    console.log("❌ voice error:", err);
    return Promise.resolve();
  }
}

if (typeof window !== "undefined") {
  (window as any).wolfSpeak = wolfSpeak;
}

// ==========================
// 🔊 PUBLIC API
// ==========================

export const speak = wolfSpeak;
export function getIsSpeaking() {
  return false;
}
export function stopSpeaking() {
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
  wolfSpeak("W.O.L.F fully operational, SK.");
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

// ==========================
// 🚀 INIT
// ==========================

if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    setMode("intelligence");
  });
}
