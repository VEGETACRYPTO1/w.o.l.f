// ==========================
// 🐺 W.O.L.F FINAL WORKING SYSTEM
// ==========================

export type VoiceMode = "jarvis" | "friday" | "robot" | "intelligence";
export type AppMode = "intelligence" | "war" | "rebuild" | "expansion" | "relax";

let modeSwitchCallback: ((mode: AppMode) => void) | null = null;

let voices: SpeechSynthesisVoice[] = [];
let voiceReady = false;
let isSpeaking = false;
let audioUnlocked = false;
let started = false;
let isProcessing = false;
let currentVoiceMode: VoiceMode = "jarvis";

// ==========================
// 🔊 LOAD VOICES
// ==========================

function loadVoices() {
  voices = speechSynthesis.getVoices();
  if (voices.length > 0) {
    voiceReady = true;
    console.log("🔊 Voices loaded:", voices.length);
  }
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

// ==========================
// 🔓 UNLOCK AUDIO (REQUIRED)
// ==========================

function unlockAudio() {
  if (audioUnlocked) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    speechSynthesis.speak(u);
    speechSynthesis.cancel();
    speechSynthesis.resume();
    audioUnlocked = true;
    console.log("🔓 Audio unlocked");
  } catch (e) {}
}

if (typeof window !== "undefined") {
  document.body?.addEventListener("click", () => {
    unlockAudio();
    if (!started) {
      _autoStartListening();
      started = true;
      console.log("🐺 WOLF listening active");
    }
  }, { once: true });
}

// ==========================
// 🔊 SPEAK (FAST + INTERRUPT)
// ==========================

// Voice profiles per mode
const VOICE_PROFILES: Record<VoiceMode, { rate: number; pitch: number; preferredVoices: string[] }> = {
  intelligence: {
    rate: 0.95,
    pitch: 0.65,
    preferredVoices: [
      "Google US English",
      "Microsoft David",
      "Alex",
      "Daniel",
    ],
  },
  jarvis: {
    rate: 1.0,
    pitch: 0.8,
    preferredVoices: ["Google UK English Male", "Daniel", "Microsoft David"],
  },
  friday: {
    rate: 1.05,
    pitch: 1.1,
    preferredVoices: ["Google US English", "Samantha", "Microsoft Zira", "Karen"],
  },
  robot: {
    rate: 0.85,
    pitch: 0.4,
    preferredVoices: ["Google US English", "Microsoft David", "Alex"],
  },
};

function selectVoice(): SpeechSynthesisVoice | undefined {
  const profile = VOICE_PROFILES[currentVoiceMode];
  for (const pref of profile.preferredVoices) {
    const match = voices.find((v) => v.name.includes(pref));
    if (match) return match;
  }
  // Fallback: any American English voice
  return (
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang.startsWith("en")) ||
    voices[0]
  );
}

