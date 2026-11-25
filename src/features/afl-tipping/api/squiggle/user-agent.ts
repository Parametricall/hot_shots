import { SQUIGGLE_USER_AGENT_NAME } from "~/features/afl-tipping/api/squiggle/constants";

/**
 * The User-Agent Squiggle asks every caller to send, with a contact email so it can reach us.
 * `undefined` without an email: the caller must not call Squiggle anonymously. The email comes
 * from the server-only `SQUIGGLE_CONTACT_EMAIL` and is never written into the (public) repo.
 */
export function buildSquiggleUserAgent(contactEmail: string | undefined): string | undefined {
  const email = contactEmail?.trim();
  return email ? `${SQUIGGLE_USER_AGENT_NAME} - ${email}` : undefined;
}
