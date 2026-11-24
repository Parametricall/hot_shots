/**
 * Creates the dev users behind /sign-in's quick-login buttons in the LOCAL Supabase, or resets
 * their passwords if they exist. Run it after `npx supabase db reset`, which deletes every user
 * (there is no seed.sql). Safe to re-run.
 *
 * Usage:
 *   npm run seed:dev-users
 *
 * Reads VITE_DEV_USER_<n>_LABEL / _EMAIL / _PASSWORD (n = 1..10), SUPABASE_URL (or
 * VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY from .env; variables already in the environment win.
 *
 * Each email gets an Invitation first, because the before-user-created hook turns away any
 * address without one. The Profile comes from the sign-up trigger, named after the label. The
 * Tipster row comes later, when the user first opens AFL Tipping.
 *
 * Refuses any Supabase URL that isn't on 127.0.0.1 or localhost: these are known passwords.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const MAX_DEV_USERS = 10;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

// Parse .env manually (no dotenv dependency)
try {
  const envContent = readFileSync(resolve(import.meta.dirname, "..", ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1).replace(/^"(.*)"$/, "$1");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // No .env: everything must already be in the environment.
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SECRET_KEY");
  process.exit(1);
}

if (!LOCAL_HOSTS.has(new URL(supabaseUrl).hostname)) {
  console.error(`Refusing to seed dev users into ${supabaseUrl}: only a local Supabase is allowed`);
  process.exit(1);
}

type DevUser = { label: string; email: string; password: string };

function readDevUsers(): DevUser[] {
  const users: DevUser[] = [];
  for (let i = 1; i <= MAX_DEV_USERS; i++) {
    const label = process.env[`VITE_DEV_USER_${i}_LABEL`];
    const email = process.env[`VITE_DEV_USER_${i}_EMAIL`];
    const password = process.env[`VITE_DEV_USER_${i}_PASSWORD`];
    if (label && email && password) {
      users.push({ label, email: email.trim().toLowerCase(), password });
    }
  }
  return users;
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId(email: string): Promise<string | null> {
  const PER_PAGE = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < PER_PAGE) return null;
  }
}

async function seed(user: DevUser): Promise<"created" | "password reset"> {
  const { error: inviteError } = await supabase
    .from("invitations")
    .upsert({ email: user.email }, { onConflict: "email", ignoreDuplicates: true });
  if (inviteError) throw new Error(`invitation failed: ${inviteError.message}`);

  const existingId = await findUserId(user.email);
  if (existingId) {
    const { error } = await supabase.auth.admin.updateUserById(existingId, {
      password: user.password,
      email_confirm: true,
    });
    if (error) throw new Error(`password reset failed: ${error.message}`);
    return "password reset";
  }

  const { error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: user.label },
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  return "created";
}

async function main() {
  const users = readDevUsers();
  if (users.length === 0) {
    console.error("No VITE_DEV_USER_<n>_LABEL / _EMAIL / _PASSWORD sets in .env");
    process.exit(1);
  }

  let failed = false;
  for (const user of users) {
    try {
      const outcome = await seed(user);
      console.log(`${user.email}: ${outcome}`);
    } catch (error) {
      failed = true;
      console.error(`${user.email}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failed) process.exit(1);
}

await main();
