
**Goal:** Rework the visuals so the sleep screen and transitions feel premium, minimal, and cinematic instead of cartoonish.

### 1) Stabilize the wake system first
- Fix the `useWake must be used within WakeProvider` crash by removing direct `useWake()` usage from deep canvas children and passing `phase` into `EnergyBall`/`Orb` as props from `WakeGate`.
- This ensures the preview stays alive while polishing the visuals.

### 2) Simplify the orb to match the neural core
**Files:** `src/components/EnergyBall.tsx`
- Strip out the cartoon elements:
  - remove the outer ring
  - remove the large soft background halo layers
  - keep only a smaller faceted core + a very tight node-like glow
- Reduce core size by about 50%.
- Match the neural node look exactly:
  - same intelligence gold palette
  - sharp faceted geometry
  - subtle bloom, not a big glowing blob
  - slow breathing + rotation + mic-reactive pulse

### 3) Put the orb in deep space, not on a fake glow backdrop
**Files:** `src/components/EnergyBall.tsx`
- Add a sparse starfield behind the orb inside the sleep/wake scene.
- Keep it minimal: tiny white stars, low density, dark empty space around them.
- No big gradient plate behind the orb.

### 4) Rebuild the wake transition to feel cinematic
**Files:** `src/components/EnergyBall.tsx`, `src/App.tsx`, `src/components/CyberGlobe.tsx`
- Replace the current chunky burst with:
  - a short charge-up/compression phase
  - tighter brightness ramp
  - many smaller, faster particles
  - cleaner fade from orb into brain
- Make the brain feel like it is emerging from the orb, not switching abruptly.
- Use a short overlap: orb collapses/erupts while the brain fades/forms in.

### 5) Rebuild sleep into a real black-hole pull
**Files:** `src/App.tsx`, `src/index.css`, `src/components/CyberGlobe.tsx`, `src/components/ChatOverlay.tsx`, `src/pages/Dashboard.tsx`
- Make the suction visible across the whole HUD:
  - chat trigger
  - chat panel
  - W.O.L.F title
  - date/time
  - other marked UI
- Upgrade the current effect from simple shrink/fade into a proper spiral pull:
  - translate toward center
  - increasing spin
  - scale collapse
  - blur/brightness stretch
- At the same time, make the brain itself collapse inward more aggressively so the whole app feels dragged into the same core.
- End with the orb re-forming cleanly at center.

### 6) Tighten the main globe scene
**Files:** `src/components/CyberGlobe.tsx`
- Keep the neural core as the hero.
- Tone down any extra visual clutter around it so the scene feels cleaner and more expensive.
- Preserve the existing core quality while making the transition into/out of it smoother.

### Technical notes
- Keep within the existing Three.js / React Three Fiber setup.
- Do not redesign the whole system; this is a visual quality pass on:
  - `EnergyBall`
  - wake/sleep transition timing
  - black-hole motion
  - neural-core presentation
- Reuse the current gold neural palette and minimal HUD style from project memory.

### Result
- Sleep screen: small premium gold orb in deep space, breathing and rotating, no cartoon glow plate.
- Wake: tense charge → sharp cinematic burst → brain/UI materialize smoothly.
- Sleep: entire UI and brain visibly spiral inward like a black hole and reform into the orb.
