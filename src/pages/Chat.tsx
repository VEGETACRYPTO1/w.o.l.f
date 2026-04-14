import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, User, Loader2, Swords, Leaf, Brain, Volume2 } from "lucide-react";
import { useMode } from "@/contexts/ModeContext";
import { streamWolfChat, type Msg } from "@/lib/wolfChat";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { resetSphere } from "@/components/CyberGlobe";
import { ExternalLink } from "lucide-react";
import { getCurrentVoiceMode, setVoiceMode, speak, type VoiceMode } from "@/lib/wolfVoice";

function openTab(query: string) {
  const url = query.startsWith("http")
    ? query
    : "https://www.google.com/search?q=" + encodeURIComponent(query);

  const newWindow = window.open(url, "_blank");

  if (!newWindow) {
    window.location.href = url;
  }
}

function ChatMessage({ content }: { content: string }) {
  // Detect clickable open links: 🌐 [Open: query](search:query)
  const linkMatch = content.match(/🌐 \[Open: (.+?)\]\(search:(.+?)\)/);
  if (linkMatch) {
    const query = linkMatch[2];
    return (
      <button
        onClick={() => openTab(query)}
        className="flex items-center gap-2 text-primary hover:underline cursor-pointer text-left"
      >
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        🌐 Open: {query}
      </button>
    );
  }
  return <ReactMarkdown>{content}</ReactMarkdown>;
}

const MODE_SELECTION_MSG = "Choose your mode:";

const VOICE_MODES: { id: VoiceMode; label: string; icon: string; color: string }[] = [
  { id: "intelligence", label: "Intel", icon: "🧠", color: "rgba(255,215,0,0.4)" },
  { id: "war", label: "War", icon: "⚔️", color: "rgba(239,68,68,0.4)" },
  { id: "relax", label: "Relax", icon: "🧘", color: "rgba(34,197,94,0.4)" },
];

function VoiceModeSelector() {
  const [active, setActive] = useState<VoiceMode>(getCurrentVoiceMode());

  const handleSelect = (mode: VoiceMode) => {
    setActive(mode);
    setVoiceMode(mode);
  };

  return (
    <div className="flex items-center gap-2">
      <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {VOICE_MODES.map((vm) => (
        <button
          key={vm.id}
          onClick={() => handleSelect(vm.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            active === vm.id
              ? "scale-105 ring-1"
              : "opacity-50 hover:opacity-80"
          }`}
          style={{
            background: active === vm.id ? vm.color.replace("0.4", "0.15") : "transparent",
            borderColor: active === vm.id ? vm.color : "transparent",
            boxShadow: active === vm.id ? `0 0 8px ${vm.color}` : "none",
          }}
        >
          <span>{vm.icon}</span>
          {vm.label}
        </button>
      ))}
    </div>
  );
}

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

  const selectMode = (selectedMode: "intelligence" | "war" | "relax") => {
    setMode(selectedMode);
    setAwaitingModeSelection(false);
    setLastWasModePrompt(false);
    const labels: Record<string, string> = {
      intelligence: "🧠 Intelligence Mode activated. Ask anything.",
      war: "⚔️ War Mode activated. State your objective.",
      relax: "🧘 Relax Mode activated. What would you like to work on?",
    };
    setMessages((prev) => [...prev, { role: "assistant", content: labels[selectedMode] }]);
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
      if (lower.includes("intelligence")) { selectMode("intelligence"); return; }
      if (lower.includes("war")) { selectMode("war"); return; }
      if (lower.includes("relax")) { selectMode("relax"); return; }
      setMessages((prev) => [...prev, { role: "assistant", content: 'Please reply with "Intelligence", "War", or "Relax" to choose your mode.' }]);
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
        !m.content.startsWith("🧠 Intelligence Mode activated") &&
        !m.content.startsWith("⚔️ War Mode activated") &&
        !m.content.startsWith("🧘 Relax Mode activated") &&
        m.content !== 'Please reply with "Intelligence", "War", or "Relax" to choose your mode.'
      ),
      mode,
      onDelta: upsertAssistant,
      onDone: () => {
        setIsLoading(false);
        if (assistantSoFar) {
          setTimeout(() => (window as any).wolfSpeak?.(assistantSoFar) || speak(assistantSoFar), 50);
        }
      },
      onError: (err) => {
        setIsLoading(false);
        toast.error(err);
      },
      onAction: (label) => {
        setMessages((prev) => [...prev, { role: "assistant", content: label }]);
        setIsLoading(false);
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
                <ChatMessage content={msg.content} />
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
              onClick={() => selectMode("intelligence")}
              className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold transition-all hover:scale-105 border"
              style={{
                background: "rgba(255, 215, 0, 0.15)",
                borderColor: "rgba(255, 215, 0, 0.4)",
                color: "#FFD700",
                boxShadow: "0 0 20px rgba(255, 215, 0, 0.2)",
              }}
            >
              <Brain className="h-4 w-4" />
              Intelligence
            </button>
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
              War
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
              Relax
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

      <div className="border-t border-border pt-4 space-y-3">
        <VoiceModeSelector />
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
