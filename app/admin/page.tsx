import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionPhotoUrl } from "@/lib/db/session-photos";
import { SOCIAL_ENABLED } from "@/lib/flags";
import { NUDGE_PRESETS, isNudgePreset } from "@/lib/social/nudges";

import { AdminReports, type AdminReport } from "./admin-reports";
import {
  AdminInterviews,
  type InterviewConsent,
} from "./admin-interviews";
import {
  AdminBugReports,
  type AdminBugReport,
} from "./admin-bug-reports";
import {
  AdminWaitlist,
  type BetaOverview,
  type WaitlistEntry,
} from "./admin-waitlist";

// Shape of each element returned by the admin_list_reports() RPC. The RPC is
// SECURITY DEFINER and reads the target preview across RLS, so it embeds the
// comment body / story photo paths that the admin couldn't otherwise read.
type RawReport = {
  id: string;
  reporter_username: string | null;
  target_type: "story" | "comment" | "profile" | "recap" | "nudge";
  target_id: string;
  reason: string;
  note: string | null;
  created_at: string;
  target: {
    // story (a reported session; "story" is the persisted report_target_type)
    session_id?: string;
    label?: string;
    is_goal?: boolean;
    photo_path?: string | null;
    owner_username?: string | null;
    // comment
    body?: string | null;
    author_username?: string | null;
    // profile
    username?: string | null;
    display_name?: string | null;
    // recap
    week_start_ms?: number | null;
    tracked_ms?: number | null;
    // nudge
    sender_username?: string | null;
    recipient_username?: string | null;
    preset_key?: string | null;
    target_label?: string | null;
    // set by the RPC when the target no longer exists / was taken down
    gone?: boolean;
  } | null;
};

type RawConsentRow = {
  user_id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  consented_at: string | null;
  seat_no: number | null;
};

type RawBugRow = {
  id: string;
  reporter_email: string | null;
  reporter_username: string | null;
  description: string;
  route: string | null;
  platform: string | null;
  user_agent: string | null;
  viewport: string | null;
  commit_sha: string | null;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
};

type RawWaitlistRow = {
  user_id: string;
  queue_position: number;
  email: string | null;
  display_name: string | null;
  username: string | null;
  joined_at: string;
};

