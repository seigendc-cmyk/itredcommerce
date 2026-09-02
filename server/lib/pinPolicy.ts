import { ApiError } from './http';

// Trivially-guessable PINs rejected at creation/reset time (DL-011 security
// review item #5). This is a denylist, not a strength requirement — a 4-6
// digit PIN has limited entropy no matter what (see DL-011's PIN-strength
// notes), so this only closes off the handful of patterns real people
// actually pick under time pressure at a till. Shared by staff.ts (existing
// staff creation/reset) and onboarding.ts (the wizard's admin PIN setup,
// which is also, structurally, a staff creation) so the two can't drift.
const WEAK_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '2345', '3456', '4567', '5678', '6789', '0123',
  '4321', '9876', '8765', '7654', '6543', '5432',
  '000000', '111111', '123456', '654321', '121212', '112233',
]);

export function assertStrongPin(pin: string) {
  if (!/^\d{4,6}$/.test(pin)) throw new ApiError(400, 'pin must be 4-6 digits');
  if (WEAK_PINS.has(pin)) throw new ApiError(400, 'That PIN is too easy to guess — choose a less predictable one', 'WEAK_PIN');
}
