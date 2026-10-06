# Open questions

These questions do not block the repository bootstrap. Answer them before the relevant phase reaches production.

## Identity and channels

- Final product and contact name.
- Dedicated phone-number provider and recurring cost.
- Whether Telegram ships with Phase 3 or immediately after the WhatsApp vertical slice.
- Whether the web PWA sends push notifications before native iOS.

## Evolution

- Exact stable version and Docker digest after testing.
- Required activation or licensing flow for the chosen release.
- Redis enabled or disabled.
- Object storage for incoming media.
- Message reconciliation endpoint and cadence supported by the selected version.
- Manager exposure and access method.

## User policy

- Exact definition and phrase for a hard override.
- Which constitution items are immovable.
- Quiet hours and critical exceptions.
- Maximum daily proactive message count.
- Retention and deletion choices.
- What “forget everything about X” removes and what deletion receipt remains.

## Google

- Exact calendars selected.
- Whether clear email dates create events automatically or request confirmation during the first month.
- Whether labels or archive actions enter a later release.

## Finance

- Plaid account eligibility and current plan.
- Mercury institution support and account data quality.
- Whether liabilities provide every desired Chase due field.
- Whether recurring transactions are included on the selected plan.
- Alert thresholds for balance, utilization, duplicates, and spending pace.

## Health and training

- WHOOP data types used in planning.
- Rules that permit reducing training versus moving it.
- Native iOS schedule.
- HealthKit read types and retention.
- Iron & Intervals API readiness.
- Nutrition app contract.

## Infrastructure

- Object storage provider.
- Error tracking and metrics provider.
- Domain names.
- Backup retention.
- Encryption key storage and rotation method.
- Monthly operating budget.

## External execution

- Whether Hermes is still preferred after core connectors exist.
- Which websites require browser automation.
- What actions the executor may perform without approval.
