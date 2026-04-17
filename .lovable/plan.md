
Goal: polish the existing sleep/wake system so it feels premium and cinematic: cleaner orb, smoother wake burst, and a real visible black-hole pull on sleep.

1. Orb cleanup in `src/components/EnergyBall.tsx`
- Remove the visible “highlight” look by replacing the current larger glow mesh with a much tighter additive light bloom only.
- Keep the small faceted core, but make the surrounding light read as brightness, not a second shape.
- Preserve the sparse starfield behind it so the orb sits in space, not on a fake backdrop.

2. Make wake feel smoother and more cinematic
- Rework the wake timing so it becomes: charge-up → subtle shake ramp for about 1 second → tight bright bloom → tiny fast particle burst → crossfade into brain/UI.
- Reduce the feeling of a hard snap by overlapping the orb fade-out with the brain/forming fade-in.
- Keep the particles small and fast so the burst feels sharp, not cartoonish.

3. Fix why the black-hole sleep effect currently feels broken
- The current effect is being dominated by the whole wrapper collapsing, so the individual suction on HUD elements is barely readable.
- Replace the generic wrapper shrink-first approach with staged element suction:
  - chat button/panel
  - W.O.L.F title
  - time/date
  - globe/root scene
- Each marked element should visibly translate to center, spin harder over time, shrink, blur, and brighten as it gets pulled in.

4. Rebuild the sleep transition around the orb
- Keep the orb centered and visible as the destination core during sleep-out.
- Make the brain collapse inward more aggressively at the same time the HUD gets sucked in.
- End with the orb re-forming cleanly in the center once everything has converged.

5. Tighten the implementation details
- `src/App.tsx`
  - adjust `WakeGate` orchestration so the app stays on screen long enough for the suction to be seen
  - remove or soften the wrapper-level animation that is hiding the black-hole effect
  - keep the orb layered above the collapsing app during sleep-out
- `src/index.css`
  - rewrite the black-hole keyframes to prioritize visible inward travel and spin, not just fade/shrink
  - add a separate stronger center-collapse animation for the full-screen scene if needed
- `src/components/CyberGlobe.tsx`
  - strengthen the internal dissolve so the neural core clearly collapses into center during sleep
  - keep the existing cleaner background/star settings
- `src/pages/Dashboard.tsx` and `src/components/ChatOverlay.tsx`
  - verify all key HUD pieces are explicitly tagged for suction so the effect reads clearly
- also fix the current ref warning tied to the transition flow while touching this logic, so the animation runs on real DOM wrappers only

6. Result
- Sleep screen: small clean orb with bright node-like light only, no ugly highlight shape.
- Wake: smoother blend with a short cinematic shake and a sharper, smaller burst into the brain/UI.
- Sleep: actual black-hole feel — the HUD and brain visibly spiral and get dragged into the center orb instead of just fading away.
