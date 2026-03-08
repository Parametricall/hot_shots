import { createFileRoute } from "@tanstack/react-router";
import { GroupTips } from "~/pages/afl-tipping/group-tips/group-tips";

export const Route = createFileRoute("/_authenticated/afl-tipping/group-tips")({
  component: GroupTips,
});
