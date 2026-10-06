---
title: "Backup and restore without repeated side effects"
document_id: "DOCS_DISASTER_RECOVERY"
status: "active"
authority_class: "protected"
owner_role: "release_operator"
created_at: "2026-09-26"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Backup and restore without repeated side effects

## What must survive

Inventory canonical database schema and migration level, owner records, constitution versions, memories, source links, commitments, ledger events, encrypted object references, consent/deletion records, outbox identities, action results, unresolved reconciliations and audit. Back up encrypted content according to source policy. Keep encryption and recovery keys outside the same backup access boundary. Provider transport sessions are recoverable infrastructure, not canonical life memory.

The owner approves RPO, RTO, backup frequency, retention and custody before private production history depends on them. A proposal is not an activated policy. `templates/v5/recovery-plan.json` records these unresolved choices without guessed service-level promises.

## Restore sequence

1. Declare an incident and stop new writes through independent controls. Preserve the old environment and evidence before cleanup.
2. Select a verified backup and record its checkpoint, hashes, schema/migration version, key version and coverage. Scan no secrets into normal logs.
3. Restore into a clean isolated environment with no provider credentials and all model/executor/transport dispatch disabled.
4. Check database constraints, foreign keys, owner scope, encryption decryptability for selected synthetic samples and object-reference consistency. Reconcile source-deletion tombstones so restore does not resurrect removed private records.
5. Advance a restore/security epoch outside the restored snapshot. Expire restored approvals and leases. Mark dispatch-capable pending work as held for reconciliation. Never replay the outbox wholesale.
6. Reconcile external outcomes from provider IDs, idempotency records and separate post-backup evidence. A provider without sufficient read-back leaves an explicit unknown outcome. Do not guess that an absent backup record means an effect never happened.
7. Rebuild derived indexes from approved sources. Check that generated summaries retain provenance and revoked source boundaries.
8. Restore read-only owner access first, then individual connectors, then selected writers only after fresh auth/kill/cost checks and explicit reauthorization.
9. Record measured data loss, restoration duration, remaining unknowns and deviations from the owner's targets. Update regression coverage and incident evidence.

## Failure drills

Corrupt an object, remove a key copy, restore an old schema, replay a formerly sent delivery, retain an old lease, remove a deletion tombstone and simulate provider unavailability. These must fail visibly or remain held. A successful `pg_restore` exit does not establish business correctness.

## Backup access and deletion

Document which operator accesses backups, which data remains in offline backups after deletion, when retention expires and how restoration reapplies tombstones. Never claim instantaneous erasure from all backups unless the storage/key mechanism proves it. Legal retention decisions require separate current advice when applicable.

## Release gate

Before irreplaceable history: demonstrate a clean-room restore with synthetic linked data and outbox quarantine. Before enabled writers: demonstrate no duplicate effects using a controlled provider fixture and, separately, the approved staging integration. Record provenance and actual environment. No backup or restore was executed against the user's systems while packaging V5.
