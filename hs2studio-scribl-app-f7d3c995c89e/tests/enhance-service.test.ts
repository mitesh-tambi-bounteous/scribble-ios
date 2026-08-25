import sharp from "sharp";
import {
  enhanceDrawing,
  parseDataUri,
  type EnhanceDeps,
} from "../backend/lambda/enhance/service";
import { ENHANCE_CONFIG, buildDescribeContext } from "../backend/lambda/enhance/config";
import type {
  DescribeImageRequest,
  DescribeImageResponse,
  GenerateRequest,
  GenerateResponse,
} from "../packages/claude-provider-adapter/types";
import type {
  GenerateBackgroundRequest,
  GenerateBackgroundResult,
} from "../backend/lambda/enhance/image/types";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Mock Claude text generation (the setting-derivation step) returning a fixed setting. */
function makeGenerate(setting: string) {
  return jest.fn<Promise<GenerateResponse>, [GenerateRequest]>(async () => ({
    text: setting,
    modelId: "claude-opus-stub",
    usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
  }));
}

async function tinyPngBase64(width = 40, height = 30): Promise<string> {
  const buf = await sharp({
    create: { width, height, channels: 4, background: { r: 200, g: 50, b: 50, alpha: 1 } },
  })
    .png()
    .toBuffer();
  return buf.toString("base64");
}

describe("parseDataUri", () => {
  it("parses a png data URI", () => {
    const parsed = parseDataUri("data:image/png;base64,QUJD");
    expect(parsed).toEqual({ mimeType: "image/png", base64: "QUJD" });
  });

  it("parses jpeg and webp mime types", () => {
    expect(parseDataUri("data:image/jpeg;base64,QUJD").mimeType).toBe("image/jpeg");
    expect(parseDataUri("data:image/webp;base64,QUJD").mimeType).toBe("image/webp");
  });

  it("defaults to png for unrecognized mime types", () => {
    expect(parseDataUri("data:image/gif;base64,QUJD").mimeType).toBe("image/png");
  });

  it("throws on malformed input (no data: prefix)", () => {
    expect(() => parseDataUri("QUJD")).toThrow(/malformed/i);
  });

  it("throws on missing comma separator", () => {
    expect(() => parseDataUri("data:image/png;base64")).toThrow(/malformed/i);
  });

  it("throws on empty payload", () => {
    expect(() => parseDataUri("data:image/png;base64,")).toThrow(/non-empty/i);
  });

  it("throws on empty input", () => {
    expect(() => parseDataUri("")).toThrow(/non-empty/i);
  });
});

