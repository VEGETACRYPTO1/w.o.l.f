import { getMemory, handleMemoryAction, tryOpenTab, type WolfMemory } from "./wolfMemory";

export type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wolf-chat`;

const SESSION_ID = `wolf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function streamWolfChat({
  messages,
  mode,
  location,
  onDelta,
  onDone,
  onError,
  onAction,
}: {
  messages: Msg[];
  mode: string;
  location?: { lat: number; lon: number };
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
  onAction?: (label: string) => void;
}) {
  try {
    // Handle time/date queries client-side — never use API
    const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
    if (/\btime\b|what time|current time/.test(lastMsg)) {
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      onDelta(`${time}. System synchronized.`);
      onDone();
      return;
    }
    if (/\bdate\b|what date|today|what day/.test(lastMsg)) {
      const date = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
      onDelta(date);
      onDone();
      return;
    }

    const memory = getMemory();

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages, mode, sessionId: SESSION_ID, memory, location }),
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      onError(data.error || `Error ${resp.status}`);
      return;
    }

    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await resp.json();

      // Handle action responses (memory mutations + openWebsite)
      if (data.action) {
        if (data.action === "openWebsite") {
          const query = data.data?.query || "";
          const opened = tryOpenTab(query);
          if (opened) {
            onDelta("Opened.");
          } else {
            // Blocked — send clickable fallback
            onDelta(`🌐 [Open: ${query}](search:${query})`);
          }
          onDone();
          return;
        }
        const label = handleMemoryAction(data.action, data.data || {});
        if (label && onAction) {
          onAction(label);
          onDone();
          return;
        }
      }

      const text = data.reply || data.actions?.map((a: any) => a.result).join("\n") || "Done.";
      onDelta(text);
      onDone();
      return;
    }

    if (!resp.body) {
      onError("No response stream");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Connection failed");
  }
}
