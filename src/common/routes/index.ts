export const ROUTES = {
  auth: {
    root: 'auth',
    login: 'login',
    refresh: 'refresh',
    me: 'me',
    sessions: 'sessions',
    session: 'sessions/:sessionId',
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
