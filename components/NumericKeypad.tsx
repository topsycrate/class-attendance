"use client";

interface NumericKeypadProps {
  disabled?: boolean;
  onDigit: (digit: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
}

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function NumericKeypad({
  disabled,
  onDigit,
  onDelete,
  onSubmit,
}: NumericKeypadProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(key)}
          className="flex h-16 items-center justify-center rounded-2xl border border-line bg-white text-2xl font-semibold text-ink shadow-sm transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        className="flex h-16 items-center justify-center rounded-2xl border border-line bg-mint text-xl font-medium text-ink shadow-sm transition hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        ←
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDigit("0")}
        className="flex h-16 items-center justify-center rounded-2xl border border-line bg-white text-2xl font-semibold text-ink shadow-sm transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        0
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onSubmit}
        className="flex h-16 items-center justify-center rounded-2xl bg-ink px-2 text-base font-semibold text-white shadow-sm transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        OK
      </button>
    </div>
  );
}
