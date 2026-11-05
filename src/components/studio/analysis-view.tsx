import { Badge } from "@/components/ui/badge";
import type { Analysis } from "@/lib/types";

export function AnalysisView({ analysis }: { analysis: Analysis | null }) {
  if (!analysis) {
    return <p className="py-16 text-center text-sm text-muted-foreground">The structure breakdown appears after the first step.</p>;
  }
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{analysis.summary}</h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Style:</span> {analysis.style}
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Layout:</span> {analysis.layout}
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {analysis.components.map((c, i) => (
          // Index in the key: a model may return two components with the same name.
          <li key={`${c.name}-${i}`} className="min-w-0 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-mono text-sm font-semibold">{c.name}.tsx</span>
              <Badge variant="secondary" className="shrink-0">
                {c.role}
              </Badge>
            </div>
            <p className="mt-1.5 break-words text-xs text-muted-foreground">{c.description}</p>
            {c.shadcn.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {c.shadcn.map((s) => (
                  <Badge key={s} variant="outline" className="font-mono text-[10px]">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
