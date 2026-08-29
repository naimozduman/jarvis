# Reminder and ghosting engine

Reminder reasoning is independent of delivery channels. The data contract supports fixed-time, before/after event, deadline, context, until-completed, follow-up, conditional, open-loop, recurring, and escalating proposals. Phase 2 creates internal proposals and local delivery intents only; it sends no WhatsApp, Telegram, email, or other external messages.

The normal proactive budget is configurable (default conceptual range: six to nine useful messages per day). Related messages may be grouped. Critical reminders may bypass the normal budget. Quiet mode suppresses noncritical delivery while preserving commitments, deadlines, bills, and all durable state.

Ghosting uses explicit states: waiting, follow-up scheduled, escalated, replan needed, expired without completion, and needs review. A cooldown or quiet mode may suppress a message; it never marks the underlying commitment complete. Completion needs explicit evidence through the existing action boundary.
