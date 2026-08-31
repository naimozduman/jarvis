/**
 * The Phase 3.6 bridge package intentionally has no ambient network composition. Starting this
 * binary before the Phase 3.6B local operator setup is a configuration error rather than an
 * opportunity to create an Evolution session, pair WhatsApp, or silently use cloud credentials.
 *
 * A future explicit local composition injects a verified Evolution port, an opaque Convex signal
 * subscription, and a VercelBridgeApiClient into createLocalBridgeRuntime. The injectable runtime
 * is exported from this package today; this guard makes the package's standard start command
 * fail closed until that operator-owned composition exists.
 */
console.error('Local WhatsApp bridge is not configured; Phase 3.6B operator setup is required.');
process.exitCode = 1;
