import { createFileRoute } from "@tanstack/react-router";
import { GroupTips } from "~/features/afl-tipping/pages/group-tips";

export const Route = createFileRoute("/_authenticated/afl-tipping/group-tips")({
  component: GroupTips,
});
