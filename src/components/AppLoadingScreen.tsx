export function AppLoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <img src="/dummy-footy-logo.png" alt="Hot Shots logo" className="w-20 h-20 rounded-xl" />
        <span className="text-2xl font-bold text-foreground">Hot Shots</span>
      </div>
    </div>
  );
}
