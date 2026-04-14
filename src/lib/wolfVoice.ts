// ==========================
// 🔊 UNIVERSAL VOICE ENGINE (ALL DEVICES)
// ==========================

let voices: SpeechSynthesisVoice[] = [];
let voiceReady = false;
let isSpeaking = false;

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
// 🔊 UNLOCK AUDIO (MOBILE FIX)
// ==========================

let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  try {
    const utter = new SpeechSynthesisUtterance(" ");
    speechSynthesis.speak(utter);
    speechSynthesis.cancel();
    audioUnlocked = true;
    console.log("🔓 Audio unlocked");
  } catch (e) {}
}

if (typeof window !== "undefined") {
  window.addEventListener("click", () => {
    unlockAudio();
    speechSynthesis.resume();
  }, { once: true });
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

export async function speak(text: string): Promise<void> {
  const clean = text
    .replace(/[*_~`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/🌐|🐺|⚔️|🧠|🧘|🔧|🌱/g, "")
    .trim();

  if (!clean) return;

  try {
    speechSynthesis.cancel();

    if (!voiceReady) {
      loadVoices();
      return new Promise((resolve) => {
        setTimeout(() => { speak(clean).then(resolve); }, 200);
      });
    }

    isSpeaking = true;

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(clean);

      const selectedVoice =
        voices.find((v) => v.name.includes("Google") && v.lang.includes("en")) ||
        voices.find((v) => v.name.includes("Samantha")) ||
        voices.find((v) => v.lang.includes("en")) ||
        voices[0];

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.rate = 1.03;
      utterance.pitch = 0.9;
      utterance.volume = 1;

      utterance.onstart = () => {
        console.log("🗣️ WOLF speaking...");
      };

      utterance.onend = () => {
        console.log("✅ Done speaking");
        isSpeaking = false;
        resolve();
      };

      utterance.onerror = (e) => {
        console.log("❌ Speech error:", e);
        isSpeaking = false;
        // Retry once on fail
        setTimeout(() => {
          try { speechSynthesis.speak(utterance); } catch {}
        }, 200);
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
