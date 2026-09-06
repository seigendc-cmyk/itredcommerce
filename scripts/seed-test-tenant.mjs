#!/usr/bin/env node
// Seeds one idempotent, clearly-flagged TEST/sandbox tenant + branch +
// terminal + license_keys row directly in Supabase (service-role, bypasses
// RLS — the same "tenant provisioning is an administrative action" path
// tenants' own RLS policy comment documents), then issues a real, ECDSA
// P-256-signed TerminalActivationToken for that terminal via the actual
// deployed console-issue-terminal-activation-token Edge Function (DL-039/
// DL-046) — never a stub/mocked signature — so the app's real offline
// verification module can validate it.
//
// Safe to re-run: every step checks for an existing row by a fixed id
// before inserting, and never touches any other tenant's data.
//
// Usage: node scripts/seed-test-tenant.mjs
// Requires SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the environment
// (already present in this repo's own .env, loaded below).

import { createClient } from '@supabase/supabase-js';
import { randomInt, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env');
  process.exit(1);
}

const OPERATOR_EMAIL = process.env.SEED_OPERATOR_EMAIL || 'purestartba@gmail.com';

const TENANT_ID = 'TEN-TEST-SANDBOX';
const BRANCH_ID = 'BR-TEST-SANDBOX-01';
const TERMINAL_ID = 'TRM-TEST-SANDBOX-01';
const LICENSE_KEY_ID = 'LIC-TEST-SANDBOX';
const PLAN_TIER = 'PROFESSIONAL';
const BILLING_CYCLE = 'monthly';

