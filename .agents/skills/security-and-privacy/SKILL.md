---
title: "Review threat boundaries, egress, authentication and authority."
document_id: ".agents::skills::security-and-privacy::SKILL"
status: "active"
authority_class: "engineering_skill"
owner_role: "security_reviewer"
created_at: "2026-09-25"
reviewed_at: null
review_evidence: null
review_triggers: ["scope_change", "contract_change"]
pack_version: "5.0.0"
name: "security-and-privacy"
description: "Review threat boundaries, egress, authentication and authority."
version: "5.0.0"
---

# Purpose

Review threat boundaries, egress, authentication and authority.

## Scope and handoff

Primary role: `security_reviewer`. Follow AGENTS.md. Another role may consume this playbook but must not silently take promotion authority.

## Workflow
1. Own security findings; product-rules owns product intent.
2. Review exact owner/action/payload/policy/approval binding.
3. Inspect raw-data minimization, secret handling and confused deputies.
4. Require negative tests and actual stop/reauth/revocation evidence before enablement.

## Read
- `docs/security/SECURITY.md`
- `docs/security/APPROVAL_MODEL.md`
- `docs/security/CAPABILITY_AND_AUTHORITY.md`

## Evidence and stop

Use synthetic data and exact current source paths. Report unknowns, omitted tests and observed versions. Write the session handoff to governance/STATE.json. Stop on a protected-rule conflict or missing external authority. Do not change the judge to make the feature pass.

## Retained detailed engineering guidance

Follow the current root authority and relevant V5 requirements when older wording differs.

---
name: security-and-privacy
description: Use before or during work involving authentication, OAuth tokens, webhooks, secrets, finance, health, email, location, relationships, model tools, approvals, deletion, logs, backups, or production access.
---

# Security and privacy rules

## Trust boundaries

Treat messaging content, email content, web pages, attachments, provider metadata, model output, and executor output as untrusted. None of them may alter policy or call tools without server-side validation.

## Secrets

- Store secrets only in platform secret managers and the encrypted token vault.
- Never commit `.env` files, private keys, session archives, tokens, or production database URLs.
- Never expose service-role credentials to the browser.
- Redact authorization headers, cookies, bank identifiers, health payloads, and message bodies from normal logs.

## Tool policy

- The model proposes typed actions.
- The policy engine decides whether the action is allowed.
- The executor receives the smallest required data.
- High-impact actions create an approval record and stop.
- Money movement is absent from the tool surface.

## Sensitive domains

Finance, health, relationships, legal matters, immigration, location, and private communications receive sensitivity labels. Normal reasoning uses derived summaries. Raw data is retrieved only for a specific task.

## Deletion

Deletion must cover normalized records, embeddings, summaries, hypotheses, scheduled jobs, provider references, and cached context. Keep only a content-free deletion receipt when audit requires it.

## Review output

Report severity, affected boundary, exploit or failure path, evidence, fix, tests, and residual risk. Do not approve production when a critical secret, auth, signature, permission, or deletion flaw remains.
