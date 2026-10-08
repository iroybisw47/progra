// PrograSessionWidget.swift
// Reference implementation of the Progra "Current session" home screen widget (variant 1b).
// A starting point only: adapt the App Group ID, URL scheme, font names and session service to the codebase.
// Requires iOS 17+.

import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Shared model (compile into BOTH the app and the widget extension)

struct ActiveSession: Codable, Equatable {
    var id: String
    var title: String
    var goalName: String
    var goalColorHex: String              // e.g. "A98BF5", the goal's color in the app
    var segmentStartedAt: Date            // when the current running segment began
    var accumulatedSeconds: TimeInterval  // time banked before the current segment
    var isPaused: Bool

    /// Start date that makes `Text(timerInterval:)` show the total elapsed time while running.
    var effectiveStart: Date { segmentStartedAt.addingTimeInterval(-accumulatedSeconds) }
}

enum SharedSessionStore {
    static let appGroupID = "group.com.progra.app" // TODO: use the app's real App Group
    private static let key = "activeSession"
    private static var defaults: UserDefaults? { UserDefaults(suiteName: appGroupID) }

    static func load() -> ActiveSession? {
        guard let data = defaults?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(ActiveSession.self, from: data)
    }

    /// Call from the app on every session change, and from the widget intent.
    static func save(_ session: ActiveSession?) {
        if let session, let data = try? JSONEncoder().encode(session) {
            defaults?.set(data, forKey: key)
        } else {
            defaults?.removeObject(forKey: key)
        }
        WidgetCenter.shared.reloadTimelines(ofKind: PrograSessionWidget.kind)
    }
}

enum PrograLinks {
    static func clockOut(_ sessionID: String) -> URL { URL(string: "progra://session/clock-out?id=\(sessionID)")! }
    static let currentSession = URL(string: "progra://session/current")!
}

// MARK: - Intents

struct TogglePauseIntent: AppIntent {
    static var title: LocalizedStringResource = "Pause or Resume Session"
    static var isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        guard var session = SharedSessionStore.load() else { return .result() }
        let now = Date()
        if session.isPaused {
            session.segmentStartedAt = now
            session.isPaused = false
        } else {
            session.accumulatedSeconds += now.timeIntervalSince(session.segmentStartedAt)
            session.isPaused = true
        }
        SharedSessionStore.save(session)
        // TODO: route through the app's session service / backend so the pause syncs.
        return .result()
    }
}

// MARK: - Tokens

enum WidgetTokens {
    static let navy = Color(hex: 0x1C3A5E)
    static let pausedTime = Color(hex: 0x8FA3BC)
    static let secondaryButtonFill = Color.white.opacity(0.14)
    static let chipFillOpacity = 0.28
    static let chipTextTowardWhite = 0.65
    static let paddingVertical: CGFloat = 16
    static let paddingHorizontal: CGFloat = 14
    /// Width of "0:00:00" in Newsreader Medium 48 pt. Measure once the font is installed.
    static let timeWidth: CGFloat = 150 // TODO: measure
}

enum WidgetFonts {
    // PostScript names: confirm with UIFont.fontNames(forFamilyName:) after adding the files.
    static func hanken(_ size: CGFloat) -> Font { .custom("HankenGrotesk-SemiBold", fixedSize: size) }
    static func time(_ size: CGFloat) -> Font { .custom("Newsreader-Medium", fixedSize: size) }
}

extension Color {
    init(hex: UInt32) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: 1)
    }

    init(hexString: String) {
        self.init(hex: Color.parse(hexString))
    }

    /// Blend a hex color toward white (0 = unchanged, 1 = white). Used for the goal chip text.
    static func tint(_ hexString: String, towardWhite amount: Double) -> Color {
        let v = parse(hexString)
        func channel(_ shift: UInt32) -> Double {
            let c = Double((v >> shift) & 0xFF) / 255
            return c + (1 - c) * amount
        }
        return Color(.sRGB, red: channel(16), green: channel(8), blue: channel(0), opacity: 1)
    }

    private static func parse(_ hexString: String) -> UInt32 {
        UInt32(hexString.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0xA98BF5
    }
}

// MARK: - Timeline

struct SessionEntry: TimelineEntry {
    let date: Date
    let session: ActiveSession?
}

struct SessionProvider: TimelineProvider {
    func placeholder(in context: Context) -> SessionEntry {
        SessionEntry(date: .now, session: .preview)
    }

    func getSnapshot(in context: Context, completion: @escaping (SessionEntry) -> Void) {
        completion(SessionEntry(date: .now, session: SharedSessionStore.load() ?? .preview))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SessionEntry>) -> Void) {
        let now = Date()
        let session = SharedSessionStore.load()
        var entries = [SessionEntry(date: now, session: session)]
        // Progra auto clocks out at 10 h, so leave the session state at that moment.
        if let session, !session.isPaused {
            let limit = session.effectiveStart.addingTimeInterval(10 * 60 * 60)
            if limit > now { entries.append(SessionEntry(date: limit, session: nil)) }
        }
        completion(Timeline(entries: entries, policy: .never))
    }
}

// MARK: - Views

struct PrograSessionWidgetView: View {
    let entry: SessionEntry

