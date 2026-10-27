// Design-bundle stand-in for app/actions/reactions, wired by ../../tsconfig.json.
// Typed against the real action through an `import type`, which esbuild
// erases — so the signature can't drift and no server code is bundled.
import type * as real from "../../../app/actions/reactions";

export const toggleReaction: typeof real.toggleReaction = async () => ({ ok: true, reacted: true });
