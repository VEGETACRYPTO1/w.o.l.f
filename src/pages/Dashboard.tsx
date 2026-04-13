import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Clock, Shield, Sparkles, Calendar } from "lucide-react";
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

const priorityColors: Record<string, string> = {
  high: "text-primary",
  medium: "text-muted-foreground",
  low: "text-muted-foreground/60",
};

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const { config, mode } = useMode();
  const completed = tasks.filter((t) => t.done).length;
  const total = tasks.length;

  const toggle = (id: string) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm text-muted-foreground">{greeting}, Operator.</p>
        <h1 className="text-3xl font-heading font-bold mt-1">
          Command Center
        </h1>
        <p className="text-sm text-muted-foreground mt-2 italic">"{config.description}"</p>
      </motion.div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        {["Plan My Day", "Weekly Review", "Focus Mode"].map((label, i) => (
          <motion.button
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-accent transition-colors border border-border"
          >
            {i === 0 && <Sparkles className="h-3.5 w-3.5 text-primary" />}
            {i === 1 && <Calendar className="h-3.5 w-3.5 text-primary" />}
            {i === 2 && <Shield className="h-3.5 w-3.5 text-primary" />}
            {label}
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-card rounded-lg border border-border p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-lg">Today's Ops</h2>
            <span className="text-xs text-muted-foreground">
              {completed}/{total} complete
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-secondary rounded-full mb-5 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(completed / total) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          <div className="space-y-2">
            {tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => toggle(task.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all text-left ${
                  task.done
                    ? "opacity-40"
                    : "hover:bg-accent"
                }`}
              >
                {task.done ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Circle className={`h-4 w-4 shrink-0 ${priorityColors[task.priority]}`} />
                )}
                <span className={task.done ? "line-through" : ""}>{task.title}</span>
                {task.time && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {task.time}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Non-Negotiables */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-lg border border-border p-5"
        >
          <h2 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Non-Negotiables
          </h2>
          <div className="space-y-3">
            {nonNegotiables.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="font-heading text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Current Mode
            </h3>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-lg">{config.icon}</span>
              <div>
                <p className="font-medium text-foreground">{config.label}</p>
                <p className="text-xs text-muted-foreground">{config.tone}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
