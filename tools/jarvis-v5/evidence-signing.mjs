/** Detached evidence signatures. Run signing only outside the builder's account.
 * The signature proves who vouched for a record, not semantic test quality.
 * There is no verification shortcut for unsigned/local fixture data in this CLI.
 */
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { argumentsOf, keyId, stable } from './trust-gate.mjs';

const DOMAIN = 'JARVIS-V4.1-EVIDENCE\0';
const FORMAT = 'jarvis-evidence-v1';
const purposes = new Set(['test-verification', 'eval-review']);
function message(payload) { return Buffer.from(DOMAIN + stable(payload), 'utf8'); }

export function verifyEvidence(envelope, policy, now = new Date()) {
  if (policy.evidencePolicyVersion !== 1 || policy.enabled !== true) {
    throw new Error('Evidence trust is not enrolled in the trusted baseline.');
  }
  if (!envelope || envelope.format !== FORMAT || typeof envelope.signature !== 'string') {
    throw new Error('Expected a detached signed evidence envelope.');
  }
  const p = envelope.payload;
  if (!p || !purposes.has(p.purpose) || p.repository !== policy.repository ||
      !/^[0-9a-f]{40}$/.test(p.base || '') || !/^[0-9a-f]{40}$/.test(p.head || '')) {
    throw new Error('Invalid evidence subject or purpose.');
  }
  const signer = (policy.signers || []).find(k => k.keyId === p.keyId);
  if (!signer || !signer.purposes.includes(p.purpose) || keyId(signer.publicKeyPem) !== p.keyId) {
    throw new Error('Unenrolled or wrong-purpose evidence signer.');
  }
  const issued = Date.parse(p.issuedAt), expires = Date.parse(p.expiresAt), n = now.getTime();
  const maximum = policy.maxValiditySeconds?.[p.purpose];
  if (!Number.isSafeInteger(maximum) || maximum < 1 || !Number.isFinite(issued) ||
      !Number.isFinite(expires) || !Number.isFinite(n) || issued > n || expires <= n || expires <= issued ||
      expires - issued > maximum * 1000) {
    throw new Error('Evidence is expired, future-dated, or exceeds its trusted lifetime.');
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.signature)) throw new Error('Malformed evidence signature.');
  const signature = Buffer.from(envelope.signature, 'base64');
  if (signature.length !== 64 || !verify(null, message(p), createPublicKey(signer.publicKeyPem), signature)) {
    throw new Error('Invalid evidence signature.');
  }
  return p;
}

export function signEvidence(payload, privateKeyPem) {
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Ed25519 required.');
  const pub = createPublicKey(key).export({ type: 'spki', format: 'pem' });
  if (payload.keyId !== keyId(pub)) throw new Error('Signing key does not match record key ID.');
  return { format: FORMAT, payload, signature: sign(null, message(payload), key).toString('base64') };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] || '')).href) {
  try {
    const [command, ...rest] = process.argv.slice(2), a = argumentsOf(rest);
    for (const k of ['policy', 'record']) if (typeof a[k] !== 'string') throw new Error(`Required --${k}`);
    const policy = JSON.parse(readFileSync(a.policy, 'utf8'));
    if (command === 'verify') {
      const p = verifyEvidence(JSON.parse(readFileSync(a.record, 'utf8')), policy);
      console.log(JSON.stringify({ passed: true, purpose: p.purpose, keyId: p.keyId, base: p.base, head: p.head }));
    } else if (command === 'sign') {
      if (a['i-verified-the-evidence'] !== true || typeof a['private-key'] !== 'string' || typeof a.output !== 'string') {
        throw new Error('Owner/verifier-side sign requires --private-key --output --i-verified-the-evidence.');
      }
      const e = signEvidence(JSON.parse(readFileSync(a.record, 'utf8')), readFileSync(a['private-key'], 'utf8'));
      verifyEvidence(e, policy);
      writeFileSync(a.output, JSON.stringify(e, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      console.log(JSON.stringify({ written: resolve(a.output), purpose: e.payload.purpose, privateKeyPrinted: false }));
    } else throw new Error('Use sign or verify.');
  } catch (error) { console.error(JSON.stringify({ passed: false, error: error.message })); process.exitCode = 2; }
}
