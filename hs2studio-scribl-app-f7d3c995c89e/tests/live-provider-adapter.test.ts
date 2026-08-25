/**
 * S-008 — live Claude provider adapters (Direct + Bedrock) behind the
 * config-swap seam (ADR 0009 / AC8).
 *
 * No real network / AWS calls. Both SDKs are mocked; assertions verify
 * request shape (model id per tier, message/content shape, structured
 * output for moderate), response parsing (text/caption/verdict + usage
 * mapping), the fail-safe verdict on unparseable moderation output, and
 * fail-fast config validation (missing apiKey / region) without leaking
 * secrets into thrown error text.
 */

import { MODEL_TIERS } from "../packages/claude-provider-adapter/model-tiers";

const ORIGINAL_AWS_REGION = process.env.AWS_REGION;

function restoreAwsRegion(): void {
  if (ORIGINAL_AWS_REGION === undefined) {
    delete process.env.AWS_REGION;
  } else {
    process.env.AWS_REGION = ORIGINAL_AWS_REGION;
  }
}

function canned(text: string, usage?: Partial<Record<string, number>>) {
  return {
    content: [{ type: "text", text }],
    usage: {
      input_tokens: usage?.input_tokens ?? 10,
      output_tokens: usage?.output_tokens ?? 20,
      cache_read_input_tokens: usage?.cache_read_input_tokens ?? 3,
      cache_creation_input_tokens: usage?.cache_creation_input_tokens ?? 4,
    },
  };
}

