import SwiftUI

// The Live Activity card's LAYOUT, and nothing else. WIDGET EXTENSION TARGET.
//
// Split out of PrograLiveActivityWidget.swift so it imports SwiftUI ALONE — no
// ActivityKit, no WidgetKit, no `@main`. That is what lets the headless render
// harness (scripts/render-widget) compile this exact file and photograph the
// real card on macOS, instead of a hand-kept copy that would drift until the
// renders quietly started lying. ActivityKit is iOS-only, so without the split
// there is no way to render at all.
//
// Keep it that way: an `import ActivityKit` here breaks the harness.
//
// Everything it draws arrives as `PrograCardModel`, a plain value type. The
// widget maps its ContentState into one (see the extension in
// PrograLiveActivityWidget.swift); the harness builds them by hand.
//
// Built to design_handoff_progra_widget (variant 1b: the clock is drawn in the
// goal's colour). EVERY STRING COMES FROM THE MODEL, which comes from the
// payload: this binary is behind App Store review, lib/live-activity.ts is
// behind a Vercel deploy.

// MARK: - Model

struct PrograCardModel {
    var label: String
    /// What the session counts towards — a goal's title or a category's name,
    /// "Uncategorized" otherwise. The chip renders it as-is: no "Goal · "
    /// prefix, just the name of the thing. Uppercased on the Dynamic Island.
    var attribution: String

    /// The chip's text. A fourth colour variant: the chip's own 28% fill tints
    /// the ground, so `accentOnDark` — measured against bare navy — leaves
    /// 12.5pt type hue-on-hue inside the pill. See entityChipInk in lib/colors.ts.
    var chipInk: Color?
    /// The chip's FILL, raw. The one place the unlifted palette hex belongs:
    /// drawn at 28% as a wash, where being too dark to read is the point.
    var chipFill: Color?
    /// Paints the bar and the clock. Always the on-dark lift, never the raw
    /// fill — the card is always navy, where the fills put maroon at 1.91:1,
    /// under the 3:1 even a non-text marker needs.
    var accentOnDark: Color?

    var isRunning: Bool
    var isOnBreak: Bool
    /// The instant the clock counts up from: startedAt + pausedMs.
    var anchor: Date?
    /// Non-nil only while frozen. Passed as `pauseTime` so a paused clock
    /// renders through the SAME system formatter as a running one.
    var pauseDisplay: Date?
    /// One second short of the 10-hour cap — see `clockWidth`.
    var rangeEnd: Date

    var stateLabel: String?
    var breakEnd: Date?
    var targetEnd: Date?

    var secondaryLabel: String
    var secondaryPath: String?
    var endLabel: String
    var endPath: String?
}

// MARK: - Tokens

// Straight from the handoff, and fixed rather than adaptive: the card is always
// navy, in both appearances.
let navy = Color(rgb: 0x1C3A5E)
private let pausedClock = Color(rgb: 0x8FA3BC)
private let secondaryFill = Color.white.opacity(0.14)
private let chipFillOpacity: Double = 0.28
// For a session with nothing to colour — --disabled, already the app's neutral
// on this ground.
private let neutralAccent = Color(rgb: 0xC3C8CE)

private let padV: CGFloat = 16
private let padH: CGFloat = 14
let barWidth: CGFloat = 4
private let barRadius: CGFloat = 2
private let barToText: CGFloat = 10
private let chipToName: CGFloat = 6
private let nameToClock: CGFloat = 10
private let minGapAboveButtons: CGFloat = 8
private let buttonGap: CGFloat = 8
private let buttonHeight: CGFloat = 40
private let buttonRadius: CGFloat = 12
private let iconToLabel: CGFloat = 8

// MARK: - Metrics

