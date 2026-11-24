import { cn } from "~/lib/utils";

type SegmentedControlProps<T extends string> = {
  /** Names the choice for assistive tech, e.g. "Stats view". */
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
};

/**
 * A row of mutually exclusive choices, like iOS's segmented control. Each segment is at least 40px
 * tall, so a thumb can hit it.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex rounded-lg bg-muted p-0.5", className)}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-10 flex-1 items-center justify-center rounded-md px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
              isSelected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
