# Phase 4: Web control center

Use the web-app and security skills relevant to the selected framework. Build the owner-only web
control center after the core API contracts, reasoning boundaries, and WhatsApp vertical slice exist.

Implement canonical views for Today, Chat, Brain, Commitments, Approvals, Activity, and Connectors.
The interface may inspect and request operations through typed API contracts, but it must never
become a direct database client, forge an owner ID, bypass policy, or execute high-impact actions.
