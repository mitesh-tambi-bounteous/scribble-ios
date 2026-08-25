/**
 * Personal Archive channel identity helpers. Archive channels are day-less,
 * unlimited-draw, single-member channels whose id is derived server-side as
 * `${userId}${ARCHIVE_SUFFIX}` — this is the one place that suffix convention
 * is defined, so app/family.tsx and app/home.tsx never redefine it locally.
 */
export const ARCHIVE_SUFFIX = "-archive";

/** Whether a given channel id identifies a Personal Archive channel. */
export function isArchiveChannel(channelId: string): boolean {
  return channelId.endsWith(ARCHIVE_SUFFIX);
}
