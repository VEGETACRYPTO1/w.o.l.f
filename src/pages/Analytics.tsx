import { motion } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";

const weekData = [
  { day: "Mon", score: 92 },
  { day: "Tue", score: 85 },
  { day: "Wed", score: 78 },
  { day: "Thu", score: 90 },
  { day: "Fri", score: 65 },
  { day: "Sat", score: 40 },
  { day: "Sun", score: 55 },
];

const insights = [
  { text: "Your consistency drops after 8 PM. Avoid important tasks then.", trend: "down" as const },
  { text: "Peak productivity: Tuesday and Thursday mornings.", trend: "up" as const },
  { text: "Gym habit is your strongest — 12-day streak.", trend: "up" as const },
  { text: "Social media slip on Thursday broke momentum.", trend: "down" as const },
];

const stats = [
  { label: "Avg Productivity", value: "72%", change: "+5%" },
  { label: "Habits Hit Rate", value: "68%", change: "-2%" },
  { label: "Goals Progress", value: "62%", change: "+8%" },
];

export default function Analytics() {
  const maxScore = Math.max(...weekData.map((d) => d.score));

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Weekly performance overview</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card rounded-lg border border-border p-4"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-heading">{s.label}</p>
            <p className="text-2xl font-heading font-bold mt-1">{s.value}</p>
            <p className={`text-xs mt-1 ${s.change.startsWith("+") ? "text-primary" : "text-destructive"}`}>
              {s.change} vs last week
            </p>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-card rounded-lg border border-border p-5"
      >
        <h2 className="font-heading font-semibold text-sm mb-4">Daily Productivity Score</h2>
        <div className="flex items-end gap-3 h-40">
          {weekData.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(d.score / maxScore) * 100}%` }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="w-full bg-primary/20 rounded-t relative overflow-hidden"
              >
                <div
                  className="absolute bottom-0 left-0 right-0 bg-primary rounded-t"
                  style={{ height: `${d.score}%` }}
                />
              </motion.div>
              <span className="text-[10px] text-muted-foreground">{d.day}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* AI Insights */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-card rounded-lg border border-border p-5"
      >
        <h2 className="font-heading font-semibold text-sm mb-4">JARVIS Insights</h2>
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              {insight.trend === "up" ? (
                <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              )}
              <span className="text-muted-foreground">{insight.text}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
