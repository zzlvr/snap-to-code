import type { GeneratedFile } from "./types";

/**
 * Brand logos that lucide-react no longer ships, mapped to a generic icon that does exist.
 * Models still reach for them out of habit, and one missing export stops the whole page from compiling.
 */
const BRAND_ICONS: Record<string, string> = {
  Github: "GitFork",
  Gitlab: "GitBranch",
  Twitter: "MessageCircle",
  Facebook: "Users",
  Instagram: "Camera",
  Linkedin: "Briefcase",
  Youtube: "Play",
  Twitch: "Tv",
  Chrome: "Globe",
  Chromium: "Globe",
  Slack: "Hash",
  Discord: "MessageSquare",
  Figma: "PenTool",
  Dribbble: "Palette",
  Codepen: "Code",
  Codesandbox: "Box",
  Framer: "Frame",
  Trello: "Kanban",
  Pocket: "Bookmark",
};

const LUCIDE_IMPORT = /import\s*\{([^}]*)\}\s*from\s*(["'])lucide-react\2/g;

/** Swaps removed brand icons for generic ones in the lucide-react imports. Usages stay unchanged: `Github` becomes `GitFork as Github`. */
export function replaceBrandIcons(files: GeneratedFile[]): GeneratedFile[] {
  return files.map((file) => {
    if (!file.code.includes("lucide-react")) return file;
    const code = file.code.replace(LUCIDE_IMPORT, (whole, names: string, quote: string) => {
      let changed = false;
      const next = names
        .split(",")
        .map((part) => {
          const match = part.match(/^(\s*)([A-Za-z0-9_]+)(\s+as\s+[A-Za-z0-9_]+)?(\s*)$/);
          const replacement = match ? BRAND_ICONS[match[2]] : undefined;
          if (!match || !replacement) return part;
          changed = true;
          return `${match[1]}${replacement} as ${match[3] ? match[3].replace(/^\s+as\s+/, "") : match[2]}${match[4]}`;
        })
        .join(",");
      return changed ? `import {${next}} from ${quote}lucide-react${quote}` : whole;
    });
    return code === file.code ? file : { ...file, code };
  });
}
