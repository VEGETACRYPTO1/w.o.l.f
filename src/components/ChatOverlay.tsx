import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, User, Loader2, Swords, Leaf } from "lucide-react";
import { useMode } from "@/contexts/ModeContext";
import { streamWolfChat, type Msg } from "@/lib/wolfChat";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { resetSphere } from "@/components/CyberGlobe";

const MODE_SELECTION_MSG = "Choose your mode:";

export function ChatOverlay() {
  const [open, setOpen] = useState(false);
  const { mode, setMode } = useMode();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [awaitingModeSelection, setAwaitingModeSelection] = useState(false);
  const [lastWasModePrompt, setLastWasModePrompt] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleReset = () => {
    if (lastWasModePrompt) return;
    setAwaitingModeSelection(true);
    setIsFirstMessage(false);
    setIsLoading(false);
    setLastWasModePrompt(true);
    setMessages((prev) => [...prev, { role: "assistant", content: MODE_SELECTION_MSG }]);
    resetSphere();
  };

  const selectMode = (selectedMode: "war" | "relax") => {
    setMode(selectedMode);
    setAwaitingModeSelection(false);
    setLastWasModePrompt(false);
    const label = selectedMode === "war" ? "⚔️ War Mode activated. State your objective." : "🧘 Relax Mode activated. What would you like to work on?";
    setMessages((prev) => [...prev, { role: "assistant", content: label }]);
  };

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    if (isFirstMessage) {
      setIsFirstMessage(false);
      setAwaitingModeSelection(true);
      setLastWasModePrompt(true);
      setMessages((prev) => [...prev, { role: "assistant", content: MODE_SELECTION_MSG }]);
      return;
    }

    if (awaitingModeSelection) {
      const lower = input.trim().toLowerCase();
      if (lower.includes("war")) { selectMode("war"); return; }
      if (lower.includes("relax")) { selectMode("relax"); return; }
      setMessages((prev) => [...prev, { role: "assistant", content: 'Please reply with "War" or "Relax" to choose your mode.' }]);
      return;
    }

    setLastWasModePrompt(false);
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
      messages: newMessages.filter((m) =>
        m.content !== MODE_SELECTION_MSG &&
        !m.content.startsWith("⚔️ War Mode activated") &&
        !m.content.startsWith("🧘 Relax Mode activated") &&
        m.content !== 'Please reply with "War" or "Relax" to choose your mode.'
      ),
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
        {open ? <X className="h-6 w-6 text-primary" /> : <span className="text-2xl">🐺</span>}
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
                <button
                  onClick={handleReset}
                  className="hover:scale-110 transition-transform"
                  title="Reset W.O.L.F"
                >
                  <span className="text-base">🐺</span>
                </button>
                <span className="text-sm font-bold tracking-wider text-foreground">W.O.L.F</span>
              </div>

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
                      {msg.role === "assistant" ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                    </div>
                    {msg.role === "user" && (
                      <div className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}

                {awaitingModeSelection && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 pl-8">
                    <button
                      onClick={() => selectMode("war")}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105 border"
                      style={{
                        background: "rgba(220, 38, 38, 0.15)",
                        borderColor: "rgba(220, 38, 38, 0.4)",
                        color: "#ef4444",
                        boxShadow: "0 0 15px rgba(220, 38, 38, 0.2)",
                      }}
                    >
                      <Swords className="h-3 w-3" />
                      War
                    </button>
                    <button
                      onClick={() => selectMode("relax")}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105 border"
                      style={{
                        background: "rgba(34, 197, 94, 0.15)",
                        borderColor: "rgba(34, 197, 94, 0.4)",
                        color: "#22c55e",
                        boxShadow: "0 0 15px rgba(34, 197, 94, 0.2)",
                      }}
                    >
                      <Leaf className="h-3 w-3" />
                      Relax
                    </button>
                  </motion.div>
                )}

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
