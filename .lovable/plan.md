

**Root cause of "doesn't work":** The component crashes with `TypeError: undefined is not an object (evaluating 'edges[p.edgeIdx]')` at line 591 in `CyberGlobe.tsx`. When this throws, the whole brain unmounts → no shockwave can ever render. So even though the burst event fires correctly (we can see `MODE: war/relax/intelligence` in logs), the visual never appears because the canvas has crashed.

The crash happens because `pulses` React state can contain stale `edgeIdx` values after HMR / re-mounts, or `edgesByNode[p.toNode]` returns `undefined` if `toNode` is out of range.

**Fix (1 file: `src/components/CyberGlobe.tsx`):**

1. **Guard the render map (line 590-612):** filter out invalid pulses before mapping — skip any `p` where `edges[p.edgeIdx]` is undefined or `nodes[p.toNode]` is undefined.

2. **Guard the chaining loop (line 510-545):** before reading `edgesByNode[p.toNode]`, check it exists; before reading `edges[p.edgeIdx]` for `edgeGlow`, bounds-check `p.edgeIdx < edges.length`.

3. **Guard the burst spawn loop (line 263-280):** ensure `edges[edgeIdx]` exists before destructuring.

4. **Sanity log** when shockwave fires so we can confirm it visually in console: `console.log("💥 BURST", color)`.

This will stop the crash, keep the canvas alive, and let the already-correct shockwave rendering actually show on screen.

**Files to edit:**
- `src/components/CyberGlobe.tsx` — add defensive guards in 3 spots + 1 debug log.

**Result:** Mode change (UI or voice) → no crash → colored radial shockwave fires from center as designed.

