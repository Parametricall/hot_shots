import { Box } from "~/features/architecture/diagram/box";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Edge } from "~/features/architecture/diagram/edge";
import { EdgeLabel } from "~/features/architecture/diagram/edge-label";
import { Activation, Lifeline } from "~/features/architecture/diagram/lifeline";
import { DiagramText } from "~/features/architecture/diagrams/diagram-text";

export const SIGN_IN_LABEL =
  "Sequence: the browser starts Google sign-in through the site's server, Supabase Auth checks the email is invited, then the server exchanges the code for a session and sets HttpOnly cookies.";

export const SIGN_IN_CAPTION =
  'A first sign-in with Google. With an emailed code, steps 3–4 become "Supabase emails a code, the person types it in", and the same invite check and cookie step follow.';

/** A first sign-in with Google, from the button to the HttpOnly session cookies. */
export const SignInSequence = () => (
  <Diagram viewBox="0 0 760 396" label={SIGN_IN_LABEL} maxWidth={860}>
    <Box x={15} y={8} width={130} height={36} title="Browser" centered />
    <Box x={215} y={8} width={130} height={36} title="The server" centered />
    <Box x={415} y={8} width={130} height={36} title="Supabase Auth" centered />
    <Box x={615} y={8} width={130} height={36} title="Google" centered external />
    <Lifeline x={80} y1={44} y2={388} />
    <Lifeline x={280} y1={44} y2={388} />
    <Lifeline x={480} y1={44} y2={388} />
    <Lifeline x={680} y1={44} y2={388} />

    <Edge x1={84} y1={76} x2={274} y2={76} />
    <EdgeLabel x={180} y={68} anchor="middle">
      1. Continue with Google
    </EdgeLabel>
    <Edge x1={284} y1={110} x2={474} y2={110} />
    <EdgeLabel x={380} y={102} anchor="middle">
      2. Start OAuth (PKCE)
    </EdgeLabel>
    <Edge x1={84} y1={144} x2={674} y2={144} />
    <EdgeLabel x={380} y={136} anchor="middle">
      3. Google consent screen
    </EdgeLabel>
    <Edge x1={676} y1={178} x2={486} y2={178} />
    <EdgeLabel x={580} y={170} anchor="middle">
      4. Who this is
    </EdgeLabel>
    <Activation x={480} y={194} height={36} />
    <DiagramText x={494} y={208} className="text-[11px]">
      5. Before User Created hook:
    </DiagramText>
    <DiagramText x={494} y={224} className="text-[11px]">
      is this email invited?
    </DiagramText>
    <Edge x1={474} y1={254} x2={86} y2={254} ret />
    <EdgeLabel x={280} y={246} anchor="middle">
      6. Redirect to /auth/callback?code
    </EdgeLabel>
    <Edge x1={84} y1={288} x2={274} y2={288} />
    <EdgeLabel x={180} y={280} anchor="middle">
      7. GET /auth/callback
    </EdgeLabel>
    <Edge x1={284} y1={322} x2={474} y2={322} />
    <EdgeLabel x={380} y={314} anchor="middle">
      8. Exchange code for a session
    </EdgeLabel>
    <Edge x1={276} y1={356} x2={86} y2={356} ret />
    <EdgeLabel x={180} y={348} anchor="middle">
      9. HttpOnly cookies, redirect
    </EdgeLabel>
  </Diagram>
);
