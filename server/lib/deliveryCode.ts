import { randomInt } from 'node:crypto';

// Confirmed decision (see ITRED_GOVERNANCE_AND_ARCHITECTURE.md open items):
// 6-character alphanumeric. Charset excludes characters easily confused
// when read aloud or hand-copied: 0/O, 1/I/L.
const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateConfirmationCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARSET[randomInt(CODE_CHARSET.length)];
  }
  return code;
}

const LOCAL_EXPIRY_HOURS = 12;
const INTERCITY_EXPIRY_HOURS = 48;

export function confirmationCodeExpiryHours(routeClass: 'local' | 'intercity'): number {
  return routeClass === 'local' ? LOCAL_EXPIRY_HOURS : INTERCITY_EXPIRY_HOURS;
}
