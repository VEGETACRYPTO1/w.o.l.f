import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Bot, User } from "lucide-react";
import { useMode } from "@/contexts/ModeContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const modeGreetings: Record<string, string> = {
  war: "War Mode active. State your objective.",
  rebuild: "Rebuild Mode active. Let's assess and plan strategically.",
  expansion: "Expansion Mode active. Let's explore new possibilities.",
};

export default function Chat() {
  const { mode, config } = useMode();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: modeGreetings[mode] },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages([{ role: "assistant", content: modeGreetings[mode] }]);
  }, [mode]);

  const send = () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Mock AI response
    setTimeout(() => {
      const responses: Record<string, string> = {
        war: "Understood. Here's the action plan:\n\n1. **Identify the #1 priority** — What moves the needle most?\n2. **Block 2 hours** of uninterrupted deep work\n3. **Eliminate** all non-essential tasks\n\nNo excuses. Execute now.",
        rebuild: "Let's break this down methodically:\n\n1. **Audit** — What's working, what's not?\n2. **Simplify** — Remove complexity\n3. **Rebuild systems** one at a time\n\nPatience is a weapon. Use it.",
        expansion: "Interesting direction. Here's how to explore it:\n\n1. **Brainstorm freely** — No bad ideas in this phase\n2. **Prototype fast** — Test one concept today\n3. **Seek unexpected connections**\n\nGrowth lives outside comfort zones.",
      };
      setMessages((prev) => [...prev, { role: "assistant", content: responses[mode] }]);
    }, 800);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-7rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-heading font-bold">JARVIS</h1>
        <p className="text-xs text-muted-foreground">{config.tone}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto space-y-4 pb-4">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="h-7 w-7 rounded-md bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              }`}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </motion.div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border pt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Command JARVIS..."
            className="flex-1 bg-secondary border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            className="h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