// The width the clock reserves, right-aligned inside it.
//
// MEASURED through CoreText with the exact bundled cut (Newsreader48pt-Medium
// at 48pt, SwiftUI's tracking of -0.48 applied per character):
//
//     "0:00:00" / "9:59:59"   165.41pt      (7 characters)
//     "10:00:00"              193.63pt      (8 characters)
//     "24:07"                 125.04pt      (5 characters)
//
// 169 is the UNTRACKED width of the widest string (168.77pt), rounded up,
// rather than the tracked 165.41. Deliberately the conservative bound: it is
// not certain the system applies `.tracking` when it computes the reservation,
// and a frame NARROWER than the reservation squeezes the digits, which is a
// visibly broken clock. A frame a few points wider costs nothing now that the
// glyphs are trailing-aligned inside it — see ElapsedText. (The handoff
// reference file's TODO guessed 150, which is ~15pt short of either number.)
//
// Holds only because the model's `rangeEnd` stops one second short of the cap,
// capping the range at seven characters: Text(timerInterval:) reserves width
// for the widest string its RANGE can produce, not the value it draws. The two
// are a pair and moving either alone breaks the other. Given slack the timer
// centres its glyphs instead of hugging the trailing edge, which is the drift
// the previous card's own clock-width comment documented at length.
private let clockWidth: CGFloat = 169

// How much of the clock's reserved descent to reclaim.
//
// A 48pt line of Newsreader reserves 12.72pt below the baseline (hhea
// descender, -530/2000 em). The clock can only ever render digits and a colon,
// and those reach just -1.20pt (the '9' overshoot at -50 units; the colon -18).
// So ~11.5pt of that reservation is provably empty.
//
// Worth reclaiming because the clock is baseline-aligned beside the name, so
// its descent otherwise sets the top block's height — and a Lock Screen Live
// Activity wants to stay near 160pt. With 11pt back a two-line name gives
// 16 + 74.59 + 8 + 40 + 16 = 154.59pt; left intact it is 162.16pt.
//
// 11 rather than 11.52 leaves 1.72pt below the baseline, still clear of the
// 1.20pt of real ink. Measured, not nudged — an unmeasured inset here is
// exactly what shipped the last optical bug.
private let clockDescentCollapse: CGFloat = 11

// MARK: - Fonts

// PostScript names CONFIRMED against the bundled files through CoreText, not
// guessed — a name that doesn't resolve falls back to the system font SILENTLY.
// Both are listed under UIAppFonts in this extension's Info.plist.
//
//   HankenGrotesk-SemiBold.ttf   -> "HankenGrotesk-SemiBold"
//   Newsreader48pt-Medium.ttf    -> "Newsreader48pt-Medium"
//
// Static instances cut from the Google Fonts variable originals (SIL OFL,
// licence bundled alongside): Hanken at wght=600, Newsreader at opsz=48,
// wght=500. 48 is the clock's render size and so the optically correct cut —
// and it is what the HTML mock shows, since it loads
// `Newsreader:opsz,wght@6..72,500` and browsers resolve opsz from font-size.
// The handoff's "36 pt or 60 pt static instance" comes from the Google Fonts
// download packaging; upstream declares opsz nominals at 6/16/72 only, so
// neither exists to take.
enum WidgetFonts {
    /// `fixedSize` on purpose: the handoff's type scale is absolute, and a card
    /// that reflowed with Dynamic Type would break the pinned clock width.
    static func hanken(_ size: CGFloat) -> Font {
        .custom("HankenGrotesk-SemiBold", fixedSize: size)
    }

    /// The clock. NO `.monospacedDigit()`, deliberately rather than by
    /// omission: this cut's figures are ALREADY tabular — every digit measures
    /// exactly 1196/2000 em — so the modifier changes nothing it can reach,
    /// while risking a system-font substitution on a custom face that declares
    /// no `tnum` feature. The handoff's "tabular lining figures" is satisfied
    /// by the font itself, which is the stronger guarantee.
    static func clock() -> Font {
        .custom("Newsreader48pt-Medium", fixedSize: 48)
    }
}

// MARK: - Colour

extension Color {
    init(rgb: UInt32) {
        self.init(
            .sRGB,
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255,
            opacity: 1
        )
    }

    /// "#2f6f4e" -> Color. nil on anything unexpected, so a caller falls back
    /// rather than rendering black — every colour field in the payload is
    /// Optional by the compatibility contract.
    init?(hexString: String?) {
        guard var raw = hexString else { return nil }
        if raw.hasPrefix("#") { raw.removeFirst() }
        guard raw.count == 6, let v = UInt32(raw, radix: 16) else { return nil }
        self.init(rgb: v)
    }
}

