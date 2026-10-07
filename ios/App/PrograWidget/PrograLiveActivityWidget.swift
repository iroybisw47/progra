import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

// The card. WIDGET EXTENSION TARGET ONLY.
//
// Editorial, to match the app: a serif task name, a small-caps attribution line,
// a hairline rule, and the elapsed clock in monospaced digits. ADAPTIVE — flat
// white in light appearance, #142c49 navy in dark — so the card is legible
// either way rather than forcing one ground onto both.
//
// THE TIMER NEVER NEEDS AN UPDATE. Text(timerInterval:) is rendered by the system
// and ticks on its own, so a running session's card costs exactly ZERO updates
// after the one that started it. That is why lib/live-activity.ts computes an
// anchor (startedAt + pausedMs) rather than an elapsed number — an elapsed
// number would need a push per second.
//
// COLOUR IS THREE VALUES, NOT ONE, and the reason is measured rather than
// aesthetic. On white the marker takes the palette fill and the digits take
// `accentInk`, because light green, gold and light blue are unreadable as type.
// On navy BOTH take `accentOnDark`: the raw fills put maroon at 1.91:1 and dark
// blue at 2.12:1 against this ground — under the 3:1 a non-text marker needs, so
// the bar would be invisible, not merely dim — and the inks are darker still,
// moving the wrong way entirely. See entityOnDark in lib/colors.ts, and
// lib/colors.test.ts, which pins every palette entry above 4.5:1 here.
//
// The two buttons are `Link`s, not Button(intent:). They deep-link into
// /clock/live?la=<action>, which performs the real mutation, so the server
// actions run exactly as they do on screen — the reminder schedule is rebuilt
// and the break guard still applies. When the silent path lands, only these two
// destinations change.
//
// EVERY STRING COMES FROM THE PAYLOAD. This binary is behind App Store review;
// lib/live-activity.ts is behind a Vercel deploy.
@available(iOS 17.0, *)
struct PrograLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PrograActivityAttributes.self) { context in
            LockScreenCard(state: context.state)
                // A dynamic UIColor rather than reading @Environment: it resolves
                // per trait collection, so the tint, the type and the rule all
                // flip from one source instead of three separate branches.
                .activityBackgroundTint(cardGround)
                .activitySystemActionForegroundColor(primaryInk)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 7) {
                        Marker(state: context.state, height: 18)
                        Text(context.state.label ?? "Session")
                            // Matches the Lock Screen's title — the wordmark's
                            // sans, not the serif.
                            .font(.system(.footnote).weight(.semibold))
                            .tracking(-0.3)
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ElapsedText(state: context.state)
                        .font(.system(.title3, design: .rounded).weight(.semibold).monospacedDigit())
                        // The Island is always dark, whatever the system
                        // appearance — so it takes the on-dark accent
                        // unconditionally, never accentInk.
                        .foregroundStyle(islandAccent(context.state))
                        .lineLimit(1)
                        // Measured the same way: "10:00:00" at 20pt semibold
                        // rounded with monospaced numbers is 89.44pt.
                        .frame(width: 90, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.attribution?.uppercased() ?? "")
                        .font(.system(size: 10, weight: .semibold))
                        .kerning(0.6)
                        .lineLimit(1)
                        .foregroundStyle(.secondary)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 8) {
                        SubLine(state: context.state)
                            .font(.system(size: 10, weight: .semibold))
                            .kerning(0.6)
                            .foregroundStyle(.secondary)
                        Buttons(state: context.state, onDarkGround: true)
                    }
                }
            } compactLeading: {
                Marker(state: context.state, height: 12, forceDark: true)
            } compactTrailing: {
                ElapsedText(state: context.state)
                    .font(.system(.caption2, design: .rounded).monospacedDigit())
                    .foregroundStyle(islandAccent(context.state))
                    .lineLimit(1)
                    // Without a width the compact region clips H:MM:SS. Measured:
                    // "10:00:00" at 11pt rounded with monospaced numbers is
                    // 49.95pt. Trailing-aligned for the same reason as the Lock
                    // Screen's clock.
                    .frame(width: 52, alignment: .trailing)
            } minimal: {
                Marker(state: context.state, height: 12, forceDark: true)
            }
            .widgetURL(deepLink(context.state.tapPath))
        }
    }
}

