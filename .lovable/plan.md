
**Goal:** Add a sleep/wake gate in front of the main app. Initial load shows only a centered breathing energy ball. Voice command transitions in/out of the full brain UI.

---

### Architecture

**New: `src/contexts/WakeContext.tsx`**
- State: `wakePhase: "sleeping" | "waking" | "awake" | "sleeping-out"`
- Persisted to `localStorage` so refresh returns to last state (default: `sleeping`)
- Actions: `wake()`, `sleep()`

**New: `src/components/EnergyBall.tsx`**
- Standalone full-screen `<Canvas>` with black background
- Single small icosahedron (~size of one brain node, centered) + soft additive halo sprite
- Color: intelligence-mode gold (`#ffd700`) — same look/feel as brain nodes
- Behaviors:
  - Breathes (sine scale) — same rhythm as brain nodes
  - Slowly rotates on Y axis
  - Pulses brighter on mic input via `getSpeakingIntensity()` from `brainEvents`
- Animation phases driven by `wakePhase`:
  - `sleeping` → idle breathe + rotate
  - `waking` → quick scale-up flash, particle burst outward (~60 particles fly out + fade), then ball fades out → calls `wake complete`
  - `sleeping-out` → ball pulses bright, ready to receive (visual only — actual implosion handled on brain side)

**New: `src/components/SleepWakeListener.tsx`**
- Lightweight `SpeechRecognition` always-on listener
- Phrases:
  - When `sleeping`: "wake up" / "wolf" / "hey wolf" → `wake()`
  - When `awake`: "go to sleep" / "sleep" → `sleep()` + call `stopHandsFree()` from `wolfVoice` to kill mic
- Auto-restarts on `onend`/`onerror` (same pattern as `wolfVoice`)
- Only one instance mounted at a time to avoid Web Speech conflicts

**Modify `src/App.tsx`**
- Wrap with `<WakeProvider>`
- Conditional render based on `wakePhase`:
  - `sleeping` or `waking` → render `<EnergyBall />` + `<SleepWakeListener />` only (no router, no layout)
  - `awake` → render existing `<BrowserRouter><AppLayout>...</AppLayout></BrowserRouter>` with `animate-fade-in`, plus `<SleepWakeListener />`
  - `sleeping-out` → render BOTH: AppLayout fading out + brain dissolve animation, then EnergyBall fades in
- Transition orchestration in a small `useEffect` based on phase

**Modify `src/components/CyberGlobe.tsx` (minimal additive)**
- Accept optional `dissolving: boolean` prop
- When `true`: animate all node positions toward center (lerp), shrink scale to 0, fade opacity over ~1s — "black hole" effect
- When mount happens after wake: brief "forming" animation — nodes scale from 0 → 1 over ~1s with slight outward spawn

**Modify `src/lib/wolfVoice.ts`**
- No behavioral changes; just ensure `stopHandsFree()` is callable from `SleepWakeListener` (already exported ✓)

---

### Transition Sequences

**Wake** (`sleeping` → `awake`):
1. User says "wake up" → `wake()` sets phase to `waking`
2. EnergyBall plays burst animation (~800ms): scale up, particle explosion, fade out
3. Phase set to `awake` → AppLayout mounts with `fade-in`, brain plays "forming" animation

**Sleep** (`awake` → `sleeping`):
1. User says "go to sleep" → `sleep()` sets phase to `sleeping-out`, calls `stopHandsFree()`
2. Brain plays "black hole" dissolve (~1s): nodes spiral to center, shrink, fade
3. AppLayout fades out simultaneously
4. EnergyBall fades in at center
5. Phase set to `sleeping` → only EnergyBall remains

---

### Files
- **New**: `src/contexts/WakeContext.tsx`
- **New**: `src/components/EnergyBall.tsx`
- **New**: `src/components/SleepWakeListener.tsx`
- **Edit**: `src/App.tsx` (wrap + conditional render)
- **Edit**: `src/components/CyberGlobe.tsx` (add `dissolving` prop + forming animation)

### Result
Refresh → black screen, small gold breathing/rotating orb in center, reacts to your voice. Say "wake up" → bursts into particles, brain UI fades in. Say "go to sleep" → brain spirals into orb like a black hole, mic off, only orb remains. State persists across refreshes.
