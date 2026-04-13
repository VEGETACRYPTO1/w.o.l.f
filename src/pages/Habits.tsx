import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Flame, Check } from "lucide-react";

interface Habit {
  id: string;
  name: string;
  icon: string;
  streak: number;
  weekDays: boolean[]; // Mon-Sun
}

const initialHabits: Habit[] = [
  { id: "1", name: "Gym", icon: "🏋️", streak: 12, weekDays: [true, false, true, false, true, false, false] },
  { id: "2", name: "Deep Work 2h+", icon: "💻", streak: 8, weekDays: [true, true, true, true, true, false, false] },
  { id: "3", name: "Read 30min", icon: "📚", streak: 21, weekDays: [true, true, true, true, false, true, false] },
  { id: "4", name: "No Social Media", icon: "🚫", streak: 5, weekDays: [true, true, true, false, false, false, false] },
  { id: "5", name: "Sleep by 11pm", icon: "😴", streak: 15, weekDays: [true, true, false, true, true, true, false] },
];

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

export default function Habits() {
  const [habits, setHabits] = useState<Habit[]>(initialHabits);

  const toggleDay = (habitId: string, dayIndex: number) => {
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habitId
          ? { ...h, weekDays: h.weekDays.map((d, i) => (i === dayIndex ? !d : d)) }
          : h
      )
    );
  };

  const overallRate = Math.round(
    (habits.reduce((sum, h) => sum + h.weekDays.filter(Boolean).length, 0) /
      (habits.length * 7)) *
      100
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
          <Activity className="h-7 w-7 text-primary" />
          Habits
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consistency rate: <span className="text-primary font-mono font-semibold">{overallRate}%</span>
        </p>
      </motion.div>

      <div className="space-y-3">
        {habits.map((habit, i) => (
          <motion.div
            key={habit.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-lg border border-border p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">{habit.icon}</span>
                <span className="font-heading font-semibold text-sm">{habit.name}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Flame className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono">{habit.streak}d streak</span>
              </div>
            </div>

            <div className="flex gap-2">
              {dayLabels.map((day, j) => (
                <button
                  key={j}
                  onClick={() => toggleDay(habit.id, j)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded transition-all ${
                    habit.weekDays[j]
                      ? "bg-primary/15"
                      : "bg-secondary hover:bg-accent"
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground">{day}</span>
                  {habit.weekDays[j] ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <div className="h-3.5 w-3.5" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
