import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ensureOwner } from "~/lib/auth";
import { AdminPage } from "~/features/afl-tipping/pages/admin";
import { Header } from "~/components/header";

const ownerCheckFn = createServerFn({ method: "GET" }).handler(async () => {
  await ensureOwner();
});

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    try {
      await ownerCheckFn();
    } catch {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="min-h-screen px-2">
      <Header />
      <hr />
      <div className="container mx-auto py-4">
        <AdminPage />
      </div>
    </div>
  );
}
