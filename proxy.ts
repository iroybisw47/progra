import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon-*.png, apple-icon.png, manifest.webmanifest
     * - api/cron/* (machine-to-machine, authenticated by CRON_SECRET; there
     *   are no cookies to refresh and updateSession would build a Supabase
     *   client on every scheduled invocation)
     * - api/analytics/* (the event ingest route). It verifies the access-token
     *   cookie LOCALLY and never refreshes it — on purpose. A background
     *   `keepalive` flush is fire-and-forget: the suspended webview may never
     *   see the response, so a refresh here would rotate the refresh token
     *   without the device ever storing the new one, and the next real open
     *   would fail to refresh. An expired token simply makes that one batch
     *   anonymous; link_device_events claims it on the next open.
     * - any file with an extension
     */
    "/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|apple-icon\\.png|manifest\\.webmanifest|api/cron|api/analytics|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
