import { createFileRoute } from "@tanstack/react-router";
import { Index } from "~/pages/afl-tipping/index";
import { AflServerFnsProvider } from "~/features/afl-tipping/providers/afl-server-fns-provider";

export const Route = createFileRoute("/afl-tipping/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <AflServerFnsProvider>
      <Index />
    </AflServerFnsProvider>
  );
}
