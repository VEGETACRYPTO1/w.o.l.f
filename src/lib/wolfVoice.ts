// ==========================
// 🐺 W.O.L.F COMPLETE VOICE SYSTEM
// ==========================

let voices: SpeechSynthesisVoice[] = [];
let voiceReady = false;
let isSpeaking = false;

export type VoiceMode = "jarvis" | "friday" | "robot" | "intelligence";
let currentVoiceMode: VoiceMode = "jarvis";

// ==========================
// 🔥 LOAD VOICES
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
// 🔓 UNLOCK AUDIO (iPhone FIX)
// ==========================

if (typeof window !== "undefined") {
  document.body?.addEventListener("click", () => {
    try {
      speechSynthesis.resume();
      const u = new SpeechSynthesisUtterance(" ");
      speechSynthesis.speak(u);
      speechSynthesis.cancel();
      console.log("🔓 Audio unlocked");
    } catch (e) {}
  }, { once: true });
}

// ==========================
// 🎭 VOICE MODE (JARVIS DEFAULT)
// ==========================

function getVoiceConfig() {
  const v = voices;
  return {
    voice:
      v.find((x) => x.name.includes("Google UK English Male")) ||
      v.find((x) => x.name.includes("Daniel")) ||
      v.find((x) => x.lang.includes("en")) ||
      v[0],
    rate: 0.95,
    pitch: 0.75,
  };
}

// ==========================
// 🔊 PUBLIC API
// ==========================

export function getIsSpeaking() {
  return isSpeaking;
}

export function stopSpeaking() {
  speechSynthesis.cancel();
  isSpeaking = false;
}

export function getCurrentVoiceMode(): VoiceMode {
  return currentVoiceMode;
}

export function setVoiceMode(mode: VoiceMode) {
  currentVoiceMode = mode;
  speak(`Voice mode set to ${mode}`);
}

// ==========================
// 🔊 SPEAK
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
      const utterance = new SpeechSynthesisUtterance(clean);
      const config = getVoiceConfig();

      if (config.voice) utterance.voice = config.voice;
      utterance.rate = config.rate;
      utterance.pitch = config.pitch;
      utterance.volume = 1;

      utterance.onstart = () => console.log("🗣️ WOLF speaking...");
      utterance.onend = () => {
        console.log("✅ Done speaking");
        isSpeaking = false;
        resolve();
      };
      utterance.onerror = (e) => {
        console.log("❌ Speech error:", e);
        isSpeaking = false;
        resolve();
      };

      speechSynthesis.resume();
      speechSynthesis.speak(utterance);
    });
  } catch (err) {
    console.log("Speech failed:", err);
    isSpeaking = false;
  }
}

// ==========================
// 🧪 DEBUG TEST
// ==========================

export function testVoice() {
  speak("W.O.L.F fully operational, SK.");
}

// ==========================
// 🎤 SPEECH RECOGNITION (STT)
// ==========================

let recognition: any = null;
let onResultCallback: ((text: string) => void) | null = null;
let keepListening = false;

export function isRecognitionSupported(): boolean {
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function startListening(onResult: (text: string) => void): boolean {
  if (!isRecognitionSupported()) return false;

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  onResultCallback = onResult;
  keepListening = true;

  recognition.onresult = (event: any) => {
    const result = event.results[event.results.length - 1];
    const text = result[0].transcript.trim();
    console.log("🎤 Heard:", text);
    if (text && onResultCallback) {
      onResultCallback(text);
    }
  };

  recognition.onerror = (event: any) => {
    console.error("Speech recognition error:", event.error);
    if (event.error === "no-speech" || event.error === "aborted") return;
    stopListening();
  };

  recognition.onend = () => {
    if (keepListening) {
      // 🔁 AUTO RESTART (ALWAYS LISTENING)
      setTimeout(() => { try { recognition?.start(); } catch {} }, 50);
    } else {
      recognition = null;
    }
  };

  try {
    recognition.start();
    console.log("🎤 WOLF listening...");
    return true;
  } catch {
    return false;
  }
}

export function stopListening() {
  keepListening = false;
  if (recognition) {
    try { recognition.stop(); } catch {}
    recognition = null;
  }
  onResultCallback = null;
}

export function isListening(): boolean {
  return recognition !== null;
}

// ==========================
// 🐺 WAKE WORD + HANDS-FREE
// ==========================

let wolfActive = false;
let wakeWordCallback: (() => void) | null = null;

export function isWolfActive() {
  return wolfActive;
}

export function startHandsFree(onWake: () => void, onCommand: (text: string) => void): boolean {
  if (!isRecognitionSupported()) return false;

  wolfActive = false;
  wakeWordCallback = onWake;

  return startListening((text) => {
    const lower = text.toLowerCase();

    const wakeWords = ["hey wolf", "hey wolff", "wake up wolf", "hello wolf"];
    const isWake = wakeWords.some((w) => lower.includes(w));

    if (!wolfActive && isWake) {
      wolfActive = true;
      wakeWordCallback?.();
      const hour = new Date().getHours();
      const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
      speak(`${greeting}, SK. W.O.L.F online. Awaiting your command.`).catch(() => {});
      return;
    }

    if (!wolfActive) return;

    if (isSpeaking) {
      speechSynthesis.cancel();
      isSpeaking = false;
    }

    onCommand(text);
  });
}

export function stopHandsFree() {
  wolfActive = false;
  wakeWordCallback = null;
  stopListening();
}
