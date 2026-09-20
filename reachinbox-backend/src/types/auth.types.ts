export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends AuthenticatedUser {}
    interface Request {
      currentUser?: AuthenticatedUser;
    }
  }
}

export interface JwtPayload {
  sub: string; // userId
  tenantId: string;
  email: string;
}
