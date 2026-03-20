import { createFileRoute } from "@tanstack/react-router";
import { MyTips } from "~/features/afl-tipping/pages/my-tips";

export const Route = createFileRoute("/_authenticated/afl-tipping/tips")({
  component: MyTips,
});
