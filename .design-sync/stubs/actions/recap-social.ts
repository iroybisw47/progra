// Design-bundle stand-in for app/actions/recap-social, wired by ../../tsconfig.json.
// Typed against the real action through an `import type`, which esbuild
// erases — so the signature can't drift and no server code is bundled.
import type * as real from "../../../app/actions/recap-social";

export const addRecapComment: typeof real.addRecapComment = async () => ({ ok: true });
export const deleteRecapComment: typeof real.deleteRecapComment = async () => ({ ok: true });
export const toggleRecapKudos: typeof real.toggleRecapKudos = async () => ({ ok: true, reacted: true });
