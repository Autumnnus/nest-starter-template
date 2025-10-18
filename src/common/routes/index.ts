export const ROUTES = {
  auth: {
    root: 'auth',
    login: 'login',
    refresh: 'refresh',
    me: 'me',
    sessions: 'sessions',
    session: 'sessions/:sessionId',
    password: {
      requestReset: 'password/reset/request',
      reset: 'password/reset',
      change: 'password/change',
    },
    email: {
      requestChange: 'email/change/request',
      confirm: 'email/change/confirm',
    },
    oauth: {
      google: 'oauth/google',
    },
  },
  users: {
    root: 'users',
    byId: ':userId',
    deactivate: 'deactivate',
    profilePhoto: ':userId/profile-photo',
  },
  health: {
    root: 'health',
  },
} as const;
