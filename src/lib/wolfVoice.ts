// ==========================
// 🐺 W.O.L.F REALTIME VOICE SYSTEM
// ==========================

export type VoiceMode = "intelligence" | "war" | "relax";

let onModeChangeCallback: ((mode: VoiceMode) => void) | null = null;
export function onModeChange(cb: (mode: VoiceMode) => void) { onModeChangeCallback = cb; }

let recognition: any = null;
let _isListening = false;
let isAwake = false;
let isProcessing = false;
let currentMode: VoiceMode = "intelligence";
let wakeWordCallback: (() => void) | null = null;
let commandCallback: ((text: string) => void) | null = null;

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
// 🐺 WAKE
// ==========================

function wakeWolf() {
  isAwake = true;
  wakeWordCallback?.();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  speak(`${greeting}, SK. W.O.L.F online.`);
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
  speak(`${mode} mode`);
}

// ==========================
// 🧠 PROCESS VOICE
// ==========================

async function processVoice(text: string) {
  const t = text.toLowerCase();
  console.log("🎤 Heard:", t);

  // Wake gate
  if (!isAwake) {
    if (t.includes("hey wolf") || t.includes("wake up") || t.includes("hello wolf")) {
      wakeWolf();
    }
    return;
  }

  // Mode switch
  if (t.includes("war mode")) return setMode("war");
  if (t.includes("relax mode")) return setMode("relax");
  if (t.includes("intelligence mode")) return setMode("intelligence");

  // Processing guard
  if (isProcessing) {
    console.log("⚠️ Skipping (busy)");
    return;
  }
  isProcessing = true;

  // Send to command handler (ChatOverlay)
  if (commandCallback) {
    commandCallback(text);
  }

  isProcessing = false;
}

// ==========================
// 🎤 LISTEN (OPTIMIZED)
// ==========================

export function isRecognitionSupported(): boolean {
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

function _startListening() {
  if (!isRecognitionSupported()) return;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = async (event: any) => {
    const last = event.results[event.results.length - 1];
    if (!last.isFinal) return;
    const text = last[0].transcript.trim();

    // 🔥 INTERRUPT AI SPEECH
    speechSynthesis.cancel();

    await processVoice(text);
  };

  recognition.onend = () => {
    setTimeout(() => { try { recognition?.start(); } catch (e) {} }, 100);
  };

  recognition.onerror = () => {
    setTimeout(() => { try { recognition?.start(); } catch (e) {} }, 300);
  };

  recognition.start();
  _isListening = true;
  console.log("🎤 Always listening");
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
