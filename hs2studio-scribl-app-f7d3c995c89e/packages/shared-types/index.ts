/**
 * Scribl POC shared types — single import surface.
 *
 * Consumed type-only by the Expo app (via `@scribl/shared/*` tsconfig alias),
 * the backend Lambdas, and the Claude provider adapter.
 */

export * from "./domain";
export * from "./api";
export * from "./constants";
export * from "./email";
export * from "./tools";
