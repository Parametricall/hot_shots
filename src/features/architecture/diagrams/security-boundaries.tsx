import { Box } from "~/features/architecture/diagram/box";
import { Diagram } from "~/features/architecture/diagram/diagram";
import { Edge } from "~/features/architecture/diagram/edge";
import { EdgeLabel } from "~/features/architecture/diagram/edge-label";
import { Lane } from "~/features/architecture/diagram/lane";

export const SECURITY_LABEL =
  "Boundaries: the browser reaches our server with its cookie and Realtime with a signed-in token, but the publishable key reads no table rows. Our server uses the secret key. pg_cron calls our sync endpoints with a Bearer secret from Vault.";

export const SECURITY_CAPTION =
  "The publishable key ships in the page, so anyone can take it. With RLS on and no policies, it reads and writes nothing. The only exception is receiving on afl:live-games, and only with a signed-in token.";

/** Who may reach what: the allowed paths in grey, and the one the publishable key is refused. */
export const SecurityBoundaries = () => (
  <Diagram viewBox="0 0 780 350" label={SECURITY_LABEL} maxWidth={860}>
    <Lane x={10} y={44} width={200} height={268} label="BROWSER · ANYONE" />
    <Lane x={290} y={44} width={200} height={268} label="OUR SERVER" />
    <Lane x={570} y={44} width={200} height={268} label="SUPABASE" />

    <Box
      x={24}
      y={80}
      width={172}
      height={52}
      title="Publishable key"
      lines={["+ session cookie"]}
    />
    <Box
      x={304}
      y={80}
      width={172}
      height={52}
      title="Server functions"
      lines={["secret key, server-only"]}
    />
    <Box
      x={304}
      y={246}
      width={172}
      height={52}
      title="Sync endpoints"
      lines={["need the Bearer secret"]}
    />
    <Box x={584} y={80} width={172} height={52} title="Tables" lines={["RLS on, no policies"]} />
    <Box x={584} y={146} width={172} height={40} title="Lease/cron functions" />
    <Box x={584} y={198} width={172} height={40} title="Realtime channel" />
    <Box
      x={584}
      y={250}
      width={172}
      height={48}
      title="pg_cron + Vault"
      lines={["app_url, sync secret"]}
    />

    <Edge x1={196} y1={106} x2={302} y2={106} />
    <EdgeLabel x={249} y={98} anchor="middle" on="lane">
      cookie
    </EdgeLabel>
    <Edge x1={476} y1={106} x2={582} y2={106} />
    <EdgeLabel x={529} y={98} anchor="middle" on="lane">
      bypasses RLS
    </EdgeLabel>
    <Edge x1={584} y1={274} x2={478} y2={274} />
    <EdgeLabel x={531} y={266} anchor="middle" on="lane">
      POST + secret
    </EdgeLabel>

    {/* Starts at x=180 so it clears the lane label. */}
    <Edge d="M180 80 V24 H670 V78" refused />
    <line
      x1={384}
      y1={18}
      x2={396}
      y2={30}
      strokeWidth={2.2}
      strokeLinecap="round"
      className="stroke-destructive"
    />
    <line
      x1={396}
      y1={18}
      x2={384}
      y2={30}
      strokeWidth={2.2}
      strokeLinecap="round"
      className="stroke-destructive"
    />
    <EdgeLabel x={410} y={18}>
      publishable key: 0 rows
    </EdgeLabel>

    {/* Runs up the right margin (x=763) so it clears the pg_cron box. */}
    <Edge d="M110 132 V330 H763 V218 H758" />
    <EdgeLabel x={400} y={324} anchor="middle">
      signed-in token · receive only, one topic
    </EdgeLabel>
  </Diagram>
);
