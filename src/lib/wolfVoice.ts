const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wolf-tts`;

let currentAudio: HTMLAudioElement | null = null;
let isSpeaking = false;

export function getIsSpeaking() {
  return isSpeaking;
}

export function stopSpeaking() {
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

  stopSpeaking();
  isSpeaking = true;

  try {
    const res = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ text: clean }),
    });

    if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.playbackRate = 1.1;

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        isSpeaking = false;
        currentAudio = null;
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = () => {
        isSpeaking = false;
        currentAudio = null;
        URL.revokeObjectURL(url);
        reject(new Error("Audio playback failed"));
      };
      audio.play().catch(reject);
    });
  } catch (err) {
    isSpeaking = false;
    currentAudio = null;
    console.error("Voice error:", err);
    throw err;
  }
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
    // Process interim results for speed if long enough
    const text = result[0].transcript.trim();
    if (!result.isFinal && text.length < 4) return;

    if (result.isFinal && text && onResultCallback) {
      onResultCallback(text);
    }
  };

  recognition.onerror = (event: any) => {
    console.error("Speech recognition error:", event.error);
    // Don't stop on no-speech errors, just let it restart
    if (event.error === "no-speech" || event.error === "aborted") return;
    stopListening();
  };

  recognition.onend = () => {
    // Ultra-fast restart for continuous listening
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
      // Greet user
      const hour = new Date().getHours();
      const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
      speak(`${greeting}, SK. W.O.L.F online.`).catch(() => {});
      return;
    }

    if (!wolfActive) return;

    // Interrupt current speech instantly
    if (isSpeaking && currentAudio) {
      currentAudio.pause();
      currentAudio = null;
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