// MARK: - Metrics

// The width the elapsed clock reserves on the Lock Screen, right-aligned inside
// it.
//
// Text(timerInterval:) sizes itself for the WIDEST string its range can produce,
// not for the value it currently draws — and the range runs to the 10-hour cap,
// so it always reserves for "10:00:00" while drawing "1:24:07" or "52:18". It
// does not right-align within that reservation, so the digits drifted left by up
// to ~54pt and stole the row's width from the title at the same time.
//
// Pinning fixes both ends: the clock can never overflow the card, never drifts,
// and the sub-line's budget becomes a known constant rather than the outcome of
// a negotiation. This is the convention the web app already uses for a changing
// numeric readout — `w-[50px] shrink-0 text-right tabular-nums` on the friends
// leaderboard, `min-w-[78px]` on the history stepper — both sized for the
// longest realistic string rather than the current one.
//
// 116 is MEASURED, not estimated. CoreText, with the exact font the card uses
// (26pt SF Pro Rounded semibold, monospaced-numbers feature):
//
//     "10:00:00"  115.35pt      "59:59"  74.45pt
//     "1:24:07"    98.58pt      "5:23"   57.68pt
//
// So 116 is the widest string the 10-hour range can produce, plus a hair. The
// earlier 124 came from a 0.6em-per-digit estimate and was ~9pt over, which the
// sub-line was paying for.
//
// NOT adaptive to the current digit count — that would reshuffle the layout
// mid-session every time the clock crossed an hour.
//
// AND NO OPTICAL INSET ON TOP OF IT. A headless ImageRenderer pass (see the
// render-harness note in AGENTS.md) shows that at this width the digits land
// exactly on the card's trailing padding, flush with the "Clock out" pill below
// — for a short "52:18" as well as a long "1:24:07". An earlier
// `.padding(.trailing, -6)`, added to chase "move it further right", pushed the
// clock PAST that edge and out of line with the buttons, which is what read as
// broken. Right-aligned against the same edge as everything else is as far right
// as it goes.
//
// The width has to stay close to the real reservation for this to hold: given
// slack, the timer centres its glyphs inside the box rather than hugging the
// trailing edge, which is what the earlier 124 produced.
private let clockWidth: CGFloat = 116


// MARK: - Adaptive palette

// One place where light and dark diverge. Every value below is the app's own
// token: #1c3a5e --brand, #142c49 --brand-deep, #8b929c --caption,
// #9fa6b0 --faint, #c3c8ce --disabled.
private func adaptive(light: UInt32, dark: UInt32) -> Color {
    Color(UIColor { trait in
        UIColor(rgb: trait.userInterfaceStyle == .dark ? dark : light)
    })
}

private let cardGround = adaptive(light: 0xFFFFFF, dark: 0x142C49)
private let primaryInk = adaptive(light: 0x1C3A5E, dark: 0xFFFFFF)
private let secondaryInk = adaptive(light: 0x8B929C, dark: 0x9FA6B0)
// Paused: the colour drops out in both themes, but the neutral moves UP in
// lightness on navy and DOWN on white.
private let pausedMarker = adaptive(light: 0xC3C8CE, dark: 0x6E7A8C)
private let pausedInk = adaptive(light: 0x8B929C, dark: 0x9FA6B0)
private let ruleColor = Color(UIColor { trait in
    trait.userInterfaceStyle == .dark
        ? UIColor(white: 1, alpha: 0.12)
        : UIColor(white: 0, alpha: 0.08)
})
private let ghostFill = Color(UIColor { trait in
    trait.userInterfaceStyle == .dark
        ? UIColor(white: 1, alpha: 0.14)
        : UIColor(white: 0, alpha: 0.05)
})

