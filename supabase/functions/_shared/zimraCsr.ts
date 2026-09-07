// ZIMRA device keypair + CSR generation (Prompt 16, DL-073/075). Built on
// @peculiar/x509 (Web Crypto-based) — verified working under this exact
// API surface via a standalone Node smoke test before being committed here
// (see the Prompt 16 delivery notes); not yet executed inside an actual
// Deno/Supabase Edge Function deployment, since this repo has no Deno
// runtime available to run one. Treat the very first real deployment of
// this file as still needing a live check, not as fully proven.
//
// ECC ECDSA on secp256r1/prime256v1 (ecdsa-with-SHA256), per the prompt's
// explicit choice for consistency with this codebase's existing
// TerminalActivationToken signing scheme (supabase/functions/_shared/
// terminalTokenIssuance.ts) — same algorithm, same crypto.subtle-based
// approach, different key material (one ECDSA keypair per call site's own
// purpose; this is NOT the same key as terminal-token signing).
//
// Subject DN fields, exactly as specified:
//   CN = "ZIMRA-<serialNo>-<deviceId, 10-digit zero-padded>"
//   C  = "ZW"
//   O  = "Zimbabwe Revenue Authority"
//   ST = "Zimbabwe" (the spec's "S" attribute — @peculiar/x509's Name
//        parser resolves the standard X.500 stateOrProvinceName RDN under
//        the key "ST", confirmed by the smoke test's round-trip; "S" alone
//        is not a key this library recognizes)
import * as x509 from 'npm:@peculiar/x509@1';

const SIGNING_ALGORITHM: EcdsaParams & { namedCurve: string } = {
  name: 'ECDSA',
  namedCurve: 'P-256',
  hash: 'SHA-256',
};

// Must be called once, at module load or before first use, so @peculiar/x509
// knows which Web Crypto implementation to use. Deno's global `crypto` is
// already a full Web Crypto implementation, so this is a same-runtime
// assignment, not a polyfill.
x509.cryptoProvider.set(crypto);

export interface ZimraDeviceKeypair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export async function generateZimraDeviceKeypair(): Promise<ZimraDeviceKeypair> {
  const keys = await crypto.subtle.generateKey(SIGNING_ALGORITHM, true, ['sign', 'verify']);
  return keys as ZimraDeviceKeypair;
}

function buildSubjectName(serialNo: string, deviceId: number): string {
  const deviceIdPadded = String(deviceId).padStart(10, '0');
  const cn = `ZIMRA-${serialNo}-${deviceIdPadded}`;
  return `CN=${cn}, C=ZW, O=Zimbabwe Revenue Authority, ST=Zimbabwe`;
}

export interface GeneratedCsr {
  csrPem: string;
  subject: string;
}

/**
 * Builds and self-signs a PKCS#10 CSR for a ZIMRA device registration. The
 * CSR's own signature is always by the CSR's own (new) private key — this
 * is unrelated to, and does not require, Section 13's receipt-signing
 * procedure (which signs FDMS receipt payloads with the device's
 * ZIMRA-issued certificate, once registration is complete). Do not conflate
 * the two: this function only ever runs once, at registration time, before
 * ZIMRA has issued anything.
 */
export async function generateZimraCsr(keys: ZimraDeviceKeypair, serialNo: string, deviceId: number): Promise<GeneratedCsr> {
  const name = buildSubjectName(serialNo, deviceId);
  const csr = await x509.Pkcs10CertificateRequestGenerator.create({
    name,
    keys,
    signingAlgorithm: SIGNING_ALGORITHM,
  });

  const verified = await csr.verify();
  if (!verified) {
    // Should be unreachable — the CSR is signed with the same key pair
    // that verifies it, in the same call. Failing loudly here is cheaper
    // than silently submitting a CSR to ZIMRA that would be rejected.
    throw new Error('Generated CSR failed self-signature verification.');
  }

  return { csrPem: csr.toString('pem'), subject: csr.subject };
}

export async function exportPrivateKeyPkcs8Pem(privateKey: CryptoKey): Promise<string> {
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
  const bytes = new Uint8Array(pkcs8);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;
}
