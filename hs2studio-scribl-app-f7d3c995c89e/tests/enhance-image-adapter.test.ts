import { createImageProvider, imageConfigFromEnv, DEFAULT_IMAGE_CONFIG } from "../backend/lambda/enhance/image/factory";
import { STUB_IMAGE_BASE64 } from "../backend/lambda/enhance/image/adapters/stub";

describe("createImageProvider factory", () => {
  it("returns stub by default", () => {
    const provider = createImageProvider();
    expect(provider.provider).toBe("stub");
  });

  it("falls back to stub (and warns) when provider=openai but no key", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const provider = createImageProvider({ provider: "openai" });
    expect(provider.provider).toBe("stub");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns openai adapter when key present", () => {
    const provider = createImageProvider({ provider: "openai", apiKey: "sk-test" });
    expect(provider.provider).toBe("openai");
  });

  it("DEFAULT_IMAGE_CONFIG is stub", () => {
    expect(DEFAULT_IMAGE_CONFIG.provider).toBe("stub");
  });
});

describe("stub image provider", () => {
  it("returns a deterministic png", async () => {
    const provider = createImageProvider();
    const result = await provider.generateBackground({ prompt: "a sunrise" });
    expect(result).toEqual({
      imageBase64: STUB_IMAGE_BASE64,
      mimeType: "image/png",
      modelId: "stub",
    });
  });
});

describe("openai image adapter", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("posts a text-only body (no image field), Authorization header, and maps b64_json", async () => {
    let capturedUrl: unknown;
    let capturedInit: any;
    global.fetch = jest.fn(async (url: any, init: any) => {
      capturedUrl = url;
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ data: [{ b64_json: "ZmFrZS1wbmc=" }] }),
      } as any;
    }) as any;

    const provider = createImageProvider({ provider: "openai", apiKey: "sk-test" });
    const result = await provider.generateBackground({ prompt: "a mountain lake" });

    expect(capturedUrl).toBe("https://api.openai.com/v1/images/generations");
    expect(capturedInit.headers.Authorization).toBe("Bearer sk-test");
    expect(capturedInit.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(capturedInit.body);
    expect(body).toEqual({
      model: "gpt-image-1",
      prompt: "a mountain lake",
      size: "1024x1024",
      n: 1,
    });
    // gpt-image-1 rejects `response_format` (hard 400); it always returns b64_json.
    // Data-boundary assertion: only these text-only fields, no image bytes/base64.
    expect(Object.keys(body).sort()).toEqual(["model", "n", "prompt", "size"]);
    expect(body).not.toHaveProperty("image");
    expect(body).not.toHaveProperty("imageBase64");
    expect(body).not.toHaveProperty("base64");

    expect(result).toEqual({
      imageBase64: "ZmFrZS1wbmc=",
      mimeType: "image/png",
      modelId: "gpt-image-1",
    });
  });

  it("throws on a non-ok response", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({}),
    })) as any;

    const provider = createImageProvider({ provider: "openai", apiKey: "sk-test" });
    await expect(provider.generateBackground({ prompt: "x" })).rejects.toThrow(
      /openai image generation failed: 500/,
    );
  });
});

describe("imageConfigFromEnv", () => {
  it("reads env vars with correct precedence", () => {
    const cfg1 = imageConfigFromEnv({});
    expect(cfg1).toEqual({ provider: "stub", apiKey: undefined, model: undefined });

    const cfg2 = imageConfigFromEnv({
      IMAGE_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-fallback",
      IMAGE_MODEL: "gpt-image-1",
    });
    expect(cfg2).toEqual({ provider: "openai", apiKey: "sk-fallback", model: "gpt-image-1" });

    const cfg3 = imageConfigFromEnv({
      IMAGE_PROVIDER: "openai",
      IMAGE_API_KEY: "sk-preferred",
      OPENAI_API_KEY: "sk-fallback",
    });
    expect(cfg3.apiKey).toBe("sk-preferred");
  });
});
