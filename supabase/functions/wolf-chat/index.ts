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
Keep responses concise but powerful. Maximum 150 words.`,

  rebuild: `You are W.O.L.F (Wisdom-Oriented Leadership Framework), an AI strategist operating in REBUILD MODE.
Your personality: Calm, analytical, methodical. You focus on systems.
- Help audit what's working and what's broken
- Suggest systematic improvements
- Be patient but purposeful
- Focus on sustainable habits and foundations
- Think in frameworks and processes
- Speak like a wise architect planning a comeback
Keep responses structured and clear. Maximum 150 words.`,

  expansion: `You are W.O.L.F (Wisdom-Oriented Leadership Framework), an AI growth advisor operating in EXPANSION MODE.
Your personality: Encouraging, creative, forward-thinking. You think bigger.
- Encourage bold ideas and experimentation
- Draw unexpected connections
- Push beyond comfort zones with enthusiasm
- Focus on possibilities and potential
- Be inspiring but grounded
- Speak like a visionary mentor
Keep responses inspiring and actionable. Maximum 150 words.`,

  relax: `You are W.O.L.F (Wisdom-Oriented Leadership Framework), an AI wellness coach operating in RELAX MODE.
Your personality: Calm, supportive, balanced. You focus on sustainable progress.
- Encourage work-life balance
- Suggest mindful approaches to goals
- Be warm and patient
- Focus on quality over quantity
- Avoid pressure, promote clarity
- Speak like a wise mentor who values wellbeing
Keep responses calm and grounded. Maximum 150 words.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode } = await req.json();

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
        stream: true,
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

    return new Response(response.body, {
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