// The colour the bar and the clock take. ONE function, where the adaptive card
// needed three, because the ground no longer varies.
//
// NOT named `accentColor`: that collides with SwiftUI's own View.accentColor
// modifier inside a view body and resolves to the modifier instead.
func sessionAccent(_ m: PrograCardModel) -> Color {
    m.isRunning ? (m.accentOnDark ?? neutralAccent) : pausedClock
}

// MARK: - Pieces

/// The colour bar beside the session: 4pt on the card, 3pt in the Island.
struct Marker: View {
    let model: PrograCardModel
    var width: CGFloat = barWidth
    /// nil = width only, so the bar fills whatever height its row establishes.
    /// The card relies on that to span the chip and the name without a
    /// hardcoded height that would drift if the rows reflow; the Island's
    /// regions are fixed-height by nature and pass one.
    var height: CGFloat?

    var body: some View {
        RoundedRectangle(cornerRadius: barRadius, style: .continuous)
            .fill(sessionAccent(model))
            .frame(width: width, height: height)
    }
}

/// Counting UP from the anchor while running; frozen at the banked time while
/// paused, via `pauseTime`, so both states render through the SAME system
/// formatter. That is a layout requirement as much as a tidiness one — the card
/// pins the clock to the system formatter's seven-character reservation, and
/// the hand-rolled string this used to use could differ from it in metrics.
///
/// WHY `.multilineTextAlignment(.trailing)` IS LOAD-BEARING, and why the clock
/// drifting left has come back three times.
///
/// `Text(timerInterval:)` reserves layout width for the WIDEST string its
/// range can produce, not the value it currently draws. With a 10-hour range
/// that reservation is "9:59:59" — 165.41pt at 48pt — while a young session
/// draws "5:23", which is 57.68pt. Over 100pt of the box is empty, and the
/// glyphs are NOT trailing-aligned inside it by default.
///
/// `.frame(width:alignment:.trailing)` cannot fix that, which is the part that
/// kept being missed: the Text's own box already fills the frame, so the frame
/// has nothing left to align. The slack is INSIDE the Text. Only the text
/// alignment reaches it.
///
/// Two earlier fixes aimed at the wrong thing and were reverted:
/// `.padding(.trailing, -6)` (the digits' right side bearing is 0.55–3.55pt
/// and VARIES per digit, so a fixed inset overshoots for most of them), and
/// tuning the frame width 124 → 116 (changes how much slack there is, never
/// where the glyphs sit in it).
///
/// An adaptive frame sized to the current digit count is NOT an option here,
/// and the reason is specific to this surface: a Live Activity re-renders only
/// when the app pushes an update, so a width chosen at render time would still
/// be in force after the clock crossed an hour and gained a digit — overflowing
/// instead of merely sitting left. A widget could schedule a timeline entry for
/// that instant; a Live Activity cannot.
///
/// NOT VERIFIABLE BY THE RENDER HARNESS. `ImageRenderer` draws a timer Text as
/// a plain static string at its natural width and never applies the
/// reservation, so all of this looks correct in a PNG whether or not it is.
/// That is why the bug survived every off-device check. Changes here need a
/// device.
struct ElapsedText: View {
    let model: PrograCardModel

    var body: some View {
        if let anchor = model.anchor {
            Text(
                timerInterval: anchor...model.rangeEnd,
                pauseTime: model.pauseDisplay,
                countsDown: false
            )
            // THE CLOCK'S RIGHT EDGE. Do not remove — and read the block above
            // before replacing it with a frame tweak or an inset, because both
            // have been tried and neither can work.
            .multilineTextAlignment(.trailing)
        } else {
            Text("—")
        }
    }
}

/// The attribution chip — the goal's or category's bare name.
struct GoalChip: View {
    let model: PrograCardModel

    var body: some View {
        Text(model.attribution)
            .font(WidgetFonts.hanken(12.5))
            .foregroundStyle(model.chipInk ?? .white)
            .lineLimit(1)
            .padding(.vertical, 4)
            .padding(.horizontal, 11)
            .background(
                (model.chipFill ?? neutralAccent).opacity(chipFillOpacity),
                in: Capsule()
            )
    }
}

