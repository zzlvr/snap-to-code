import { describe, expect, it } from "vitest";
import { CLASS_MERGE_SOURCE } from "./class-merge";

const twMerge = new Function(`${CLASS_MERGE_SOURCE}; return twMerge;`)() as (s: string) => string;

describe("class merge (preview runtime)", () => {
  it("lets a later background replace the button's own one", () => {
    expect(twMerge("bg-primary text-primary-foreground hover:bg-primary/90 bg-neutral-900 text-white")).toBe(
      "hover:bg-primary/90 bg-neutral-900 text-white",
    );
  });

  it("lets a later variant class replace the same variant only", () => {
    expect(twMerge("hover:bg-primary/90 hover:bg-neutral-800")).toBe("hover:bg-neutral-800");
    expect(twMerge("bg-primary hover:bg-neutral-800")).toBe("bg-primary hover:bg-neutral-800");
  });

  it("tells text colour from text size and alignment", () => {
    expect(twMerge("text-sm text-primary text-[13px] text-white text-center")).toBe("text-[13px] text-white text-center");
  });

  it("replaces radius, height and padding", () => {
    expect(twMerge("h-10 px-4 py-2 rounded-md h-8 rounded-full px-3")).toBe("py-2 h-8 rounded-full px-3");
  });

  it("lets p replace the earlier px and py but not the reverse", () => {
    expect(twMerge("px-2 py-1 p-4")).toBe("p-4");
    expect(twMerge("p-4 px-2")).toBe("p-4 px-2");
  });

  it("tells border width from border colour", () => {
    expect(twMerge("border border-input border-0 border-transparent")).toBe("border-0 border-transparent");
  });

  it("keeps unknown classes and flex/grid utilities that do not clash", () => {
    expect(twMerge("inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium")).toBe(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    );
  });

  it("ignores extra spaces", () => {
    expect(twMerge("  bg-red-500   bg-blue-500 ")).toBe("bg-blue-500");
  });
});
