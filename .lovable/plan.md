
**Goal:** Transform background stars from static field into a living deep-space travel scene, scoped only to the existing `BackgroundStars` setup in `src/components/CyberGlobe.tsx`.

**Changes (1 file: `src/components/CyberGlobe.tsx`)**

1. **Drifting stars with parallax depth**
   - Assign each background star a per-star velocity vector + a depth/layer factor (3 layers: far/mid/near).
   - Far stars drift very slowly, near stars drift faster — creates parallax.
   - Per frame: update star positions by `velocity * depthFactor * dt`. Wrap stars around a bounding sphere/box so they re-enter from the opposite side (infinite field).
   - Push updated positions into the star `BufferGeometry` `position` attribute and flag `needsUpdate`.

2. **Dynamic constellation lines that follow the stars**
   - Keep the existing nearest-neighbor connection logic, but rebuild the line segment positions every frame from the moved star positions (same index pairs — no re-computation of neighbors, just refresh endpoints).
   - Lines remain at ~5% white opacity, so they appear to gently breathe with the drift.

3. **Warp streaks (subtle passing stars)**
   - Maintain a small pool (max 3-5 active at a time) of "streak" stars: separate `THREE.Line` segments with additive blending, white, low opacity (~15%).
   - Spawn one every 2-5s at a random offscreen edge with a high-velocity vector aimed roughly past the camera. Length scales with speed.
   - Despawn when out of bounds. Capped count keeps it "just a few".

4. **Scope guarantee**
   - All changes live inside the `BackgroundStars` component / setup block. Brain mesh, pulses, shockwave, breathing, and CRT scanline overlay are untouched.

**Result:** The brain feels suspended in deep space, slowly traveling — distant stars drift gently, near stars slide by faster, faint constellation web flexes with them, and the occasional star streaks past like a warp moment.
