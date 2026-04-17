import { useEffect, useRef } from "react";
import { useWake } from "@/contexts/WakeContext";
import { triggerWake, triggerSleep, processVoiceCommand } from "@/lib/wolfVoice";

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
      if (rec) return;
      try {
        rec = new SR();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = "en-US";

        rec.onresult = (e: any) => {
          const text = e.results[e.results.length - 1][0].transcript
            .toLowerCase()
            .trim();
          console.log("🎤 Heard:", text);
          const p = phaseRef.current;

          if (p === "sleeping") {
            if (
              text.includes("wake up") ||
              text.includes("hey wolf") ||
              text.includes("hello wolf") ||
              text === "wolf" ||
              text.includes(" wolf")
            ) {
              triggerWake();
              wake();
            }
            return;
          }

          if (p === "awake") {
            const result = processVoiceCommand(text);
            if (result === "sleep") {
              triggerSleep();
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
        console.log("🎤 SleepWakeListener active");
      } catch {}
    };

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
