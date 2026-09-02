import { randomInt } from 'node:crypto';

// Tenant Pairing Code: identifies a tenant so a second terminal/desk install
// can join it instead of provisioning a new one (see
// ITRED_GOVERNANCE_AND_ARCHITECTURE.md's Business Profile Onboarding
// addendum). A different concept from LicenceInfo's software activationCode
// (a product/plan license key, unrelated to tenant identity). Same charset
// convention as server/lib/deliveryCode.ts's confirmation code — excludes
// characters easily confused when read aloud or hand-copied (0/O, 1/I/L) —
// since this also gets read aloud/typed by a non-technical admin setting up
// their next branch.
const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function generatePairingCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARSET[randomInt(CODE_CHARSET.length)];
  }
  return code;
}