/// ATTRIBUTION · STATE, in small caps. DYNAMIC ISLAND ONLY — the Lock Screen
/// card follows the handoff, which has no sub-line. This is where the break
/// countdown and a timed session's end time survive.
struct SubLine: View {
    let model: PrograCardModel

    private enum Trailing {
        case breakCountdown(Date)
        case breakOver
        case endsAt(Date)
        case word(String)
    }

    private var trailing: Trailing? {
        if model.isOnBreak, let ends = model.breakEnd {
            // Past the end instant nothing has ended the break in the DB —
            // useBreakSchedule only runs with the app open — so say so rather
            // than showing a frozen 0:00.
            return ends > Date() ? .breakCountdown(ends) : .breakOver
        }
        if let target = model.targetEnd, model.isRunning, target > Date() {
            return .endsAt(target)
        }
        if let label = model.stateLabel, !label.isEmpty {
            return .word(label.uppercased())
        }
        return nil
    }

    var body: some View {
        HStack(spacing: 5) {
            // The attribution truncates if the row runs out: a clipped
            // "TRACKIN" reads as a bug where "LINEAR ALGEBRA REV…" reads as a
            // long goal name.
            Text(model.attribution.uppercased())
                .lineLimit(1)
                .truncationMode(.tail)

            if let trailing {
                Text("·")
                view(for: trailing).lineLimit(1)
            }
        }
    }

    @ViewBuilder private func view(for trailing: Trailing) -> some View {
        switch trailing {
        case .breakCountdown(let ends):
            // The one thing still moving on a paused card, so it keeps full
            // strength while the rest of the line stays secondary.
            Text(timerInterval: Date()...ends, countsDown: true)
                .foregroundStyle(.white)
        case .breakOver:
            Text("BREAK OVER")
        case .endsAt(let instant):
            Text("ENDS ") + Text(instant, style: .time)
        case .word(let word):
            Text(word)
        }
    }
}

/// Pause / Resume / End break, and Clock out.
///
/// `Link`s, NOT `Button(intent:)`. Progra's session lives in Postgres under RLS
/// and a widget extension has no Supabase cookie, so an intent could only
/// mutate a local shadow that diverges until the app next opens. Each links to
/// /clock/live?la=<action>, where the live timer's dispatcher runs the real
/// server action — so revalidateSessionSurfaces() fires, the reminder schedule
/// is rebuilt, and the break guard still applies.
///
/// `secondaryLabel` and `secondaryPath` are DECISIONS already made in
/// TypeScript, so this never branches on whether a break is running and can
/// never offer a Pause that pauseSession would refuse.
struct Buttons: View {
    let model: PrograCardModel

    var body: some View {
        HStack(spacing: buttonGap) {
            Link(destination: link(model.secondaryPath)) {
                pill(
                    icon: model.isRunning ? "pause.fill" : "play.fill",
                    iconSize: 13,
                    label: model.secondaryLabel
                )
                .foregroundStyle(.white)
                .background(
                    secondaryFill,
                    in: RoundedRectangle(cornerRadius: buttonRadius, style: .continuous)
                )
            }
            Link(destination: link(model.endPath)) {
                pill(icon: "stop.fill", iconSize: 11, label: model.endLabel)
                    .foregroundStyle(navy)
                    .background(
                        Color.white,
                        in: RoundedRectangle(cornerRadius: buttonRadius, style: .continuous)
                    )
            }
        }
        // NOT optional. Without it a Link's label is drawn by the platform's
        // default button style instead of as given: the headless render showed
        // a flat yellow fill with a missing-glyph symbol and no label at all,
        // and the identical content renders correctly the moment this is
        // applied. See the harness note in AGENTS.md.
        .buttonStyle(.plain)
    }

    private func pill(icon: String, iconSize: CGFloat, label: String) -> some View {
        HStack(spacing: iconToLabel) {
            Image(systemName: icon)
                .font(.system(size: iconSize, weight: .bold))
            Text(label)
                .font(WidgetFonts.hanken(16))
                .lineLimit(1)
        }
        // Two equal-width buttons, 40pt tall.
        .frame(maxWidth: .infinity)
        .frame(height: buttonHeight)
    }

