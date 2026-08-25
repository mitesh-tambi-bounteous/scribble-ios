/**
 * Foundation smoke test for the Claude provider-adapter seam
 * (packages/claude-provider-adapter), confirming the config-swap pattern
 * (AC8 / ADR-0009) and the operation -> model-tier mapping (ADR-0011).
 */

import {
  createProviderAdapter,
  modelForOperation,
  MODEL_TIERS,
} from "../packages/claude-provider-adapter/index";

describe("provider-adapter (config-swap seam, AC8)", () => {
  it("createProviderAdapter({ provider: 'stub' }) returns a working stub adapter", async () => {
    const adapter = createProviderAdapter({ provider: "stub" });

    expect(adapter.provider).toBe("stub");

    const generated = await adapter.generate({ prompt: "Draw something nice" });
    expect(typeof generated.text).toBe("string");
    expect(generated.text.length).toBeGreaterThan(0);
    expect(generated.modelId).toBe(modelForOperation("generate"));

    const moderated = await adapter.moderate({ text: "hello world" });
    expect(["allow", "flag", "block"]).toContain(moderated.verdict);
    expect(moderated.modelId).toBe(modelForOperation("moderate"));

    const captioned = await adapter.describeImage({
      imageBase64: "ZmFrZS1pbWFnZS1ieXRlcw==",
      mimeType: "image/png",
    });
    expect(typeof captioned.caption).toBe("string");
    expect(captioned.caption.length).toBeGreaterThan(0);
    expect(captioned.modelId).toBe(modelForOperation("describeImage"));
  });

  it("modelForOperation returns the declared tier model id for every operation (ADR-0011)", () => {
    expect(modelForOperation("generate")).toBe(MODEL_TIERS.opus);
    expect(modelForOperation("describeImage")).toBe(MODEL_TIERS.sonnetVision);
    expect(modelForOperation("moderate")).toBe(MODEL_TIERS.haiku);
  });
});
