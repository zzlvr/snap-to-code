"use client";

import { useState } from "react";
import { Check, Copy, Download, FileCode2, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadBlob, filesToText, filesToZip, shadcnCommand } from "@/lib/export";
import type { GeneratedFile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CodeViewer({ files, busy }: { files: GeneratedFile[]; busy: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const current = files.find((f) => f.path === selected) ?? files[files.length - 1] ?? files[0];
  const cmd = shadcnCommand(files);

  async function copy(text: string, id: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      toast.success(msg);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Не удалось скопировать");
    }
  }

  if (files.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Код появится здесь после генерации.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} onClick={() => copy(filesToText(files), "all", "Все файлы скопированы")}>
          {copied === "all" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Копировать всё
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => downloadBlob(await filesToZip(files), "snap-to-code.zip")}
        >
          <Download className="h-3.5 w-3.5" /> ZIP
        </Button>
        {cmd && (
          <Button size="sm" variant="ghost" onClick={() => copy(cmd, "cmd", "Команда shadcn скопирована")}>
            <Terminal className="h-3.5 w-3.5" /> shadcn add
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[200px_1fr]">
        <ul className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Файлы">
          {files.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                onClick={() => setSelected(f.path)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left font-mono text-xs transition-colors hover:bg-muted",
                  current?.path === f.path && "bg-muted font-semibold",
                )}
              >
                <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.path}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="min-w-0 overflow-hidden rounded-lg border bg-zinc-950 text-zinc-100">
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
            <span className="font-mono text-xs text-zinc-400">{current?.path}</span>
            <button
              type="button"
              onClick={() => current && copy(current.code, current.path, `${current.path} скопирован`)}
              className="rounded p-1 text-zinc-400 hover:text-zinc-100"
              aria-label="Копировать файл"
            >
              {copied === current?.path ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <pre className="max-h-[560px] overflow-auto p-4 text-xs leading-relaxed">
            <code>{current?.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
