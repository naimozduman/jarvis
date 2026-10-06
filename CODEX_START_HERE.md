# Start here

1. Read [JARVIS.md](JARVIS.md) and [AGENTS.md](AGENTS.md).
2. Read [the document index](docs/INDEX.md) and [the decisions resolving V5 conflicts](docs/product/DECISIONS.md).
3. Select the relevant requirements from [PRODUCT_SPEC](governance/PRODUCT_SPEC.json) and their [crosswalk](docs/product/REQUIREMENTS_CROSSWALK.md). Consult the full [V5 PRD](docs/product/JARVIS_PRD_V5.md) when scope changes.
4. Read [architecture](docs/architecture/ARCHITECTURE.md), [current implementation](docs/architecture/CURRENT_IMPLEMENTATION.md), the relevant subsystem owners, current source/tests/migrations and slug-qualified [ADRs](docs/ADR/index.md).
5. Before authority, execution, model calls or data access changes, read [security](docs/security/SECURITY.md), [cost/model policy](docs/security/COST_AND_MODEL_POLICY.md) and [documentation governance](docs/security/DOCUMENTATION_GOVERNANCE.md).
6. Read [the V5 reconciliation report](docs/missions/V5_RECONCILIATION_REPORT.md) and [deferred Linux validation](DEFERRED_VALIDATION.md) before treating source as executable proof.

V5 is absorbed into this repository; prior documents excluding it are archived phase records. Follow the owner's October 5 precedence rule: V5 newer intent/architecture, reconciled implementation unless explicitly superseded, one current owner per document, exact archives for superseded versions.

The data-only context resolver in tools/jarvis-v5/context.py uses the relocated registry and rejects oversized required context. It is a convenience for bounded reading, not mission admission. Legacy pack generators/validators operate only on the original standalone source tree; [the canonical documentation manager](tools/jarvis-docs/README.md) owns the relocated PRD and index.

Draft schemas, prompt modules, preview outputs, integration examples and unenrolled policies do not change active consumers. No dated prompt or mission definition authorizes a migration, pairing, provider call, send, release or trust enrollment. Keep observations descriptive and future requirements explicit.
