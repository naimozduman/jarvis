# Connector card specification

Each card on `/admin/connectors` displays:

- Provider name and icon.
- Capability summary.
- Connection status: disconnected, connecting, syncing, healthy, stale, error, or revoked.
- Connected account identity.
- Granted scopes.
- Enabled accounts or calendars.
- Last webhook received.
- Last successful full reconciliation.
- Data freshness.
- Last error and retry status.
- Connect or reconnect button.
- Test connection button.
- Sync now button.
- Disconnect button.
- Delete imported data control.
- Provider-specific settings.

Sensitive tokens never appear. The browser receives only status, scope names, masked account labels, timestamps, and user-safe diagnostics.
