import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, User, Loader2, Swords, Leaf } from "lucide-react";
import { useMode } from "@/contexts/ModeContext";
import { streamWolfChat, type Msg } from "@/lib/wolfChat";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { resetSphere } from "@/components/CyberGlobe";

const MODE_SELECTION_MSG = "Choose your mode:";

function WolfLogo({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 cursor-pointer hover:scale-110 transition-transform"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid hsl(var(--primary) / 0.3)",
        boxShadow: "0 0 10px hsl(var(--primary) / 0.15)",
      }}
      title="Reset W.O.L.F"
    >
      <span className="text-sm leading-none">🐺</span>
    </button>
  );
}

export default function Chat() {
  const { mode, setMode, config } = useMode();
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
    // Don't clear chat — just re-prompt mode selection
    if (lastWasModePrompt) return; // prevent duplicate prompts
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
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-7rem)]">
      <div className="mb-4 flex items-center gap-3">
        <WolfLogo onClick={handleReset} />
        <div>
          <h1 className="text-2xl font-heading font-bold">W.O.L.F</h1>
          <p className="text-xs text-muted-foreground">{config.tone}</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm opacity-60">
            Send a message to begin.
          </div>
        )}
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                <span className="text-sm leading-none">🐺</span>
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-lg text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                  : "bg-card border border-border prose prose-sm prose-invert max-w-none"
              }`}
            >
              {msg.role === "assistant" ? (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === "user" && (
              <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </motion.div>
        ))}

        {awaitingModeSelection && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 pl-10">
            <button
              onClick={() => selectMode("war")}
              className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 border"
              style={{
                background: "rgba(220, 38, 38, 0.15)",
                borderColor: "rgba(220, 38, 38, 0.4)",
                color: "#ef4444",
                boxShadow: "0 0 20px rgba(220, 38, 38, 0.2)",
              }}
            >
              <Swords className="h-4 w-4" />
              War Mode
            </button>
            <button
              onClick={() => selectMode("relax")}
              className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 border"
              style={{
                background: "rgba(34, 197, 94, 0.15)",
                borderColor: "rgba(34, 197, 94, 0.4)",
                color: "#22c55e",
                boxShadow: "0 0 20px rgba(34, 197, 94, 0.2)",
              }}
            >
              <Leaf className="h-4 w-4" />
              Relax Mode
            </button>
          </motion.div>
        )}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <span className="text-sm leading-none animate-pulse">🐺</span>
            </div>
            <div className="px-4 py-3 rounded-lg bg-card border border-border text-sm text-muted-foreground">
              Thinking...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

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
            placeholder="Command W.O.L.F..."
            disabled={isLoading}
            className="flex-1 bg-secondary border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
