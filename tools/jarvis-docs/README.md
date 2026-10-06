# Canonical documentation manager

This dependency-free Python 3.11+ helper reads product data and an explicit reviewed path list. It renders only docs/product/JARVIS_PRD_V5.md and writes the current document index/checksums. It never imports application code, scans a directory, installs dependencies, invokes a provider or grants authority.

After an authorized structured product edit, run:

    python tools/jarvis-docs/manage.py render
    python tools/jarvis-docs/manage.py index
    python tools/jarvis-docs/manage.py check

Register new reviewed artifacts explicitly in governance/DOCUMENTATION_MANAGED_PATHS.json. The index excludes its own hash and the checksum file to avoid recursion; the checksum file covers the index. Application-source integrity is separately recorded in FINAL_TREE_MANIFEST.json.

Legacy tools/jarvis-v5/generate.py, render.py and index.py are fenced from application roots, including managed mode. Their original validator/test reports belong to the unchanged standalone pack preserved in the source ZIP. Context resolution can read the relocated current registries without adopting a runtime prompt loader.

Neither generated hashes nor a passing documentation check certify application types, migrations, tests, deployed policy, owner-key enrollment, trusted mission completion or release readiness.
