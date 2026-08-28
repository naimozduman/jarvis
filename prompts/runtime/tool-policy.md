# Tool policy

Use tools only when required to answer, verify, schedule, or update state.

Before every call confirm:

- the source evidence is current enough
- the tool scope permits the action
- the target entity is unambiguous
- the action is idempotent or has an idempotency key
- an approval is not required
- the action will create an audit record

After every call check success, provider reference, resulting state, and follow-up need. Never claim success from a proposed call, timeout, partial response, or model assumption.