function wolfSpeak(text: string): Promise<void> {
  const clean = text
    .replace(/[*_~`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/🌐|🐺|⚔️|🧠|🧘|🔧|🌱/g, "")
    .trim();

  if (!clean) return Promise.resolve();

  if (!voiceReady) {
    loadVoices();
    return new Promise((resolve) => {
      setTimeout(() => { wolfSpeak(clean).then(resolve); }, 200);
    });
  }

  try {
    speechSynthesis.cancel();
    isSpeaking = true;

    const profile = VOICE_PROFILES[currentVoiceMode];

    return new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(clean);
      const voice = selectVoice();

      if (voice) utter.voice = voice;
      utter.rate = profile.rate;
      utter.pitch = profile.pitch;
      utter.volume = 1;

      utter.onend = () => { isSpeaking = false; resolve(); };
      utter.onerror = () => { isSpeaking = false; resolve(); };

      // 🔥 CRITICAL: resume before speak
      speechSynthesis.resume();
      speechSynthesis.speak(utter);
      console.log("🐺 WOLF speaking:", clean.substring(0, 60));
    });
  } catch (err) {
    console.log("❌ voice error:", err);
    isSpeaking = false;
    return Promise.resolve();
  }
}

// Register globally
if (typeof window !== "undefined") {
  (window as any).wolfSpeak = wolfSpeak;
}

// ==========================
// 🔊 PUBLIC API
// ==========================

export const speak = wolfSpeak;
export function getIsSpeaking() { return isSpeaking; }
export function stopSpeaking() { speechSynthesis.cancel(); isSpeaking = false; }
export function getCurrentVoiceMode(): VoiceMode { return currentVoiceMode; }
export function setVoiceMode(mode: VoiceMode) { currentVoiceMode = mode; wolfSpeak(`Voice mode set to ${mode}`); }
export function testVoice() { wolfSpeak("W.O.L.F fully operational, SK."); }
export function onModeSwitch(cb: (mode: AppMode) => void) { modeSwitchCallback = cb; }

// ==========================
// 🐺 WAKE WORD (FIXED)
// ==========================

let wolfActive = false;
let wakeWordCallback: (() => void) | null = null;
let commandCallback: ((text: string) => void) | null = null;

function handleWakeWord(text: string): boolean {
  const lower = text.toLowerCase();
  const wakeWords = ["hey wolf", "wake up", "hello wolf"];
  if (!wakeWords.some((w) => lower.includes(w))) return false;

  wolfActive = true;
  wakeWordCallback?.();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  // ⚔️ IMPORTANT FIX → DO NOT BLOCK FUTURE INPUT
  wolfSpeak(`${greeting}, SK. W.O.L.F online.`).catch(() => {});
  return true;
}

// ==========================
// ⚔️ VOICE MODE SWITCH
// ==========================

const MODE_KEYWORDS: Record<string, AppMode> = {
  "intelligence mode": "intelligence",
  "war mode": "war",
  "rebuild mode": "rebuild",
  "expansion mode": "expansion",
  "relax mode": "relax",
};

function handleVoiceModeSwitch(text: string): boolean {
  const lower = text.toLowerCase();
  for (const [keyword, mode] of Object.entries(MODE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      modeSwitchCallback?.(mode as AppMode);
      wolfSpeak(`${mode} mode activated.`).catch(() => {});
      return true;
    }
  }
  return false;
}

// ==========================
// 🎤 LISTENING SYSTEM (FIXED)
// ==========================

let recognition: any = null;

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
    if (isProcessing) return;
    const result = event.results[event.results.length - 1];
    const text = result[0].transcript.trim();
    console.log("🎤 Heard:", text);

    isProcessing = true;

    // 🐺 WAKE WORD
    const isWake = handleWakeWord(text);
    if (isWake) { isProcessing = false; return; }

    // ⚔️ MODE SWITCH via voice
    const modeResult = handleVoiceModeSwitch(text);
    if (modeResult) { isProcessing = false; return; }

    // 🧠 NORMAL COMMAND
    if (wolfActive && commandCallback) {
      if (isSpeaking) { speechSynthesis.cancel(); isSpeaking = false; }
      commandCallback(text);
    }

    isProcessing = false;
  };

  recognition.onend = () => {
    setTimeout(() => { try { recognition?.start(); } catch (e) {} }, 300);
  };
  recognition.onerror = () => {
    setTimeout(() => { try { recognition?.start(); } catch (e) {} }, 800);
  };
  recognition.start();
  console.log("🎤 Listening...");
}

export function startHandsFree(onWake: () => void, onCommand: (text: string) => void): boolean {
  if (!isRecognitionSupported()) return false;
  wakeWordCallback = onWake;
  commandCallback = onCommand;
  return true;
}

export function stopHandsFree() { wolfActive = false; wakeWordCallback = null; commandCallback = null; if (recognition) { try { recognition.stop(); } catch {} recognition = null; } }
export function isWolfActive() { return wolfActive; }
export function isListening(): boolean { return recognition !== null; }
export function stopListening() { stopHandsFree(); }
export function startListening(onResult: (text: string) => void): boolean { commandCallback = onResult; return true; }

// ==========================
// 🔊 REPLAY LAST (RESTORED)
// ==========================

export function replayLast() {
  const messages = document.querySelectorAll(".ai-message");
  const last = messages[messages.length - 1];
  if (last) {
    wolfSpeak(last.textContent || "");
  }
}