extension UIColor {
    convenience init(rgb: UInt32) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: 1
        )
    }

    // "#2f6f4e" → UIColor. nil on anything unexpected, so a caller falls back
    // rather than rendering black.
    convenience init?(hexString: String?) {
        guard var raw = hexString else { return nil }
        if raw.hasPrefix("#") { raw.removeFirst() }
        guard raw.count == 6, let v = UInt32(raw, radix: 16) else { return nil }
        self.init(rgb: v)
    }
}

// MARK: - Accent resolution

// The MARKER's colour: the palette fill on white, the lifted hex on navy.
@available(iOS 17.0, *)
private func markerColor(_ s: PrograActivityAttributes.ContentState) -> Color {
    guard s.isRunning else { return pausedMarker }
    let light = UIColor(hexString: s.accentColor)
    let dark = UIColor(hexString: s.accentOnDark)
    guard light != nil || dark != nil else { return primaryInk }
    return Color(UIColor { trait in
        let wantsDark = trait.userInterfaceStyle == .dark
        return (wantsDark ? dark ?? light : light ?? dark)
            ?? UIColor(rgb: wantsDark ? 0xFFFFFF : 0x1C3A5E)
    })
}

// The DIGITS' colour: accentInk on white (the fill fails as type), the same
// lifted hex on navy.
@available(iOS 17.0, *)
private func digitsColor(_ s: PrograActivityAttributes.ContentState) -> Color {
    guard s.isRunning else { return pausedInk }
    let light = UIColor(hexString: s.accentInk)
    let dark = UIColor(hexString: s.accentOnDark)
    guard light != nil || dark != nil else { return primaryInk }
    return Color(UIColor { trait in
        let wantsDark = trait.userInterfaceStyle == .dark
        return (wantsDark ? dark ?? light : light ?? dark)
            ?? UIColor(rgb: wantsDark ? 0xFFFFFF : 0x1C3A5E)
    })
}

// The Dynamic Island is always dark — no light variant to pick.
@available(iOS 17.0, *)
private func islandAccent(_ s: PrograActivityAttributes.ContentState) -> Color {
    guard s.isRunning else { return Color(uiColor: UIColor(rgb: 0x9FA6B0)) }
    guard let c = UIColor(hexString: s.accentOnDark) ?? UIColor(hexString: s.accentColor)
    else { return .white }
    return Color(uiColor: c)
}

// Paths come from the payload so they stay JS-shippable. The scheme matches
// CFBundleURLSchemes in the app's Info.plist, and components/deep-link-router.tsx
// turns the open into a navigation — Capacitor itself navigates nothing.
@available(iOS 17.0, *)
private func deepLink(_ path: String?) -> URL? {
    URL(string: "world.progra.app://\(path ?? "/clock/live")")
}

// MARK: - Pieces

// The 3pt colour bar the app puts beside every session row.
@available(iOS 17.0, *)
private struct Marker: View {
    let state: PrograActivityAttributes.ContentState
    // nil = width only, so the bar fills whatever height its row establishes.
    // The Lock Screen card relies on that to span both of its rows without a
    // hardcoded height that would drift if the rows ever reflow. The Dynamic
    // Island passes explicit heights — those regions are fixed-height by nature.
    var height: CGFloat?
    var forceDark: Bool = false

    var body: some View {
        RoundedRectangle(cornerRadius: 1.5)
            .fill(forceDark ? islandAccent(state) : markerColor(state))
            .frame(width: 3, height: height)
    }
}

// Counting UP from the anchor while running; a frozen constant while paused,
// because worked time genuinely isn't advancing.
@available(iOS 17.0, *)
private struct ElapsedText: View {
    let state: PrograActivityAttributes.ContentState

