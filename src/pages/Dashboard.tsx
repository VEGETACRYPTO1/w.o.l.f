import { useState, useEffect } from "react";
import { motion } from "framer-motion";

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const time = `${hours}:${minutes}:${seconds}`;

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const d = now.getDate();
  const suffix = d > 3 && d < 21 ? "th" : ["th", "st", "nd", "rd"][d % 10] || "th";
  const date = `${days[now.getDay()]}, ${d}${suffix} ${months[now.getMonth()]}`;

  return { time, date };
}

export default function Dashboard() {
  const { time, date } = useLiveClock();

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        data-bh
        className="absolute top-5 left-[30px] z-20 font-mono text-foreground"
      >
        <div className="text-lg tracking-[2px]">{time}</div>
        <div className="text-sm opacity-70 mt-1">{date}</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        data-bh
        className="absolute top-5 right-[30px] z-20"
      >
        <h1 className="text-xl font-heading font-bold tracking-[3px] text-foreground/90 font-mono">
          W.O.L.F.
        </h1>
      </motion.div>
    </div>
  );
}
