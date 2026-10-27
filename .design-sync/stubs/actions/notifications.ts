// Design-bundle stand-in for app/actions/notifications, wired by ../../tsconfig.json.
// Typed against the real action through an `import type`, which esbuild
// erases — so the signature can't drift and no server code is bundled.
import type * as real from "../../../app/actions/notifications";

export const fetchNavBadges: typeof real.fetchNavBadges = async () => ({ feed: false, friends: false });
export const markFeedSeen: typeof real.markFeedSeen = async () => ({ ok: true });
export const markFriendsSeen: typeof real.markFriendsSeen = async () => ({ ok: true });
