import { createFileRoute } from "@tanstack/react-router";
import { HowTippingWorksPage } from "~/features/afl-tipping/pages/how-tipping-works";

export const Route = createFileRoute("/_authenticated/afl-tipping/$season/how-tipping-works")({
  head: () => ({ meta: [{ title: "How tipping works - Hot Shots" }] }),
  component: HowTippingWorksPage,
});
