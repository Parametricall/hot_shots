/**
 * One-off migration: every Clerk user becomes an Invitation, a Supabase Auth user, a Profile and
 * an `afl_tipsters` row (plans/013, docs/adr/0006). Safe to re-run: a Clerk user whose Profile
 * already has their `clerk_user_id` is skipped.
 *
 * Usage:
 *   npx tsx scripts/migrate-clerk-users.ts [--apply]
 *
 * Options:
 *   --apply    Write to the database. Without it, nothing is written (a dry run).
 *
 * Reads CLERK_SECRET_KEY, SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY from .env;
 * variables already in the environment win, so a local run can point at the local stack.
 * RLS denies the publishable key every row, so this needs the secret key.
 *
 * Each person keeps their Clerk sign-up date as `afl_tipsters.joined_at`, so 2026 Auto-tips don't
 * change (docs/adr/0001). Their photo is left empty: Clerk's image URLs die with the Clerk app,
 * and the sign-in callback fills in Google's on first sign-in.
 *
 * The full Clerk id -> new id mapping is written to the OS temp directory. It contains emails, so
 * it never goes in the repo.
 *
 * Exits non-zero if a Clerk user who has Tips was skipped.
 */

import { createClerkClient, type User } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

// Parse .env manually (no dotenv dependency)
try {
  const envContent = readFileSync(resolve(import.meta.dirname, "..", ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // No .env: everything must already be in the environment.
}

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!clerkSecretKey || !supabaseUrl || !supabaseKey) {
  console.error(
    "Missing CLERK_SECRET_KEY, SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SECRET_KEY",
  );
  process.exit(1);
}

const apply = process.argv.includes("--apply");

const clerk = createClerkClient({ secretKey: clerkSecretKey });
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Outcome = "created" | "existing" | "skipped";

type Report = {
  clerkId: string;
  email: string | null;
  signedInWith: string;
  newId: string | null;
  outcome: Outcome;
  note?: string;
};

async function fetchAllClerkUsers(): Promise<User[]> {
  const BATCH_SIZE = 100;
  const users: User[] = [];
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data } = await clerk.users.getUserList({ limit: BATCH_SIZE, offset });
    users.push(...data);
    if (data.length < BATCH_SIZE) break;
  }
  return users;
}

/** Everyone with a Tip. A skipped user among them is a failed migration. */
async function fetchUserIdsWithTips(): Promise<Set<string>> {
  const PAGE_SIZE = 1000;
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("afl_tipping")
      .select("user_id")
      .order("game_id", { ascending: true })
      .order("user_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not read afl_tipping: ${error.message}`);
    for (const row of data ?? []) ids.add(row.user_id as string);
    if (!data || data.length < PAGE_SIZE) break;
  }
  return ids;
}

function primaryEmail(user: User): string | null {
  const primary =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
  return primary?.emailAddress.toLowerCase() ?? null;
}

/** The name Clerk showed: first and last name, else the first email, else "Unknown User". */
function displayName(user: User): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.emailAddresses[0]?.emailAddress ||
    "Unknown User"
  );
}

function signedInWith(user: User): string {
  const accounts = user.externalAccounts.map(
    (a) => `${a.provider}${a.emailAddress ? ` (${a.emailAddress.toLowerCase()})` : ""}`,
  );
  return accounts.length > 0 ? accounts.join(", ") : "password";
}

/** Someone whose Google email differs from the invited one is turned away. */
function emailMismatch(user: User, email: string): string | undefined {
  const other = user.externalAccounts
    .map((a) => a.emailAddress?.toLowerCase())
    .filter((e): e is string => !!e && e !== email);
  return other.length > 0 ? `provider email differs: ${other.join(", ")}` : undefined;
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const PER_PAGE = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(`Could not list Auth users: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < PER_PAGE) return null;
  }
}

async function migrateUser(user: User): Promise<Report> {
  const email = primaryEmail(user);
  const base = { clerkId: user.id, email, signedInWith: signedInWith(user) };
  if (!email) return { ...base, newId: null, outcome: "skipped", note: "no email address" };

  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(`Could not read profiles: ${profileError.message}`);
  if (existingProfile) {
    return { ...base, newId: existingProfile.id, outcome: "existing", note: "already migrated" };
  }

  const note = emailMismatch(user, email);
  if (!apply) return { ...base, newId: null, outcome: "created", note: `dry run; ${note ?? ""}` };

  // The admin API skips the Before User Created hook, so the Invitation is what lets this
  // person back in through Google or an emailed code.
  const { error: inviteError } = await supabase
    .from("invitations")
    .upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  if (inviteError) throw new Error(`Could not invite ${email}: ${inviteError.message}`);

  let newId: string;
  let outcome: Outcome = "created";
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: displayName(user) },
  });
  if (created?.user) {
    newId = created.user.id;
  } else {
    const existingId = await findAuthUserIdByEmail(email);
    if (!existingId) {
      throw new Error(`Could not create ${email}: ${createError?.message ?? "unknown error"}`);
    }
    newId = existingId;
    outcome = "existing";
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ display_name: displayName(user), clerk_user_id: user.id, avatar_url: null })
    .eq("id", newId);
  if (updateError) throw new Error(`Could not update the Profile: ${updateError.message}`);

  const { error: tipsterError } = await supabase
    .from("afl_tipsters")
    .upsert({ profile_id: newId, joined_at: new Date(user.createdAt).toISOString() });
  if (tipsterError) throw new Error(`Could not add the Tipster: ${tipsterError.message}`);

  return { ...base, newId, outcome, note };
}

async function main() {
  console.log(apply ? "APPLY: writing to the database" : "DRY RUN: nothing will be written");
  console.log(`Supabase: ${new URL(supabaseUrl!).host}`);

  const [users, idsWithTips] = await Promise.all([fetchAllClerkUsers(), fetchUserIdsWithTips()]);
  console.log(`${users.length} Clerk users, ${idsWithTips.size} people with Tips\n`);

  const reports: Report[] = [];
  for (const user of users) {
    const report = await migrateUser(user);
    reports.push(report);
    console.log(
      [
        report.clerkId,
        report.email ?? "(no email)",
        report.signedInWith,
        report.newId ?? "-",
        report.outcome,
        report.note ?? "",
      ].join("  |  "),
    );
  }

  const mappingPath = join(tmpdir(), `clerk-migration-${Date.now()}.json`);
  writeFileSync(mappingPath, JSON.stringify(reports, null, 2));
  console.log(`\nMapping written to ${mappingPath}`);

  const lostTips = reports.filter((r) => r.outcome === "skipped" && idsWithTips.has(r.clerkId));
  const clerkIds = new Set(users.map((u) => u.id));
  const unknownIds = [...idsWithTips].filter((id) => !clerkIds.has(id));
  if (lostTips.length > 0 || unknownIds.length > 0) {
    console.error("\nTips that would be orphaned:");
    for (const r of lostTips) console.error(`  ${r.clerkId}: skipped, ${r.note}`);
    for (const id of unknownIds) console.error(`  ${id}: has Tips but is not a Clerk user`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
