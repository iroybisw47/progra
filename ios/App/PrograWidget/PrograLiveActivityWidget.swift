import ActivityKit
import SwiftUI
import WidgetKit

// The card itself. WIDGET EXTENSION TARGET ONLY.
//
// Phase 1 is READ-ONLY: the whole card is a tap target that deep-links to
// /clock/live. Phase 2 swaps the bottom row for Button(intent:) controls, which
// is why the payload already carries secondaryAction/secondaryLabel/endLabel —
// adding them later would be the breaking ContentState change.
//
// THE TIMER NEVER NEEDS AN UPDATE. Text(timerInterval:) is rendered by the system
// and ticks on its own, so a running session's card costs exactly ZERO updates
// after the one that started it. That is the whole reason lib/live-activity.ts
// computes an anchor (startedAt + pausedMs) rather than an elapsed number: an
// elapsed number would need a push per second.
//
// Colours are hardcoded navy/ink here rather than passed in the payload. A
// category colour would be a second axis of native layout for zero function, and
// Lock Screen cards render on an unpredictable background.
@available(iOS 17.0, *)
struct PrograLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PrograActivityAttributes.self) { context in
            LockScreenCard(state: context.state)
                .widgetURL(deepLink(context.state.tapPath))
                // Matches the app's flat-white surface.
                .activityBackgroundTint(Color.white)
                .activitySystemActionForegroundColor(brand)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: icon(context.state))
                        .foregroundStyle(brand)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ElapsedText(state: context.state)
                        .font(.system(.title3, design: .rounded).monospacedDigit())
                        .foregroundStyle(brand)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.label ?? "Session")
                        .font(.caption)
                        .lineLimit(1)
                        .foregroundStyle(.secondary)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    SubLine(state: context.state)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                Image(systemName: icon(context.state)).foregroundStyle(brand)
            } compactTrailing: {
                ElapsedText(state: context.state)
                    .font(.system(.caption2, design: .rounded).monospacedDigit())
                    .foregroundStyle(brand)
                    // Without this the compact region clips a H:MM:SS string.
                    .frame(maxWidth: 58)
            } minimal: {
                Image(systemName: icon(context.state)).foregroundStyle(brand)
            }
            .widgetURL(deepLink(context.state.tapPath))
        }
    }
}

private let brand = Color(red: 0.11, green: 0.23, blue: 0.37)

@available(iOS 17.0, *)
private func icon(_ state: PrograActivityAttributes.ContentState) -> String {
    if state.isOnBreak { return "cup.and.saucer.fill" }
    return state.isRunning ? "stopwatch.fill" : "pause.circle.fill"
}

// Paths come from the payload so they stay JS-shippable. The scheme matches
// CFBundleURLSchemes in the app's Info.plist, and components/deep-link-router.tsx
// is what turns the open into a navigation — Capacitor itself navigates nothing.
@available(iOS 17.0, *)
private func deepLink(_ path: String?) -> URL? {
    URL(string: "world.progra.app://\(path ?? "/clock/live")")
}

// The elapsed clock. Counting UP from the anchor while running; a frozen constant
// while paused, because worked time genuinely isn't advancing.
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

@available(iOS 17.0, *)
private struct SubLine: View {
    let state: PrograActivityAttributes.ContentState

    var body: some View {
        if state.isOnBreak, let ends = state.breakEndDate {
            if ends > Date() {
                // Counts down to the break's end. Past it, nothing in the DB has
                // ended the break (useBreakSchedule only runs with the app open),
                // so the copy says so rather than showing a frozen 0:00.
                Text("Break · ") + Text(timerInterval: Date()...ends, countsDown: true)
            } else {
                Text("Break over — tap to resume")
            }
        } else if !state.isRunning {
            Text("Paused")
        } else if let target = state.targetEndMs,
                  target > Date().timeIntervalSince1970 * 1000 {
            Text("Ends ") + Text(Date(timeIntervalSince1970: target / 1000), style: .time)
        } else {
            Text("Tracking")
        }
    }
}

@available(iOS 17.0, *)
private struct LockScreenCard: View {
    let state: PrograActivityAttributes.ContentState

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: icon(state))
                .font(.title3)
                .foregroundStyle(brand)

            VStack(alignment: .leading, spacing: 2) {
                Text(state.label ?? "Session")
                    .font(.system(.subheadline, design: .serif).weight(.medium))
                    .lineLimit(1)
                    .foregroundStyle(brand)
                SubLine(state: state)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            ElapsedText(state: state)
                .font(.system(.title2, design: .rounded).weight(.semibold).monospacedDigit())
                .foregroundStyle(brand)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

// The extension's entry point. One widget; `@main` must appear exactly once in
// the target — which is why Xcode's generated PrograWidgetBundle.swift has to go.
@available(iOS 17.0, *)
@main
struct PrograWidgetBundle: WidgetBundle {
    var body: some Widget {
        PrograLiveActivityWidget()
    }
}
