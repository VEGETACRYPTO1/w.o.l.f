import { useState } from "react";
import { motion } from "framer-motion";
import { Target, Plus, ChevronDown, ChevronRight } from "lucide-react";

interface Goal {
  id: string;
  title: string;
  progress: number;
  missions: string[];
}

const initialGoals: Goal[] = [
  {
    id: "1",
    title: "Launch side project MVP",
    progress: 65,
    missions: ["Finalize landing page", "Set up auth", "Deploy v1"],
  },
  {
    id: "2",
    title: "Read 24 books this year",
    progress: 42,
    missions: ["Finish current book", "Create reading list", "Read 30min daily"],
  },
  {
    id: "3",
    title: "Hit 80kg bench press",
    progress: 80,
    missions: ["Train 4x/week", "Progressive overload", "Track nutrition"],
  },
];

export default function Goals() {
  const [goals] = useState<Goal[]>(initialGoals);
  const [expanded, setExpanded] = useState<string | null>("1");

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
          <Target className="h-7 w-7 text-primary" />
          Goals
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Long-term objectives broken into missions.</p>
      </motion.div>

      <div className="space-y-3">
        {goals.map((goal, i) => (
          <motion.div
            key={goal.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card rounded-lg border border-border overflow-hidden"
          >
            <button
              onClick={() => setExpanded(expanded === goal.id ? null : goal.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/50 transition-colors"
            >
              {expanded === goal.id ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-sm">{goal.title}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{goal.progress}%</span>
                </div>
              </div>
            </button>

            {expanded === goal.id && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                className="border-t border-border px-4 py-3"
              >
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-heading">
                  Weekly Missions
                </p>
                <div className="space-y-2">
                  {goal.missions.map((m, j) => (
                    <div key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      {m}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      <button className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-secondary text-sm text-muted-foreground hover:text-foreground hover:bg-accent border border-border transition-colors">
        <Plus className="h-4 w-4" />
        Add Goal
      </button>
    </div>
  );
}
