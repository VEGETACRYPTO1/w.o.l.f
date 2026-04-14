// ─── Browser Voice (Free + Instant) ───

let voicesLoaded = false;
let selectedVoice: SpeechSynthesisVoice | null = null;
let currentAudio: HTMLAudioElement | null = null;
let isSpeaking = false;

function loadVoices() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;

  selectedVoice =
    voices.find((v) => v.name.includes("Google") && v.lang.includes("en")) ||
    voices.find((v) => v.name.includes("Samantha")) ||
    voices.find((v) => v.lang.includes("en")) ||
    voices[0];

  voicesLoaded = true;
  console.log("🔊 Voice selected:", selectedVoice?.name);
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

// ─── Public API ───

export function getIsSpeaking() {
  return isSpeaking;
}

export function stopSpeaking() {
  speechSynthesis.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  isSpeaking = false;
}

export async function speak(text: string): Promise<void> {
  const clean = text
    .replace(/[*_~`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/🌐|🐺|⚔️|🧠|🧘|🔧|🌱/g, "")
    .trim();

  if (!clean) return;

  if (!voicesLoaded) loadVoices();

  // Interrupt current speech
  speechSynthesis.cancel();
  isSpeaking = true;

  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(clean);
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.rate = 1.05;
    utterance.pitch = 0.9;
    utterance.volume = 1;

    utterance.onend = () => {
      isSpeaking = false;
      resolve();
    };
    utterance.onerror = () => {
      isSpeaking = false;
      resolve();
    };

    speechSynthesis.speak(utterance);
  });
}

// ─── Speech Recognition (STT) ───

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
  recognition.interimResults = true;
  recognition.lang = "en-US";

  onResultCallback = onResult;
  keepListening = true;

  recognition.onresult = (event: any) => {
    const result = event.results[event.results.length - 1];
    const text = result[0].transcript.trim();
    if (!result.isFinal && text.length < 4) return;

    if (result.isFinal && text && onResultCallback) {
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
      setTimeout(() => {
        try { recognition?.start(); } catch {}
      }, 50);
    } else {
      recognition = null;
    }
  };

  try {
    recognition.start();
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

// ─── Wake Word + Hands-Free System ───

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

    if (!wolfActive && lower.includes("hey wolf")) {
      wolfActive = true;
      wakeWordCallback?.();
      const hour = new Date().getHours();
      const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
      speak(`${greeting}, SK. W.O.L.F online.`).catch(() => {});
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