describe("Direct adapter (Anthropic SDK mocked)", () => {
  afterEach(() => {
    jest.dontMock("@anthropic-ai/sdk");
    jest.resetModules();
  });

  it("generate sends the Opus model id, messages shape and max_tokens; parses text + usage", async () => {
    const createMock = jest.fn().mockResolvedValue(canned("hello there"));
    jest.doMock("@anthropic-ai/sdk", () => ({
      default: class Anthropic {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");
    const adapter = createProviderAdapter({ provider: "direct", apiKey: "sk-test-key" });

    const result = await adapter.generate({ prompt: "Draw a cat", maxOutputTokens: 512 });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: MODEL_TIERS.opus,
        max_tokens: 512,
        messages: [{ role: "user", content: "Draw a cat" }],
      })
    );
    expect(result.text).toBe("hello there");
    expect(result.modelId).toBe(MODEL_TIERS.opus);
    expect(result.usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 3,
      cacheWriteTokens: 4,
    });
  });

  it("generate defaults max_tokens to 1024 when maxOutputTokens is omitted", async () => {
    const createMock = jest.fn().mockResolvedValue(canned("x"));
    jest.doMock("@anthropic-ai/sdk", () => ({
      default: class Anthropic {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");
    const adapter = createProviderAdapter({ provider: "direct", apiKey: "sk-test-key" });
    await adapter.generate({ prompt: "hi" });

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 1024 }));
  });

  it("describeImage sends the Sonnet-vision model id with the image block first, then a text block", async () => {
    const createMock = jest.fn().mockResolvedValue(canned("A cheerful sketch of a cat."));
    jest.doMock("@anthropic-ai/sdk", () => ({
      default: class Anthropic {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");
    const adapter = createProviderAdapter({ provider: "direct", apiKey: "sk-test-key" });

    const result = await adapter.describeImage({
      imageBase64: "ZmFrZQ==",
      mimeType: "image/png",
      context: "Today's prompt: draw your morning",
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: MODEL_TIERS.sonnetVision })
    );
    const call = createMock.mock.calls[0][0];
    const content = call.messages[0].content;
    expect(content[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "ZmFrZQ==" },
    });
    expect(content[1].type).toBe("text");
    expect(content[1].text).toContain("Today's prompt: draw your morning");
    expect(result.caption).toBe("A cheerful sketch of a cat.");
    expect(result.modelId).toBe(MODEL_TIERS.sonnetVision);
  });

  it("moderate sends structured output_config with MODERATE_OUTPUT_SCHEMA and the Haiku model id", async () => {
    const createMock = jest.fn().mockResolvedValue(canned(JSON.stringify({ verdict: "allow" })));
    jest.doMock("@anthropic-ai/sdk", () => ({
      default: class Anthropic {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");
    const { MODERATE_OUTPUT_SCHEMA } = require("../packages/claude-provider-adapter/adapters/_messages");
    const adapter = createProviderAdapter({ provider: "direct", apiKey: "sk-test-key" });

    const result = await adapter.moderate({ text: "a nice drawing" });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: MODEL_TIERS.haiku,
        output_config: { format: { type: "json_schema", schema: MODERATE_OUTPUT_SCHEMA } },
      })
    );
    expect(result.verdict).toBe("allow");
    expect(result.modelId).toBe(MODEL_TIERS.haiku);
  });

  it("moderate parses a valid flag/block verdict with reason", async () => {
    const createMock = jest.fn().mockResolvedValue(
      canned(JSON.stringify({ verdict: "block", reason: "explicit content" }))
    );
    jest.doMock("@anthropic-ai/sdk", () => ({
      default: class Anthropic {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");
    const adapter = createProviderAdapter({ provider: "direct", apiKey: "sk-test-key" });
    const result = await adapter.moderate({ text: "bad text" });

    expect(result.verdict).toBe("block");
    expect(result.reason).toBe("explicit content");
  });

  it("moderate fails safe to 'flag' when the model's output is unparseable JSON", async () => {
    const createMock = jest.fn().mockResolvedValue(canned("not valid json at all"));
    jest.doMock("@anthropic-ai/sdk", () => ({
      default: class Anthropic {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");
    const adapter = createProviderAdapter({ provider: "direct", apiKey: "sk-test-key" });
    const result = await adapter.moderate({ text: "ambiguous text" });

    expect(result.verdict).toBe("flag");
  });

  it("moderate fails safe to 'flag' when the parsed JSON has an unexpected verdict value", async () => {
    const createMock = jest.fn().mockResolvedValue(canned(JSON.stringify({ verdict: "unsure" })));
    jest.doMock("@anthropic-ai/sdk", () => ({
      default: class Anthropic {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");
    const adapter = createProviderAdapter({ provider: "direct", apiKey: "sk-test-key" });
    const result = await adapter.moderate({ text: "ambiguous text" });

    expect(result.verdict).toBe("flag");
  });

  it("throws fail-fast when apiKey is missing, without constructing an SDK client", () => {
    jest.resetModules();
    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");

    expect(() => createProviderAdapter({ provider: "direct" })).toThrow(
      "ANTHROPIC_API_KEY required for the Direct Claude provider"
    );
  });

  it("propagates a rejected messages.create as a rejection, and no api key leaks into the error text", async () => {
    const secretKey = "sk-super-secret-do-not-leak-12345";
    const createMock = jest.fn().mockRejectedValue(new Error("upstream 500"));
    jest.doMock("@anthropic-ai/sdk", () => ({
      default: class Anthropic {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");
    const adapter = createProviderAdapter({ provider: "direct", apiKey: secretKey });

    await expect(adapter.generate({ prompt: "hi" })).rejects.toThrow("upstream 500");
    try {
      await adapter.generate({ prompt: "hi" });
      throw new Error("expected adapter.generate to reject");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain(secretKey);
    }
  });
});

describe("Bedrock adapter (Bedrock SDK mocked)", () => {
  afterEach(() => {
    jest.dontMock("@anthropic-ai/bedrock-sdk");
    restoreAwsRegion();
    jest.resetModules();
  });

  it("generate sends the anthropic.-prefixed model id using config.region", async () => {
    delete process.env.AWS_REGION;
    const createMock = jest.fn().mockResolvedValue(canned("bedrock says hi"));
    jest.doMock("@anthropic-ai/bedrock-sdk", () => ({
      AnthropicBedrockMantle: class AnthropicBedrockMantle {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");
    const adapter = createProviderAdapter({ provider: "bedrock", region: "eu-west-1" });

    const result = await adapter.generate({ prompt: "Draw a dog" });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: `anthropic.${MODEL_TIERS.opus}`,
        messages: [{ role: "user", content: "Draw a dog" }],
      })
    );
    expect(result.text).toBe("bedrock says hi");
    expect(result.modelId).toBe(`anthropic.${MODEL_TIERS.opus}`);
  });

  it("falls back to process.env.AWS_REGION when config.region is not set", async () => {
    process.env.AWS_REGION = "us-west-2";
    const createMock = jest.fn().mockResolvedValue(canned("ok"));
    jest.doMock("@anthropic-ai/bedrock-sdk", () => ({
      AnthropicBedrockMantle: class AnthropicBedrockMantle {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");
    // No config.region: must fall back to process.env.AWS_REGION and not throw.
    expect(() => createProviderAdapter({ provider: "bedrock" })).not.toThrow();
  });

  it("describeImage sends the anthropic.-prefixed sonnet-vision id with an image block first", async () => {
    delete process.env.AWS_REGION;
    const createMock = jest.fn().mockResolvedValue(canned("A tidy bedrock caption."));
    jest.doMock("@anthropic-ai/bedrock-sdk", () => ({
      AnthropicBedrockMantle: class AnthropicBedrockMantle {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");
    const adapter = createProviderAdapter({ provider: "bedrock", region: "us-east-1" });

    const result = await adapter.describeImage({ imageBase64: "Ymxhaw==", mimeType: "image/jpeg" });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: `anthropic.${MODEL_TIERS.sonnetVision}` })
    );
    const call = createMock.mock.calls[0][0];
    const content = call.messages[0].content;
    expect(content[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "Ymxhaw==" },
    });
    expect(result.caption).toBe("A tidy bedrock caption.");
  });

  it("moderate sends the anthropic.-prefixed haiku id with structured output_config; verdict parses and usage maps", async () => {
    delete process.env.AWS_REGION;
    const createMock = jest.fn().mockResolvedValue(
      canned(JSON.stringify({ verdict: "allow" }), {
        input_tokens: 7,
        output_tokens: 9,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      })
    );
    jest.doMock("@anthropic-ai/bedrock-sdk", () => ({
      AnthropicBedrockMantle: class AnthropicBedrockMantle {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");
    const { MODERATE_OUTPUT_SCHEMA } = require("../packages/claude-provider-adapter/adapters/_messages");
    const adapter = createProviderAdapter({ provider: "bedrock", region: "us-east-1" });

    const result = await adapter.moderate({ text: "a fine submission" });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: `anthropic.${MODEL_TIERS.haiku}`,
        output_config: { format: { type: "json_schema", schema: MODERATE_OUTPUT_SCHEMA } },
      })
    );
    expect(result.verdict).toBe("allow");
    expect(result.usage).toEqual({
      inputTokens: 7,
      outputTokens: 9,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
  });

  it("throws fail-fast when region is unset in both config and AWS_REGION env", () => {
    delete process.env.AWS_REGION;
    jest.resetModules();
    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");

    expect(() => createProviderAdapter({ provider: "bedrock" })).toThrow(
      "AWS_REGION (or config.region) required for the Bedrock Claude provider"
    );
  });

  it("does not require ANTHROPIC_API_KEY to construct the Bedrock adapter", () => {
    delete process.env.AWS_REGION;
    delete process.env.ANTHROPIC_API_KEY;
    jest.resetModules();
    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");

    expect(() => createProviderAdapter({ provider: "bedrock", region: "us-east-1" })).not.toThrow();
  });

  it("propagates a rejected messages.create as a rejection", async () => {
    delete process.env.AWS_REGION;
    const createMock = jest.fn().mockRejectedValue(new Error("bedrock throttled"));
    jest.doMock("@anthropic-ai/bedrock-sdk", () => ({
      AnthropicBedrockMantle: class AnthropicBedrockMantle {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");
    const adapter = createProviderAdapter({ provider: "bedrock", region: "us-east-1" });

    await expect(adapter.generate({ prompt: "hi" })).rejects.toThrow("bedrock throttled");
  });
});

describe("factory provider selection (AC8)", () => {
  afterEach(() => {
    jest.dontMock("@anthropic-ai/sdk");
    jest.dontMock("@anthropic-ai/bedrock-sdk");
    restoreAwsRegion();
    jest.resetModules();
  });

  it("'claude' and 'direct' both drive the Direct adapter (mocked @anthropic-ai/sdk)", async () => {
    const createMock = jest.fn().mockResolvedValue(canned("direct path"));
    jest.doMock("@anthropic-ai/sdk", () => ({
      default: class Anthropic {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");

    const claudeAdapter = createProviderAdapter({ provider: "claude", apiKey: "sk-a" });
    expect(claudeAdapter.provider).toBe("direct");
    const claudeResult = await claudeAdapter.generate({ prompt: "hi" });
    expect(claudeResult.text).toBe("direct path");

    const directAdapter = createProviderAdapter({ provider: "direct", apiKey: "sk-b" });
    expect(directAdapter.provider).toBe("direct");
    await directAdapter.generate({ prompt: "hi again" });
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("'bedrock' drives the Bedrock adapter (mocked @anthropic-ai/bedrock-sdk)", async () => {
    delete process.env.AWS_REGION;
    const createMock = jest.fn().mockResolvedValue(canned("bedrock path"));
    jest.doMock("@anthropic-ai/bedrock-sdk", () => ({
      AnthropicBedrockMantle: class AnthropicBedrockMantle {
        messages = { create: createMock };
      },
    }));
    jest.resetModules();

    const { createProviderAdapter } = require("../packages/claude-provider-adapter/factory");
    const adapter = createProviderAdapter({ provider: "bedrock", region: "us-east-1" });
    expect(adapter.provider).toBe("bedrock");

    const result = await adapter.generate({ prompt: "hi" });
    expect(result.text).toBe("bedrock path");
  });
});
