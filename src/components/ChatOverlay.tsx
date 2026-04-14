import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, User, Swords, Leaf, Brain } from "lucide-react";
import { useMode, type Mode } from "@/contexts/ModeContext";
import { streamWolfChat, type Msg } from "@/lib/wolfChat";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { resetSphere } from "@/components/CyberGlobe";
import { handleMemoryAction, openTab } from "@/lib/wolfMemory";

export function ChatOverlay() {
  const [open, setOpen] = useState(false);
  const [wolfPulse, setWolfPulse] = useState(false);
  const { mode, setMode } = useMode();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleChat = () => {
    setWolfPulse(true);
    setTimeout(() => setWolfPulse(false), 400);
    setTimeout(() => setOpen((v) => !v), 100);
  };

  const handleWolfClick = () => {
    setShowModeSelector((v) => !v);
    resetSphere();
  };

  const selectMode = (selectedMode: Mode) => {
    setMode(selectedMode);
    setShowModeSelector(false);
    const labels: Record<Mode, string> = {
      intelligence: "🧠 Intelligence Mode active.",
      war: "⚔️ War Mode activated.",
      relax: "🧘 Relax Mode activated.",
      rebuild: "🔧 Rebuild Mode activated.",
      expansion: "🌱 Expansion Mode activated.",
    };
    setMessages((prev) => [...prev, { role: "assistant", content: labels[selectedMode] }]);
  };

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setShowModeSelector(false);

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

    const modeLabels = ["🧠 Intelligence Mode active.", "⚔️ War Mode activated.", "🧘 Relax Mode activated.", "🔧 Rebuild Mode activated.", "🌱 Expansion Mode activated."];

    await streamWolfChat({
      messages: newMessages.filter((m) => !modeLabels.includes(m.content)),
      mode,
      onDelta: upsertAssistant,
      onDone: () => setIsLoading(false),
      onError: (err) => {
        setIsLoading(false);
        toast.error(err);
      },
    });
  };

  const renderContent = (content: string) => {
    // Detect clickable open links: 🌐 [Open: query](search:query)
    const linkRegex = /🌐 \[Open: (.+?)\]\(search:(.+?)\)/g;
    const match = linkRegex.exec(content);
    if (match) {
      const query = match[2];
      return (
        <button
          onClick={() => openTab(query)}
          className="text-left underline decoration-primary/50 hover:decoration-primary transition-colors"
        >
          🌐 Open: {match[1]}
        </button>
      );
    }
    return <ReactMarkdown>{content}</ReactMarkdown>;
  };

  return (
    <>
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full flex items-center justify-center shadow-lg hover:scale-110"
        style={{
          background: "rgba(0,0,0,0.7)",
          border: "1px solid hsl(var(--primary) / 0.4)",
          boxShadow: open
            ? "0 0 25px hsl(var(--primary) / 0.5)"
            : "0 0 20px hsl(var(--primary) / 0.3)",
          backdropFilter: "blur(10px)",
          transition: "transform 0.2s ease, box-shadow 0.3s ease",
          animation: wolfPulse ? "wolfPulse 0.4s ease" : "none",
        }}
      >
        {open ? <X className="h-6 w-6 text-primary" /> : <span className="text-2xl">🐺</span>}
      </button>

      <div
        className="fixed z-50"
        style={{
          bottom: "100px",
          right: "40px",
          width: "min(500px, calc(100vw - 80px))",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0px) scale(1)" : "translateY(30px) scale(0.9)",
          transformOrigin: "bottom right",
          pointerEvents: open ? "auto" as const : "none" as const,
          transition: "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease",
          boxShadow: open
            ? "0 0 20px hsl(var(--glow-primary) / 0.2), 0 0 60px hsl(var(--glow-primary) / 0.08)"
            : "none",
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
              <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ borderColor: "hsl(var(--primary) / 0.2)" }}>
                <button
                  onClick={handleWolfClick}
                  className="hover:scale-110 transition-transform"
                  title="Switch Mode"
                >
                  <span className="text-base">🐺</span>
                </button>
                <span className="text-sm font-bold tracking-wider text-foreground">W.O.L.F</span>
              </div>

              {/* Mode selector (only visible when wolf logo clicked) */}
              <AnimatePresence>
                {showModeSelector && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b"
                    style={{ borderColor: "hsl(var(--primary) / 0.2)" }}
                  >
                    <div className="flex gap-2 p-3">
                      <button
                        onClick={() => selectMode("intelligence")}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105 border"
                        style={{
                          background: mode === "intelligence" ? "rgba(198, 167, 94, 0.25)" : "rgba(198, 167, 94, 0.1)",
                          borderColor: mode === "intelligence" ? "rgba(255, 211, 107, 0.6)" : "rgba(198, 167, 94, 0.3)",
                          color: "#FFD36B",
                          boxShadow: mode === "intelligence" ? "0 0 15px rgba(255, 211, 107, 0.3)" : "none",
                        }}
                      >
                        <Brain className="h-3 w-3" />
                        Intelligence
                      </button>
                      <button
                        onClick={() => selectMode("war")}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105 border"
                        style={{
                          background: mode === "war" ? "rgba(220, 38, 38, 0.25)" : "rgba(220, 38, 38, 0.1)",
                          borderColor: mode === "war" ? "rgba(220, 38, 38, 0.6)" : "rgba(220, 38, 38, 0.3)",
                          color: "#ef4444",
                          boxShadow: mode === "war" ? "0 0 15px rgba(220, 38, 38, 0.3)" : "none",
                        }}
                      >
                        <Swords className="h-3 w-3" />
                        War
                      </button>
                      <button
                        onClick={() => selectMode("relax")}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105 border"
                        style={{
                          background: mode === "relax" ? "rgba(0, 255, 204, 0.25)" : "rgba(0, 255, 204, 0.1)",
                          borderColor: mode === "relax" ? "rgba(0, 255, 204, 0.6)" : "rgba(0, 255, 204, 0.3)",
                          color: "#00ffcc",
                          boxShadow: mode === "relax" ? "0 0 15px rgba(0, 255, 204, 0.3)" : "none",
                        }}
                      >
                        <Leaf className="h-3 w-3" />
                        Relax
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div className="flex-1 overflow-auto p-4 space-y-3" style={{ maxHeight: "40vh" }}>
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground text-xs opacity-60 py-8">
                    Send a message to begin.
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: "rgba(255,255,255,0.05)" }}>
                        <span className="text-xs leading-none">🐺</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                          : "bg-white/5 border border-white/10 text-foreground prose prose-xs prose-invert max-w-none"
                      }`}
                    >
                      {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
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
                    <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "rgba(255,255,255,0.05)" }}>
                      <span className="text-xs leading-none animate-pulse">🐺</span>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground">
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {/* Input */}
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
          </div>
        </div>
    </>
  );
}
