import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Clock,
  Shield,
  Sparkles,
  Target,
  Activity,
  BarChart3,
  X,
  ChevronRight,
} from "lucide-react";
import { useMode } from "@/contexts/ModeContext";

interface Task {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  done: boolean;
  time?: string;
}

const initialTasks: Task[] = [
  { id: "1", title: "Deep work session — main project", priority: "high", done: false, time: "09:00 - 11:00" },
  { id: "2", title: "Review weekly goals", priority: "high", done: false, time: "11:00 - 11:30" },
  { id: "3", title: "Gym session", priority: "medium", done: false, time: "18:00 - 19:00" },
  { id: "4", title: "Read 30 minutes", priority: "low", done: false, time: "21:00 - 21:30" },
];

const nonNegotiables = ["Train", "Deep work 2h+", "Sleep 7h+", "No junk food"];

const goals = [
  { title: "Launch MVP", progress: 65 },
  { title: "Read 24 books", progress: 42 },
  { title: "80kg bench", progress: 80 },
];

const habits = [
  { name: "Gym", streak: 12, done: true },
  { name: "Deep Work", streak: 8, done: true },
  { name: "Read", streak: 21, done: false },
  { name: "No Social Media", streak: 5, done: false },
];

const stats = { productivity: "72%", habitsRate: "68%", goalProgress: "62%" };

type PopupId = "ops" | "nonneg" | "goals" | "habits" | "stats" | "mode";

interface PopupConfig {
  id: PopupId;
  label: string;
  icon: React.ReactNode;
  anchor: [number, number];
}

const popups: PopupConfig[] = [
  { id: "ops", label: "Today's Ops", icon: <Sparkles className="h-3.5 w-3.5" />, anchor: [20, 15] },
  { id: "nonneg", label: "Non-Negotiables", icon: <Shield className="h-3.5 w-3.5" />, anchor: [15, 55] },
  { id: "goals", label: "Goals", icon: <Target className="h-3.5 w-3.5" />, anchor: [55, 10] },
  { id: "habits", label: "Habits", icon: <Activity className="h-3.5 w-3.5" />, anchor: [60, 60] },
  { id: "stats", label: "Performance", icon: <BarChart3 className="h-3.5 w-3.5" />, anchor: [80, 40] },
  { id: "mode", label: "Mode", icon: <ChevronRight className="h-3.5 w-3.5" />, anchor: [40, 75] },
];

function useFloatAnimation(count: number) {
  return useMemo(() => {
    return Array.from({ length: count }, () => {
      const duration = 20 + Math.random() * 15;
      const xAmplitude = 30 + Math.random() * 40;
      const yAmplitude = 20 + Math.random() * 30;
      const steps = 5 + Math.floor(Math.random() * 4);
      const xKeys = Array.from({ length: steps }, () => (Math.random() - 0.5) * 2 * xAmplitude);
      const yKeys = Array.from({ length: steps }, () => (Math.random() - 0.5) * 2 * yAmplitude);
      xKeys.push(xKeys[0]);
      yKeys.push(yKeys[0]);
      return { duration, xKeys, yKeys };
    });
  }, [count]);
}

