import { cn } from "cn";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, hint, className }: StatCardProps) {
  return (
    <div className={cn("bg-card border-border rounded-xl border p-4", className)}>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-foreground mt-1.5 font-mono text-xl font-bold">{value}</p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  );
}
