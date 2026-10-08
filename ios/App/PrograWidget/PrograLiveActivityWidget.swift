import ActivityKit
import SwiftUI
import WidgetKit

// The Live Activity. WIDGET EXTENSION TARGET ONLY.
//
// Thin on purpose: the ActivityKit plumbing and the Dynamic Island live here,
// and every bit of the Lock Screen card's LAYOUT lives in PrograCardView.swift,
// which imports SwiftUI alone. That split is what lets the headless render
// harness compile the real card on macOS — ActivityKit is iOS-only, so a card
// that imported it could only ever be photographed by hand-copying it.
//
// Restyled 2026-10-07 to design_handoff_progra_widget (variant 1b: the clock is
// drawn in the goal's colour). The handoff was drawn for a `.systemMedium` home
// screen widget and is applied HERE instead, because a home screen widget
// cannot hide itself when there is no session — iOS gives no API to retract a
// placed widget, so it would need an undesigned empty state for the ~22 hours a
// day nobody is clocked in. A Live Activity appears on clock-in and disappears
// on clock-out, which is the lifecycle the design already assumes.
//
// WHAT CHANGED FROM THE EDITORIAL CARD THIS REPLACES:
//
//   * ALWAYS NAVY. The previous card adapted — flat white in light appearance,
//     #142c49 in dark — and that is gone, because the handoff specifies one
//     ground in both. `accentInk` (the palette colour darkened for type on
//     white) therefore has no reader left on this surface. It stays in the
//     payload: removing a field strands an activity an older binary started,
//     which the Optional contract in PrograActivityAttributes.swift prevents.
//   * REAL FONTS. The old card's title comment said a widget "can't load a
//     Google font (no file in the repo, and an extension needs it embedded +
//     registered via UIAppFonts)". Both are now done — see WidgetFonts.
//   * NO HAIRLINE RULE, NO SUB-LINE ON THE LOCK SCREEN. The handoff's layout is
//     a goal chip, the session name, the clock and two buttons; there is no
//     slot for the break countdown or a timed session's "ENDS 17:30". Both
//     survive in the Dynamic Island's expanded region below, which still has a
//     sub-line and the room for it. Nothing else is lost: `staleLabel` was
//     already in the payload and already rendered nowhere.
//
// THE TIMER NEVER NEEDS AN UPDATE. Text(timerInterval:) is rendered by the
// system and ticks on its own, so a running session's card costs exactly ZERO
// updates after the one that started it. That is why lib/live-activity.ts
// computes an anchor (startedAt + pausedMs) rather than an elapsed number.
@available(iOS 17.0, *)
struct PrograLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PrograActivityAttributes.self) { context in
            LockScreenCard(model: context.state.card)
                // One ground in both appearances now, so a flat colour rather
                // than the dynamic UIColor the adaptive card needed.
                .activityBackgroundTint(navy)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            // DELIBERATELY NOT RESTYLED. The handoff designs one card and says
            // nothing about the Island, which is a different shape with its own
            // constraints — so it keeps the layout and the measured metrics it
            // already had. It does take the bundled sans for its text, which is
            // what the old comments wanted and couldn't have.
            let m = context.state.card
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 7) {
                        Marker(model: m, width: 3, height: 18)
                        Text(m.label)
                            .font(WidgetFonts.hanken(13))
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    // Stays the SYSTEM rounded face: the widths below are
                    // measured for it, and a 48pt optical cut rendered at 20pt
                    // would be drawn at the wrong optical size.
                    ElapsedText(model: m)
                        .font(.system(.title3, design: .rounded).weight(.semibold).monospacedDigit())
                        .foregroundStyle(sessionAccent(m))
                        .lineLimit(1)
                        .frame(width: islandClockWidth, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(m.attribution.uppercased())
                        .font(WidgetFonts.hanken(10))
                        .kerning(0.6)
                        .lineLimit(1)
                        .foregroundStyle(.secondary)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 8) {
                        // Where the break countdown and "ENDS 17:30" live on.
                        SubLine(model: m)
                            .font(WidgetFonts.hanken(10))
                            .kerning(0.6)
                            .foregroundStyle(.secondary)
                        Buttons(model: m)
                    }
                }
            } compactLeading: {
                Marker(model: m, width: 3, height: 12)
            } compactTrailing: {
                ElapsedText(model: m)
                    .font(.system(.caption2, design: .rounded).monospacedDigit())
                    .foregroundStyle(sessionAccent(m))
                    .lineLimit(1)
                    .frame(width: islandCompactClockWidth, alignment: .trailing)
            } minimal: {
                Marker(model: m, width: 3, height: 12)
            }
            .widgetURL(URL(string: "world.progra.app://\(context.state.tapPath ?? "/clock/live")"))
        }
    }
}

// Dynamic Island clock widths, in the SYSTEM rounded face they are drawn in and
// re-measured for the seven-character range the card's `rangeEnd` now caps it
// to: "9:59:59" is 76.45pt at 20pt semibold and 42.74pt at 11pt, with
// monospaced numbers. (They were 90 and 52, sized for the "10:00:00" the range
// used to be able to produce — leaving slack, which makes a timer Text centre
// its glyphs rather than hug the trailing edge.)
private let islandClockWidth: CGFloat = 77
private let islandCompactClockWidth: CGFloat = 43

// MARK: - Payload -> layout

@available(iOS 17.0, *)
extension PrograActivityAttributes.ContentState {
    /// The one place the wire format meets the layout.
    ///
    /// Every field in the payload is Optional by the compatibility contract, so
    /// the defaults here are the whole fallback story: a payload from a newer
    /// deploy that this binary half-understands still renders a sane card
    /// rather than an empty one.
    var card: PrograCardModel {
        PrograCardModel(
            label: label ?? "Session",
            attribution: attribution ?? "",
            chipInk: Color(hexString: chipInk),
            chipFill: Color(hexString: accentColor),
            accentOnDark: Color(hexString: accentOnDark),
            isRunning: isRunning,
            isOnBreak: isOnBreak,
            anchor: anchorDate,
            pauseDisplay: pauseDisplayDate,
            rangeEnd: timerRangeEnd,
            stateLabel: stateLabel,
            breakEnd: breakEndDate,
            targetEnd: Self.date(targetEndMs),
            secondaryLabel: secondaryLabel ?? "Pause",
            secondaryPath: secondaryPath,
            endLabel: endLabel ?? "Clock out",
            endPath: endPath
        )
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
