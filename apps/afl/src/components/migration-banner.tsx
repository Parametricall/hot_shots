import * as React from "react";

const NEW_ORIGIN_HOSTNAME = "afl.hot-shots.dev";
const REINSTALL_DISMISSED_KEY = "hot-shots-reinstall-banner-dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's PWA flag isn't covered by the display-mode media query.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// Shown at the old apex/www origin: the AFL app has moved to
// afl.hot-shots.dev and this origin will stop serving it. Not dismissible -
// every online launch (the SW is network-first for navigations) should
// carry this notice until the user has migrated.
function MovedNotice() {
  return (
    <div className="bg-amber-500 text-amber-950 text-sm text-center px-4 py-2">
      Hot Shots has moved to{" "}
      <a href="https://afl.hot-shots.dev/afl-tipping/tips" className="font-bold underline">
        afl.hot-shots.dev
      </a>
      . Open the new site and add it to your home screen, then delete this old icon.
    </div>
  );
}

// Shown at the new origin to visitors not running in standalone mode - this
// catches people who arrived via the redirect from their old home-screen
// icon and nudges them to reinstall.
function ReinstallNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="bg-blue-500 text-blue-950 text-sm text-center px-4 py-2 flex items-center justify-center gap-3">
      <span>
        Add Hot Shots to your home screen: use your browser&apos;s share/menu button, then
        &quot;Add to Home Screen&quot;.
      </span>
      <button onClick={onDismiss} className="font-bold underline shrink-0">
        Dismiss
      </button>
    </div>
  );
}

export function MigrationBanner() {
  const [notice, setNotice] = React.useState<"moved" | "reinstall" | null>(null);

  React.useEffect(function determineNotice() {
    const hostname = window.location.hostname;
    if (hostname === "hot-shots.dev" || hostname === "www.hot-shots.dev") {
      setNotice("moved");
      return;
    }
    if (hostname === NEW_ORIGIN_HOSTNAME && !isStandalone()) {
      const dismissed = window.localStorage.getItem(REINSTALL_DISMISSED_KEY);
      if (!dismissed) setNotice("reinstall");
    }
  }, []);

  if (notice === "moved") return <MovedNotice />;
  if (notice === "reinstall") {
    return (
      <ReinstallNotice
        onDismiss={() => {
          window.localStorage.setItem(REINSTALL_DISMISSED_KEY, "1");
          setNotice(null);
        }}
      />
    );
  }
  return null;
}
