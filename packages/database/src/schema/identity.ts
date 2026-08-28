import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { defaultJsonObject, jarvis, standardColumns } from './common.js';

export const owners = jarvis.table(
  'owners',
  {
    ...standardColumns,
    emailNormalized: varchar('email_normalized', { length: 320 }).notNull(),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    timezone: varchar('timezone', { length: 80 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (table) => [
    uniqueIndex('owners_email_normalized_unique').on(table.emailNormalized),
    uniqueIndex('owners_single_primary_unique')
      .on(table.isPrimary)
      .where(sql`${table.isPrimary} = true`),
  ],
);

export const identities = jarvis.table(
  'identities',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    identityProvider: varchar('identity_provider', { length: 80 }).notNull(),
    providerSubject: varchar('provider_subject', { length: 512 }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    isAllowed: boolean('is_allowed').notNull().default(false),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    uniqueIndex('identities_provider_subject_unique').on(
      table.identityProvider,
      table.providerSubject,
    ),
    index('identities_owner_index').on(table.ownerId),
  ],
);

export const devices = jarvis.table(
  'devices',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    deviceLabel: varchar('device_label', { length: 160 }).notNull(),
    platform: varchar('platform', { length: 80 }).notNull(),
    publicKeyFingerprint: varchar('public_key_fingerprint', { length: 256 }),
    trustedAt: timestamp('trusted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (table) => [index('devices_owner_active_index').on(table.ownerId, table.revokedAt)],
);

export const passkeyCredentials = jarvis.table(
  'passkey_credentials',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
    credentialId: varchar('credential_id', { length: 1024 }).notNull(),
    publicKey: text('public_key').notNull(),
    signCount: integer('sign_count').notNull().default(0),
    transports: jsonb('transports')
      .$type<readonly string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('passkey_credentials_credential_id_unique').on(table.credentialId),
    index('passkey_credentials_owner_index').on(table.ownerId),
  ],
);

export const authSessions = jarvis.table(
  'auth_sessions',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
    tokenDigest: varchar('token_digest', { length: 128 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    reauthenticatedAt: timestamp('reauthenticated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('auth_sessions_token_digest_unique').on(table.tokenDigest),
    index('auth_sessions_owner_active_index').on(table.ownerId, table.expiresAt),
  ],
);

export const trustedClients = jarvis.table(
  'trusted_clients',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    clientIdentifier: varchar('client_identifier', { length: 160 }).notNull(),
    tokenDigest: varchar('token_digest', { length: 128 }).notNull(),
    scopes: jsonb('scopes')
      .$type<readonly string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    keyVersion: varchar('key_version', { length: 64 }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('trusted_clients_identifier_unique').on(table.clientIdentifier),
    uniqueIndex('trusted_clients_token_digest_unique').on(table.tokenDigest),
    index('trusted_clients_owner_active_index').on(table.ownerId, table.revokedAt),
  ],
);

export const connectorAccounts = jarvis.table(
  'connector_accounts',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    connectorType: varchar('connector_type', { length: 120 }).notNull(),
    externalAccountReference: varchar('external_account_reference', { length: 512 }).notNull(),
    displayLabel: varchar('display_label', { length: 160 }),
    status: varchar('status', { length: 32 }).notNull().default('unconfigured'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(defaultJsonObject),
  },
  (table) => [
    uniqueIndex('connector_accounts_owner_external_unique').on(
      table.ownerId,
      table.connectorType,
      table.externalAccountReference,
    ),
  ],
);

export const encryptedConnectorSecrets = jarvis.table(
  'encrypted_connector_secrets',
  {
    ...standardColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'restrict' }),
    connectorAccountId: uuid('connector_account_id')
      .notNull()
      .references(() => connectorAccounts.id, { onDelete: 'restrict' }),
    ciphertext: text('ciphertext').notNull(),
    algorithm: varchar('algorithm', { length: 120 }).notNull(),
    keyVersion: varchar('key_version', { length: 64 }).notNull(),
    nonce: varchar('nonce', { length: 512 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [index('encrypted_connector_secrets_owner_index').on(table.ownerId)],
);