    var body: some View {
        if let session = entry.session {
            ActiveSessionView(session: session, now: entry.date)
                .widgetURL(PrograLinks.currentSession)
        } else {
            // TODO: the no-active-session state is not designed yet. Confirm with design.
            Text("Not clocked in")
                .font(WidgetFonts.hanken(17))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(.vertical, WidgetTokens.paddingVertical)
                .padding(.horizontal, WidgetTokens.paddingHorizontal)
        }
    }
}

struct ActiveSessionView: View {
    let session: ActiveSession
    let now: Date

    private var goal: Color { Color(hexString: session.goalColorHex) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(goal)
                    .frame(width: 4)
                    .widgetAccentable()

                VStack(alignment: .leading, spacing: 6) {
                    goalChip
                    HStack(alignment: .lastTextBaseline, spacing: 10) {
                        Text(session.title)
                            .font(WidgetFonts.hanken(17))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .truncationMode(.tail)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        timeText
                    }
                }
            }
            .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 8)

            HStack(spacing: 8) {
                pauseButton
                clockOutButton
            }
        }
        .padding(.vertical, WidgetTokens.paddingVertical)
        .padding(.horizontal, WidgetTokens.paddingHorizontal)
    }

    private var goalChip: some View {
        Text("Goal · \(session.goalName)")
            .font(WidgetFonts.hanken(12.5))
            .foregroundStyle(Color.tint(session.goalColorHex, towardWhite: WidgetTokens.chipTextTowardWhite))
            .lineLimit(1)
            .padding(.vertical, 4)
            .padding(.horizontal, 11)
            .background(goal.opacity(WidgetTokens.chipFillOpacity), in: Capsule())
    }

    private var timeText: some View {
        // Paused: freeze at the banked time using pauseTime, so both states share the system format.
        let start = session.isPaused ? now.addingTimeInterval(-session.accumulatedSeconds) : session.effectiveStart
        return Text(timerInterval: start...Date.distantFuture,
                    pauseTime: session.isPaused ? now : nil,
                    countsDown: false)
            .font(WidgetFonts.time(48))
            .monospacedDigit()
            .tracking(-0.48)
            .lineLimit(1)
            .multilineTextAlignment(.trailing)
            .foregroundStyle(session.isPaused ? WidgetTokens.pausedTime : goal)
            .frame(width: WidgetTokens.timeWidth, alignment: .trailing)
            .widgetAccentable()
    }

    private var pauseButton: some View {
        Button(intent: TogglePauseIntent()) {
            HStack(spacing: 8) {
                Image(systemName: session.isPaused ? "play.fill" : "pause.fill")
                    .font(.system(size: 13, weight: .bold))
                Text(session.isPaused ? "Resume" : "Pause")
                    .font(WidgetFonts.hanken(16))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(WidgetTokens.secondaryButtonFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var clockOutButton: some View {
        Link(destination: PrograLinks.clockOut(session.id)) {
            HStack(spacing: 8) {
                Image(systemName: "stop.fill")
                    .font(.system(size: 11, weight: .bold))
                Text("Clock out")
                    .font(WidgetFonts.hanken(16))
            }
            .foregroundStyle(WidgetTokens.navy)
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }
}

// MARK: - Widget

struct PrograSessionWidget: Widget {
    static let kind = "PrograSessionWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: SessionProvider()) { entry in
            PrograSessionWidgetView(entry: entry)
                .containerBackground(WidgetTokens.navy, for: .widget)
        }
        .configurationDisplayName("Current session")
        .description("Shows the session you're clocked in on, with pause and clock out.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

// If the extension already has a WidgetBundle, add PrograSessionWidget() to it instead.
@main
struct PrograWidgetsBundle: WidgetBundle {
    var body: some Widget {
        PrograSessionWidget()
    }
}

// MARK: - Previews

extension ActiveSession {
    static let preview = ActiveSession(
        id: "preview",
        title: "Thesis — chapter 3 redraft",
        goalName: "Thesis",
        goalColorHex: "A98BF5",
        segmentStartedAt: Date().addingTimeInterval(-5047), // 1:24:07
        accumulatedSeconds: 0,
        isPaused: false
    )

    static let previewPaused: ActiveSession = {
        var s = ActiveSession.preview
        s.accumulatedSeconds = 5047
        s.isPaused = true
        return s
    }()

    static let previewLongTitle: ActiveSession = {
        var s = ActiveSession.preview
        s.title = "Thesis — chapter 3 redraft, literature review and figure cleanup"
        return s
    }()
}

#Preview(as: .systemMedium) {
    PrograSessionWidget()
} timeline: {
    SessionEntry(date: .now, session: .preview)
    SessionEntry(date: .now, session: .previewPaused)
    SessionEntry(date: .now, session: .previewLongTitle)
}

// MARK: - App-side integration (sketch: lives in the app target)
//
// 1. Whenever the session changes (clock in, pause, resume, clock out, auto clock-out):
//      SharedSessionStore.save(ActiveSession(...))   // or save(nil) when no session is active
//
// 2. When the app becomes active, pick up pause/resume done from the widget:
//      .onChange(of: scenePhase) { _, phase in
//          if phase == .active { sessionService.reconcile(with: SharedSessionStore.load()) }
//      }
//
// 3. Deep links:
//      .onOpenURL { url in
//          guard url.scheme == "progra", url.host == "session" else { return }
//          switch url.path {
//          case "/clock-out": sessionService.clockOut(); router.show(.finishAndPost)
//          case "/current":   router.show(.runningSession)
//          default: break
//          }
//      }
