
The user is reporting voice activation regressions: "Hey Wolf" wake word isn't triggering, and voice mode switching ("war mode", "relax mode", "intelligence mode") isn't working either.

Let me trace the architecture:

1. `src/components/SleepWakeListener.tsx` — owns one SpeechRecognition instance. It listens for "wake up" / "hey wolf" / "wolf" when sleeping, and "go to sleep" / "sleep" when awake. It does NOT handle mode switches or pass commands to wolfVoice.

2. `src/lib/wolfVoice.ts` — has its OWN `_autoStartListening()` that creates ANOTHER SpeechRecognition instance. It handles `handleWake` ("hey wolf"/"wake up") and `handleModeSwitch` ("war mode", "relax mode", "intelligence mode"). This is started on first body click.

**The conflict:** Two SpeechRecognition instances try to run simultaneously. Most browsers (Chrome especially) only allow ONE SpeechRecognition at a time. When `SleepWakeListener` starts first (on mount, no click required), it grabs the mic. When wolfVoice's listener tries to start on first click, it errors out silently (or one keeps restarting and blocking the other via onend loops).

**Why "wake up" still works partially:** Because `SleepWakeListener` catches it and calls `wake()` from `WakeContext`. But it never calls into `wolfVoice` so:
- No greeting is spoken
- `isAwake` flag in wolfVoice stays false
- Mode switches never get evaluated (wolfVoice's recognition isn't actually receiving events because SleepWakeListener owns the mic)

**Also:** when sleeping, SleepWakeListener listens but only triggers wake on the WakeContext layer. wolfVoice's listener is also trying to run → race / error.

### The fix

Consolidate to ONE recognition pipeline. Make `SleepWakeListener` the single owner of SpeechRecognition, and have it route everything:

1. **Sleeping phase** → listen for wake words → call `wake()` AND notify wolfVoice (set isAwake + speak greeting).
2. **Awake phase** → route all transcripts to wolfVoice for:
   - mode switch detection ("war mode" / "relax mode" / "intelligence mode") → call `setVoiceMode()` (which already syncs through `onModeChange` to React context)
   - sleep command ("go to sleep") → call `sleep()` from WakeContext
   - other commands → forward to chat handler if present
3. **Disable wolfVoice's `_autoStartListening`** so there's only one recognizer.

### Files to change

- `src/lib/wolfVoice.ts`
  - Remove the auto-start click listener that creates a second SpeechRecognition
  - Export helper functions: `processVoiceCommand(text)` that runs `handleWake` → `handleModeSwitch` → command callback
  - Keep `setVoiceMode`, `wolfSpeak`, mode handling intact
- `src/components/SleepWakeListener.tsx`
  - Become the single recognition owner
  - On result: if sleeping → wake-word check; if awake → call `processVoiceCommand` (handles mode switches + sleep command)
  - On wake, also call wolfVoice greeting
- Verify mic permission flow still works (start on first user gesture to satisfy browser autoplay/mic policies)

### Result
- "Hey Wolf" / "Wake up" → wakes the system AND speaks greeting
- "War mode" / "Relax mode" / "Intelligence mode" → switches mode + speaks confirmation + updates globe color
- "Go to sleep" → triggers black-hole sleep transition
- Only one SpeechRecognition instance, no more silent conflicts
