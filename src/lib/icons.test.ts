import { describe, expect, it } from "vitest";
import { replaceBrandIcons } from "./icons";

const file = (code: string) => [{ path: "components/Nav.tsx", code }];

describe("replaceBrandIcons", () => {
  it("replaces a removed brand icon and keeps its usages", () => {
    const [out] = replaceBrandIcons(file('import { Github, Plus } from "lucide-react";\nexport default () => <Github />;'));
    expect(out.code).toBe('import { GitFork as Github, Plus } from "lucide-react";\nexport default () => <Github />;');
  });

  it("handles several brand icons and multi-line imports", () => {
    const [out] = replaceBrandIcons(file('import {\n  Search,\n  Twitter,\n  Linkedin,\n} from "lucide-react";'));
    expect(out.code).toContain("MessageCircle as Twitter");
    expect(out.code).toContain("Briefcase as Linkedin");
    expect(out.code).toContain("Search,");
  });

  it("keeps an existing alias", () => {
    const [out] = replaceBrandIcons(file('import { Github as Gh } from "lucide-react";'));
    expect(out.code).toBe('import { GitFork as Gh } from "lucide-react";');
  });

  it("leaves icons that exist, other imports and other files alone", () => {
    const input = [
      { path: "a.tsx", code: 'import { Plus, Search } from "lucide-react";' },
      { path: "b.tsx", code: 'import { Github } from "some-other-icons";' },
    ];
    expect(replaceBrandIcons(input)).toEqual(input);
  });
});
