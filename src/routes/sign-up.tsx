import { SignUp } from "@clerk/tanstack-react-start";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { IS_DEMO } from "~/lib/demo";

export const Route = createFileRoute("/sign-up")({
  // The Demo has no sign-up: go straight to AFL Tipping.
  beforeLoad: () => {
    if (IS_DEMO) throw redirect({ to: "/afl-tipping/tips" });
  },
  component: SignUpPage,
});

function SignUpPage() {
  return <SignUp />;
}
