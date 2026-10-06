import ActivityKit
import Foundation

// The Live Activity's data contract. SHARED FILE: it must be a member of BOTH
// the App target (which requests/updates/ends the activity) and the widget
// extension target (which renders it). If it's only in one, the other won't
// compile.
//
// EVERY ContentState FIELD IS OPTIONAL, deliberately.
//
// capacitor.config.ts points the shell at https://progra.world, so the
// JavaScript that produces these payloads ships from Vercel while this binary
// ships through App Store review — and the two can be arbitrarily far apart on
// any given phone. Optional fields mean:
//
//   * a NEWER payload reaching an OLDER binary decodes fine (unknown keys are
//     ignored), and
//   * an activity started by an OLDER binary still decodes under a NEWER one.
//
// A non-optional field added in a later binary fails to decode an activity the
// earlier one started, which strands a live card. So: fields are ADDITIVE AND
// OPTIONAL, forever. The Phase-2 button fields are already here, unused, for
// exactly this reason — adding them later would be the breaking change.
//
// The strings all arrive from lib/live-activity.ts rather than being written
// here, because this file is behind review and that one is behind a deploy.
@available(iOS 17.0, *)
struct PrograActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Bumped by lib/live-activity.ts only if the shape changes
        // incompatibly. Render nothing rather than guess on an unknown version.
        var snapshotVersion: Int?

        var label: String?
        // What the session counts towards — a goal title or category name.
        var attribution: String?
        // The session's own colour as "#rrggbb", or nil when it has none. Hexes
        // rather than palette names: the palette lives in app/globals.css and
        // must not be duplicated in a binary behind App Store review.
        //
        // THREE, and none is interchangeable with another. accentColor is the
        // FILL (the light card's marker); accentInk is it darkened for TEXT on
        // white (the digits), since light green, gold and light blue fail
        // contrast as type; accentOnDark is it LIFTED for the navy card, where
        // the fills fall under even the 3:1 non-text bar (maroon 1.91:1) and the
        // inks are darker still. lib/colors.test.ts pins every palette entry
        // above 4.5:1 on that ground.
        var accentColor: String?
        var accentInk: String?
        var accentOnDark: String?
        // "running" | "paused" | "onBreak". A String rather than an enum so an
        // unrecognised future state degrades to "treat as running" instead of
        // failing the whole decode.
        var state: String?
        // "Tracking" | "Paused" | "On a break" — the live screen's own words.
        var stateLabel: String?

        // Epoch MILLISECONDS throughout — JavaScript's unit, converted once at
        // the edge (see `date(_:)` below). Keeping the wire format in JS's
        // native unit means no rounding decisions live on this side.
        //
        // The instant iOS counts up from: startedAt + pausedMs. Shifts later as
        // pauses accumulate, which is what keeps this card agreeing with the
        // on-screen countdown.
        var timerAnchorMs: Double?
        // Worked ms frozen at the moment of pausing. Non-nil only while paused.
        var frozenWorkedMs: Double?
        var targetEndMs: Double?
        var plannedWorkMs: Double?
        var breakEndsAtMs: Double?
        var staleAtMs: Double?
        var capEndMs: Double?

        var staleLabel: String?

        // The buttons. `secondaryAction` is the DECISION, already made in
        // TypeScript — "pause" | "resume" | "endBreak" — so this side never
        // branches on onBreak itself, and can never offer a Pause during a break
        // that pauseSession would refuse.
        var secondaryAction: String?
        var secondaryLabel: String?
        var endLabel: String?
        // Deep links. tapPath is the card body; the other two are the buttons,
        // each "/clock/live?la=<action>".
        var tapPath: String?
        var secondaryPath: String?
        var endPath: String?

        // MARK: - Derived

        var isRunning: Bool { state != "paused" && state != "onBreak" }
        var isOnBreak: Bool { state == "onBreak" }

        static func date(_ ms: Double?) -> Date? {
            guard let ms else { return nil }
            return Date(timeIntervalSince1970: ms / 1000)
        }

        var anchorDate: Date? { Self.date(timerAnchorMs) }
        var staleDate: Date? { Self.date(staleAtMs) }
        var breakEndDate: Date? { Self.date(breakEndsAtMs) }

        // The upper bound of the counting-up range. The cap is the honest end:
        // past it autoClockOut zeroes the session, so there is nothing worth
        // showing even if iOS would still allow it.
        var timerRangeEnd: Date {
            Self.date(capEndMs) ?? Date.distantFuture
        }
    }

    // Fixed for the activity's whole life, which is exactly right: a different
    // session is a different activity (end, then request a new one) rather than
    // an update. In Phase 2 it's also the staleness token a button posts, so a
    // tap on a card left over from a previous session can't mutate the current
    // one.
    var sessionId: String
}

// H:MM:SS past an hour, else M:SS — matching how the app's own live clock reads.
@available(iOS 17.0, *)
func prograFormatWorked(_ ms: Double) -> String {
    let total = max(0, Int(ms / 1000))
    let hours = total / 3600
    let minutes = (total % 3600) / 60
    let seconds = total % 60
    if hours > 0 {
        return String(format: "%d:%02d:%02d", hours, minutes, seconds)
    }
    return String(format: "%d:%02d", minutes, seconds)
}
