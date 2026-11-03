import { describe, expect, it } from "vitest";
import { analysisPrompt, generationPrompt, partsNote } from "./prompts";

const analysis = { summary: "s", style: "x", layout: "l", components: [] };

describe("page slices in prompts", () => {
  it("adds nothing for a single image", () => {
    expect(partsNote(1)).toBe("");
    expect(analysisPrompt(1)).toBe("Analyse this UI screenshot.");
    expect(generationPrompt(analysis)).not.toMatch(/slices/);
  });

  it("tells the model several images are slices of one page, top to bottom, with overlap", () => {
    for (const text of [analysisPrompt(3), generationPrompt(analysis, 3)]) {
      expect(text).toMatch(/3 images/);
      expect(text).toMatch(/ONE page/);
      expect(text).toMatch(/top to bottom/);
      expect(text).toMatch(/overlap/);
    }
  });
});
