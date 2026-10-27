// design-sync bundle entry — the design-system surface of this app.
//
// Server actions and next/navigation are swapped for inert stubs by
// .design-sync/tsconfig.json, so components that CALL an action (kudos, the
// nudges, BottomNav's badge poll) can ship as cards. Anything that READS on the
// server (lib/db values, Supabase clients) still cannot — those stay out; see
// the null entries in .design-sync/config.json.
import "./process-shim";

// ── shadcn primitives still used by the live screens ──
export * from "../components/ui/alert-dialog";
export * from "../components/ui/badge";
export * from "../components/ui/button";
export * from "../components/ui/card";
export * from "../components/ui/checkbox";
export * from "../components/ui/dialog";
export * from "../components/ui/input";
export * from "../components/ui/label";
export * from "../components/ui/sonner";
// sonner's imperative API must ship from the SAME module instance the
// bundled Toaster subscribes to, or fired toasts never render.
export { toast } from "sonner";
export * from "../components/ui/textarea";

// ── redesign (V2) building blocks ──
export * from "../components/v2/primary-button";
export * from "../components/v2/section-header";
export * from "../components/v2/menu-row";
export * from "../components/v2/period-chips";
export * from "../components/v2/toggle-switch";
export * from "../components/v2/back-button";
export * from "../components/v2/back-link";
export * from "../components/v2/bottom-sheet";
export * from "../components/avatar-initials";
export * from "../components/progra-mark";
export * from "../components/v2/week-pulse";

// ── data display ──
export * from "../components/v2/donut";
export * from "../components/v2/category-donut";
export * from "../components/v2/goal-quota-rows";
export * from "../components/v2/week-summary";
export * from "../components/v2/habit-week-grid";
export * from "../components/v2/friends-leaderboard";
export * from "../components/category-marker";
export * from "../components/color-swatches";
export * from "../components/goal-progress";

// ── social ──
export * from "../components/v2/session-card";
export * from "../components/clocked-in-strip";
export * from "../components/v2/recap-feed-card";
export * from "../components/v2/invite-share";
export * from "../components/v2/refer-friend-button";

// ── moments, nudges, flows ──
export * from "../components/v2/whats-new-modal";
export * from "../components/v2/auto-end-nudge";
export * from "../components/v2/recap-nudge";
export * from "../components/v2/session-plan-picker";
export * from "../components/category-picker";

// ── chrome ──
export * from "../components/bottom-nav";
export * from "../components/page-skeleton";
