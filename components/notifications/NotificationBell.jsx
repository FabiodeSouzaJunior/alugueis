"use client";

import { NotificationDropdown } from "./NotificationDropdown";
import { cn } from "@/lib/utils";

export function NotificationBell({ className }) {
  return (
    <div className={cn("flex items-center", className)}>
      <NotificationDropdown />
    </div>
  );
}
