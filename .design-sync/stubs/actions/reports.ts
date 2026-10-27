// Design-bundle stand-in for app/actions/reports, wired by ../../tsconfig.json.
// Typed against the real action through an `import type`, which esbuild
// erases — so the signature can't drift and no server code is bundled.
import type * as real from "../../../app/actions/reports";

export const reportContent: typeof real.reportContent = async () => ({ ok: true });
