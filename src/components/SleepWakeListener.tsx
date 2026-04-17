import { useEffect, useRef } from "react";
import { useWake } from "@/contexts/WakeContext";

// Lightweight always-on recognizer that listens for wake/sleep trigger phrases.
// Independent of the main wolfVoice listener (which only runs after wake).
export function SleepWakeListener() {
  const { awake, wake, sleep } = useWake();
  const recRef = useRef<any>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.warn("SpeechRecognition not supported — wake/sleep voice triggers disabled.");
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = (e: any) => {
      const text = (e.results[e.results.length - 1][0].transcript || "").toLowerCase().trim();
      if (!text) return;
      console.log("👂 trigger heard:", text);

      if (!awake) {
        if (text.includes("wake up") || text.includes("wolf") || text.includes("hey wolf")) {
          wake();
        }
      } else {
        if (text.includes("go to sleep") || text.includes("sleep mode") || /\bsleep\b/.test(text)) {
          sleep();
        }
      }
    };

    rec.onend = () => {
      if (stoppedRef.current) return;
      setTimeout(() => { try { rec.start(); } catch {} }, 300);
    };
    rec.onerror = () => {
      if (stoppedRef.current) return;
      setTimeout(() => { try { rec.start(); } catch {} }, 800);
    };

    try { rec.start(); } catch {}
    recRef.current = rec;
    stoppedRef.current = false;

    return () => {
      stoppedRef.current = true;
      try { rec.stop(); } catch {}
      recRef.current = null;
    };
  }, [awake, wake, sleep]);

  return null;
}
