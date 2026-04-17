
**Goal:** When mode changes, fire a one-time radial shockwave from the brain's center that travels outward through the synaptic lines, tinted to the mode color, then returns to normal gold rendering.

**Approach:**

1. **Extend `src/lib/brainEvents.ts`**
   - Add a new event type `"modeBurst"` carrying a `{ color: string }` payload.
   - Add `emitModeBurst(color)` and `onModeBurst(cb)` helpers (slight signature change since existing events are payload-less — keep existing API intact, add a parallel typed channel for burst).

2. **Trigger from `src/contexts/ModeContext.tsx`**
   - In `setMode`, after applying the new mode, call `emitModeBurst(color)` with the mapped color:
     - `intelligence` → `#FFD36B`
     - `war` → `#ef4444`
     - `relax` → `#00ffcc`
     - `rebuild` / `expansion` → fall back to gold (or skip).
   - Skip on the very first mount so it doesn't fire on page load.

3. **Render the shockwave in `src/components/CyberGlobe.tsx`**
   - Subscribe to `onModeBurst` inside the brain mesh component. On event, store `{ startTime, color, active: true }` in a ref.
   - Each frame while active (duration ~1.4s):
     - Compute `progress = (now - startTime) / duration` (0→1).
     - Compute a radial wavefront radius = `progress * maxRadius` (where maxRadius covers the whole brain ellipsoid).
     - For each edge, measure its midpoint distance from center. If distance is within a band around the wavefront (e.g. `|dist - radius| < bandWidth`), bump that edge's `edgeGlow` to 1.0 using the burst color.
   - **Color tint:** temporarily override the edge highlight color (`hiR/hiG/hiB`) with the burst color while active, blending back to gold as `progress → 1`. Implement by storing a current `highlightColor` Vector3 in the existing color-write loop and lerping it back to the gold default.
   - Also spawn a handful of pulses originating from center-most nodes radiating outward to reinforce the shockwave through the chaining system already in place.

4. **No core mesh / no breathing changes** — respect prior memory rules ("don't ruin what I built", no volumetric core, single-flow breathing).

**Files to edit:**
- `src/lib/brainEvents.ts` — add burst channel.
- `src/contexts/ModeContext.tsx` — emit burst on mode change (skip first mount).
- `src/components/CyberGlobe.tsx` — subscribe + render shockwave + tint edge highlight color during burst.

**Behavior summary:**
- Mode change → instant single radial wave of colored glow racing through synaptic lines from center outward over ~1.4s → smoothly returns to gold ambient state. No persistent color change to nodes, no visual lingering.
