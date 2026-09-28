export function AppLoadingScreen({ message }: { message?: string }) {
  return (
    <div
      id="app-splash"
      className="fixed inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950"
    >
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <img src="/dummy-footy-logo.png" alt="Hot Shots logo" className="w-20 h-20 rounded-xl" />
        <span className="text-2xl font-bold text-foreground">Hot Shots</span>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}
