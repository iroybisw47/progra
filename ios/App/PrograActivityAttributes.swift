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
        // The ink for the chip, which renders `attribution` — the goal's or
        // category's bare name. A fourth colour, because the chip's own 28%
        // fill tints the ground: accentOnDark is measured against bare navy
        // and leaves 12.5pt type hue-on-hue inside the pill. The chip's FILL
        // is accentColor, drawn at 28% as a wash.
        var chipInk: String?
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
        //
        // THE FALLBACK IS LOAD-BEARING, and it used to be `Date.distantFuture`.
        // Text(timerInterval:) reserves layout width for the widest string its
        // RANGE can produce, not for the value it currently draws — so a
        // distant-future bound made it reserve room for a counter of
        // astronomical magnitude, which crushed everything beside it on the
        // card. Every field here is Optional by the compatibility contract
        // above, so a nil capEndMs is a reachable path, not a hypothetical.
        //
        // Clamped to the anchor plus the app's own 10-hour cap: the same bound
        // the payload would have carried, so the reservation is identical
        // whether or not the field decoded.
            var timerRangeEnd: Date {
            let anchor = anchorDate ?? Date()
            let cap = Self.date(capEndMs) ?? anchor.addingTimeInterval(10 * 60 * 60)
            // ONE SECOND SHORT OF THE CAP, and it is the card's layout that
            // depends on it rather than correctness.
            //
            // Text(timerInterval:) reserves width for the widest string its
            // RANGE can produce. A range ending exactly at the 10-hour cap can
            // produce "10:00:00" — eight characters — while one ending a second
            // earlier tops out at "9:59:59", seven. In the card's 48pt
            // Newsreader that is 193.63pt against 165.41pt, and `clockWidth`
            // there is pinned to the seven-character measurement. The Island's
            // two widths are measured the same way.
            //
            // Honest as a value, too: at the cap autoClockOut ends the session
            // and sessionWorkedMs reads it back as zero, so there is nothing
            // worth showing past 9:59:59 even if iOS would still draw it.
            //
            // max() guards a malformed payload from producing an inverted
            // range, which would trap at the Range initialiser.
            return max(anchor.addingTimeInterval(1), cap).addingTimeInterval(-1)
        }

        /// What to pass as `pauseTime` so a frozen clock renders through the
        /// SAME system formatter as a running one.
        ///
        /// The previous card hand-formatted the frozen case with
        /// a hand-rolled formatter, which was fine when the clock had no pinned
        /// width. It no longer is: the card reserves exactly the system
        /// formatter's seven-character width, and a hand-rolled string can
        /// differ from it in metrics. One formatter, both states.
        ///
        /// Clamped into the renderable range. Normally the pause sits well
        /// inside it; the exception is the offline case `isOverSessionCap`
        /// documents — a session paused *after* crossing the cap, where no
        /// client was open at the crossing instant — which unclamped would
        /// render eight characters into a seven-character frame.
        var pauseDisplayDate: Date? {
            guard !isRunning, let anchor = anchorDate else { return nil }
            let worked = max(0, frozenWorkedMs ?? 0)
            let at = anchor.addingTimeInterval(worked / 1000)
            return min(max(at, anchor), timerRangeEnd)
        }
    }

    // Fixed for the activity's whole life, which is exactly right: a different
    // session is a different activity (end, then request a new one) rather than
    // an update. In Phase 2 it's also the staleness token a button posts, so a
    // tap on a card left over from a previous session can't mutate the current
    // one.
    var sessionId: String
}

