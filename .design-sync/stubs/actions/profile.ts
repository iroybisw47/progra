// Design-bundle stand-in for app/actions/profile, wired by ../../tsconfig.json.
// Typed against the real action through an `import type`, which esbuild
// erases — so the signature can't drift and no server code is bundled.
import type * as real from "../../../app/actions/profile";

export const markPatchNotesSeen: typeof real.markPatchNotesSeen = async () => ({ ok: true });
