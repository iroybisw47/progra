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
     * - any file with an extension
     */
    "/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|apple-icon\\.png|manifest\\.webmanifest|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
