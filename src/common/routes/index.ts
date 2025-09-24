export const ROUTES = {
  auth: {
    root: 'auth',
    login: 'login',
    refresh: 'refresh',
    me: 'me',
    sessions: 'sessions',
  },
  users: {
    root: 'users',
    byId: ':userId',
    deactivate: 'deactivate',
  },
  health: {
    root: 'health',
  },
} as const;
