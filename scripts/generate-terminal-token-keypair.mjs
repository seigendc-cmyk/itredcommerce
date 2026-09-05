// One-off key generation for TerminalActivationToken signing (DL-046,
// DL-048's key rotation scheme). Run manually:
//   node scripts/generate-terminal-token-keypair.mjs [--key-id v2]
//
// `--key-id` defaults to "v1" (today's only active key). Rotating means
// generating a NEW key under a NEW id (e.g. "v2") and:
//   1. Adding it as a Supabase Edge Function secret named
//      TERMINAL_TOKEN_SIGNING_PRIVATE_KEY_<KEY_ID> (uppercased) — never
//      committed to this repo.
//   2. Adding its printed public key to
//      server/lib/terminalActivationToken.ts's TERMINAL_TOKEN_PUBLIC_KEYS
//      registry under the same keyId, alongside the old entry (don't
//      remove it — tokens already issued under the old key must stay
//      verifiable until they expire + grace period lapses).
//   3. Updating console-issue-terminal-activation-token's CURRENT_KEY_ID
//      constant to the new id, so newly issued tokens sign under it.
import { generateKeyPairSync } from 'node:crypto';

const keyIdArgIndex = process.argv.indexOf('--key-id');
const keyId = keyIdArgIndex !== -1 ? process.argv[keyIdArgIndex + 1] : 'v1';
if (!keyId || !/^[a-z0-9]+$/i.test(keyId)) {
  console.error('--key-id must be a non-empty alphanumeric string (e.g. v1, v2)');
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
});

const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicSpkiB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const secretName = `TERMINAL_TOKEN_SIGNING_PRIVATE_KEY_${keyId.toUpperCase()}`;

console.log(`--- keyId: ${keyId} ---`);
console.log(`--- PRIVATE KEY (Supabase Edge Function secret ${secretName}, do not commit) ---`);
console.log(privatePem);
console.log(`--- PUBLIC KEY (add to TERMINAL_TOKEN_PUBLIC_KEYS['${keyId}'] in server/lib/terminalActivationToken.ts) ---`);
console.log(publicSpkiB64);
