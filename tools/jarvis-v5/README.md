# V5 reference tooling

All 42 original tool/test files are retained. Original bytes are recoverable from the 467-member source archive under docs/archive/v5-source. Trust/signing/key/worker tools are reference implementations; none is installed as a trusted gate or runtime executor.

The relocated canonical PRD/index uses [the documentation manager](../jarvis-docs/README.md). Legacy generate.py/render.py/index.py now reject every application-root invocation, including managed mode, to protect navigation pointers. Original validate.py/v5_checks.py and full pack tests apply to an extracted original standalone source tree, not this reorganized application root.

context.py remains unchanged and can read the relocated ROADMAP/CONTEXT_REGISTRY plus canonical PRODUCT_SPEC. It returns bounded data-only context and refuses required overflow. It grants no mission/runtime authority. Other planning tools require their documented sanitized inputs and actual-path review before use.

Historical V5 preview manifests are archived; relocated invariant/mission document hashes invalidate any old previews/receipts. No valid owner key, enrollment, trust epoch receipt, branch protection or OS isolation is created by this import.
