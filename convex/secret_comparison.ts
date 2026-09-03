const bearerPrefix = 'Bearer ';
const encoder = new TextEncoder();

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

/**
 * Checks a configured bearer secret without branching on the candidate digest.
 *
 * Convex HTTP actions use the default runtime, so this deliberately relies on
 * Web Crypto rather than Node's `crypto` module.
 */
export async function hasValidBearerSecret(
  expected: string | undefined,
  authorization: string | null,
): Promise<boolean> {
  if (!expected || !authorization?.startsWith(bearerPrefix)) {
    return false;
  }

  const candidate = authorization.slice(bearerPrefix.length).trim();
  const [expectedDigest, candidateDigest] = await Promise.all([
    digest(expected),
    digest(candidate),
  ]);

  let difference = 0;
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= expectedDigest[index] ^ candidateDigest[index];
  }
  return difference === 0;
}
