// ==========================
// 🐺 W.O.L.F REALTIME VOICE SYSTEM
// ==========================

export type VoiceMode = "intelligence" | "war" | "relax";

let recognition: any = null;
let _isListening = false;
let isAwake = false;
let isProcessing = false;
let currentMode: VoiceMode = "intelligence";

let wakeWordCallback: (() => void) | null = null;
let commandCallback: ((text: string) => void) | null = null;
let messageCallback: ((text: string, role: "user" | "ai") => void) | null = null;
let onModeChangeCallback: ((mode: VoiceMode) => void) | null = null;

export function onModeChange(cb: (mode: VoiceMode) => void) {
  onModeChangeCallback = cb;
}

// ==========================
// 🔊 SPEAK (INTERRUPT SAFE)
// ==========================

export function speak(text: string): Promise<void> {
  const clean = text
    .replace(/[*_~`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/🌐|🐺|⚔️|🧠|🧘|🔧|🌱/g, "")
    .trim();
  if (!clean) return Promise.resolve();

  speechSynthesis.cancel();
  return new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.05;
    u.pitch = 0.9;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

// ==========================
// 🎯 MODE SWITCH
// ==========================

function setMode(mode: VoiceMode) {
  currentMode = mode;
  document.body.classList.remove("mode-war", "mode-relax", "mode-intelligence");
  document.body.classList.add(`mode-${mode}`);
  document.documentElement.setAttribute("data-mode", mode);

  const colorMap: Record<VoiceMode, string> = {
    war: "#ff3b3b",
    relax: "#00ffc6",
    intelligence: "#ffd700",
  };
  document.documentElement.style.setProperty("--wolf-glow", colorMap[mode]);
  onModeChangeCallback?.(mode);
}

// ==========================
// 🐺 HANDLE WAKE
// ==========================

function handleWake(text: string): boolean {
  const lower = text.toLowerCase();
  if (
    lower.includes("hey wolf") ||
    lower.includes("wake up") ||
    lower.includes("hello wolf")
  ) {
    isAwake = true;
    wakeWordCallback?.();
    const hour = new Date().getHours();
    const greeting =
      hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const msg = `${greeting}, SK. W.O.L.F online.`;
    messageCallback?.(msg, "ai");
    speak(msg);
    return true;
  }
  return false;
}

// ==========================
// ⚔️ HANDLE COMMAND
// ==========================

function handleCommand(text: string): boolean {
  const lower = text.toLowerCase();

  if (lower.includes("war mode")) {
    setMode("war");
    messageCallback?.("⚔️ War Mode activated.", "ai");
    speak("War mode activated");
    return true;
  }
  if (lower.includes("relax mode")) {
    setMode("relax");
    messageCallback?.("🧘 Relax Mode activated.", "ai");
    speak("Relax mode activated");
    return true;
  }
  if (lower.includes("intelligence mode")) {
    setMode("intelligence");
    messageCallback?.("🧠 Intelligence Mode activated.", "ai");
    speak("Intelligence mode activated");
    return true;
  }

  return false;
}

// ==========================
// 🎤 LISTEN (ROBUST ERROR RECOVERY)
// ==========================

export function isRecognitionSupported(): boolean {
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

function _startListening() {
  if (!isRecognitionSupported()) {
    console.error("Speech recognition not supported");
    return;
  }

  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    console.log("🎤 Listening started");
    _isListening = true;
  };

  recognition.onresult = async (event: any) => {
    const text = event.results[event.results.length - 1][0].transcript.trim();
    console.log("🎤 Heard:", text);

    // 🔥 INTERRUPT AI SPEECH
    speechSynthesis.cancel();

    // 🐺 WAKE SYSTEM
    if (!isAwake) {
      handleWake(text);
      return;
    }

    // ⚔️ MODE COMMANDS
    if (handleCommand(text)) return;

    // 🧠 NORMAL CHAT
    if (!isProcessing && commandCallback) {
      isProcessing = true;
      await commandCallback(text);
      isProcessing = false;
    }
  };

  recognition.onerror = (e: any) => {
    console.log("❌ Recognition error:", e);
    // 🔥 HARD RESET
    try { recognition.stop(); } catch {}
    setTimeout(() => {
      _startListening();
    }, 500);
  };

  recognition.onend = () => {
    console.log("⚠️ Recognition ended → restarting...");
    // 🔥 ALWAYS RESTART
    setTimeout(() => {
      try {
        recognition.start();
      } catch {
        _startListening();
      }
    }, 300);
  };

  try {
    recognition.start();
  } catch {
    console.log("Restart failed, retrying...");
    setTimeout(_startListening, 500);
  }
}

// Auto-start on first click (browser requirement)
if (typeof window !== "undefined") {
  document.body?.addEventListener("click", () => {
    if (!_isListening) {
      _startListening();
    }
  }, { once: true });
}

// ==========================
// 🔊 PUBLIC API
// ==========================

export function getIsSpeaking() { return false; }
export function stopSpeaking() { speechSynthesis.cancel(); }
export function getCurrentVoiceMode(): VoiceMode { return currentMode; }
export function setVoiceMode(mode: VoiceMode) { setMode(mode); }
export function testVoice() { speak("W.O.L.F fully operational, SK."); }
export function isWolfActive() { return isAwake; }
export function isListening(): boolean { return _isListening; }

export function startHandsFree(
  onWake: () => void,
  onCommand: (text: string) => void,
  onMessage?: (text: string, role: "user" | "ai") => void
): boolean {
  if (!isRecognitionSupported()) return false;
  wakeWordCallback = onWake;
  commandCallback = onCommand;
  messageCallback = onMessage || null;
  return true;
}

export function stopHandsFree() {
  isAwake = false;
  wakeWordCallback = null;
  commandCallback = null;
  messageCallback = null;
  if (recognition) {
    try { recognition.stop(); } catch {}
    recognition = null;
    _isListening = false;
  }
}

export function stopListening() { stopHandsFree(); }
export function startListening(onResult: (text: string) => void): boolean {
  commandCallback = onResult;
  return true;
}

// ==========================
// 🔊 REPLAY
// ==========================

export function replayLast() {
  const msgs = document.querySelectorAll(".ai-message");
  const last = msgs[msgs.length - 1];
  if (last) speak(last.textContent || "");
}

// ==========================
// 🚀 AUTO START
// ==========================

if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    document.body.classList.add("mode-intelligence");
    document.documentElement.setAttribute("data-mode", "intelligence");
  });
  (window as any).wolfSpeak = speak;
}
