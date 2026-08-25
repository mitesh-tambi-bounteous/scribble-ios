import type { DataClient } from "./client";
import { httpDataClient } from "./http";
import { mockDataClient } from "./mock";

/**
 * Selects the active DataClient adapter. Defaults to mock so the app boots
 * with zero AWS dependency. Set EXPO_PUBLIC_API_MODE=http to hit the real
 * backend once it is live.
 */
const API_MODE = process.env.EXPO_PUBLIC_API_MODE ?? "mock";

function selectDataClient(): DataClient {
  if (API_MODE === "http") {
    return httpDataClient;
  }
  return mockDataClient;
}

export const dataClient: DataClient = selectDataClient();
export type { DataClient } from "./client";
