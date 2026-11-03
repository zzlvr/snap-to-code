import { Lock } from "lucide-react";
import { Studio } from "@/components/studio/studio";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-7xl flex-wrap items-end justify-between gap-x-8 gap-y-3 px-4 pb-6 pt-8">
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
            <path
              d="M3 11V3h8M25 3h8v8M33 25v8h-8M11 33H3v-8"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="square"
            />
            <rect x="14" y="14" width="8" height="8" fill="var(--lime)" />
          </svg>
          <div>
            <h1 translate="no" className="font-heading text-3xl font-bold leading-none tracking-tight">
              Snap to Code
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Screenshot in, React components out. Bring your own vision model.
            </p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Your key and images never leave the browser: there is no backend.
        </p>
      </header>
      <Studio />
    </main>
  );
}
