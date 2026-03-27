"use client";

interface PinInputProps {
  value: string;
  length?: number;
}

export function PinInput({ value, length = 4 }: PinInputProps) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {Array.from({ length }).map((_, index) => {
        const char = value[index];

        return (
          <div
            key={index}
            className="flex h-14 items-center justify-center rounded-2xl border border-line bg-white text-xl font-semibold text-ink shadow-sm sm:h-16 sm:text-2xl"
          >
            {char ? <span className="font-display">{char}</span> : <span className="text-line">_</span>}
          </div>
        );
      })}
    </div>
  );
}
