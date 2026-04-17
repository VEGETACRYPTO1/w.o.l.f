
**Goal:** (1) Heavily reduce stars + constellations, (2) Add sleep/wake state with a centered energy ball gating the full UI.

---

### Part 1 — Tone down background (`src/components/CyberGlobe.tsx`)
- Stars: 300 → **90**
- Constellation pairs: only build for ~**15%** of stars (random skip), and tighten threshold from 1.6 → 1.0 so far stars never connect
- Line opacity: 0.05 → **0.025** (barely visible)
- Streaks unchanged (already rare)

### Part 2 — Sleep/Wake system

**New file: `src/contexts/WakeContext.tsx`**
- Provides `{ awake: boolean, wake(): void, sleep(): void }`
- Starts `awake = false` (sleep state on first load)
- Persists to `localStorage` so refresh keeps state

**New file: `src/components/EnergyBall.tsx`**
- Standalone full-screen `<Canvas>` with a single glowing icosahedron + soft additive particle halo
- Breathes (scale sine), rotates, reacts to mic via `getSpeakingIntensity()` from existing `brainEvents`
- Color from `useMode()` (uses `modeColors.highlight`)
- Two animation modes:
  - **Idle**: gentle breathe + rotate
  - **Bursting** (when wake fires): scales up, particles explode outward, then fades out → triggers `onBurstComplete`
  - **Imploding** (when sleep fires): receives external particles spiraling inward (purely visual on EnergyBall side it just pulses bright as they "land"), then settles to idle
- Exposes imperative trigger via prop or context

**New file: `src/components/SleepWakeListener.tsx`**
- Mounts a `SpeechRecognition` (Web Speech API) when **awake=false** to listen for "wake up" / "wolf" → calls `wake()`
- When **awake=true**, listens for "go to sleep" / "sleep" → calls `sleep()`
- Reuses logic similar to existing `wolfVoice` but lightweight (just trigger phrases). To avoid conflicting with the main voice system, only this minimal recognizer runs in sleep mode; in awake mode the existing wolfVoice handles its own listening but we ALSO route the "sleep" phrase through it via a small hook (subscribe to a new event or piggyback `onTranscript`).
- Simpler approach: run a dedicated lightweight recognizer that always listens for those specific trigger words regardless of mode; the existing main voice system continues separately. Web Speech API allows multiple recognizers but it's flaky — instead we'll only run the trigger recognizer when **awake=false** (sleep), and when awake we hook into the existing `wolfVoice` transcript stream (add an `onTranscript` listener). 
- Check `wolfVoice.ts` for an existing transcript callback hook; if present, subscribe; if not, add a tiny exported `onTranscript` event.

**Modify `src/App.tsx` (or `AppLayout.tsx`)**
- Wrap routes in `<WakeProvider>`
- Conditionally render:
  - `awake === false` → only `<EnergyBall />` + `<SleepWakeListener />`. No sidebar, no header, no chat, no brain.
  - `awake === true` → existing layout, fades in via `transition-opacity duration-700`. Brain particles "form" effect: brain mounts with an `entering` animation (handled by adding an `appearing` flag to `BrainNetwork` that scales nodes from 0 over ~1s). EnergyBall fades out simultaneously.
- Sleep transition: when `sleep()` is called, set an `transitioning` flag → fade out UI (700ms) → unmount UI → mount EnergyBall pulsing bright once → set `awake=false`.

**Modify `src/components/CyberGlobe.tsx`**
- Accept optional `appearing` prop (default false). When true, multiply node scales by an eased `[0..1]` value over the first 1.2s after mount. This gives the "particles forming the brain" feel.

**Modify `src/lib/wolfVoice.ts`**
- Quickly inspect: if it already exposes an `onTranscript` subscriber, use it. Otherwise add `subscribeTranscript(cb)` that fires on every recognized phrase. Keep changes minimal and additive (no behavior change to existing voice logic).

### Files
- **Edit**: `src/components/CyberGlobe.tsx` (reduce stars/lines, add `appearing` prop)
- **Edit**: `src/App.tsx` (wrap with WakeProvider, gate UI)
- **Edit**: `src/lib/wolfVoice.ts` (add transcript subscriber if missing — additive only)
- **New**: `src/contexts/WakeContext.tsx`
- **New**: `src/components/EnergyBall.tsx`
- **New**: `src/components/SleepWakeListener.tsx`

### Result
- Background: sparse stars, rare faint constellations.
- First load: black screen with one breathing glowing ball (mode color), reacting to mic.
- Say "wake up" / "wolf" → ball bursts, brain forms from particles, full UI fades in.
- Say "go to sleep" / "sleep" → UI fades out, brain implodes into the ball, mic stops, only ball remains.
