/**
 * Scribl POC — AWS Bedrock adapter (LIVE, server-side/Lambda only).
 *
 * ADR 0009: the production/AWS path once Bedrock is stood up. This file is
 * the ONLY place `@anthropic-ai/bedrock-sdk` is imported in this package —
 * never bundled into the Expo client. Auth is SigV4 via the standard AWS
 * credential chain (env / profile / role) — no Anthropic API key involved.
 * Model ids are `anthropic.`-prefixed per Bedrock's naming convention.
 */

import { modelForOperation } from "../model-tiers";
import type { ClaudeOperation } from "../types";
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

// Narrow structural type for the pieces of the Bedrock Mantle client this
// adapter actually calls (mirrors direct.ts's DirectMessagesClient).
interface BedrockMessagesClient {
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

let cachedClient: BedrockMessagesClient | null = null;

function getClient(awsRegion: string): BedrockMessagesClient {
  if (cachedClient) {
    return cachedClient;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires -- lazy load; keeps SDK out of static import graph
  const { AnthropicBedrockMantle } = require("@anthropic-ai/bedrock-sdk");
  cachedClient = new AnthropicBedrockMantle({ awsRegion }) as unknown as BedrockMessagesClient;
  return cachedClient;
}

/** Bedrock prepends `anthropic.` to the bare first-party model id. */
function bedrockModelId(operation: ClaudeOperation): string {
  return `anthropic.${modelForOperation(operation)}`;
}

const DESCRIBE_IMAGE_INSTRUCTION =
  "Write a short, warm caption (1-2 sentences) describing this drawing.";

export function createBedrockAdapter(
  config: ProviderConfig,
  log: TokenLogger = noopTokenLogger
): ProviderAdapter {
  const awsRegion = config.region ?? process.env.AWS_REGION;
  if (!awsRegion) {
    throw new Error("AWS_REGION (or config.region) required for the Bedrock Claude provider");
  }

  return {
    provider: "bedrock",

    async generate(req: GenerateRequest): Promise<GenerateResponse> {
      const modelId = bedrockModelId("generate");
      const client = await getClient(awsRegion);
      const response = await client.messages.create({
        model: modelId,
        max_tokens: req.maxOutputTokens ?? 1024,
        messages: [{ role: "user", content: req.prompt }],
      });
      const usage = toTokenUsage(response.usage);
      log({ operation: "generate", modelId, provider: "bedrock", usage, timestamp: new Date().toISOString() });
      return { text: extractText(response.content), modelId, usage };
    },

    async describeImage(req: DescribeImageRequest): Promise<DescribeImageResponse> {
      const modelId = bedrockModelId("describeImage");
      const client = await getClient(awsRegion);
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
      log({ operation: "describeImage", modelId, provider: "bedrock", usage, timestamp: new Date().toISOString() });
      return { caption: extractText(response.content), modelId, usage };
    },

    async moderate(req: ModerateRequest): Promise<ModerateResponse> {
      const modelId = bedrockModelId("moderate");
      const client = await getClient(awsRegion);
      const response = await client.messages.create({
        model: modelId,
        max_tokens: 256,
        messages: [{ role: "user", content: `Classify this submission for moderation: ${req.text}` }],
        output_config: { format: { type: "json_schema", schema: MODERATE_OUTPUT_SCHEMA } },
      });
      const usage = toTokenUsage(response.usage);
      log({ operation: "moderate", modelId, provider: "bedrock", usage, timestamp: new Date().toISOString() });
      const { verdict, reason } = parseModerationVerdict(extractText(response.content));
      return reason === undefined ? { verdict, modelId, usage } : { verdict, reason, modelId, usage };
    },
  };
}
