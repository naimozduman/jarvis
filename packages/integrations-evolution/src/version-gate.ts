/**
 * Phase 3's reviewed contingency only. This is deliberately an exact source commit rather than a
 * mutable branch. It is NOT an authorization to deploy production Evolution infrastructure.
 */
export const reviewedEvolutionSourceBuildId = 'e273b904d53f5726970fd6a244ed9caa61dfeb9a' as const;
export const preferredPatchedBaileysVersion = '7.0.0-rc13' as const;
export const minimumPatchedBaileysVersion = '7.0.0-rc12' as const;

export type EvolutionVersionGateReason =
  | 'missing_build_evidence'
  | 'invalid_image_digest'
  | 'vulnerable_baileys'
  | 'unreviewed_build'
  | 'unstable_build_not_explicitly_allowed'
  | 'unstable_build_prohibited_in_production'
  | 'verified';

export interface EvolutionVersionEvidence {
  readonly providerBuildId: string | undefined;
  readonly baileysVersion: string | undefined;
  readonly imageDigest: string | undefined;
  readonly unstableSourceBuildAllowed: boolean;
  readonly appEnvironment: 'development' | 'test' | 'production';
}

export interface EvolutionVersionGateResult {
  readonly verified: boolean;
  readonly reason: EvolutionVersionGateReason;
  readonly providerBuildId: string | null;
  readonly baileysVersion: string | null;
  readonly imageDigest: string | null;
}

interface ParsedVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly releaseCandidate: number | null;
}

function parseBaileysVersion(value: string): ParsedVersion | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+)|-rc(\d+))?$/.exec(value.trim());
  if (!match) {
    return undefined;
  }
  const releaseCandidate = match[4] ?? match[5];
  return {
    major: Number.parseInt(match[1]!, 10),
    minor: Number.parseInt(match[2]!, 10),
    patch: Number.parseInt(match[3]!, 10),
    releaseCandidate: releaseCandidate ? Number.parseInt(releaseCandidate, 10) : null,
  };
}

/**
 * Pre-release-aware comparison for the advisory gate. A final 7.0.0 is newer than rc12; rc11 and
 * below are vulnerable. Unparseable versions fail closed rather than being assumed patched.
 */
export function isPatchedBaileysVersion(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const parsed = parseBaileysVersion(value);
  if (!parsed) {
    return false;
  }
  if (parsed.major !== 7) {
    return parsed.major > 7;
  }
  if (parsed.minor !== 0) {
    return parsed.minor > 0;
  }
  if (parsed.patch !== 0) {
    return parsed.patch > 0;
  }
  return parsed.releaseCandidate === null || parsed.releaseCandidate >= 12;
}

export function isVulnerableBaileysVersion(value: string | undefined): boolean {
  if (!value) {
    return true;
  }
  const parsed = parseBaileysVersion(value);
  if (!parsed) {
    return true;
  }
  return (
    parsed.major === 7 &&
    parsed.minor === 0 &&
    parsed.patch === 0 &&
    parsed.releaseCandidate !== null &&
    parsed.releaseCandidate >= 1 &&
    parsed.releaseCandidate < 12
  );
}

/**
 * Verifies the build evidence that must exist before the adapter is allowed to make a provider
 * request. We intentionally do not accept an arbitrary newer tag: that requires a reviewed ADR,
 * lockfile inspection, and a new immutable digest rather than a best-effort semver guess.
 */
export function verifyEvolutionVersionGate(
  evidence: EvolutionVersionEvidence,
): EvolutionVersionGateResult {
  if (!evidence.providerBuildId || !evidence.baileysVersion || !evidence.imageDigest) {
    return {
      verified: false,
      reason: 'missing_build_evidence',
      providerBuildId: evidence.providerBuildId ?? null,
      baileysVersion: evidence.baileysVersion ?? null,
      imageDigest: evidence.imageDigest ?? null,
    };
  }

  if (!/^sha256:[a-f0-9]{64}$/.test(evidence.imageDigest)) {
    return {
      verified: false,
      reason: 'invalid_image_digest',
      providerBuildId: evidence.providerBuildId,
      baileysVersion: evidence.baileysVersion,
      imageDigest: evidence.imageDigest,
    };
  }

  if (!isPatchedBaileysVersion(evidence.baileysVersion)) {
    return {
      verified: false,
      reason: 'vulnerable_baileys',
      providerBuildId: evidence.providerBuildId,
      baileysVersion: evidence.baileysVersion,
      imageDigest: evidence.imageDigest,
    };
  }

  if (evidence.providerBuildId !== reviewedEvolutionSourceBuildId) {
    return {
      verified: false,
      reason: 'unreviewed_build',
      providerBuildId: evidence.providerBuildId,
      baileysVersion: evidence.baileysVersion,
      imageDigest: evidence.imageDigest,
    };
  }

  if (!evidence.unstableSourceBuildAllowed) {
    return {
      verified: false,
      reason: 'unstable_build_not_explicitly_allowed',
      providerBuildId: evidence.providerBuildId,
      baileysVersion: evidence.baileysVersion,
      imageDigest: evidence.imageDigest,
    };
  }

  if (evidence.appEnvironment === 'production') {
    return {
      verified: false,
      reason: 'unstable_build_prohibited_in_production',
      providerBuildId: evidence.providerBuildId,
      baileysVersion: evidence.baileysVersion,
      imageDigest: evidence.imageDigest,
    };
  }

  return {
    verified: true,
    reason: 'verified',
    providerBuildId: evidence.providerBuildId,
    baileysVersion: evidence.baileysVersion,
    imageDigest: evidence.imageDigest,
  };
}
