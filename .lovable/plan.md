
**Problem:** The shockwave doesn't fire because most mode changes come through the **voice path**, not `setMode`. Console logs confirm: `MODE: war`, `MODE: relax`, `MODE: intelligence` are all triggered by voice (`onModeChange` from `wolfVoice`), which directly calls `setModeState` in `ModeContext.tsx` (lines 89-97) and **bypasses `emitModeBurst` entirely**.

Additionally, `setMode` uses functional `setModeState((prev) => ...)` to compare — under React StrictMode this updater runs twice, which can fire the burst twice or behave unpredictably.

**Fix (1 file: `src/contexts/ModeContext.tsx`):**

1. Refactor `setMode` to compare against current `mode` state (not inside setter) before emitting burst, so the burst fires exactly once per real change.
2. In the `onModeChange` voice bridge, emit `emitModeBurst(MODE_BURST_COLORS[voiceMode])` whenever the voice flips the mode to a different value, mirroring the manual path.
3. Use a ref to track the previous mode inside the voice bridge so we only emit on actual changes (avoid emitting if voice re-asserts the same mode).

**Result:** Whether mode is changed via UI button or by saying "war / relax / intelligence" out loud, the colored radial shockwave fires once from center.

**No changes needed** to `CyberGlobe.tsx` or `brainEvents.ts` — the subscription and rendering are already wired correctly.
