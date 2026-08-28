# ADR 0004: Keep finance read-only

Status: Accepted

Date: 2026-08-23

## Context

JARVIS should detect bills, due dates, subscriptions, duplicate charges, cash-flow risks, and credit-card issues. Moving money or paying bills would sharply increase risk.

## Decision

- Use a provider abstraction with Plaid as the first implementation.
- Request only the products and scopes required for balances, transactions, recurring activity, and liabilities.
- Allowlist the Chase Prime Visa and selected Mercury accounts.
- Exclude other linked accounts unless the user explicitly enables them.
- Do not implement payment, transfer, purchase, card-control, or brokerage actions.
- Never give the model direct access to bank credentials or provider secrets.

## Consequences

- Finance becomes useful early without autonomous money movement.
- Alerts and forecasts still need transfer reconciliation and confidence labels.
- Any future write capability requires a separate ADR and threat review.
