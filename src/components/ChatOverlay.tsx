import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, X, Bot, User, Loader2 } from "lucide-react";
import { useMode } from "@/contexts/ModeContext";
import { streamWolfChat, type Msg } from "@/lib/wolfChat";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const modeGreetings: Record<string, string> = {
  war: "W.O.L.F active. State your objective.",
  rebuild: "W.O.L.F active. Let's assess and plan strategically.",
  expansion: "W.O.L.F active. Let's explore new possibilities.",
};

export function ChatOverlay() {
  const [open, setOpen] = useState(false);
  const { mode } = useMode();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: modeGreetings[mode] },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages([{ role: "assistant", content: modeGreetings[mode] }]);
  }, [mode]);

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && prev.length > newMessages.length) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev.slice(0, newMessages.length), { role: "assistant", content: assistantSoFar }];
      });
    };

    await streamWolfChat({
      messages: newMessages.filter((m) => m.content !== modeGreetings[mode]),
      mode,
      onDelta: upsertAssistant,
      onDone: () => setIsLoading(false),
      onError: (err) => {
        setIsLoading(false);
        toast.error(err);
      },
    });
  };

  return (
    <>
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
        {open ? <X className="h-6 w-6 text-primary" /> : <MessageSquare className="h-6 w-6 text-primary" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 z-50"
            style={{ left: "50%", transform: "translateX(-50%)", width: "min(500px, calc(100vw - 40px))" }}
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
              <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ borderColor: "hsl(var(--primary) / 0.2)" }}>
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold tracking-wider text-foreground">W.O.L.F</span>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-3" style={{ maxHeight: "40vh" }}>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className="h-6 w-6 rounded-md bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="h-3 w-3 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                          : "bg-white/5 border border-white/10 text-foreground prose prose-xs prose-invert max-w-none"
                      }`}
                    >
                      {msg.role === "assistant" ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                    </div>
                    {msg.role === "user" && (
                      <div className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-2">
                    <div className="h-6 w-6 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                      <Loader2 className="h-3 w-3 text-primary animate-spin" />
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground">
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <div className="p-3 border-t" style={{ borderColor: "hsl(var(--primary) / 0.2)" }}>
                <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Command W.O.L.F..."
                    disabled={isLoading}
                    className="flex-1 bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50"
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