describe("enhanceDrawing", () => {
  it("calls describeImage with the parsed base64 and mime type", async () => {
    const drawingBase64 = await tinyPngBase64();
    const backgroundBase64 = await tinyPngBase64(64, 64);

    const describeImage = jest.fn<Promise<DescribeImageResponse>, [DescribeImageRequest]>(
      async () => ({
        caption: "a red square",
        modelId: "claude-sonnet-vision-stub",
        usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
      }),
    );
    const generateBackground = jest.fn<
      Promise<GenerateBackgroundResult>,
      [GenerateBackgroundRequest]
    >(async () => ({
      imageBase64: backgroundBase64,
      mimeType: "image/png" as const,
      modelId: "image-stub",
    }));

    const deps: EnhanceDeps = {
      claude: { describeImage, generate: makeGenerate("a quiet meadow at dawn") },
      image: { provider: "stub", generateBackground },
    };

    await enhanceDrawing({ imageDataUri: `data:image/png;base64,${drawingBase64}` }, deps);

    expect(describeImage).toHaveBeenCalledTimes(1);
    const describeArg = describeImage.mock.calls[0][0];
    expect(describeArg.imageBase64).toBe(drawingBase64);
    expect(describeArg.mimeType).toBe("image/png");
    expect(describeArg.context).toBe(buildDescribeContext(undefined));
    expect(describeArg.context).toContain("SUBJECT:");
    expect(describeArg.context).toContain("PERSPECTIVE:");
  });

  it("threads promptContext into both describeImage and setting derivation", async () => {
    const drawingBase64 = await tinyPngBase64();
    const backgroundBase64 = await tinyPngBase64(64, 64);

    const describeImage = jest.fn<Promise<DescribeImageResponse>, [DescribeImageRequest]>(
      async () => ({
        caption: "SUBJECT: a pair of blue shoes\nPERSPECTIVE: top-down / straight-down view\nSURFACE: floor",
        modelId: "claude-sonnet-vision-stub",
        usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
      }),
    );
    const generate = jest.fn<Promise<GenerateResponse>, [GenerateRequest]>(async () => ({
      text: "a floor viewed from directly above",
      modelId: "claude-opus-stub",
      usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
    }));
    const generateBackground = jest.fn<
      Promise<GenerateBackgroundResult>,
      [GenerateBackgroundRequest]
    >(async () => ({
      imageBase64: backgroundBase64,
      mimeType: "image/png" as const,
      modelId: "image-stub",
    }));

    const deps: EnhanceDeps = {
      claude: { describeImage, generate },
      image: { provider: "stub", generateBackground },
    };

    await enhanceDrawing(
      {
        imageDataUri: `data:image/png;base64,${drawingBase64}`,
        promptContext: "Draw your favorite shoes",
      },
      deps,
    );

    const describeArg = describeImage.mock.calls[0][0];
    expect(describeArg.context).toContain("Draw your favorite shoes");

    const generateArg = generate.mock.calls[0][0];
    expect(generateArg.prompt).toContain("a pair of blue shoes");
    expect(generateArg.prompt).toContain("top-down / straight-down view");
    expect(generateArg.prompt).toContain("Draw your favorite shoes");

    // The perspective-matched setting Claude produced must reach the image
    // model's background prompt (subject-free, but perspective-correct).
    const bgArg = generateBackground.mock.calls[0][0];
    expect(bgArg.prompt).toContain("a floor viewed from directly above");
    expect(bgArg.prompt).not.toContain("a pair of blue shoes");
  });

  it("calls generateBackground with a text-only {prompt,size} request — never the user's image (data boundary)", async () => {
    const drawingBase64 = await tinyPngBase64();
    const backgroundBase64 = await tinyPngBase64(64, 64);

    const describeImage = jest.fn<Promise<DescribeImageResponse>, [DescribeImageRequest]>(
      async () => ({
        caption: "a happy dog",
        modelId: "claude-sonnet-vision-stub",
        usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
      }),
    );
    const generateBackground = jest.fn<
      Promise<GenerateBackgroundResult>,
      [GenerateBackgroundRequest]
    >(async () => ({
      imageBase64: backgroundBase64,
      mimeType: "image/png" as const,
      modelId: "image-stub",
    }));

    const deps: EnhanceDeps = {
      claude: { describeImage, generate: makeGenerate("a grassy field under an open sky") },
      image: { provider: "stub", generateBackground },
    };

    await enhanceDrawing({ imageDataUri: `data:image/png;base64,${drawingBase64}` }, deps);

    expect(generateBackground).toHaveBeenCalledTimes(1);
    const bgArg = generateBackground.mock.calls[0][0];

    // Only {prompt, size} keys.
    expect(Object.keys(bgArg).sort()).toEqual(["prompt", "size"]);
    expect(typeof bgArg.prompt).toBe("string");
    // The image model receives the derived subject-free SETTING, never the
    // subject caption — that separation is what prevents the duplicate subject.
    expect(bgArg.prompt).toContain("a grassy field under an open sky");
    expect(bgArg.prompt).not.toContain("a happy dog");
    expect(bgArg.size).toBe(`${ENHANCE_CONFIG.canvas.width}x${ENHANCE_CONFIG.canvas.height}`);

    // Explicit data-boundary assertion: no value anywhere in the request
    // equals or contains the user's drawing base64.
    for (const value of Object.values(bgArg)) {
      if (typeof value === "string") {
        expect(value).not.toBe(drawingBase64);
        expect(value.includes(drawingBase64)).toBe(false);
      }
    }
  });

  it("returns a data:image/png;base64 URI that decodes to a valid canvas-sized PNG", async () => {
    const drawingBase64 = await tinyPngBase64();
    const backgroundBase64 = await tinyPngBase64(200, 200);

    const deps: EnhanceDeps = {
      claude: {
        describeImage: async () => ({
          caption: "a small drawing",
          modelId: "stub",
          usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        }),
        generate: makeGenerate("a soft open backdrop"),
      },
      image: {
        provider: "stub",
        generateBackground: async () => ({
          imageBase64: backgroundBase64,
          mimeType: "image/png",
          modelId: "stub",
        }),
      },
    };

    const result = await enhanceDrawing(
      { imageDataUri: `data:image/png;base64,${drawingBase64}` },
      deps,
    );

    expect(result.caption).toBe("a small drawing");
    expect(result.enhancedImageDataUri.startsWith("data:image/png;base64,")).toBe(true);

    const b64 = result.enhancedImageDataUri.slice("data:image/png;base64,".length);
    const buf = Buffer.from(b64, "base64");

    // PNG magic bytes present -> valid PNG.
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);

    // sharp can decode it back, and dimensions match the configured canvas
    // (proving the composite — background + original drawing — succeeded).
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(ENHANCE_CONFIG.canvas.width);
    expect(meta.height).toBe(ENHANCE_CONFIG.canvas.height);
    expect(meta.format).toBe("png");
  });

  it("throws on an empty imageDataUri", async () => {
    const deps: EnhanceDeps = {
      claude: { describeImage: jest.fn(), generate: jest.fn() },
      image: { provider: "stub", generateBackground: jest.fn() },
    };
    await expect(enhanceDrawing({ imageDataUri: "" }, deps)).rejects.toThrow(/non-empty/i);
  });

  // Durability: the setting-derivation Claude call is best-effort. If it returns
  // empty text we must NOT build the malformed "...setting: ." prompt — we fall
  // back to the neutral, subject-free ENHANCE_CONFIG.fallbackSetting instead.
  it("falls back to the neutral setting when generate returns empty text", async () => {
    const drawingBase64 = await tinyPngBase64();
    const backgroundBase64 = await tinyPngBase64(64, 64);

    const describeImage = jest.fn<Promise<DescribeImageResponse>, [DescribeImageRequest]>(
      async () => ({
        caption: "a happy dog",
        modelId: "stub",
        usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
      }),
    );
    const generateBackground = jest.fn<
      Promise<GenerateBackgroundResult>,
      [GenerateBackgroundRequest]
    >(async () => ({ imageBase64: backgroundBase64, mimeType: "image/png" as const, modelId: "image-stub" }));

    const deps: EnhanceDeps = {
      claude: { describeImage, generate: makeGenerate("   ") }, // whitespace-only → empty
      image: { provider: "stub", generateBackground },
    };

    const result = await enhanceDrawing(
      { imageDataUri: `data:image/png;base64,${drawingBase64}` },
      deps,
    );

    expect(generateBackground).toHaveBeenCalledTimes(1);
    const prompt = generateBackground.mock.calls[0][0].prompt;
    expect(prompt).toContain(ENHANCE_CONFIG.fallbackSetting);
    // Never the malformed empty-setting prompt.
    expect(prompt).not.toContain("background setting: .");
    expect(result.enhancedImageDataUri.startsWith("data:image/png;base64,")).toBe(true);
  });

  // Durability: if the setting-derivation call THROWS, the enhance must still
  // succeed on the fallback setting — never fail and strand the row as pending.
  it("degrades to the neutral setting when generate throws (no stranded row)", async () => {
    const drawingBase64 = await tinyPngBase64();
    const backgroundBase64 = await tinyPngBase64(64, 64);

    const describeImage = jest.fn<Promise<DescribeImageResponse>, [DescribeImageRequest]>(
      async () => ({
        caption: "a happy dog",
        modelId: "stub",
        usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
      }),
    );
    const generate = jest.fn<Promise<GenerateResponse>, [GenerateRequest]>(async () => {
      throw new Error("simulated Claude generate outage");
    });
    const generateBackground = jest.fn<
      Promise<GenerateBackgroundResult>,
      [GenerateBackgroundRequest]
    >(async () => ({ imageBase64: backgroundBase64, mimeType: "image/png" as const, modelId: "image-stub" }));

    const deps: EnhanceDeps = {
      claude: { describeImage, generate },
      image: { provider: "stub", generateBackground },
    };

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await enhanceDrawing(
        { imageDataUri: `data:image/png;base64,${drawingBase64}` },
        deps,
      );

      expect(generate).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalled(); // failure was logged, not swallowed silently
      expect(generateBackground).toHaveBeenCalledTimes(1);
      expect(generateBackground.mock.calls[0][0].prompt).toContain(ENHANCE_CONFIG.fallbackSetting);
      expect(result.enhancedImageDataUri.startsWith("data:image/png;base64,")).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
