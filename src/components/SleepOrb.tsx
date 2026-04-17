export function SleepOrb() {
  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">
      <div
        className="relative w-[220px] h-[220px] rounded-full animate-breathe"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, hsl(var(--primary) / 0.95) 0%, hsl(var(--primary) / 0.6) 25%, hsl(var(--primary) / 0.2) 55%, transparent 75%)",
          boxShadow:
            "0 0 60px 10px hsl(var(--primary) / 0.45), 0 0 140px 40px hsl(var(--primary) / 0.25), 0 0 260px 80px hsl(var(--primary) / 0.12)",
        }}
      >
        <div
          className="absolute inset-0 rounded-full animate-spin-slow"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0%, hsl(var(--primary) / 0.15) 25%, transparent 50%, hsl(var(--primary) / 0.1) 75%, transparent 100%)",
            mixBlendMode: "screen",
          }}
        />
      </div>
    </div>
  );
}
