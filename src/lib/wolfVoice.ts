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
  // Strip markdown for cleaner speech
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
    audio.playbackRate = 1.05;

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

export function isRecognitionSupported(): boolean {
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function startListening(onResult: (text: string) => void): boolean {
  if (!isRecognitionSupported()) return false;

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  onResultCallback = onResult;

  recognition.onresult = (event: any) => {
    const result = event.results[event.results.length - 1];
    if (result.isFinal) {
      const text = result[0].transcript.trim();
      if (text && onResultCallback) {
        onResultCallback(text);
      }
    }
  };

  recognition.onerror = (event: any) => {
    console.error("Speech recognition error:", event.error);
    stopListening();
  };

  recognition.onend = () => {
    recognition = null;
  };

  try {
    recognition.start();
    return true;
  } catch {
    return false;
  }
}

export function stopListening() {
  if (recognition) {
    try { recognition.stop(); } catch {}
    recognition = null;
  }
  onResultCallback = null;
}

export function isListening(): boolean {
  return recognition !== null;
}
