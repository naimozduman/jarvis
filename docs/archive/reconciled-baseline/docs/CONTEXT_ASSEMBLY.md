# Context assembly

`ContextAssembler` is deterministic and owner-scoped. It starts with structured retrieval rather than embeddings and ranks records by constitutional relevance, active commitment relevance, deadline proximity, current-day relevance, source authority, confidence, recency, and visible conflict state.

The runtime configuration caps context records, recent messages, and approximate prompt tokens. Cross-owner records are discarded. Restricted records retain only a safe placeholder for the model; the `ContextManifest` records that redaction occurred without storing raw content.

Each request persists a manifest containing selected record IDs/types, rank, score, selection reasons, sensitivity/redaction state, excluded-record count, and a content-free source hash. The model can cite only IDs in this exact manifest. An invented ID or altered epistemic state invalidates the decision before durable candidates or actions are created.

Health, finance, training, email, and provider summaries are represented as explicit `not_connected` or missing interfaces in this phase. No provider data is invented or fetched.
