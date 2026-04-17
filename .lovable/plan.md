
**Goal:** Add a hardcoded asleep state showing only a centered CSS glowing orb. No Three.js, no voice, no transitions yet — just the visual.

**Changes**

1. **`src/components/AppLayout.tsx`** — at the top, hardcode `const asleep = true;`. If `asleep`, return ONLY the orb (no `CyberGlobe`, no `ChatOverlay`, no children, no scanline). Else, return existing layout.

2. **New `src/components/SleepOrb.tsx`** — pure CSS:
   - Fixed full-screen black background, flex center.
   - Single `<div>` ~200px circle with radial-gradient gold glow (`hsl(var(--primary))` core fading to transparent), large `box-shadow` bloom in same gold.
   - Two animations via Tailwind arbitrary values / `index.css` keyframes:
     - `breathe`: scale 1 → 1.08 → 1 over ~5s ease-in-out infinite.
     - `spin-slow`: rotate 360° over ~30s linear infinite (subtle since orb is radial — gives shimmer feel via slight gradient asymmetry).
   - Add the two keyframes to `tailwind.config.ts` (`breathe`, `spin-slow`) so they're reusable.

**Files**
- Edit: `src/components/AppLayout.tsx`
- Edit: `tailwind.config.ts` (add `breathe` + `spin-slow` keyframes/animations)
- New: `src/components/SleepOrb.tsx`

**Result:** Black screen with one smooth gold orb breathing and slowly rotating in the center. Nothing else.
