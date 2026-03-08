import { createFileRoute } from "@tanstack/react-router";
import { MyTips } from "~/pages/afl-tipping/my-tips/my-tips";

export const Route = createFileRoute("/_authenticated/afl-tipping/tips")({
  component: MyTips,
});
