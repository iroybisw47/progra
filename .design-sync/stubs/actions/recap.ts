// Design-bundle stand-in for app/actions/recap, wired by ../../tsconfig.json.
// Typed against the real action through an `import type`, which esbuild
// erases — so the signature can't drift and no server code is bundled.
import type * as real from "../../../app/actions/recap";

export const markRecapOpened: typeof real.markRecapOpened = async () => ({ ok: true });
