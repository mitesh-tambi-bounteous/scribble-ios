import {
  ENHANCE_CONFIG,
  buildBackgroundPrompt,
  buildDescribeContext,
  buildSettingPrompt,
  parseDescribedDrawing,
} from "../backend/lambda/enhance/config";
import type { ChannelResponse } from "@scribl/shared/domain";

describe("ENHANCE_CONFIG", () => {
  it("has the expected shape", () => {
    expect(typeof ENHANCE_CONFIG.describePromptContext).toBe("string");
    expect(ENHANCE_CONFIG.describePromptContext.length).toBeGreaterThan(0);

    expect(typeof ENHANCE_CONFIG.backgroundStylePrompt).toBe("string");
    expect(ENHANCE_CONFIG.backgroundStylePrompt.length).toBeGreaterThan(0);

    expect(Array.isArray(ENHANCE_CONFIG.backgroundNegatives)).toBe(true);
    expect(ENHANCE_CONFIG.backgroundNegatives.length).toBeGreaterThan(0);

    expect(ENHANCE_CONFIG.canvas.width).toBe(1024);
    expect(ENHANCE_CONFIG.canvas.height).toBe(1024);

    expect(ENHANCE_CONFIG.shadow).toBe(false);

    // Fallback used when setting derivation returns empty/throws — must be a
    // non-empty string safe to feed straight into buildBackgroundPrompt.
    expect(typeof ENHANCE_CONFIG.fallbackSetting).toBe("string");
    expect(ENHANCE_CONFIG.fallbackSetting.trim().length).toBeGreaterThan(0);
  });
});

// Demo-critical anti-duplication step: the subject caption is converted to
// subject-free scenery BEFORE the image model ever sees it. If the subject noun
// reaches the image model it redraws it, and the composite then shows it twice.
describe("buildSettingPrompt", () => {
  it("includes the subject and instructs to omit the subject / same-kind objects", () => {
    const prompt = buildSettingPrompt({
      subject: "a happy tree on a grassy hill",
      perspective: "eye-level",
      surfaceHint: "",
    });
    expect(prompt).toContain("a happy tree on a grassy hill");
    const lower = prompt.toLowerCase();
    expect(lower).toContain("do not");
    expect(lower).toMatch(/subject|central object|same kind/);
    // Asks for surrounding scenery only.
    expect(lower).toMatch(/scenery|landscape|setting|sky/);
  });

  it("carries the drawing's perspective into the instruction, distinctly per perspective", () => {
    const topDown = buildSettingPrompt({
      subject: "a pair of blue shoes",
      perspective: "top-down / straight-down view",
      surfaceHint: "floor",
    });
    const side = buildSettingPrompt({
      subject: "a red shoe",
      perspective: "side / profile view",
      surfaceHint: "ground",
    });
    expect(topDown).toContain("top-down / straight-down view");
    expect(side).toContain("side / profile view");
    // Perspective-specific viewing-angle guidance must differ.
    expect(topDown.toLowerCase()).toMatch(/top-down|overhead|directly above/);
    expect(side.toLowerCase()).toMatch(/side|eye level|horizon/);
  });

  it("includes the day's prompt context when provided", () => {
    const prompt = buildSettingPrompt(
      { subject: "a pair of blue shoes", perspective: "top-down / straight-down view", surfaceHint: "floor" },
      "Draw your favorite shoes",
    );
    expect(prompt).toContain("Draw your favorite shoes");
  });
});

describe("buildDescribeContext", () => {
  it("asks for a structured SUBJECT/PERSPECTIVE/SURFACE response", () => {
    const context = buildDescribeContext();
    expect(context).toContain("SUBJECT:");
    expect(context).toContain("PERSPECTIVE:");
    expect(context).toContain("SURFACE:");
  });

  it("includes the day's prompt text when provided", () => {
    const context = buildDescribeContext("Draw your favorite shoes");
    expect(context).toContain("Draw your favorite shoes");
  });
});

describe("parseDescribedDrawing", () => {
  it("parses a well-formed structured caption", () => {
    const caption = "SUBJECT: a pair of blue shoes\nPERSPECTIVE: top-down / straight-down view\nSURFACE: floor";
    const described = parseDescribedDrawing(caption);
    expect(described.subject).toBe("a pair of blue shoes");
    expect(described.perspective).toBe("top-down / straight-down view");
    expect(described.surfaceHint).toBe("floor");
  });

  it("degrades gracefully when the caption is unstructured free text", () => {
    const described = parseDescribedDrawing("a lovely red shoe drawn from the side");
    expect(described.subject).toBe("a lovely red shoe drawn from the side");
    expect(described.perspective).toBe("eye-level");
    expect(described.surfaceHint).toBe("");
  });
});

describe("buildBackgroundPrompt", () => {
  it("includes the (subject-free) setting it is given", () => {
    const prompt = buildBackgroundPrompt("a calm meadow under an open sky");
    expect(prompt).toContain("a calm meadow under an open sky");
  });

  it("includes hard negatives for photorealism and people", () => {
    const prompt = buildBackgroundPrompt("a quiet shoreline");
    expect(prompt.toLowerCase()).toContain("no photorealism");
    expect(prompt.toLowerCase()).toContain("people-free");
  });

  // Demo-critical invariant: the generated image is only the backdrop; the
  // user's drawing is composited on top. The prompt MUST tell the model to
  // paint background only with an open center and never render a central
  // subject, or the composite shows the subject twice.
  it("instructs the model to paint background only, with an open empty center", () => {
    const prompt = buildBackgroundPrompt("a calm meadow under an open sky").toLowerCase();
    expect(prompt).toContain("background");
    expect(prompt).toContain("do not draw");
    expect(prompt).toContain("center");
    expect(prompt).toMatch(/open|empty/);
  });
});

describe("ChannelResponse enhancement fields (shared type)", () => {
  it("allows optional enhancedImageRef / enhancementStatus", () => {
    const response: ChannelResponse = {
      id: "r1",
      promptId: "p1",
      channelId: "c1",
      authorId: "u1",
      authorName: "Alice",
      createdAt: "2026-07-09T00:00:00.000Z",
      reactions: [],
      enhancedImageRef: "data:image/png;base64,abc",
      enhancementStatus: "ready",
    };
    expect(response.enhancementStatus).toBe("ready");
  });
});
