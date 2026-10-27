// Design-bundle stand-in for app/actions/sessions, wired by ../../tsconfig.json.
// Typed against the real action through an `import type`, which esbuild
// erases — so the signature can't drift and no server code is bundled.
import type * as real from "../../../app/actions/sessions";

export const markAutoEndReviewed: typeof real.markAutoEndReviewed = async () => ({ ok: true });
