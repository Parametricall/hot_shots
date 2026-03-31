import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dismissCheatingReport } from "~/features/afl-tipping/api/cheating-reports";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { cn } from "~/lib/utils";

type Step = "step1" | "step2" | "step3" | "guilty" | "innocent";

interface CheatingPopupProps {
  reportCount: number;
}

const STEPS: Record<
  Step,
  {
    icon: string;
    title: string;
    body: string;
    buttons: { label: string; target: Step | "dismiss" }[];
  }
> = {
  step1: {
    icon: "🚨",
    title: "Cheating detected",
    body: "Our system has flagged suspicious activity on your account. This has been logged.",
    buttons: [
      { label: "I'm innocent", target: "step2" },
      { label: "Okay fine, I cheated", target: "guilty" },
    ],
  },
  step2: {
    icon: "🤔",
    title: "Are you sure about that?",
    body: "We have evidence. Are you absolutely certain you want to claim innocence?",
    buttons: [
      { label: "Okay fine, I cheated", target: "guilty" },
      { label: "Yes, completely innocent", target: "step3" },
    ],
  },
  step3: {
    icon: "🧐",
    title: "One final question",
    body: "Do you solemnly swear, on your tipping record, that you did not cheat?",
    buttons: [
      { label: "I pinky promise I did not cheat", target: "innocent" },
      { label: "Okay fine, I cheated", target: "guilty" },
    ],
  },
  guilty: {
    icon: "😂",
    title: "Confession accepted",
    body: "Your honesty has been noted. The tribunal will be in touch.",
    buttons: [{ label: "Wait, I didn't mean it", target: "step1" }],
  },
  innocent: {
    icon: "👀",
    title: "Noted... we're watching",
    body: "You're free to go. For now.",
    buttons: [{ label: "Close", target: "dismiss" }],
  },
};

export function CheatingPopup({ reportCount }: CheatingPopupProps) {
  const [step, setStep] = useState<Step>("step1");
  const [shaking, setShaking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const queryClient = useQueryClient();

  const dismissMutation = useMutation({
    mutationFn: dismissCheatingReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aflQueries.cheatingReports().queryKey });
      setDismissed(true);
    },
  });

  const goTo = (target: Step | "dismiss") => {
    if (target === "dismiss") {
      dismissMutation.mutate({ data: undefined });
      return;
    }
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
    setStep(target);
  };

  if (dismissed) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className={cn(
          "bg-white rounded-xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-center",
          shaking && "animate-shake",
        )}
      >
        <div className="text-5xl sm:text-6xl mb-4">{current.icon}</div>

        <h2 className="text-xl sm:text-2xl font-bold mb-2">{current.title}</h2>

        <p className="text-gray-600 text-sm sm:text-base mb-2">{current.body}</p>

        {step === "step1" && (
          <p className="text-xs text-gray-400 mb-4">
            {reportCount} report{reportCount !== 1 ? "s" : ""} filed against you.
          </p>
        )}

        <div className="flex flex-col gap-3 mt-6">
          {current.buttons.map((btn) => (
            <button
              key={btn.label}
              onClick={() => goTo(btn.target)}
              disabled={btn.target === "dismiss" && dismissMutation.isPending}
              className={cn(
                "w-full rounded-lg px-4 py-3 font-medium text-sm sm:text-base min-h-12 transition-colors",
                btn.target === "guilty"
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : btn.target === "dismiss"
                    ? "bg-gray-800 text-white hover:bg-gray-900"
                    : "bg-blue-600 text-white hover:bg-blue-700",
              )}
            >
              {btn.target === "dismiss" && dismissMutation.isPending ? "Closing..." : btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
