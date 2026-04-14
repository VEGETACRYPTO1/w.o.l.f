// ==========================
// 🐺 W.O.L.F GLOBAL VOICE SYSTEM
// ==========================

export type VoiceMode = "jarvis" | "friday" | "robot" | "intelligence";

let voices: SpeechSynthesisVoice[] = [];
let voiceReady = false;
let isSpeaking = false;
let wolfAudioReady = false;
let started = false;
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
// 🔓 GLOBAL AUDIO UNLOCK
// ==========================

function unlockWolfAudio() {
  if (wolfAudioReady) return;
  try {
    const utter = new SpeechSynthesisUtterance(" ");
    speechSynthesis.speak(utter);
    speechSynthesis.cancel();
    speechSynthesis.resume();
    wolfAudioReady = true;
    console.log("🔓 WOLF audio unlocked");
  } catch (e) {}
}

if (typeof window !== "undefined") {
  document.body?.addEventListener("click", () => {
    unlockWolfAudio();
    if (!started) {
      _autoStartListening();
      started = true;
      console.log("🐺 WOLF listening active");
    }
  }, { once: true });
}

// ==========================
// 🔊 wolfSpeak — ONLY speak function
// ==========================

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

    return new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(clean);
      const voice =
        voices.find((v) => v.name.includes("Google")) ||
        voices.find((v) => v.lang.includes("en")) ||
        voices[0];

      if (voice) utter.voice = voice;
      utter.rate = 1.0;
      utter.pitch = 0.9;
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

// ==========================
// 🐺 WAKE WORD
// ==========================

let wolfActive = false;
let wakeWordCallback: (() => void) | null = null;
let commandCallback: ((text: string) => void) | null = null;

function handleWakeWord(text: string): boolean {
  const lower = text.toLowerCase();
  const wakeWords = ["hey wolf", "hello wolf", "wake up wolf"];
  if (!wakeWords.some((w) => lower.includes(w))) return false;

  wolfActive = true;
  wakeWordCallback?.();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  wolfSpeak(`${greeting}, SK. W.O.L.F online. Awaiting your command.`).catch(() => {});
  return true;
}

// ==========================
// 🎤 AUTO LISTEN
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
    const result = event.results[event.results.length - 1];
    const text = result[0].transcript.trim();
    console.log("🎤 Heard:", text);
    const handled = handleWakeWord(text);
    if (!handled && wolfActive && commandCallback) {
      if (isSpeaking) { speechSynthesis.cancel(); isSpeaking = false; }
      commandCallback(text);
    }
  };

  recognition.onend = () => { setTimeout(() => { try { recognition?.start(); } catch (e) {} }, 500); };
  recognition.onerror = () => { setTimeout(() => { try { recognition?.start(); } catch (e) {} }, 1000); };
  recognition.start();
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
