import { createFileRoute } from "@tanstack/react-router";

// DRAFT: the operator reviews this text before the cutover (plans/013, Step 1). Meta and Google
// require a public privacy policy URL, and Meta requires data deletion instructions.
const CONTACT_EMAIL = "hot-shots-support@googlegroups.com";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy | Hot Shots" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl p-6 flex flex-col gap-4" data-app-ready>
      <h1 className="text-2xl font-bold">Privacy</h1>
      <p>
        Hot Shots is a private tipping site for a small group of friends. You can only join if you
        have been invited.
      </p>

      <h2 className="text-lg font-semibold">What we keep</h2>
      <ul className="list-disc pl-6">
        <li>
          Your email address and your name, and your profile photo if Google shares one, from the
          account you sign in with. We ask for nothing else from them.
        </li>
        <li>The tips you make, and the date you joined.</li>
        <li>
          A sign-in cookie in your browser, so you stay signed in until you sign out. We use no
          advertising or tracking cookies.
        </li>
      </ul>

      <h2 className="text-lg font-semibold">How we use it</h2>
      <p>
        To check you were invited, show your name and photo to the other tipsters, and score the
        competition. Other tipsters can see your name, photo and tips. We don&apos;t sell or share
        your details with anyone else. Your accounts and tips are stored with our database and
        sign-in provider, Supabase.
      </p>

      <h2 id="delete" className="text-lg font-semibold">
        Deleting your data
      </h2>
      <p>
        To have your account, name, photo and tips deleted, email{" "}
        <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>{" "}
        from the address you signed in with. We&apos;ll delete everything we hold about you and
        confirm by reply.
      </p>
    </main>
  );
}
