
Goal: remove the wake gap and replace the fake sleep snap with a real visible spiral collapse into the orb.

What’s actually wrong now
- Wake gap: `src/App.tsx` applies `wake-emerge` to the entire app wrapper, and that animation starts at low opacity/blur/scale. So while the orb is fading, the brain/UI are still dimmed, which creates the black gap.
- Sleep snap: the current suction only targets a few DOM items with `data-bh` (time, W.O.L.F, chat button/panel). The main brain scene is not being visibly dragged on the DOM layer, so most of the screen just fades instead of spiraling.
- Extra instability: `CyberGlobe.tsx` still has ref warnings from function components in the Three scene, which can interfere with reliable transition behavior.

Plan

1. Fix the wake gap in `src/App.tsx` and `src/index.css`
- Remove the wrapper-level `wake-emerge` effect from the whole app.
- Keep the app fully present during `waking`, and animate only the brain/core formation itself.
- Replace the current low-opacity startup with a center-origin brain formation so the brain is already visible behind the orb burst.
- Result: no black frame between orb and brain.

2. Make the brain truly emerge from the orb in `src/components/CyberGlobe.tsx`
- Rework the brain’s mount animation so it starts as a tiny dense center mass and expands outward from the orb location.
- Add a short synchronized scale/brightness ramp on the brain itself during `waking`.
- Keep the orb on top only during the charge/burst moment, then fade it as the brain becomes dominant.

3. Rebuild sleep around a dedicated full-screen black-hole layer in `src/App.tsx`
- Add a transition overlay for `sleeping-out` that clones the visible HUD pieces into absolute-positioned elements and animates those clones to center.
- Include: date/time, W.O.L.F title, chat trigger, open chat panel, and a visual center mass for the globe.
- Freeze interaction during `sleeping-out` so chat cannot open or change state mid-transition.

4. Make the sleep effect visibly spiral in `src/index.css`
- Replace the current mild suction with stronger spiral keyframes:
  - obvious inward travel first
  - aggressive spin ramp near the end
  - late collapse, not early shrink
  - blur/stretch only in final phase
- Separate wrapper dimming from the suction so motion stays readable instead of being hidden by fade.

5. Strengthen the globe collapse in `src/components/CyberGlobe.tsx`
- Make the neural core internally compress and rotate harder during `sleeping-out`.
- Push nodes/lines inward toward center so the brain itself looks consumed, not just faded out.
- Keep background stars subdued during sleep-out so the core collapse reads clearly.

6. Fix transition orchestration bugs
- `src/components/ChatOverlay.tsx`: hard-disable chat toggle and force-close panel as soon as phase leaves `awake`, so it cannot pop open during sleep.
- `src/contexts/WakeContext.tsx`: slightly retime `waking` and `sleeping-out` so burst/collapse complete before state flips.
- `src/App.tsx`: keep orb visible as the destination point throughout sleep-out, but do not let it cover the screen with an opaque layer during transition.

7. Clean up the Three warnings in `src/components/CyberGlobe.tsx`
- Remove improper ref usage on function components like `ParallaxCamera`, `BackgroundStars`, `BrainNetwork`, and `CursorTracker`.
- This is not just cleanup; it reduces render instability while tuning the transitions.

Expected result
- Wake: orb charges, shakes, bursts, and the brain is already forming from the same center point with no black gap.
- Sleep: the visible HUD and brain spiral inward toward the center orb instead of snapping/fading away.
- Chat stays shut during sleep transitions.