// The private moderation queue. Flag-gated and 404s anyone who isn't the admin
// (is_admin() also re-checked inside every admin_* RPC). Reads open reports plus
// an embedded target preview; story photos are re-signed here for review, which
// the is_admin() branch of the storage policy permits.
export default async function AdminPage() {
  if (!SOCIAL_ENABLED) notFound();
  await requireAdmin();

  const supabase = await createClient();

  const { data } = await supabase.rpc("admin_list_reports");
  const rows = (data ?? []) as RawReport[];

  // Beta capacity. Both RPCs are read-only and both degrade to null/empty on
  // error, so a missing Stage 7 migration can't take the moderation queue down
  // with it.
  const [overviewRes, waitlistRes, bugRes, consentRes] = await Promise.all([
    supabase.rpc("admin_beta_overview"),
    supabase.rpc("admin_list_waitlist"),
    supabase.rpc("admin_list_bug_reports"),
    supabase.rpc("admin_list_interview_consents"),
  ]);

  const rawOverview = overviewRes.error
    ? null
    : (overviewRes.data as {
        seat_cap: number;
        seated: number;
        waiting: number;
      } | null);
  const overview: BetaOverview | null = rawOverview
    ? {
        seatCap: rawOverview.seat_cap,
        seated: rawOverview.seated,
        waiting: rawOverview.waiting,
      }
    : null;

  const consentsInstalled = !consentRes.error;
  const consents: InterviewConsent[] = (
    (consentsInstalled ? (consentRes.data ?? []) : []) as RawConsentRow[]
  ).map((row) => ({
    userId: row.user_id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    consentedAt: row.consented_at,
    seatNo: row.seat_no,
  }));

  // Same degrade-on-error discipline as the capacity panel: a missing
  // migration must not take the moderation queue down with it.
  const bugsInstalled = !bugRes.error;
  const bugReports: AdminBugReport[] = (
    (bugsInstalled ? (bugRes.data ?? []) : []) as RawBugRow[]
  ).map((row) => ({
    id: row.id,
    reporterEmail: row.reporter_email,
    reporterUsername: row.reporter_username,
    description: row.description,
    route: row.route,
    platform: row.platform,
    userAgent: row.user_agent,
    viewport: row.viewport,
    commitSha: row.commit_sha,
    status: row.status,
    createdAt: row.created_at,
  }));

  const waitlist: WaitlistEntry[] = (
    (waitlistRes.error ? [] : (waitlistRes.data ?? [])) as RawWaitlistRow[]
  ).map((row) => ({
    userId: row.user_id,
    position: Number(row.queue_position),
    email: row.email,
    displayName: row.display_name,
    username: row.username,
    joinedAt: row.joined_at,
  }));

  const reports: AdminReport[] = await Promise.all(
    rows.map(async (row): Promise<AdminReport> => {
      const base = {
        id: row.id,
        reporterUsername: row.reporter_username,
        reason: row.reason,
        note: row.note,
        createdAt: row.created_at,
      };
      const t = row.target ?? {};

      if (row.target_type === "story") {
        // A taken-down session has its photo_path nulled by
        // admin_take_down_story, which is what `gone` reflects here.
        const gone = t.gone === true || !t.photo_path;
        const photoUrl = gone
          ? null
          : await getSessionPhotoUrl({ photoPath: t.photo_path ?? null });
        return {
          ...base,
          target: {
            kind: "story",
            sessionId: row.target_id,
            label: t.label ?? "Session",
            isGoal: t.is_goal === true,
            photoUrl,
            ownerUsername: t.owner_username ?? null,
            gone,
          },
        };
      }

      if (row.target_type === "comment") {
        return {
          ...base,
          target: {
            kind: "comment",
            commentId: row.target_id,
            body: t.body ?? null,
            authorUsername: t.author_username ?? null,
            gone: t.gone === true || t.body == null,
          },
        };
      }

      if (row.target_type === "recap") {
        // admin_take_down_recap deletes the row, so a missing preview = gone.
        return {
          ...base,
          target: {
            kind: "recap",
            recapId: row.target_id,
            weekStartMs: t.week_start_ms ?? null,
            trackedMs: t.tracked_ms ?? null,
            ownerUsername: t.owner_username ?? null,
            gone: t.gone === true || t.week_start_ms == null,
          },
        };
      }

      if (row.target_type === "nudge") {
        // The preset is a KEY in the database so the copy can change without a
        // migration; the admin queue shows the current wording.
        const preset = t.preset_key ?? null;
        return {
          ...base,
          target: {
            kind: "nudge",
            nudgeId: row.target_id,
            senderUsername: t.sender_username ?? null,
            recipientUsername: t.recipient_username ?? null,
            presetLabel:
              preset && isNudgePreset(preset) ? NUDGE_PRESETS[preset] : preset,
            targetLabel: t.target_label ?? null,
            gone: t.gone === true || preset == null,
          },
        };
      }

      if (row.target_type === "profile") {
        return {
          ...base,
          target: {
            kind: "profile",
            userId: row.target_id,
            username: t.username ?? null,
            displayName: t.display_name ?? null,
          },
        };
      }

      // An unrecognized target_type used to fall through to the profile branch
      // and render as a profile report — silently wrong. Say so instead.
      return {
        ...base,
        target: {
          kind: "profile",
          userId: row.target_id,
          username: null,
          displayName: `Unknown report type "${row.target_type}"`,
        },
      };
    })
  );

  return (
    <>
      {/* Analytics is its own route so triaging a bug never pays for
          computing everyone's retention. */}
      <div className="flex w-full flex-col items-center px-5 pt-8">
        <Link
          href="/admin/analytics"
          className="border-hairline flex w-full max-w-md items-center justify-between rounded-lg border px-4 py-3.5"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">Analytics</span>
            <span className="text-caption text-xs">
              Users, goals, activity, retention
            </span>
          </span>
          <span className="text-caption text-sm" aria-hidden>
            →
          </span>
        </Link>
      </div>
      {/* Bug reports first — the most actionable thing on this page. */}
      <AdminBugReports reports={bugReports} installed={bugsInstalled} />
      <AdminWaitlist overview={overview} entries={waitlist} />
      {/* A mailing list, not a queue — nothing here needs action today, so it
          sits below the two that do. Moderation stays last: it owns the page's
          bottom padding. */}
      <AdminInterviews consents={consents} installed={consentsInstalled} />
      <AdminReports reports={reports} />
    </>
  );
}
