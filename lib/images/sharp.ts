import "server-only";

type SharpModule = typeof import("sharp");
type Sharp = SharpModule["default"];

export type SharpLoad = { ok: true; sharp: Sharp } | { error: string };

// The message a caller returns when the image library itself can't start. It is
// deliberately NOT the actions' "Couldn't process that image." — that one means
// the *file* was bad, and telling someone their photo is broken when the server
// is the broken part sends them off retrying with other photos forever.
const UNAVAILABLE = "Photo uploads are temporarily unavailable.";

// sharp, loaded on demand — never at module scope.
//
// Next bundles every server action for a route into ONE module, so a top-level
// `import sharp from "sharp"` that throws takes down every *other* action that
// shares the route: on 2026-08-19 a missing libvips in the deployed bundle made
// clock-in, the whole onboarding wizard (including its Skip) and all of
// Settings return a 500 error page. Behind a function call, the same failure is
// one upload returning an error string.
//
// `importer` is injectable only so the failure path is testable; production
// always takes the default. Keep the specifier a plain literal there — the file
// tracer reads it statically to decide what to bundle.
export async function loadSharp(
  importer: () => Promise<SharpModule> = () => import("sharp"),
): Promise<SharpLoad> {
  try {
    const mod = await importer();
    // A default-less module would fail later at the call site with a much worse
    // message ("sharp is not a function") than the one we can give here.
    const sharp = mod?.default;
    if (typeof sharp !== "function") return { error: UNAVAILABLE };
    return { ok: true, sharp };
  } catch (err) {
    // Loud on the server, quiet to the user: this is an infrastructure fault
    // (a native binary missing from the bundle), so it needs to show up in the
    // logs the way the push sender's bail points do.
    console.error("[images] sharp failed to load", err);
    return { error: UNAVAILABLE };
  }
}
