import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

// The AFL app runs on :3000 in dev (apps/afl/vite.config.ts) and on its own
// subdomain in production - see apps/landing/vite.config.ts for the
// redirects that cover the reverse direction (old afl-tipping/sign-in paths
// hitting this app in production).
const AFL_TIPPING_URL = import.meta.env.DEV
  ? "http://localhost:3000/afl-tipping/tips"
  : "https://afl.hot-shots.dev/afl-tipping/tips";

function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-3xl font-bold">Hot Shots</h1>
      <a
        href={AFL_TIPPING_URL}
        className="block w-full max-w-sm rounded-lg border border-gray-200 dark:border-gray-800 p-6 hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
      >
        <h2 className="text-xl font-semibold">AFL Tipping</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Submit your tips and track your predictions.
        </p>
      </a>
    </main>
  );
}
