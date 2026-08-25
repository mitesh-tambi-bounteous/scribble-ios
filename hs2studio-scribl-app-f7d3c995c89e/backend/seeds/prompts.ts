/**
 * Admin-curated daily prompt bodies for the Scribl POC.
 *
 * This represents content an admin curates and provisions ahead of time
 * (see backend/scripts/prompts.ts), NOT test/demo fixtures. Prompts are
 * chosen deterministically by day index so the same calendar date always
 * gets the same prompt.
 */
export const ADMIN_PROMPTS: readonly string[] = [
  "Draw the first thing you saw this morning.",
  "Sketch your favorite mug or cup.",
  "Draw something that made you smile today.",
  "Doodle your dream vacation spot.",
  "Draw the view outside your nearest window.",
  "Sketch a creature that doesn't exist.",
  "Draw your shoes, right now, from where you're sitting.",
  "Doodle what your perfect breakfast looks like.",
  "Draw a memory from last week.",
  "Sketch the last plant you saw.",
  "Draw your favorite song as a shape.",
  "Doodle a robot doing your least favorite chore.",
  "Draw the sky outside right now.",
  "Sketch something small on your desk.",
];
