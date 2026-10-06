---
title: "Builder Session and Worker Isolation"
document_id: "docs::BUILDER_ISOLATION"
status: "active"
authority_class: "protected"
owner_role: "security_reviewer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
reconciled_at: "2026-10-05"
reconciliation_ref: "docs/missions/V5_RECONCILIATION_REPORT.md"
---

# Protect execution before promotion

The repository gate controls accepted changes. It does not stop an already credentialed shell from calling a provider. This document owns the builder-session boundary retained and extended in V5. The supplied Linux worker is executable tooling, not proof that your current Codex session is isolated.

## Four separate contexts

| Context | Allowed | Not present |
| --- | --- | --- |
| Owner preparation and signing | Inspect source, prepare a reviewed snapshot, enroll public keys, approve exact changes | Untrusted candidate execution while signing or holding live provider credentials |
| Codex reasoning host | Read sanitized project evidence and propose code using explicitly approved inference | Owner signing keys, provider/MCP write accounts, migration role, deployment tokens, repository admin, access to the owner's home |
| Disposable worker | Offline analysis or tests on committed sanitized source, synthetic fixtures, fresh scratch output | Network, host home, Git credentials/history, provider env, Docker socket, owner keys |
| Trusted verification/promotion | Run pinned verification tooling, authenticate evidence and issue check results | Arbitrary candidate scripts inside the token-bearing collector or signer |

Two folders or two agents under one unrestricted account are not this separation. Use a dedicated credential-free account or VM for the Codex host. Inspect globally configured apps/MCPs as well as repository config. A model service credential only belongs in the explicitly approved inference host, never in a candidate test worker. This pack does not provide an inference proxy or certify a networked Codex host.

## Prepare committed input without modifying the live repository

The owner runs the reviewed `prepare_builder.py` from a trusted copy. It reads immutable Git objects without checkout, hooks, filters, provider calls or reset. It excludes obvious credential paths before copying their bytes. It reports dirty/untracked filenames, but does not copy their contents. Dirty work remains in place.

```sh
python /trusted-pack/tools/jarvis-v5/prepare_builder.py \
  --repo /owner/jarvis --commit FULL_REVIEWED_COMMIT_SHA \
  --out /owner/scratch/jarvis-input
```

Replace placeholders with actual owner-selected paths and a full 40-character commit SHA. Inspect `SOURCE_SNAPSHOT.json`. `secretsProvenAbsent: false` is intentional: an innocent-looking source file might contain a secret. Perform the organization's secret scan or owner inspection before making the snapshot visible to a builder. Inspect any deliberate uncommitted patch separately. Do not silently treat this committed snapshot as the complete local worktree.

The snapshot has no Git history or credential directories. A source digest covers the supplied files. Every worker run verifies those hashes again. A source change requires a new snapshot. The worker never pulls new dependencies or tool images automatically.

## Delivered offline worker

`isolated_worker.py` requires Linux, the current user's rootless Docker socket and an already-installed, owner-reviewed image referenced by immutable SHA-256 digest. It fails without these prerequisites. There is no host-shell or privileged-container fallback. On macOS or Windows, put the worker in a separately reviewed Linux VM. This release does not certify Docker Desktop or a native Windows sandbox.

```sh
python /trusted-pack/tools/jarvis-v5/isolated_worker.py \
  --prepared /owner/scratch/jarvis-input --pack /trusted-pack \
  --out /owner/scratch/worker-probe --image REGISTRY/IMAGE@sha256:REVIEWED_DIGEST \
  --mode audit --probe
```

The real digest must contain 64 lowercase hexadecimal characters. `--plan-only` prints a plan without starting Docker and explicitly reports that isolation has not been established.

The launcher creates an unprivileged UID 65532 worker with network disabled, read-only root, dropped capabilities, no-new-privileges, bounded processes/memory/CPU, a bounded temporary filesystem, and only three bind mounts: read-only `/input`, read-only `/trusted`, and writable fresh `/work`. It scrubs host Docker configuration and the worker environment. It inspects the created container before starting it and removes only that created container after the command. It limits execution time and captured output.

Audit mode runs against read-only `/input`. Test mode creates a disposable writable copy at `/work/source`; its changes never update the live repository. Example after a successful probe:

```sh
python /trusted-pack/tools/jarvis-v5/isolated_worker.py \
  --prepared /owner/scratch/jarvis-input --pack /trusted-pack \
  --out /owner/scratch/worker-tests --image REGISTRY/IMAGE@sha256:REVIEWED_DIGEST \
  --mode test -- python3 -m unittest discover -s tests
```

The selected image must already contain the approved tooling/dependencies. Do not enable network access to make a missing dependency disappear. Dependency acquisition and image review are owner-controlled preparation tasks. An image containing model or provider secrets is invalid even if its digest is pinned.

## Negative probe and its limits

The fixed `isolation_probe.py` verifies unprivileged identity, absence of common secret environment names and socket mounts, read-only inputs/tools, writable scratch, no non-loopback route, failure to connect to a documentation-only test IP, and inability to read a dummy host canary outside mounts. The owner also verifies the dummy canary was unchanged. No real credential or production endpoint is used.

This is a worker-boundary probe. It does not prove absence of a kernel/container escape, inspect every host file, prove every outbound destination is blocked, or authenticate the operator. A successful local `WORKER_RESULT.json` is not trusted promotion evidence. The separately authenticated verifier must execute its own checks.

This pack's Linux execution environment has no Docker daemon/tool, so the delivered validation tests command construction, denial behavior and probe logic using fixtures. Real rootless execution and the probe remain NOT RUN until M01 installation. Do not relabel a mocked test as a deployed isolation drill.

## Permission to run an audit

M00 does not require an enrolled repository signing key. It does require a safe input/credential boundary before its tools run. If isolation cannot be established, the owner supplies sanitized files for a document-only audit. No shell action in a credentialed live checkout is a substitute.

Live provider reads are a separate owner-controlled operation with a scoped read identity. Send sanitized, timestamped observations back to the audit. Do not pass the token into the builder to let it collect its own evidence. This preserves the original rule: unavailable data stays unknown.

## Completion evidence

M01 records the OS/VM and rootless Docker versions, exact worker image digest, source digest, probe result, operator, timestamp, credential scopes, connector inventory, and isolation exceptions. Keep secret values out. A changed image, mount layout, host identity or enabled connector invalidates the prior boundary observation.

The optional `integration/codex/isolated-config.example.toml` removes shell-profile/environment inheritance and requests read-only/no-network sandbox behavior. It is a configuration aid, not a replacement for account/VM isolation or remote-tool access review.

## Sources and status

Official technical references consulted for this patch:
- Docker run: https://docs.docker.com/engine/containers/run/
- Docker no-network driver: https://docs.docker.com/engine/network/drivers/none/
- Codex configuration reference: https://developers.openai.com/codex/config-reference/
- GitHub privileged workflow guidance: https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target

These sources describe mechanisms. The four-context design, command restrictions and admission rules above are JARVIS proposals implemented in the supplied worker tools where stated, not vendor guarantees or observed installation facts.
