import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-3xl font-bold">Hot Shots</h1>
      <a
        href="https://afl.hot-shots.dev/afl-tipping/tips"
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
