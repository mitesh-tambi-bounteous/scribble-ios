# Scribl D2C POC — Claude project guide

## What this is
A ~1-week clickable POC of the Scribl daily-creative-practice app, built in the
**Expo open-source framework** (React Native) as a single codebase that also
exports to web. This POC seeds the production app — it is NOT a throwaway.

## Golden rules
- **OSS only, no Expo-cloud lock-in.** Use the Expo MIT framework + libraries.
  Do NOT use EAS (Build/Update/Submit/Workflows) or the remote Expo MCP.
  Builds, hosting, and CI/CD live in **AWS**.
- **Plan Mode before executing** any multi-file change.
- **Phone-first.** The drawing canvas (finger-on-glass) and the daily loop are
  the point. Validate feel on a device, not just web.

## Stack (locked)
- Expo SDK 56 (OSS) · Expo Router · TypeScript
- @shopify/react-native-skia — drawing canvas (web via CanvasKit + native)
- NativeWind v4 (Tailwind v3) · React Native Reusables (UI) · Zustand (state)
- Backend: thin AWS API Gateway + Lambda (+ DynamoDB) via AWS CDK; mock data
- Voice response: STUBBED for the POC (non-functional button)

## Build / run
- Dev: `npx expo start` (web) · `npx expo run:ios` / `run:android` (device feel)
- Web export (shareable): `npx expo export -p web` → host on S3/CloudFront
- Native: `npx expo prebuild` → build ios/ + android/ in our own CI (no EAS)

## Scope guardrails (1 week)
- Build the loop: prompt → draw/text → submit-to-unlock → channel wall + reactions → streak.
- Auth stubbed unless trivial. Push = device smoke test only.
- Do not add EAS, analytics SDKs, or the production data model yet.

## Data
Mock/seeded JSON via the thin backend: one daily prompt + a few channel responses.
