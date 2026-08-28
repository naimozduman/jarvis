export interface EncryptedConnectorSecretRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly connectorAccountId: string;
  readonly ciphertext: string;
  readonly algorithm: string;
  readonly keyVersion: number;
  readonly nonce: string;
  readonly createdAt: string;
  readonly rotatedAt: string | undefined;
  readonly revokedAt: string | undefined;
}

/**
 * Provider implementations supply encryption/decryption through a secret manager later. Ordinary
 * application repositories may store and fetch encrypted envelopes only; this interface has no
 * plaintext read or write method.
 */
export interface EncryptedConnectorSecretVault {
  storeEncrypted(record: EncryptedConnectorSecretRecord): Promise<void>;
  getEncrypted(id: string, ownerId: string): Promise<EncryptedConnectorSecretRecord | undefined>;
  revoke(id: string, ownerId: string, revokedAt: string): Promise<void>;
}
