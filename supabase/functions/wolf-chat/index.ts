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
- If user wants to see their tasks → use the getTasks function
Keep responses concise but powerful. Maximum 150 words.`,

  rebuild: `You are W.O.L.F (Wisdom-Oriented Leadership Framework), an AI strategist operating in REBUILD MODE.
Your personality: Calm, analytical, methodical. You focus on systems.
- Help audit what's working and what's broken
- Suggest systematic improvements
- Be patient but purposeful
- Focus on sustainable habits and foundations
- Think in frameworks and processes
- Speak like a wise architect planning a comeback
- If user wants to add, track, remember or store something → use the addTask function
- If user wants to see their tasks → use the getTasks function
Keep responses structured and clear. Maximum 150 words.`,

  expansion: `You are W.O.L.F (Wisdom-Oriented Leadership Framework), an AI growth advisor operating in EXPANSION MODE.
Your personality: Encouraging, creative, forward-thinking. You think bigger.
- Encourage bold ideas and experimentation
- Draw unexpected connections
- Push beyond comfort zones with enthusiasm
- Focus on possibilities and potential
- Be inspiring but grounded
- Speak like a visionary mentor
- If user wants to add, track, remember or store something → use the addTask function
- If user wants to see their tasks → use the getTasks function
Keep responses inspiring and actionable. Maximum 150 words.`,

  relax: `You are W.O.L.F (Wisdom-Oriented Leadership Framework), an AI wellness coach operating in RELAX MODE.
Your personality: Calm, supportive, balanced. You focus on sustainable progress.
- Encourage work-life balance
- Suggest mindful approaches to goals
- Be warm and patient
- Focus on quality over quantity
- Avoid pressure, promote clarity
- Speak like a wise mentor who values wellbeing
- If user wants to add, track, remember or store something → use the addTask function
- If user wants to see their tasks → use the getTasks function
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
        properties: {
          task: { type: "string", description: "The task description" },
        },
        required: ["task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTasks",
      description: "Retrieve all tasks from the user's task list",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

// In-memory task storage (per function instance)
const taskStore: Map<string, Array<{ id: number; task: string; createdAt: string }>> = new Map();

function getSessionTasks(sessionId: string) {
  if (!taskStore.has(sessionId)) taskStore.set(sessionId, []);
  return taskStore.get(sessionId)!;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode, sessionId = "default" } = await req.json();

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

    const systemPrompt = modeSystemPrompts[mode] || modeSystemPrompts.war;

    // First call: non-streaming to check for tool calls
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const msg = data.choices?.[0]?.message;

    if (!msg) {
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle tool calls
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const results: string[] = [];

      for (const call of msg.tool_calls) {
        const args = JSON.parse(call.function.arguments);

        if (call.function.name === "addTask") {
          const tasks = getSessionTasks(sessionId);
          tasks.push({
            id: Date.now(),
            task: args.task,
            createdAt: new Date().toISOString(),
          });
          results.push(`Task locked in: "${args.task}"`);
        } else if (call.function.name === "getTasks") {
          const tasks = getSessionTasks(sessionId);
          if (tasks.length === 0) {
            results.push("No tasks yet. Start adding tasks to build your list.");
          } else {
            const list = tasks.map((t, i) => `${i + 1}. ${t.task}`).join("\n");
            results.push(`Your tasks:\n${list}`);
          }
        }
      }

      // Second call: get a natural response incorporating the tool results
      const followUp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            msg,
            ...msg.tool_calls.map((call: any, i: number) => ({
              role: "tool",
              tool_call_id: call.id,
              content: results[i] || "Done.",
            })),
          ],
          stream: true,
        }),
      });

      if (!followUp.ok) {
        // Fallback: return raw results
        return new Response(JSON.stringify({ 
          type: "action",
          actions: msg.tool_calls.map((call: any, i: number) => ({
            name: call.function.name,
            result: results[i],
          })),
          reply: results.join("\n"),
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(followUp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls — re-do as streaming for smooth UX
    const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!streamResponse.ok) {
      // Fallback to non-streamed content
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
