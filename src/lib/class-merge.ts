/**
 * Plain JavaScript source of a small class-name merger, injected into the live preview.
 *
 * The real shadcn/ui `cn` uses tailwind-merge, so `<Button className="bg-neutral-900">` replaces the button's own
 * `bg-primary`. The preview has no bundler, so it needs the same rule: when two classes set the same property
 * (same variant prefix, same utility group), the later one wins. Unknown classes are always kept.
 * It is a string so the preview iframe can run it and the tests can run the exact same code.
 */
export const CLASS_MERGE_SOURCE = String.raw`
  var TEXT_SIZES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"];
  var TEXT_ALIGN = ["left", "center", "right", "justify", "start", "end"];
  var TEXT_OTHER = ["wrap", "nowrap", "balance", "pretty", "ellipsis", "clip"];
  var FONT_WEIGHTS = ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"];
  var RADIUS = ["none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"];
  var SIDES = ["t", "b", "l", "r", "x", "y", "s", "e", "tl", "tr", "bl", "br"];
  var DISPLAY = ["block", "inline", "inline-block", "flex", "inline-flex", "grid", "inline-grid", "hidden", "contents", "table"];
  var POSITION = ["static", "relative", "absolute", "fixed", "sticky"];
  var BG_OTHER = ["cover", "contain", "auto", "center", "top", "bottom", "left", "right", "fixed", "local", "scroll", "repeat", "no-repeat", "clip-text", "clip-border", "clip-padding", "clip-content"];
  var BORDER_STYLE = ["solid", "dashed", "dotted", "double", "hidden", "none"];
  var SPACING = ["p", "px", "py", "pt", "pr", "pb", "pl", "ps", "pe", "m", "mx", "my", "mt", "mr", "mb", "ml", "ms", "me"];
  var CONFLICTS = {
    p: ["px", "py", "pt", "pr", "pb", "pl", "ps", "pe"], px: ["pl", "pr", "ps", "pe"], py: ["pt", "pb"],
    m: ["mx", "my", "mt", "mr", "mb", "ml", "ms", "me"], mx: ["ml", "mr", "ms", "me"], my: ["mt", "mb"],
    size: ["w", "h"], gap: ["gap-x", "gap-y"], rounded: ["rounded-t", "rounded-b", "rounded-l", "rounded-r", "rounded-tl", "rounded-tr", "rounded-bl", "rounded-br"]
  };
  function has(list, v) { return list.indexOf(v) >= 0; }
  function isLength(v) {
    return v.charAt(0) === "[" && (v.indexOf("px]") > 0 || v.indexOf("rem]") > 0 || v.indexOf("em]") > 0 || v.indexOf("%]") > 0);
  }
  function isDigits(v) {
    if (v === "") return false;
    for (var i = 0; i < v.length; i++) if (v.charAt(i) < "0" || v.charAt(i) > "9") return false;
    return true;
  }
  function groupOfUtility(u) {
    var dash = u.indexOf("-");
    var head = dash < 0 ? u : u.slice(0, dash);
    var rest = dash < 0 ? "" : u.slice(dash + 1);
    if (has(SPACING, head)) return head;
    if (has(DISPLAY, u)) return "display";
    if (has(POSITION, u)) return "position";
    switch (head) {
      case "bg":
        if (rest.indexOf("gradient") === 0) return "bg-image";
        if (has(BG_OTHER, rest)) return null;
        return rest === "" ? null : "bg-color";
      case "text":
        if (rest === "") return null;
        if (has(TEXT_SIZES, rest) || isLength(rest)) return "text-size";
        if (has(TEXT_ALIGN, rest)) return "text-align";
        if (has(TEXT_OTHER, rest)) return null;
        return "text-color";
      case "font":
        if (has(FONT_WEIGHTS, rest)) return "font-weight";
        if (rest === "sans" || rest === "serif" || rest === "mono") return "font-family";
        return null;
      case "rounded":
        if (rest === "" || has(RADIUS, rest) || isLength(rest)) return "rounded";
        var side = rest.split("-")[0];
        return has(SIDES, side) ? "rounded-" + side : null;
      case "border":
        if (rest === "" || isDigits(rest) || isLength(rest)) return "border-w";
        if (has(BORDER_STYLE, rest)) return "border-style";
        var bs = rest.split("-")[0];
        if (has(SIDES, bs) && (rest === bs || isDigits(rest.slice(bs.length + 1)) || isLength(rest.slice(bs.length + 1)))) return "border-w-" + bs;
        return "border-color";
      case "ring":
        if (rest === "" || isDigits(rest)) return "ring-w";
        return "ring-color";
      case "shadow":
        if (rest === "" || has(RADIUS, rest) || rest === "inner") return "shadow";
        return "shadow-color";
      case "h": case "w": case "size": case "opacity": case "leading": case "tracking": case "z": case "cursor": case "items": case "justify": case "self": case "order":
        return rest === "" ? null : head;
      case "min": case "max":
        return "mm-" + head + "-" + rest.split("-")[0];
      case "gap":
        if (rest.indexOf("x-") === 0) return "gap-x";
        if (rest.indexOf("y-") === 0) return "gap-y";
        return "gap";
      case "space":
        return rest.indexOf("x-") === 0 ? "space-x" : rest.indexOf("y-") === 0 ? "space-y" : null;
      case "overflow":
        if (rest.indexOf("x-") === 0) return "overflow-x";
        if (rest.indexOf("y-") === 0) return "overflow-y";
        return has(["auto", "hidden", "visible", "scroll", "clip"], rest) ? "overflow" : null;
      default:
        return null;
    }
  }
  function twMerge(input) {
    var parts = String(input).split(" ");
    var claimed = {};
    var kept = [];
    for (var i = parts.length - 1; i >= 0; i--) {
      var cls = parts[i];
      if (!cls) continue;
      var cut = cls.lastIndexOf(":");
      var variant = cut >= 0 ? cls.slice(0, cut + 1) : "";
      var utility = cls.slice(cut + 1);
      if (utility.charAt(0) === "!") { variant += "!"; utility = utility.slice(1); }
      if (utility.charAt(0) === "-") utility = utility.slice(1);
      var group = groupOfUtility(utility);
      if (group === null) { kept.push(cls); continue; }
      if (claimed[variant + group]) continue;
      claimed[variant + group] = true;
      var extra = CONFLICTS[group];
      if (extra) for (var k = 0; k < extra.length; k++) claimed[variant + extra[k]] = true;
      kept.push(cls);
    }
    return kept.reverse().join(" ");
  }
`;
