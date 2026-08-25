/**
 * Single source of truth for the DrawPad wrapper's dimensions. DrawPad has
 * no explicit pixel size of its own — it fills whatever View wraps it
 * (see SkiaCanvas's onLayout-driven sizing) — so every screen that draws
 * on, or renders behind, the "entry" drawing surface must wrap DrawPad in
 * a View with this exact className. Any mismatch (e.g. a fixed height on
 * one screen) makes that screen's canvas a different dp size, and
 * DrawPad's SkiaImage background layer stretches/compresses to fill it.
 */
export const ENTRY_CANVAS_FRAME_CLASSNAME = "w-full max-w-[760px] self-center flex-1";
