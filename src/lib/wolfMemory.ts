export interface WolfMemory {
  goals: string[];
  tasks: Array<{ task: string; createdAt: string }>;
  habits: string[];
}

const STORAGE_KEY = "wolf_memory";

export function getMemory(): WolfMemory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* corrupted */ }
  return { goals: [], tasks: [], habits: [] };
}

export function saveMemory(memory: WolfMemory) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
}

export function resolveUrl(query: string): string {
  const q = query.toLowerCase().trim();
  if (q.includes("youtube")) {
    const clean = q.replace(/open|search|go to|show/gi, "").replace("youtube", "").trim();
    return clean ? "https://www.youtube.com/results?search_query=" + encodeURIComponent(clean) : "https://www.youtube.com";
  }
  if (q.includes("twitter") || q.includes("x.com")) return "https://x.com";
  if (q.includes("github")) return "https://github.com";
  if (q.includes("reddit")) return "https://www.reddit.com";
  if (q.includes("linkedin")) return "https://www.linkedin.com";
  if (query.trim().startsWith("http")) return query.trim();
  const clean = q.replace(/open|search|go to|show/gi, "").trim();
  return "https://www.google.com/search?q=" + encodeURIComponent(clean || query);
}

/** Try auto-open; returns true if succeeded */
export function tryOpenTab(query: string): boolean {
  const url = resolveUrl(query);
  const win = window.open(url, "_blank");
  return !!(win && !win.closed && typeof win.closed !== "undefined");
}

/** Manual fallback open */
export function openTab(query: string) {
  const url = resolveUrl(query);
  window.open(url, "_blank");
}

export function handleMemoryAction(
  action: string,
  data: Record<string, string>
): string {
  const memory = getMemory();

  if (action === "addTask") {
    memory.tasks.push({ task: data.task, createdAt: new Date().toISOString() });
    saveMemory(memory);
    return `⚔️ Task stored: "${data.task}"`;
  }

  if (action === "setGoal") {
    memory.goals.push(data.goal);
    saveMemory(memory);
    return `🎯 Goal locked: "${data.goal}"`;
  }

  if (action === "addHabit") {
    memory.habits.push(data.habit);
    saveMemory(memory);
    return `🔁 Habit started: "${data.habit}"`;
  }

  if (action === "openWebsite") {
    return `🌐 [Open: ${data.query}](search:${data.query})`;
  }

  return "";
}
