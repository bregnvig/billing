import { isAllowedUser } from './auth.service';

describe('isAllowedUser', () => {
  it('allows only the verified owner email, case-insensitively', () => {
    expect(isAllowedUser({ email: 'flemming@loopme.dk', emailVerified: true })).toBe(true);
    expect(isAllowedUser({ email: 'Flemming@LoopMe.DK', emailVerified: true })).toBe(true);
  });

  it('refuses everyone else', () => {
    expect(isAllowedUser(null)).toBe(false);
    expect(isAllowedUser({ email: 'someone@example.com', emailVerified: true })).toBe(false);
    expect(isAllowedUser({ email: 'flemming@loopme.dk', emailVerified: false })).toBe(false);
    expect(isAllowedUser({ email: null, emailVerified: true })).toBe(false);
  });
});
