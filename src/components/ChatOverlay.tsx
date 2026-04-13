import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, X, Bot, User } from "lucide-react";
import { useMode } from "@/contexts/ModeContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const modeGreetings: Record<string, string> = {
  war: "W.O.L.F active. State your objective.",
  rebuild: "W.O.L.F active. Let's assess and plan strategically.",
  expansion: "W.O.L.F active. Let's explore new possibilities.",
};

const modeResponses: Record<string, string> = {
  war: "Understood. Here's the action plan:\n\n1. **Identify the #1 priority** — What moves the needle most?\n2. **Block 2 hours** of uninterrupted deep work\n3. **Eliminate** all non-essential tasks\n\nNo excuses. Execute now.",
  rebuild: "Let's break this down methodically:\n\n1. **Audit** — What's working, what's not?\n2. **Simplify** — Remove complexity\n3. **Rebuild systems** one at a time\n\nPatience is a weapon. Use it.",
  expansion: "Interesting direction. Here's how to explore it:\n\n1. **Brainstorm freely** — No bad ideas in this phase\n2. **Prototype fast** — Test one concept today\n3. **Seek unexpected connections**\n\nGrowth lives outside comfort zones.",
};

export function ChatOverlay() {
  const [open, setOpen] = useState(false);
  const { mode } = useMode();
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
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "assistant", content: modeResponses[mode] }]);
    }, 800);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
        style={{
          background: "rgba(0,0,0,0.7)",
          border: "1px solid hsl(var(--primary) / 0.4)",
          boxShadow: "0 0 20px hsl(var(--primary) / 0.3)",
          backdropFilter: "blur(10px)",
        }}
      >
        {open ? (
          <X className="h-6 w-6 text-primary" />
        ) : (
          <MessageSquare className="h-6 w-6 text-primary" />
        )}
      </button>

      {/* Chat Overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 z-50"
            style={{
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(500px, calc(100vw - 40px))",
            }}
          >
            <div
              className="rounded-xl overflow-hidden flex flex-col"
              style={{
                background: "rgba(0,0,0,0.85)",
                border: "1px solid hsl(var(--primary) / 0.3)",
                backdropFilter: "blur(16px)",
                maxHeight: "60vh",
              }}
            >
              {/* Header */}
              <div
                className="px-4 py-3 flex items-center gap-2 border-b"
                style={{ borderColor: "hsl(var(--primary) / 0.2)" }}
              >
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold tracking-wider text-foreground">
                  W.O.L.F
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-auto p-4 space-y-3" style={{ maxHeight: "40vh" }}>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="h-6 w-6 rounded-md bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="h-3 w-3 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/5 border border-white/10 text-foreground"
                      }`}
                    >
                      {msg.content}
                    </div>
                    {msg.role === "user" && (
                      <div className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t" style={{ borderColor: "hsl(var(--primary) / 0.2)" }}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Command W.O.L.F..."
                    className="flex-1 bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
