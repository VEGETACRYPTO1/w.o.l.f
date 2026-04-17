import { useEffect, useRef } from "react";
import { useWake } from "@/contexts/WakeContext";

export function SleepWakeListener() {
  const { phase, wake, sleep } = useWake();
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;

    let rec: any = null;
    let stopped = false;

    const start = () => {
      try {
        rec = new SR();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = "en-US";

        rec.onresult = (e: any) => {
          const text = e.results[e.results.length - 1][0].transcript
            .toLowerCase()
            .trim();
          const p = phaseRef.current;
          if (p === "sleeping") {
            if (
              text.includes("wake up") ||
              text.includes("hey wolf") ||
              text === "wolf" ||
              text.includes(" wolf")
            ) {
              wake();
            }
          } else if (p === "awake") {
            if (text.includes("go to sleep") || text.includes("sleep")) {
              sleep();
            }
          }
        };

        rec.onend = () => {
          if (!stopped) setTimeout(() => { try { rec?.start(); } catch {} }, 300);
        };
        rec.onerror = () => {
          if (!stopped) setTimeout(() => { try { rec?.start(); } catch {} }, 600);
        };
        rec.start();
      } catch {}
    };

    // Need user gesture to start in some browsers — try anyway, also retry on first click
    start();
    const onClick = () => { if (!rec) start(); };
    document.addEventListener("click", onClick, { once: true });

    return () => {
      stopped = true;
      document.removeEventListener("click", onClick);
      try { rec?.stop(); } catch {}
      rec = null;
    };
  }, [wake, sleep]);

  return null;
}
