# ADR 0001: Use a split Vercel, Railway, and Neon architecture

Status: Accepted

Date: 2026-08-23

## Context

JARVIS needs a mobile-friendly control center, public webhook endpoints, persistent background work, durable scheduling, and a canonical database. One hosting product does not need to own every concern.

## Decision

- Host the Next.js web control center on Vercel.
- Host the Fastify API and long-running worker on Railway.
- Store canonical product state in a dedicated Neon Postgres project.
- Keep Evolution API and its transport database inside Railway but separate from the JARVIS database.
- Use private Railway networking for internal service communication.

## Consequences

- The web app remains easy to deploy and preview.
- Background jobs survive beyond request lifetimes.
- Database state stays independent from any messaging transport.
- The project has more than one platform to configure, so environment schemas and deployment runbooks are required.
