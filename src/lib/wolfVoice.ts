// ==========================
// 🐺 W.O.L.F CORE FIXED SYSTEM
// ==========================

export type VoiceMode = "intelligence" | "war" | "relax";

// Global mode change listener (React bridge)
let onModeChangeCallback: ((mode: VoiceMode) => void) | null = null;
export function onModeChange(cb: (mode: VoiceMode) => void) { onModeChangeCallback = cb; }

let voices: SpeechSynthesisVoice[] = [];
let audioReady = false;
let isAwake = false;
let currentMode: VoiceMode = "intelligence";
let recognition: any = null;
let _isListening = false;
let wakeWordCallback: (() => void) | null = null;
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
  document.body?.addEventListener("click", () => {
    unlockAudio();
    if (!_isListening) {
      _autoStartListening();
      console.log("🐺 WOLF listening active");
    }
  }, { once: true });
}

// ==========================
// 🎯 MODE SWITCH (MASTER FIX)
// ==========================

function setMode(mode: VoiceMode) {
  currentMode = mode;

  // 🔥 FORCE UI RESET
  document.body.classList.remove("mode-war", "mode-relax", "mode-intelligence");
  document.body.classList.add(`mode-${mode}`);
  document.documentElement.setAttribute("data-mode", mode);

  // 🔥 FORCE GLOBE COLOR via CSS variable
  const colorMap: Record<VoiceMode, string> = {
    war: "#ff3b3b",
    relax: "#00ffc6",
    intelligence: "#ffd700",
  };
  const color = colorMap[mode];
  document.documentElement.style.setProperty("--wolf-glow", color);

  // 🔥 HARD FORCE CANVAS (if scene exists on window)
  const w = window as any;
  if (w.scene) {
    w.scene.traverse((obj: any) => {
      if (obj.material && obj.material.color) {
        obj.material.color.set(color);
      }
    });
  }

  // 🔥 Notify React context
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
// 🐺 WAKE SYSTEM (FIXED)
// ==========================

function handleWake(text: string): boolean {
  const t = text.toLowerCase();
  if (!t.includes("hey wolf") && !t.includes("wake up") && !t.includes("hello wolf")) return false;

  isAwake = true;
  wakeWordCallback?.();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  wolfSpeak(`${greeting}, SK. W.O.L.F online.`).catch(() => {});
  return true;
}

// ==========================
// 🎤 VOICE MODE SWITCH
// ==========================

function handleModeSwitch(text: string): boolean {
  const t = text.toLowerCase();
  if (t.includes("war mode")) {
    setMode("war");
  } else if (t.includes("relax mode")) {
    setMode("relax");
  } else if (t.includes("intelligence mode")) {
    setMode("intelligence");
  } else {
    return false;
  }
  wolfSpeak(`${currentMode} mode activated`).catch(() => {});
  return true;
}

// ==========================
// 🎤 LISTEN (CONTINUOUS FIX)
// ==========================

export function isRecognitionSupported(): boolean {
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

function _autoStartListening() {
  if (!isRecognitionSupported()) return;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event: any) => {
    const text = event.results[event.results.length - 1][0].transcript.trim();
    console.log("🎤 Heard:", text);

    // Wake once
    if (!isAwake) {
      handleWake(text);
      return;
    }

    // Mode switch
    if (handleModeSwitch(text)) return;

    // Normal flow
    if (commandCallback) commandCallback(text);
  };

  recognition.onend = () => {
    setTimeout(() => { try { recognition?.start(); } catch (e) {} }, 300);
  };
  recognition.onerror = () => {
    setTimeout(() => { try { recognition?.start(); } catch (e) {} }, 800);
  };

  recognition.start();
  _isListening = true;
  console.log("🎤 Listening...");
}

// ==========================
// 🔊 PUBLIC API
// ==========================

export const speak = wolfSpeak;
export function getIsSpeaking() { return false; }
export function stopSpeaking() { speechSynthesis.cancel(); }
export function getCurrentVoiceMode(): VoiceMode { return currentMode; }
export function setVoiceMode(mode: VoiceMode) { setMode(mode); wolfSpeak(`${mode} mode activated`); }
export function testVoice() { wolfSpeak("W.O.L.F fully operational, SK."); }
export function isWolfActive() { return isAwake; }
export function isListening(): boolean { return _isListening; }

export function startHandsFree(onWake: () => void, onCommand: (text: string) => void): boolean {
  if (!isRecognitionSupported()) return false;
  wakeWordCallback = onWake;
  commandCallback = onCommand;
  return true;
}

export function stopHandsFree() {
  isAwake = false;
  wakeWordCallback = null;
  commandCallback = null;
  if (recognition) { try { recognition.stop(); } catch {} recognition = null; _isListening = false; }
}

export function stopListening() { stopHandsFree(); }
export function startListening(onResult: (text: string) => void): boolean { commandCallback = onResult; return true; }

// ==========================
// 🔊 REPLAY LAST
// ==========================

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
    setMode("intelligence"); // default gold
  });
}