const PAIRING_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // mirrors server/lib/pairingCode.ts
function generatePairingCode() {
  let code = '';
  for (let i = 0; i < 8; i++) code += PAIRING_CHARSET[randomInt(PAIRING_CHARSET.length)];
  return code;
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function ensureTenant() {
  const { data: existing } = await admin.from('tenants').select('*').eq('id', TENANT_ID).maybeSingle();
  if (existing) {
    console.log(`[tenant] already exists — reusing pairing_code ${existing.pairing_code}`);
    return existing;
  }
  const pairingCode = generatePairingCode();
  const { data, error } = await admin
    .from('tenants')
    .insert({
      id: TENANT_ID,
      legal_name: 'TEST — Sandbox Tenant (do not use for real business)',
      display_name: 'TEST — Sandbox',
      country: 'ZW',
      base_currency: 'USD',
      status: 'ACTIVE',
      billing_cycle: BILLING_CYCLE,
      pairing_code: pairingCode,
      // Deliberately left null: keeps this sandbox tenant out of DL-055's
      // scheduled billing sweep (tenants_due_for_billing_invoice() requires
      // onboarding_completed_at IS NOT NULL), since this seed is about
      // testing activation, not generating recurring test invoices.
      onboarding_completed_at: null,
    })
    .select()
    .single();
  if (error) throw new Error(`tenant insert failed: ${error.message}`);
  console.log(`[tenant] created ${TENANT_ID}, pairing_code ${pairingCode}`);
  return data;
}

async function ensureBranch() {
  const { data: existing } = await admin.from('branches').select('*').eq('id', BRANCH_ID).maybeSingle();
  if (existing) {
    console.log('[branch] already exists');
    return existing;
  }
  const { data, error } = await admin
    .from('branches')
    .insert({
      id: BRANCH_ID,
      tenant_id: TENANT_ID,
      code: 'SANDBOX01',
      name: 'Sandbox Test Branch',
      status: 'ACTIVE',
      is_default: true,
      latitude: -17.8292, // Harare, ZW — placeholder, not a real address
      longitude: 31.0522,
    })
    .select()
    .single();
  if (error) throw new Error(`branch insert failed: ${error.message}`);
  console.log(`[branch] created ${BRANCH_ID}`);
  return data;
}

async function ensureTerminal() {
  const { data: existing } = await admin.from('terminals').select('*').eq('id', TERMINAL_ID).maybeSingle();
  if (existing) {
    console.log('[terminal] already exists');
    return existing;
  }
  const { data, error } = await admin
    .from('terminals')
    .insert({
      id: TERMINAL_ID,
      tenant_id: TENANT_ID,
      branch_id: BRANCH_ID,
      branch_name: 'Sandbox Test Branch',
      code: 'SANDBOXTRM01',
      name: 'Sandbox Head Office Desk',
      workstation_type: 'BACKOFFICE_REGISTER',
      app_surface: 'HEAD_OFFICE',
      status: 'ACTIVE',
      is_default: true,
    })
    .select()
    .single();
  if (error) throw new Error(`terminal insert failed: ${error.message}`);
  console.log(`[terminal] created ${TERMINAL_ID}`);
  return data;
}

async function ensureLicenseKey() {
  const { data: existing } = await admin.from('license_keys').select('*').eq('id', LICENSE_KEY_ID).maybeSingle();
  if (existing) {
    console.log('[license_keys] already exists');
    return existing;
  }
  const { data, error } = await admin
    .from('license_keys')
    .insert({
      id: LICENSE_KEY_ID,
      tenant_id: TENANT_ID,
      email: OPERATOR_EMAIL,
      plan_tier: PLAN_TIER,
      status: 'ACTIVE',
    })
    .select()
    .single();
  if (error) throw new Error(`license_keys insert failed: ${error.message}`);
  console.log(`[license_keys] created ${LICENSE_KEY_ID}`);
  return data;
}

// The Edge Function requires a real console-operator session JWT (it calls
// admin.auth.getUser(callerJwt) then checks console_operators — a
// service-role key alone does not satisfy this, by design: DL-046's own
// header comment is explicit that a service-role client bypasses RLS but
// this function still enforces its own operator check). Reuses an existing
// operator+auth user for OPERATOR_EMAIL if one already exists; only creates
// new ones if genuinely missing, and never touches an existing operator's
// password.
async function ensureConsoleOperatorSession() {
  const { data: existingOperator } = await admin
    .from('console_operators')
    .select('id, auth_user_id, email, is_active')
    .eq('email', OPERATOR_EMAIL)
    .maybeSingle();

  let authUserId = existingOperator?.auth_user_id ?? null;
  let password = null;

  if (!authUserId) {
    // Look for an existing Supabase Auth user with this email first —
    // don't create a duplicate.
    let page = 1;
    let foundUser = null;
    for (;;) {
      const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(`listUsers failed: ${error.message}`);
      foundUser = list.users.find((u) => u.email?.toLowerCase() === OPERATOR_EMAIL.toLowerCase());
      if (foundUser || list.users.length < 200) break;
      page += 1;
    }

    if (foundUser) {
      authUserId = foundUser.id;
      console.log(`[auth] reusing existing auth user for ${OPERATOR_EMAIL} — this script cannot sign in as them without their password.`);
    } else {
      password = randomBytes(18).toString('base64url');
      const { data: created, error } = await admin.auth.admin.createUser({
        email: OPERATOR_EMAIL,
        password,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser failed: ${error.message}`);
      authUserId = created.user.id;
      console.log(`[auth] created new Supabase Auth user for ${OPERATOR_EMAIL}`);
    }
  }

  if (!existingOperator) {
    const { error } = await admin.from('console_operators').insert({
      auth_user_id: authUserId,
      email: OPERATOR_EMAIL,
      is_active: true,
    });
    if (error) throw new Error(`console_operators insert failed: ${error.message}`);
    console.log(`[console_operators] created operator row for ${OPERATOR_EMAIL}`);
  } else if (!existingOperator.is_active) {
    throw new Error(`console_operators row for ${OPERATOR_EMAIL} exists but is_active=false — refusing to reactivate silently, check with the operator first.`);
  } else {
    console.log(`[console_operators] already an active operator`);
  }

  if (!password) {
    if (existingOperator) {
      throw new Error(
        `${OPERATOR_EMAIL} is already a console operator but this script has no password for them — cannot obtain a session to call the issuance function. Sign in via apps/console yourself and issue the token from the ActivationRequestsPage/console UI instead, or set SEED_OPERATOR_PASSWORD if you know it.`
      );
    }
    // Reused an existing unlinked auth user with unknown password — same problem.
    throw new Error(`Found an existing auth user for ${OPERATOR_EMAIL} with no known password — cannot sign in. Set SEED_OPERATOR_PASSWORD to that user's real password, or issue the token manually via the console UI.`);
  }

  // Sign in with the *anon*-equivalent flow — the service-role key also
  // satisfies Supabase's apikey gateway check for this public auth endpoint,
  // so a second client isn't needed just to get a real user session.
  const authClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email: OPERATOR_EMAIL,
    password,
  });
  if (signInError) throw new Error(`signInWithPassword failed: ${signInError.message}`);

  console.log(`\n[auth] Console operator password (save this if you want to sign into apps/console yourself later):\n  ${password}\n`);

  return authClient;
}

async function issueToken(authClient) {
  const { data, error } = await authClient.functions.invoke('console-issue-terminal-activation-token', {
    body: {
      tenantId: TENANT_ID,
      terminalId: TERMINAL_ID,
      planTier: PLAN_TIER,
      validityDays: 30,
    },
  });
  if (error) throw new Error(`console-issue-terminal-activation-token failed: ${error.message}`);
  return data;
}

async function main() {
  const tenant = await ensureTenant();
  await ensureBranch();
  await ensureTerminal();
  await ensureLicenseKey();
  const authClient = await ensureConsoleOperatorSession();
  const issued = await issueToken(authClient);

  console.log('\n================ SANDBOX TENANT — VALUES FOR MANUAL ENTRY ================\n');
  console.log(`Tenant ID:            ${TENANT_ID}`);
  console.log(`Tenant pairing code:  ${tenant.pairing_code}   (use this in the app's "Join an existing business" onboarding step — NOT the license key below)`);
  console.log(`Branch ID:            ${BRANCH_ID}`);
  console.log(`Terminal ID:          ${TERMINAL_ID}`);
  console.log(`License key (id):     ${LICENSE_KEY_ID}   (record only — see note below, nothing in the app currently reads this as an input)`);
  console.log(`TerminalActivationToken (paste into the local server's /api/licensing/activate-terminal, see note below):`);
  console.log(`  ${issued.token}`);
  console.log(`  expires: ${issued.expiresAt}`);
  console.log('\n===========================================================================\n');
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
