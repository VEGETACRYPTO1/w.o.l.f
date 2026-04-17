
Goal: make wake feel like the brain emerges from the orb, and make sleep show a real visible black-hole pull instead of a snap-to-black.

What’s actually broken now
- The orb layer uses a full black background even during `sleeping-out`, so it visually covers the app while the suction is supposed to happen.
- The brain only renders in `awake`, not during `waking`, so it cannot visibly form out of the burst.
- The current black-hole effect is split between wrapper tinting, a full-screen `data-bh` globe layer, and a short timeout, so the pull reads weakly.

Plan

1. Re-orchestrate wake in `src/App.tsx`
- Render the app during `waking` as well, behind the orb.
- Add a staged overlap:
  - orb charges/shakes/bursts
  - brain starts forming from center before orb fully disappears
  - UI fades in slightly after the brain begins forming
- This will make the brain feel like it comes out of the orb instead of appearing after it.

2. Fix the orb overlay in `src/components/EnergyBall.tsx`
- Keep the sleep screen black only in stable `sleeping`.
- Make the orb scene background transparent during `waking` and `sleeping-out` so the brain/UI remains visible behind it.
- Keep the orb small and bright, with no visible extra shape around it.

3. Rebuild sleep timing in `src/App.tsx` + `src/contexts/WakeContext.tsx`
- Extend `sleeping-out` long enough for the suction to fully play.
- Keep the app mounted until the pull completes, then switch to `sleeping`.
- Keep the orb visible at center as the destination point during the whole collapse.

4. Make the black-hole pull readable in `src/index.css`
- Replace the current mostly fade/shrink feel with a stronger inward travel:
  - larger center translation
  - faster spin ramp near the end
  - scale collapse later, not immediately
  - brightness stretch + blur only in the final phase
- Tone down wrapper-level dimming so it doesn’t hide the motion.

5. Clean up what gets sucked in
- `src/components/AppLayout.tsx`
  - stop relying on one giant full-screen `data-bh` wrapper as the main visible effect
- `src/components/CyberGlobe.tsx`
  - handle the brain collapse internally so the neural core clearly spirals/compresses into center
  - start the brain from a tighter center state during wake so it can “grow out” of the orb
- `src/pages/Dashboard.tsx` and `src/components/ChatOverlay.tsx`
  - keep explicit suction targets for time/date, W.O.L.F title, chat button, chat panel
  - ensure these remain individually visible while being pulled

6. Refine the wake burst in `src/components/EnergyBall.tsx`
- Smooth the burst into 3 phases:
  - charge/compress
  - 1s shake ramp
  - tight bright burst with tiny fast particles
- Crossfade the particle remnant with the brain forming animation so the transition blends instead of snapping.

Expected result
- Wake: orb charges, shakes, bursts, and the brain visibly grows out of that burst.
- Sleep: HUD elements and the brain visibly spiral inward toward the center orb before the screen settles into the sleep state.
- No more “snap into orb” look caused by the black full-screen orb layer.
