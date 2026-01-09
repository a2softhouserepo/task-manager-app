// Cookie configuration for NextAuth
// This file is separate to avoid importing Node.js modules in Edge Runtime (middleware)

export const getCookieNames = () => {
  const prefix = process.env.AUTH_PREFIX || '';
  const securePrefix = process.env.NODE_ENV === 'production' ? '__Secure-' : '';
  
  return {
    sessionToken: `${securePrefix}${prefix}next-auth.session-token`,
    callbackUrl: `${securePrefix}${prefix}next-auth.callback-url`,
    csrfToken: `${prefix}next-auth.csrf-token`,
  };
};
