// ==========================
// 🐺 W.O.L.F FINAL MASTER SYSTEM
// ==========================

export type VoiceMode = "intelligence" | "war" | "relax";

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

function getBestVoice(): SpeechSynthesisVoice | undefined {
  return (
    voices.find(v => v.name.includes("Google UK English Male")) ||
    voices.find(v => v.name.includes("Samantha")) ||
    voices[0]
  );
}

// ==========================
// 🔓 UNLOCK AUDIO (CRITICAL)
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
// 🔊 SPEAK
// ==========================

function wolfSpeak(text: string): Promise<void> {
  const clean = text
    .replace(/[*_~`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/🌐|🐺|⚔️|🧠|🧘|🔧|🌱/g, "")
    .trim();

  if (!clean) return Promise.resolve();

  if (voices.length === 0) {
    loadVoices();
    return new Promise((resolve) => {
      setTimeout(() => { wolfSpeak(clean).then(resolve); }, 200);
    });
  }

  try {
    speechSynthesis.cancel();

    return new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(clean);
      utter.voice = getBestVoice() || null;
      utter.rate = 1.05;
      utter.pitch = 0.85;
      utter.volume = 1;

      utter.onend = () => resolve();
      utter.onerror = () => resolve();

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
// 🌍 GLOBE COLOR CONTROL
// ==========================

function updateGlobeColor() {
  let color: number;
  if (currentMode === "war") {
    color = 0xff3b3b;
  } else if (currentMode === "relax") {
    color = 0x00ffc6;
  } else {
    color = 0xffd700;
  }

  const w = window as any;
  if (w.globeParticles) w.globeParticles.material.color.setHex(color);
  if (w.globeLines) w.globeLines.material.color.setHex(color);
  if (w.globeGlow) w.globeGlow.material.color.setHex(color);
  console.log("🌍 Globe updated:", currentMode);
}

// ==========================
// 🎨 APPLY MODE UI + GLOBE
// ==========================

function applyModeUI() {
  document.body.className = document.body.className.replace(/mode-\w+/g, "").trim();
  document.body.classList.add(`mode-${currentMode}`);
  document.documentElement.setAttribute("data-mode", currentMode);
  updateGlobeColor();
}

// ==========================
// 🐺 WAKE SYSTEM
// ==========================

function handleWakeWord(text: string): boolean {
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
// ⚔️ MODE SWITCH (VOICE)
// ==========================

function handleModeSwitch(text: string): boolean {
  const t = text.toLowerCase();
  if (t.includes("war mode")) {
    currentMode = "war";
  } else if (t.includes("relax mode")) {
    currentMode = "relax";
  } else if (t.includes("intelligence mode")) {
    currentMode = "intelligence";
  } else {
    return false;
  }
  applyModeUI();
  wolfSpeak(`${currentMode} mode activated`).catch(() => {});
  return true;
}

// ==========================
// 🎤 LISTEN SYSTEM
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

    // 🐺 WAKE
    if (!isAwake) {
      handleWakeWord(text);
      return;
    }

    // 🎯 MODE SWITCH
    if (handleModeSwitch(text)) return;

    // 🧠 NORMAL FLOW
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
export function setVoiceMode(mode: VoiceMode) { currentMode = mode; applyModeUI(); wolfSpeak(`${mode} mode activated`); }
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
  const messages = document.querySelectorAll(".ai-message");
  const last = messages[messages.length - 1];
  if (last) wolfSpeak(last.textContent || "");
}

// ==========================
// 🚀 AUTO START
// ==========================

if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    applyModeUI();
  });
}
