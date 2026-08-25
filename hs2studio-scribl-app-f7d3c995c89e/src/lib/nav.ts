import type { Href } from "expo-router";

/**
 * Internal implementation of goBack that accepts a router object for testability.
 * @internal
 */
export function goBackImpl(
  routerObj: {
    canGoBack: () => boolean;
    back: () => void;
    replace: (href: Href) => void;
  },
  fallback: Href
): void {
  if (routerObj.canGoBack()) {
    routerObj.back();
  } else {
    routerObj.replace(fallback);
  }
}

/**
 * Navigate back in the stack, with a fallback route for dead stacks (web refresh, deep links).
 *
 * Back = pop the stack when possible. For web refresh or deep-link entry points where the
 * stack is empty, replaces to the fallback route instead of failing.
 *
 * @param {Href} fallback - Route to navigate to when back-stack is empty (web / deep link).
 */
export function goBack(fallback: Href): void {
  // Lazy import to avoid issues with jest-expo module resolution
  const { router } = require("expo-router");
  goBackImpl(router, fallback);
}
