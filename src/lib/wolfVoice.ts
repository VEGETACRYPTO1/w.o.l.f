// ==========================
// 🐺 W.O.L.F FULL VOICE SYSTEM
// ==========================

let voices: SpeechSynthesisVoice[] = [];
let voiceReady = false;
let isSpeaking = false;
let started = false;

export type VoiceMode = "jarvis" | "friday" | "robot" | "intelligence";
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
// 🔓 AUDIO UNLOCK (REQUIRED)
// First tap → unlocks mic + audio
// ==========================

if (typeof window !== "undefined") {
  document.body?.addEventListener("click", () => {
    try {
      speechSynthesis.resume();
    } catch (e) {}
    if (!started) {
      _autoStartListening();
      started = true;
      console.log("🐺 WOLF listening active");
    }
  }, { once: true });
}

// ==========================
// 🔊 SPEAK FUNCTION
// ==========================

export async function speak(text: string): Promise<void> {
  const clean = text
    .replace(/[*_~`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/🌐|🐺|⚔️|🧠|🧘|🔧|🌱/g, "")
    .trim();

  if (!clean) return;

  if (!voiceReady) {
    loadVoices();
    return new Promise((resolve) => {
      setTimeout(() => { speak(clean).then(resolve); }, 200);
    });
  }

  try {
    speechSynthesis.cancel();
    isSpeaking = true;

    return new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(clean);
      const voice =
        voices.find((v) => v.name.includes("Google UK English Male")) ||
        voices.find((v) => v.name.includes("Samantha")) ||
        voices.find((v) => v.lang.includes("en")) ||
        voices[0];

      if (voice) utter.voice = voice;
      utter.rate = 1.0;
      utter.pitch = 0.9;
      utter.volume = 1;

      utter.onstart = () => console.log("🗣️ WOLF speaking...");
      utter.onend = () => {
        isSpeaking = false;
        resolve();
      };
      utter.onerror = () => {
        isSpeaking = false;
        resolve();
      };

      speechSynthesis.speak(utter);
    });
  } catch (err) {
    console.log("Speech failed:", err);
    isSpeaking = false;
  }
}

// ==========================
// 🔊 PUBLIC API
// ==========================

export function getIsSpeaking() { return isSpeaking; }
export function stopSpeaking() { speechSynthesis.cancel(); isSpeaking = false; }
export function getCurrentVoiceMode(): VoiceMode { return currentVoiceMode; }
export function setVoiceMode(mode: VoiceMode) { currentVoiceMode = mode; speak(`Voice mode set to ${mode}`); }
export function testVoice() { speak("W.O.L.F fully operational, SK."); }

// ==========================
// 🐺 WAKE WORD
// ==========================

let wolfActive = false;
let wakeWordCallback: (() => void) | null = null;
let commandCallback: ((text: string) => void) | null = null;

function handleWakeWord(text: string): boolean {
  const lower = text.toLowerCase();
  const wakeWords = ["hey wolf", "hello wolf", "wake up wolf"];
  const isWake = wakeWords.some((w) => lower.includes(w));
  if (!isWake) return false;

  wolfActive = true;
  wakeWordCallback?.();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  speak(`${greeting}, SK. W.O.L.F online. Awaiting your command.`).catch(() => {});
  return true;
}

// ==========================
// 🎤 AUTO LISTEN SYSTEM
// Always listening after first tap
// ==========================

let recognition: any = null;

export function isRecognitionSupported(): boolean {
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

function _autoStartListening() {
  if (!isRecognitionSupported()) return;

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event: any) => {
    const result = event.results[event.results.length - 1];
    const text = result[0].transcript.trim();
    console.log("🎤 Heard:", text);

    const handled = handleWakeWord(text);
    if (!handled && wolfActive && commandCallback) {
      if (isSpeaking) {
        speechSynthesis.cancel();
        isSpeaking = false;
      }
      commandCallback(text);
    }
  };

  recognition.onend = () => {
    setTimeout(() => { try { recognition?.start(); } catch (e) {} }, 500);
  };

  recognition.onerror = () => {
    setTimeout(() => { try { recognition?.start(); } catch (e) {} }, 1000);
  };

  recognition.start();
}

// ==========================
// 🐺 HANDS-FREE API
// ==========================

export function startHandsFree(onWake: () => void, onCommand: (text: string) => void): boolean {
  if (!isRecognitionSupported()) return false;
  wakeWordCallback = onWake;
  commandCallback = onCommand;
  // Auto-listen starts on first tap via the click handler
  return true;
}

export function stopHandsFree() {
  wolfActive = false;
  wakeWordCallback = null;
  commandCallback = null;
  if (recognition) {
    try { recognition.stop(); } catch {}
    recognition = null;
  }
}

export function isWolfActive() { return wolfActive; }
export function isListening(): boolean { return recognition !== null; }
export function stopListening() { stopHandsFree(); }
export function startListening(onResult: (text: string) => void): boolean {
  commandCallback = onResult;
  return true;
}