    var body: some View {
        if state.isRunning, let anchor = state.anchorDate {
            Text(timerInterval: anchor...state.timerRangeEnd, countsDown: false)
        } else if let frozen = state.frozenWorkedMs {
            Text(prograFormatWorked(frozen))
        } else {
            Text("—")
        }
    }
}

// ATTRIBUTION · STATE, in small caps — the app's section-label voice. A running
// break's countdown replaces the state word.
@available(iOS 17.0, *)
private struct SubLine: View {
    let state: PrograActivityAttributes.ContentState

    // What follows the attribution, or nil when nothing does.
    //
    // Resolved as a VALUE first, not as a ViewBuilder branch, because the body
    // has to know whether a trailing segment exists at all: a ViewBuilder is
    // never nil, which is why the "·" used to render unconditionally. stateLabel
    // is null while running — a ticking clock already says "tracking" — so
    // without this the card shows a dangling "MATH ·".
    private enum Trailing {
        case breakCountdown(Date)
        case breakOver
        case endsAt(Date)
        case word(String)
    }

    private var trailing: Trailing? {
        if state.isOnBreak, let ends = state.breakEndDate {
            // Past the end instant nothing has ended the break in the DB —
            // useBreakSchedule only runs with the app open — so say so rather
            // than showing a frozen 0:00.
            return ends > Date() ? .breakCountdown(ends) : .breakOver
        }
        if let target = state.targetEndMs, state.isRunning,
           target > Date().timeIntervalSince1970 * 1000 {
            return .endsAt(Date(timeIntervalSince1970: target / 1000))
        }
        if let label = state.stateLabel, !label.isEmpty {
            return .word(label.uppercased())
        }
        return nil
    }

    var body: some View {
        HStack(spacing: 5) {
            // The attribution is what truncates if the row ever runs out: a
            // clipped "TRACKIN" reads as a bug where "LINEAR ALGEBRA REV…" reads
            // as a long goal name.
            Text((state.attribution ?? "").uppercased())
                .lineLimit(1)
                .truncationMode(.tail)

            if let trailing {
                Text("·")
                view(for: trailing)
                    .lineLimit(1)
            }
        }
    }

    @ViewBuilder private func view(for trailing: Trailing) -> some View {
        switch trailing {
        case .breakCountdown(let ends):
            // The one thing still moving on a paused card, so it keeps the
            // primary ink while the rest of the line stays secondary.
            Text(timerInterval: Date()...ends, countsDown: true)
                .foregroundStyle(primaryInk)
        case .breakOver:
            Text("BREAK OVER")
        case .endsAt(let instant):
            Text("ENDS ") + Text(instant, style: .time)
        case .word(let word):
            Text(word)
        }
    }
}

@available(iOS 17.0, *)
private struct Buttons: View {
    let state: PrograActivityAttributes.ContentState
    // The Island's bottom region is always dark; the Lock Screen card adapts.
    var onDarkGround: Bool = false

    var body: some View {
        HStack(spacing: 8) {
            Link(destination: deepLink(state.secondaryPath) ?? fallback) {
                label(state.secondaryLabel ?? "Pause")
                    .background(
                        onDarkGround ? Color.white.opacity(0.14) : ghostFill,
                        in: Capsule()
                    )
                    .foregroundStyle(onDarkGround ? Color.white : primaryInk)
            }
            Link(destination: deepLink(state.endPath) ?? fallback) {
                // Inverts on navy: a white pill with navy type, because navy on
                // navy disappears. The ghost/solid pairing is preserved either
                // way, so the destructive action keeps its visual weight.
                label(state.endLabel ?? "Clock out")
                    .background(onDarkGround ? Color.white : primaryInk, in: Capsule())
                    .foregroundStyle(onDarkGround ? Color(uiColor: UIColor(rgb: 0x142C49)) : cardGround)
            }
        }
        .buttonStyle(.plain)
    }