// Particle burst component
function ParticleBurst({ active }: { active: boolean }) {
  const particles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const distance = 30 + Math.random() * 25;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        delay: Math.random() * 0.1,
        size: 2 + Math.random() * 3,
      };
    });
  }, []);

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: "linear-gradient(135deg, #FFD60A, #FFC300)",
            left: "50%",
            top: "50%",
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.2 }}
          transition={{ duration: 0.5, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [expanded, setExpanded] = useState<PopupId | null>(null);
  const [burstId, setBurstId] = useState<PopupId | null>(null);
  const floatAnims = useFloatAnimation(popups.length);
  const { config, mode } = useMode();

  const completed = tasks.filter((t) => t.done).length;

  const toggle = (id: string) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const handleExpand = useCallback((id: PopupId) => {
    setExpanded(id);
    setBurstId(id);
    setTimeout(() => setBurstId(null), 600);
  }, []);

  const renderExpanded = (id: PopupId) => {
    switch (id) {
      case "ops":
        return (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">{completed}/{tasks.length} done</span>
              <div className="flex-1 mx-3 h-1 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(completed / tasks.length) * 100}%` }} />
              </div>
            </div>
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={(e) => { e.stopPropagation(); toggle(t.id); }}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-xs text-left transition-all ${t.done ? "opacity-40" : "hover:bg-accent/50"}`}
              >
                {t.done ? <CheckCircle2 className="h-3 w-3 text-primary shrink-0" /> : <Circle className={`h-3 w-3 shrink-0 ${t.priority === "high" ? "text-primary" : "text-muted-foreground"}`} />}
                <span className={t.done ? "line-through" : ""}>{t.title}</span>
                {t.time && <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{t.time}</span>}
              </button>
            ))}
          </div>
        );
      case "nonneg":
        return (
          <div className="space-y-2.5">
            {nonNegotiables.map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                {item}
              </div>
            ))}
          </div>
        );
      case "goals":
        return (
          <div className="space-y-3">
            {goals.map((g) => (
              <div key={g.title}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>{g.title}</span>
                  <span className="text-muted-foreground font-mono">{g.progress}%</span>
                </div>
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${g.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        );
      case "habits":
        return (
          <div className="space-y-2">
            {habits.map((h) => (
              <div key={h.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {h.done ? <CheckCircle2 className="h-3 w-3 text-primary" /> : <Circle className="h-3 w-3 text-muted-foreground" />}
                  <span>{h.name}</span>
                </div>
                <span className="text-muted-foreground font-mono text-[10px]">{h.streak}d 🔥</span>
              </div>
            ))}
          </div>
        );
      case "stats":
        return (
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Productivity", val: stats.productivity },
              { label: "Habits", val: stats.habitsRate },
              { label: "Goals", val: stats.goalProgress },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-lg font-heading font-bold">{s.val}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        );
      case "mode":
        return (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{config.icon}</span>
              <span className="font-heading font-semibold text-sm">{config.label}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{config.tone}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-2 italic">"{config.description}"</p>
          </div>
        );
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-center"
      >
        <h1 className="text-xl font-heading font-bold tracking-wide text-foreground/90">
          W.O.L.F.
        </h1>
      </motion.div>

      {/* Floating popups */}
      {popups.map((popup, i) => {
        const anim = floatAnims[i];
        const isExpanded = expanded === popup.id;
        return (
          <motion.div
            key={popup.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: isExpanded ? 0 : anim.xKeys,
              y: isExpanded ? 0 : anim.yKeys,
            }}
            transition={{
              opacity: { delay: i * 0.08, duration: 0.4 },
              scale: { delay: i * 0.08, duration: 0.4 },
              x: { duration: anim.duration, repeat: Infinity, ease: "easeInOut" },
              y: { duration: anim.duration, repeat: Infinity, ease: "easeInOut" },
            }}
            style={{
              position: "absolute",
              top: `${popup.anchor[0]}%`,
              left: `${popup.anchor[1]}%`,
              zIndex: 20,
            }}
          >
          <AnimatePresence mode="wait">
            {expanded === popup.id ? (
              <motion.div
                key="expanded"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="glass-card rounded-lg border border-border/50 p-4 min-w-[220px] max-w-[280px] cursor-pointer"
                onClick={() => setExpanded(null)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-primary">
                    {popup.icon}
                    <span className="text-xs font-heading font-semibold uppercase tracking-wider">{popup.label}</span>
                  </div>
                  <X className="h-3 w-3 text-muted-foreground" />
                </div>
                {renderExpanded(popup.id)}
              </motion.div>
            ) : (
              <motion.button
                key="collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleExpand(popup.id)}
                className="relative h-10 w-10 rounded-full border border-border/40 flex items-center justify-center text-primary transition-colors group glass-card"
              >
                {/* Golden glow pulse ring */}
                <span className="absolute inset-0 rounded-full animate-icon-glow-pulse" />
                <span className="absolute inset-[-3px] rounded-full animate-icon-glow-pulse-outer" />
                <span className="relative z-10 group-hover:animate-pulse-glow">{popup.icon}</span>
                <ParticleBurst active={burstId === popup.id} />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
        );
      })}
    </div>
  );
}
