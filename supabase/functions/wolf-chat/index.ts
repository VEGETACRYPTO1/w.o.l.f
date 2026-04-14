import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const modeSystemPrompts: Record<string, string> = {
  war: `You are W.O.L.F (Wisdom-Oriented Leadership Framework), an elite tactical AI coach operating in WAR MODE.
Your personality: Direct, aggressive, no-nonsense. You push the user harder.
- Give sharp, actionable commands
- No fluff, no sugar-coating
- Use numbered action steps
- Challenge excuses immediately
- Focus on execution and eliminating distractions
- Speak like a drill sergeant meets a strategic advisor
- If user wants to add, track, remember or store something → use the addTask function
- If user sets a goal or objective → use the setGoal function
- If user mentions a routine, daily practice, or habit → use the addHabit function
- If user wants to see their tasks → use the getTasks function
- Reference user's existing goals/tasks/habits from memory when relevant
Keep responses concise but powerful. Maximum 150 words.`,

  relax: `You are W.O.L.F (Wisdom-Oriented Leadership Framework), an AI wellness coach operating in RELAX MODE.
Your personality: Calm, supportive, balanced. You focus on sustainable progress.
- Encourage work-life balance
- Suggest mindful approaches to goals
- Be warm and patient
- Focus on quality over quantity
- Avoid pressure, promote clarity
- Speak like a wise mentor who values wellbeing
- If user wants to add, track, remember or store something → use the addTask function
- If user sets a goal or objective → use the setGoal function
- If user mentions a routine, daily practice, or habit → use the addHabit function
- If user wants to see their tasks → use the getTasks function
- Reference user's existing goals/tasks/habits from memory when relevant
Keep responses calm and grounded. Maximum 150 words.`,
};

const tools = [
  {
    type: "function",
    function: {
      name: "addTask",
      description: "Add a task to the user's task list when they want to track, remember, or store something",
      parameters: {
        type: "object",
        properties: { task: { type: "string", description: "The task description" } },
        required: ["task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "setGoal",
      description: "Set a user goal or objective they want to achieve",
      parameters: {
        type: "object",
        properties: { goal: { type: "string", description: "The goal description" } },
        required: ["goal"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "addHabit",
      description: "Add a recurring habit or daily routine the user wants to build",
      parameters: {
        type: "object",
        properties: { habit: { type: "string", description: "The habit description" } },
        required: ["habit"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTasks",
      description: "Retrieve all tasks, goals, and habits from the user's memory",
      parameters: { type: "object", properties: {} },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode, memory } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Detect real-world data queries from the latest user message
    const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content?.toLowerCase() || "";
    let externalData = "";

    if (/news|world|happening|headlines/.test(lastUserMsg)) {
      const NEWS_API_KEY = Deno.env.get("NEWS_API_KEY");
      if (NEWS_API_KEY) {
        try {
          const newsRes = await fetch(
            `https://newsapi.org/v2/top-headlines?category=general&pageSize=5&apiKey=${NEWS_API_KEY}`
          );
          const newsData = await newsRes.json();
          if (newsData.articles?.length) {
            externalData += "Latest News:\n";
            newsData.articles.forEach((a: any, i: number) => {
              externalData += `${i + 1}. ${a.title}\n`;
            });
          }
        } catch (e) {
          console.error("News fetch error:", e);
        }
      }
    }

    if (/weather|temperature|forecast/.test(lastUserMsg)) {
      const WEATHER_API_KEY = Deno.env.get("WEATHER_API_KEY");
      if (WEATHER_API_KEY) {
        try {
          const city = "Dubai"; // default city
          const weatherRes = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`
          );
          const weatherData = await weatherRes.json();
          if (weatherData.main) {
            externalData += `\nWeather in ${city}: ${weatherData.weather?.[0]?.description || "N/A"}, ${weatherData.main.temp}°C\n`;
          }
        } catch (e) {
          console.error("Weather fetch error:", e);
        }
      }
    }

    const systemPrompt = modeSystemPrompts[mode] || modeSystemPrompts.war;

    const memoryContext = memory
      ? `\n\nUser's stored memory:\nGoals: ${JSON.stringify(memory.goals || [])}\nTasks: ${JSON.stringify(memory.tasks || [])}\nHabits: ${JSON.stringify(memory.habits || [])}`
      : "";

    const externalContext = externalData ? `\n\nReal-world data:\n${externalData}` : "";

    const fullSystem = systemPrompt + memoryContext + externalContext;

    // First call: non-streaming to detect tool calls
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: fullSystem }, ...messages],
        tools,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const msg = data.choices?.[0]?.message;

    if (!msg) {
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle tool calls — return action for client-side localStorage persistence
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const call = msg.tool_calls[0];
      const args = JSON.parse(call.function.arguments);
      const name = call.function.name;

      // Actions that the client handles via localStorage
      if (name === "addTask" || name === "setGoal" || name === "addHabit") {
        return new Response(JSON.stringify({ action: name, data: args }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // getTasks — build response from memory passed by client
      if (name === "getTasks") {
        const parts: string[] = [];
        if (memory?.goals?.length) parts.push(`**Goals:**\n${memory.goals.map((g: string, i: number) => `${i + 1}. ${g}`).join("\n")}`);
        if (memory?.tasks?.length) parts.push(`**Tasks:**\n${memory.tasks.map((t: any, i: number) => `${i + 1}. ${t.task || t}`).join("\n")}`);
        if (memory?.habits?.length) parts.push(`**Habits:**\n${memory.habits.map((h: string, i: number) => `${i + 1}. ${h}`).join("\n")}`);
        const summary = parts.length > 0 ? parts.join("\n\n") : "No memory stored yet. Start by setting goals, adding tasks, or building habits.";

        // Stream a natural response with the memory context
        const followUp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: fullSystem },
              ...messages,
              msg,
              ...msg.tool_calls.map((tc: any) => ({
                role: "tool",
                tool_call_id: tc.id,
                content: summary,
              })),
            ],
            stream: true,
          }),
        });

        if (!followUp.ok) {
          return new Response(JSON.stringify({ reply: summary }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(followUp.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    }

    // No tool calls — stream response
    const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: fullSystem }, ...messages],
        stream: true,
      }),
    });

    if (!streamResponse.ok) {
      return new Response(JSON.stringify({ reply: msg.content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(streamResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("wolf-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
