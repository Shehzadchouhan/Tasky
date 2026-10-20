export const getWorkspaceSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET must be set in production to sign workspace cookies');
    }
    return 'dev_jwt_secret_fallback_key';
  }
  return secret;
};
