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

function openTab(query: string) {
  const q = query.toLowerCase();
  let url = "";

  if (q.includes("youtube")) {
    const search = q.replace("open", "").replace("youtube", "").trim();
    url = search
      ? "https://www.youtube.com/results?search_query=" + encodeURIComponent(search)
      : "https://www.youtube.com";
  } else if (q.includes("google") || q.includes("search")) {
    const search = q.replace("search", "").replace("google", "").trim();
    url = "https://www.google.com/search?q=" + encodeURIComponent(search);
  } else {
    url = "https://www.google.com/search?q=" + encodeURIComponent(query);
  }

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
    openTab(data.query);
    return `🌐 Opening: ${data.query}`;
  }

  return "";
}
