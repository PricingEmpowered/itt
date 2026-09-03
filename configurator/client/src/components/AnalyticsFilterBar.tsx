import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FilterOption { value: string; label: string }

interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
}

interface AnalyticsFilterBarProps {
  filters: FilterConfig[];
  className?: string;
}

export default function AnalyticsFilterBar({ filters, className }: AnalyticsFilterBarProps) {
  return (
    <div className={cn("flex flex-wrap gap-3 items-center", className)}>
      {filters.map((f) => (
        <div key={f.key} className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</label>
          <Select value={f.value} onValueChange={f.onChange}>
            <SelectTrigger className="h-8 text-xs border-border/60 bg-background focus:ring-primary/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {f.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
