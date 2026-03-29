import { SignIn } from "@clerk/tanstack-react-start";

export function SignInPage() {
  return (
    <div className="h-dvh flex justify-center items-center w-full" data-app-ready>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </div>
  );
}
