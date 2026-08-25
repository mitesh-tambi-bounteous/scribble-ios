/**
 * Scribl POC — Direct Anthropic API adapter (LIVE).
 *
 * ADR 0009: the Direct Anthropic API is the default adapter for the POC/dev.
 * This file is the ONLY place `@anthropic-ai/sdk` is imported in this
 * package — server-side only, never bundled into the Expo client. The
 * official SDK client is constructed lazily (first call) from an API key
 * read from the environment (`ANTHROPIC_API_KEY`); the key is never logged
 * or included in any thrown error message.
 */

import { modelForOperation } from "../model-tiers";
import {
  extractText,
  MODERATE_OUTPUT_SCHEMA,
  parseModerationVerdict,
  toTokenUsage,
  type TextBearingBlock,
} from "./_messages";
import type {
  DescribeImageRequest,
  DescribeImageResponse,
  GenerateRequest,
  GenerateResponse,
  ModerateRequest,
  ModerateResponse,
  ProviderAdapter,
  ProviderConfig,
  TokenLogger,
} from "../types";
import { noopTokenLogger } from "../logger";

// Narrow structural type for the pieces of the official SDK client this
// adapter actually calls. Avoids a static import of the SDK's own types at
// module scope (the import() below stays the only place the package is
// touched at runtime).
interface DirectMessagesClient {
  messages: {
    create(params: Record<string, unknown>): Promise<{
      content: TextBearingBlock[];
      usage: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number | null;
        cache_creation_input_tokens?: number | null;
      };
    }>;
  };
}

let cachedClient: DirectMessagesClient | null = null;

function getClient(apiKey: string): DirectMessagesClient {
  if (cachedClient) {
    return cachedClient;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires -- lazy load; keeps SDK out of static import graph
  const mod = require("@anthropic-ai/sdk");
  const Anthropic = mod?.default ?? mod;
  cachedClient = new Anthropic({ apiKey }) as unknown as DirectMessagesClient;
  return cachedClient;
}

const DESCRIBE_IMAGE_INSTRUCTION =
  "Write a short, warm caption (1-2 sentences) describing this drawing.";

export function createDirectAdapter(
  config: ProviderConfig,
  log: TokenLogger = noopTokenLogger
): ProviderAdapter {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY required for the Direct Claude provider");
  }

  return {
    provider: "direct",

    async generate(req: GenerateRequest): Promise<GenerateResponse> {
      const modelId = modelForOperation("generate");
      const client = await getClient(apiKey);
      const response = await client.messages.create({
        model: modelId,
        max_tokens: req.maxOutputTokens ?? 1024,
        messages: [{ role: "user", content: req.prompt }],
      });
      const usage = toTokenUsage(response.usage);
      log({ operation: "generate", modelId, provider: "direct", usage, timestamp: new Date().toISOString() });
      return { text: extractText(response.content), modelId, usage };
    },

    async describeImage(req: DescribeImageRequest): Promise<DescribeImageResponse> {
      const modelId = modelForOperation("describeImage");
      const client = await getClient(apiKey);
      const instruction = req.context
        ? `${DESCRIBE_IMAGE_INSTRUCTION} Context: ${req.context}`
        : DESCRIBE_IMAGE_INSTRUCTION;
      const response = await client.messages.create({
        model: modelId,
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: req.mimeType, data: req.imageBase64 },
              },
              { type: "text", text: instruction },
            ],
          },
        ],
      });
      const usage = toTokenUsage(response.usage);
      log({ operation: "describeImage", modelId, provider: "direct", usage, timestamp: new Date().toISOString() });
      return { caption: extractText(response.content), modelId, usage };
    },

    async moderate(req: ModerateRequest): Promise<ModerateResponse> {
      const modelId = modelForOperation("moderate");
      const client = await getClient(apiKey);
      const response = await client.messages.create({
        model: modelId,
        max_tokens: 256,
        messages: [{ role: "user", content: `Classify this submission for moderation: ${req.text}` }],
        output_config: { format: { type: "json_schema", schema: MODERATE_OUTPUT_SCHEMA } },
      });
      const usage = toTokenUsage(response.usage);
      log({ operation: "moderate", modelId, provider: "direct", usage, timestamp: new Date().toISOString() });
      const { verdict, reason } = parseModerationVerdict(extractText(response.content));
      return reason === undefined ? { verdict, modelId, usage } : { verdict, reason, modelId, usage };
    },
  };
}
