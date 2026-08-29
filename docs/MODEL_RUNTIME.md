# Model runtime

`ModelGateway` is provider-neutral. `FakeModelGateway` supplies deterministic fixtures for all standard tests. `NotConfiguredModelGateway` reports a clear `not_configured` result and no decision when `OPENAI_API_KEY` is absent.

The optional OpenAI adapter uses the current Responses API and strict Zod Structured Outputs. It sets `store: false`, `truncation: 'disabled'`, and reasoning context to `current_turn`; it supplies neither an OpenAI Conversation nor `previous_response_id`, and exposes no hosted tools or functions. PostgreSQL remains the continuity source.

Logical routes are configured rather than scattered: fast defaults to `gpt-5.6-luna`, standard to `gpt-5.6-terra`, and deep to `gpt-5.6-sol`. Their reasoning effort, verbosity, output caps, and price cards are environment values. Deep routing needs explicit enablement, a remaining deep-call allowance, and the daily limit.

The runtime records route, configured/actual model ID, reasoning effort, safe status/error category, latency, token counts when the provider supplies them, cached/reasoning tokens, and a configured-price estimate. It never logs a full prompt, API key, raw provider response, encrypted reasoning item, or hidden chain-of-thought.

`ModelBudgetGuard` caps context, output, one-call cycle count, deep calls, and conservative daily spend before a provider request. Provider failures return a safe result and do not create a decision, candidate, or action.