    private func label(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13, weight: .semibold))
            // lineLimit before the greedy frame: the labels come from the
            // payload, and one long enough to wrap would grow the card's height
            // rather than truncate.
            .lineLimit(1)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
    }

    // Link requires a non-optional URL; the timer is the safe landing spot.
    private var fallback: URL {
        URL(string: "world.progra.app:///clock/live")!
    }
}

// MARK: - Lock Screen

@available(iOS 17.0, *)
private struct LockScreenCard: View {
    let state: PrograActivityAttributes.ContentState

    // THE TITLE GETS ITS OWN ROW. The clock shares row two with the sub-line.
    //
    // Nesting the title and the sub-line in one column beside the clock meant
    // both competed for the same ~171pt, and `GOAL · WRITING · TRACKING` is
    // almost exactly that line's 25-character budget — so both ellipsised. On
    // its own row the title gets the card's full ~305pt (~31 characters), and
    // the sub-line's 25 now hold `GOAL · WRITING` with room, because stateLabel
    // is null while running.
    //
    // It also settles a Dynamic Type mismatch: the title scales (.title3) while
    // the clock is pinned at 26pt, so sharing a row made the contest strictly
    // worse at accessibility sizes. Apart, the title simply truncates later and
    // the clock's row holds only fixed-metric items.
    //
    // The marker takes no height here, so it fills both rows on its own.
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // The marker spans the title and the sub-line — and ONLY those. The
            // rule and the buttons sit outside this HStack on purpose: a
            // height-less shape fills whatever height its row proposes, so with
            // them inside, the bar would run the full depth of the card and down
            // past the buttons.
            HStack(alignment: .top, spacing: 10) {
                Marker(state: state)

                VStack(alignment: .leading, spacing: 0) {
                    Text(state.label ?? "Session")
                        // The wordmark's treatment, not the serif. "Progra" is
                        // `font-semibold tracking-tight` with NO font-serif
                        // (components/dashboard.tsx:99), so it resolves to the
                        // sans — Hanken Grotesk on the web. A widget can't load
                        // a Google font (no file in the repo, and an extension
                        // needs it embedded + registered via UIAppFonts), so
                        // this is the system sans at the same weight and
                        // tracking. tracking-tight is -0.025em ≈ -0.5pt here.
                        //
                        // Same family as the sub-line below on purpose: the
                        // title and the goal name now read as one voice.
                        .font(.system(.title3).weight(.semibold))
                        .tracking(-0.5)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .foregroundStyle(primaryInk)
                        // Fills the column, so a long title can't widen it.
                        .frame(maxWidth: .infinity, alignment: .leading)

                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        SubLine(state: state)
                            .font(.system(size: 10, weight: .semibold))
                            .kerning(0.6)
                            .foregroundStyle(secondaryInk)

                        Spacer(minLength: 8)

                        ElapsedText(state: state)
                            .font(.system(size: 26, weight: .semibold, design: .rounded).monospacedDigit())
                            .foregroundStyle(digitsColor(state))
                            .lineLimit(1)
                            // Pinned and trailing-aligned. NOT .fixedSize(),
                            // which lets a timerInterval Text demand its
                            // unbounded ideal width and overflow the card, and
                            // NOT .minimumScaleFactor, which resolved the old
                            // squeeze by shrinking the digits so glyph size moved
                            // between states. See `clockWidth`.
                            .frame(width: clockWidth, alignment: .trailing)
                    }
                    .padding(.top, 2)
                }
            }

            // Full card width, not indented by the marker — the rule reads as
            // the card's own division, the way it did before.
            Rectangle()
                .fill(ruleColor)
                .frame(height: 1)
                .padding(.top, 11)
                .padding(.bottom, 10)

            Buttons(state: state)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
    }
}

// The extension's entry point. `@main` must appear exactly once in the target —
// which is why Xcode's generated PrograWidgetBundle.swift had to go.
@available(iOS 17.0, *)
@main
struct PrograWidgetBundle: WidgetBundle {
    var body: some Widget {
        PrograLiveActivityWidget()
    }
}
