
Root cause:
The chat is still failing for the same reason: the frontend is still sending requests to `http://127.0.0.1:8080/v1/chat/completions`. I confirmed this in both the code and the latest network log. The deployed chat function is never being called, so this is not currently a backend issue.

What I found:
- `src/lib/wolfChat.ts` still has:
  ```ts
  fetch("http://127.0.0.1:8080/v1/chat/completions", ...)
  ```
- That same file already defines the correct function URL as:
  ```ts
  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wolf-chat`;
  ```
- The latest browser network log shows the app is still posting to localhost and failing with `Failed to fetch`.

Plan to fix:
1. Update `src/lib/wolfChat.ts` so chat uses `CHAT_URL` instead of the localhost URL.
2. Send the payload the deployed function actually expects:
   - `messages`
   - `mode`
   - `memory`
   - `location`
3. Add the auth header the function call should include:
   ```ts
   Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
   ```
4. Keep the existing SSE/json response handling, since that part already matches the edge function behavior.
5. Verify the fix by checking that:
   - the browser network request goes to `/functions/v1/wolf-chat`
   - the request no longer fails immediately with `Failed to fetch`
   - chat returns either a streamed reply or a real backend error message

Implementation shape:
```ts
const resp = await fetch(CHAT_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  },
  body: JSON.stringify({
    messages,
    mode,
    memory,
    location,
  }),
});
```

Why this is happening:
A previous attempted fix did not actually land in the current codebase. The source file still contains the hardcoded localhost URL, so the app keeps calling a server that does not exist in preview/production.

If anything remains after this fix:
Once the frontend points to the real function, I’ll inspect the backend logs next only if a new error appears. Right now the request is dying before it ever reaches the deployed chat function.
