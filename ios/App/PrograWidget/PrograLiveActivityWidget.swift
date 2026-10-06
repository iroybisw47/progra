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
                            .font(.system(.footnote, design: .serif).weight(.medium))
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
                    // Without a width the compact region clips H:MM:SS.
                    .frame(maxWidth: 58)
            } minimal: {
                Marker(state: context.state, height: 12, forceDark: true)
            }
            .widgetURL(deepLink(context.state.tapPath))
        }
    }
}

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
    let height: CGFloat
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

    var body: some View {
        HStack(spacing: 5) {
            Text((state.attribution ?? "").uppercased())
                .lineLimit(1)
            Text("·")
            trailing
        }
    }

    @ViewBuilder private var trailing: some View {
        if state.isOnBreak, let ends = state.breakEndDate {
            if ends > Date() {
                // The one thing still moving on a paused card, so it keeps the
                // primary ink while the rest of the line stays secondary.
                Text(timerInterval: Date()...ends, countsDown: true)
                    .foregroundStyle(primaryInk)
            } else {
                // Past this instant nothing has ended the break in the DB —
                // useBreakSchedule only runs with the app open — so say so
                // rather than showing a frozen 0:00.
                Text("BREAK OVER")
            }
        } else if let target = state.targetEndMs, state.isRunning,
                  target > Date().timeIntervalSince1970 * 1000 {
            Text("ENDS ")
                + Text(Date(timeIntervalSince1970: target / 1000), style: .time)
        } else {
            Text((state.stateLabel ?? "").uppercased())
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

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                Marker(state: state, height: 34)

                VStack(alignment: .leading, spacing: 3) {
                    Text(state.label ?? "Session")
                        .font(.system(.title3, design: .serif).weight(.medium))
                        .lineLimit(1)
                        .foregroundStyle(primaryInk)
                    SubLine(state: state)
                        .font(.system(size: 10, weight: .semibold))
                        .kerning(0.6)
                        .foregroundStyle(secondaryInk)
                }

                Spacer(minLength: 8)

                ElapsedText(state: state)
                    .font(.system(size: 26, weight: .semibold, design: .rounded).monospacedDigit())
                    .foregroundStyle(digitsColor(state))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }

            // The app's hairline, at the app's weight.
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
