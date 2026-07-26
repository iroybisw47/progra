import { ImageResponse } from "next/og";

import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/require-user";
import { weekWindow } from "@/lib/dates";
import { getWeekLeaderboard } from "@/lib/db/leaderboard";
import { computeWeekRecap } from "@/lib/db/recap";

// Renders the week's recap summary as a 1080×1080 PNG (Satori/ImageResponse) for
// the story's Share panel. Own-data only; force per-request (never cached). Runs
// on the default Node runtime so it can reuse the Supabase server client and the
// recap reads. Satori supports flexbox + a subset of CSS only — every multi-child
// element needs display:flex and colors must be concrete hex (no CSS vars).
export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;
const NAVY = "#1c3a5e";
// Concrete swatches for categories whose stored color is null or a CSS var
// (Satori can't resolve `var(--...)`).
const FALLBACK = ["#2f6f6b", "#c98a3b", "#6b5bd2", "#c25e7a", "#4b8ab5", "#8a94a0"];

function swatch(color: string | null, i: number): string {
  return color && color.startsWith("#") ? color : FALLBACK[i % FALLBACK.length];
}

function fmtH(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

function weekRange(startMs: number, endMs: number): string {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(startMs)} – ${fmt(endMs)}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const { weekStart } = await params;
    const profile = await getProfile();
    const tz = profile?.timezone ?? "UTC";
    const win = /^\d{4}-\d{2}-\d{2}$/.test(weekStart)
      ? weekWindow(tz, weekStart)
      : weekWindow(tz);

    const [recap, leaderboard] = await Promise.all([
      computeWeekRecap(win.weekStartMs, win.weekEndMs),
      getWeekLeaderboard(win.weekStartMs, win.weekEndMs),
    ]);

    const me = leaderboard.find((r) => r.isMe);
    const topCats = recap.categoryRows.slice(0, 4);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: NAVY,
            color: "#ffffff",
            padding: "80px 76px",
            fontFamily: "sans-serif",
          }}
        >
          {/* header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 30,
              letterSpacing: 5,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            <div style={{ display: "flex", fontWeight: 700 }}>PROGRA</div>
            <div style={{ display: "flex" }}>WEEKLY RECAP</div>
          </div>

          {/* hero */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 72 }}>
            <div style={{ display: "flex", fontSize: 34, color: "rgba(255,255,255,0.7)" }}>
              Week of {weekRange(recap.weekStartMs, recap.weekEndMs)}
            </div>
            <div style={{ display: "flex", fontSize: 188, fontWeight: 800, lineHeight: 1 }}>
              {fmtH(recap.totalTrackedMs)}
            </div>
            <div style={{ display: "flex", fontSize: 36, color: "rgba(255,255,255,0.7)" }}>
              tracked this week
            </div>
          </div>

          {/* categories */}
          <div
            style={{ display: "flex", flexDirection: "column", marginTop: 60, gap: 22 }}
          >
            {topCats.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 36,
                }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: swatch(c.color, i),
                      marginRight: 22,
                    }}
                  />
                  <div style={{ display: "flex" }}>{c.name}</div>
                </div>
                <div style={{ display: "flex", color: "rgba(255,255,255,0.8)" }}>
                  {fmtH(c.ms)}
                </div>
              </div>
            ))}
          </div>

          {/* footer */}
          <div
            style={{
              display: "flex",
              marginTop: "auto",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 34,
            }}
          >
            {me && leaderboard.length > 1 ? (
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", fontWeight: 800, fontSize: 46 }}>
                  #{me.rank}
                </div>
                <div
                  style={{
                    display: "flex",
                    color: "rgba(255,255,255,0.7)",
                    marginLeft: 14,
                  }}
                >
                  of {leaderboard.length} among friends
                </div>
              </div>
            ) : (
              <div style={{ display: "flex" }} />
            )}
            <div style={{ display: "flex", color: "rgba(255,255,255,0.5)" }}>
              progra.world
            </div>
          </div>
        </div>
      ),
      { width: 1080, height: 1080 }
    );
  } catch {
    return new Response("Failed to generate image", { status: 500 });
  }
}
