import type { AuthenticatedPrincipal } from '@jarvis/contracts';

export class OwnerAuthorizationError extends Error {
  public constructor(message = 'The authenticated principal is not authorized for this owner.') {
    super(message);
    this.name = 'OwnerAuthorizationError';
  }
}

export function assertOwnerScope(principal: AuthenticatedPrincipal, ownerId: string): void {
  if (principal.ownerId !== ownerId) {
    throw new OwnerAuthorizationError();
  }
}

export function hasRequiredScope(
  principal: AuthenticatedPrincipal,
  requiredScope: string,
): boolean {
  return principal.scopes.includes(requiredScope) || principal.scopes.includes('*');
}

export interface AuthenticationRequestContext {
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly method: string;
  readonly path: string;
}

export interface AuthenticationBoundary {
  authenticate(context: AuthenticationRequestContext): Promise<AuthenticatedPrincipal>;
}

/** A production composition must replace this adapter; it deliberately fails closed. */
export class FailingAuthenticationBoundary implements AuthenticationBoundary {
  public async authenticate(): Promise<AuthenticatedPrincipal> {
    throw new OwnerAuthorizationError('Interactive authentication has not been configured.');
  }
}
