# A10 status regression checks

Run `npm run test:a10`. The production `npm run build -- --configLoader native`
also runs these checks before building, including on Cloudflare Pages.

The tests execute the current functions from `app.js` in an isolated DOM/HTTP
fixture. They cover member-visible errors, HTTP and response-body deadlines,
stopping/retrying status queries, stale responses, file/finish/mode changes,
job identity, submission idempotency and dispatch pending states. Timers are
shortened only inside the test fixture. No production API or GPU is called.

For browser verification, exercise the full application with a local mock API:
401/403, failed/timeout/unsupported, five network failures followed by a
same-job retry, a stalled response body, and switching tasks during a request.
Check the console and verify input changes do not display the previous result.
This verifies UI behavior; it does not certify generated SKP geometry or the
production member upload/dispatch/worker/download chain.
