import { PropsWithChildren } from "react";
import { Header } from "~/components/header";

export function MobileTippingFrame({ children }: PropsWithChildren) {
  return (
    <div className="h-dvh flex flex-col">
      <Header className="px-2 shrink-0" />
      <div className="container mx-auto py-2 px-2 flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </div>
  );
}

export function DesktopTippingFrame({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen">
      <Header className="px-2 sticky top-0 z-50" />
      <div className="container mx-auto py-2 px-2">{children}</div>
    </div>
  );
}
