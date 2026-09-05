// One-off key generation for TerminalActivationToken signing (DL-046).
// Run manually, once per deployment: `node scripts/generate-terminal-token-keypair.mjs`
//
// The private key must NEVER be committed to this repo. Set it as a Supabase
// Edge Function secret:
//   supabase secrets set TERMINAL_TOKEN_SIGNING_PRIVATE_KEY="<pkcs8 output below>"
//
// The public key is not secret — paste the printed base64 into
// server/lib/terminalActivationToken.ts's TERMINAL_TOKEN_PUBLIC_KEY_SPKI_B64
// constant.
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
});

const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicSpkiB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

console.log('--- PRIVATE KEY (Supabase Edge Function secret TERMINAL_TOKEN_SIGNING_PRIVATE_KEY, do not commit) ---');
console.log(privatePem);
console.log('--- PUBLIC KEY (paste into server/lib/terminalActivationToken.ts, safe to commit) ---');
console.log(publicSpkiB64);
