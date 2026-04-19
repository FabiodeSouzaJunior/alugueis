import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto scrollbar-hide">
    <table
      ref={ref}
      className={cn(
        "w-full min-w-full table-fixed caption-bottom text-sm border-separate",
        "[&_tbody_tr_td]:bg-card",
        "[&_tbody_tr:hover_td]:bg-accent",
        "[&_tbody_tr.bg-red-500\\/10_td]:!bg-red-500/10 [&_tbody_tr.bg-red-500\\/10:hover_td]:!bg-red-500/15",
        "[&_tbody_tr.bg-amber-500\\/10_td]:!bg-amber-500/10 [&_tbody_tr.bg-amber-500\\/10:hover_td]:!bg-amber-500/15",
        "[&_tbody_tr_td:first-child]:rounded-l-lg [&_tbody_tr_td:last-child]:rounded-r-lg",
        "[&_tbody_tr_td]:border-y [&_tbody_tr_td]:border-border/50",
        "[&_tbody_tr_td:first-child]:border-l [&_tbody_tr_td:last-child]:border-r",
        "[&_thead_th]:border-b [&_thead_th]:border-border/50 [&_thead_th]:pb-3",
        className
      )}
      style={{ borderSpacing: "0 6px" }}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-0", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "transition-colors data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-11 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 whitespace-nowrap",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
