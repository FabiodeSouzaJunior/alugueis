"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({ value, onChange, label, disabled }) {
  return (
    <div className="space-y-2">
      {label && (
        <p className="text-sm font-medium text-foreground/90">{label}</p>
      )}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onChange(star)}
            className={cn(
              "rounded-lg p-2 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background",
              "disabled:pointer-events-none",
              (value ?? 0) >= star
                ? "text-amber-400 drop-shadow-sm"
                : "text-muted-foreground/30 hover:text-amber-300/60"
            )}
            aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
          >
            <Star
              className="h-8 w-8 sm:h-9 sm:w-9"
              fill={(value ?? 0) >= star ? "currentColor" : "none"}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
