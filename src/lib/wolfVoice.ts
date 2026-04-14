// ==========================
// 🐺 W.O.L.F FINAL FIXED SYSTEM
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
    voices.find(v => v.lang === "en-US") ||
    voices[0]
  );
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

// Register globally
if (typeof window !== "undefined") {
  (window as any).wolfSpeak = wolfSpeak;
}

// ==========================
// 🐺 WAKE WORD (ONCE)
// ==========================

function handleWakeWord(text: string): boolean {
  const lower = text.toLowerCase();
  if (
    !lower.includes("hey wolf") &&
    !lower.includes("wake up") &&
    !lower.includes("hello wolf")
  ) return false;

  isAwake = true;
  wakeWordCallback?.();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  wolfSpeak(`${greeting}, SK. W.O.L.F online.`).catch(() => {});
  return true;
}

// ==========================
// ⚔️ MODE SWITCH
// ==========================

function handleModeSwitch(text: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes("war mode")) {
    currentMode = "war";
  } else if (lower.includes("relax mode")) {
    currentMode = "relax";
  } else if (lower.includes("intelligence mode")) {
    currentMode = "intelligence";
  } else {
    return false;
  }
  document.documentElement.setAttribute("data-mode", currentMode);
  wolfSpeak(`${currentMode} mode activated.`).catch(() => {});
  return true;
}

// ==========================
// 🎤 LISTEN SYSTEM (FIXED)
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

    // 🐺 FIRST: WAKE SYSTEM
    if (!isAwake) {
      handleWakeWord(text);
      return;
    }

    // ⚔️ MODE SWITCH
    if (handleModeSwitch(text)) return;

    // 🧠 NORMAL FLOW → pass to command callback
    if (commandCallback) {
      commandCallback(text);
    }
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
export function setVoiceMode(mode: VoiceMode) { currentMode = mode; wolfSpeak(`Voice mode set to ${mode}`); }
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
