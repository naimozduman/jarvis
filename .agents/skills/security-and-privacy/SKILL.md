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
