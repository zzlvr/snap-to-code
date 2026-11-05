"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, FileCode2, ShieldAlert, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { baseName, downloadBlob, filesToText, filesToZip, shadcnCommand } from "@/lib/export";
import { scanGeneratedCode } from "@/lib/scan";
import type { GeneratedFile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CodeViewer({ files, busy }: { files: GeneratedFile[]; busy: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const current = files.find((f) => f.path === selected) ?? files[files.length - 1] ?? files[0];
  const cmd = shadcnCommand(files);
  // Scan only finished output: partial code mid-stream would give flickering false alarms.
  const warnings = useMemo(() => (busy ? [] : scanGeneratedCode(files)), [files, busy]);

  async function copy(text: string, id: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      toast.success(msg);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Could not copy automatically. Select the code and press Ctrl/⌘ + C instead.");
    }
  }

  async function downloadZip() {
    try {
      downloadBlob(await filesToZip(files), "snap-to-code.zip");
      toast.success(`Downloaded snap-to-code.zip with all ${files.length} files`);
    } catch {
      // The ZIP library is loaded on demand, so this fails when the network is down.
      toast.error("Could not build the ZIP. Check your connection and try again, or use Copy all files.");
    }
  }

  function downloadOne(file: GeneratedFile) {
    downloadBlob(new Blob([file.code], { type: "text/plain" }), baseName(file.path));
    toast.success(`Downloaded ${baseName(file.path)}. Put it in ${file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/") + 1) : "your project"}`);
  }

  if (files.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Files appear here as soon as the model starts writing them.</p>;
  }

  return (
    <div className="space-y-3">
      {warnings.length > 0 && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            The code contains suspicious constructs. Review it before copying it into a project.
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {warnings.map((w, i) => (
              <li key={i}>
                <span className="font-mono text-foreground">{w.path}</span>: {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} onClick={() => copy(filesToText(files), "all", "All files copied")}>
          {copied === "all" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Copy all files
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={downloadZip}>
          <Download className="h-3.5 w-3.5" /> Download all (.zip)
        </Button>
        {cmd && (
          <Button size="sm" variant="ghost" onClick={() => copy(cmd, "cmd", "shadcn command copied")}>
            <Terminal className="h-3.5 w-3.5" /> shadcn add
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Download all (.zip)</span> gives every file in one archive, with the folders. To save a
        single file, open it below and press <span className="font-medium text-foreground">Download</span>.
      </p>

      <div className="grid gap-3 md:grid-cols-[200px_1fr]">
        <ul className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Files">
          {files.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                onClick={() => setSelected(f.path)}
                aria-current={current?.path === f.path ? "true" : undefined}
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

        <div className="min-w-0 overflow-hidden rounded-md border bg-foreground text-background">
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
            <span className="font-mono text-xs text-zinc-400">{current?.path}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => current && copy(current.code, current.path, `${current.path} copied`)}
                className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                aria-label="Copy this file"
              >
                {copied === current?.path ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy
              </button>
              <button
                type="button"
                onClick={() => current && downloadOne(current)}
                className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                aria-label="Download this file"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </div>
          </div>
          {/* Scrollable region: focusable so keyboard users can scroll it. */}
          <pre
            tabIndex={0}
            aria-label={`Source of ${current?.path}`}
            className="max-h-[560px] overflow-auto p-4 text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime"
          >
            <code>{current?.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