    /// The app's EXISTING custom scheme, already registered in Info.plist and
    /// already routed by components/deep-link-router.tsx, which parses the URL
    /// and allowlists same-origin paths. Link requires a non-optional URL; the
    /// timer is the safe landing spot because it performs no mutation.
    private func link(_ path: String?) -> URL {
        URL(string: "world.progra.app://\(path ?? "/clock/live")")
            ?? URL(string: "world.progra.app:///clock/live")!
    }
}

// MARK: - The card

struct LockScreenCard: View {
    let model: PrograCardModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // The clock is a SIBLING of the bar-and-text group, not a row
            // inside it, and the mock requires that rather than merely
            // preferring it.
            //
            // The handoff's prose puts the name and the clock in one row inside
            // the text column — but the bar is then stretched by the 48pt clock
            // and runs ~26pt past the bottom of the name, where the mock has it
            // ending exactly there (its markup keeps the clock outside the flex
            // group that holds the bar). So the clock sits out here, and
            // `.lastTextBaseline` does natively what the mock's
            // `margin-bottom:-9px` hack does.
            HStack(alignment: .lastTextBaseline, spacing: nameToClock) {
                HStack(alignment: .top, spacing: barToText) {
                    Marker(model: model)

                    VStack(alignment: .leading, spacing: chipToName) {
                        GoalChip(model: model)
                        nameText
                    }
                }
                // Without this the bar — a height-less shape — expands the row
                // to fill the card instead of matching the text.
                .fixedSize(horizontal: false, vertical: true)
                // Takes the leftover width so the clock is pushed to the
                // trailing edge: the mock's `justify-content: space-between`
                // with the clock's `flex-shrink: 0`.
                .frame(maxWidth: .infinity, alignment: .leading)

                clockText
            }

            Spacer(minLength: minGapAboveButtons)

            Buttons(model: model)
        }
        .padding(.vertical, padV)
        .padding(.horizontal, padH)
        // RECONCILES THE HANDOFF'S FRAME WITH THIS SURFACE.
        //
        // The mock is a fixed 364x170 home screen widget using
        // `justify-content: space-between`, so its button row is pushed to the
        // bottom and a two-line name leaves ~23pt of air above it. A Live
        // Activity instead sizes to its content, which collapses `Spacer` to
        // its 8pt minimum and crowds the buttons against the name — spec-legal
        // but visibly tighter than the design.
        //
        // 160 rather than the mock's 170: Apple's guidance is that a Lock
        // Screen Live Activity should not exceed ~160pt, and past that the
        // system constrains the view rather than honouring it. At 160 a
        // two-line name gets 13.4pt above the buttons and a one-line name
        // ~35pt, which is the space-between behaviour the mock shows.
        //
        // minHeight, not height: content must still be able to grow rather
        // than clip if a future payload adds a row.
        .frame(minHeight: 160)
    }

    // TWO LINES, not the mock's three.
    //
    // The mock sets a 20px line height and allows three; SwiftUI uses the
    // font's natural line height, which for Hanken SemiBold at 17pt is 22.15pt.
    // Three lines put the top block at 96.74pt and the card at 176.74pt, past
    // what a Lock Screen Live Activity should ask for. Two come to 74.59pt and
    // a 154.59pt card. See `clockDescentCollapse` for the rest of that budget.
    private var nameText: some View {
        Text(model.label)
            .font(WidgetFonts.hanken(17))
            .foregroundStyle(.white)
            .lineLimit(2)
            .truncationMode(.tail)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var clockText: some View {
        ElapsedText(model: model)
            .font(WidgetFonts.clock())
            .tracking(-0.48)
            .lineLimit(1)
            .foregroundStyle(sessionAccent(model))
            .frame(width: clockWidth, alignment: .trailing)
            // Reclaims the empty descent so the clock doesn't set the top
            // block's height. See `clockDescentCollapse` — the numbers are there.
            .padding(.bottom, -clockDescentCollapse)
    }
}
