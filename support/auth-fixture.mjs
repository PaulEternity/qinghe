// Explicit authenticated identity for tests of unrelated chart/model behavior.
export const testAccounts = {
  current: async () => ({ user: { id: 'test-user', username: 'test_user' }, sessionKey: 'test-session' }),
  handle: async () => false
};
