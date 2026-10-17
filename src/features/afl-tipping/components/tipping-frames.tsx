import { PropsWithChildren } from "react";
import { Header } from "~/components/header";
import { cn } from "~/lib/utils";

type FrameProps = PropsWithChildren<{ className?: string }>;

export function MobileTippingFrame({ children, className }: FrameProps) {
  return (
    <div className={cn("h-dvh flex flex-col", className)}>
      <Header className="px-2 shrink-0" />
      <div className="container mx-auto py-2 px-2 flex-1 flex flex-col min-h-0">{children}</div>
    </div>
  );
}

export function DesktopTippingFrame({ children, className }: FrameProps) {
  return (
    <div className={cn("min-h-screen", className)}>
      <Header className="px-2 sticky top-0 z-50" />
      <div className="container mx-auto py-2 px-2">{children}</div>
    </div>
  );
}
