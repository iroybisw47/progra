import AppKit
import CoreText
import SwiftUI

// Headless render harness for the Live Activity's Lock Screen card.
//
// Compiles the REAL SwiftUI view and writes a PNG, so layout can be SEEN rather
// than inferred. `swiftc -typecheck` proves the types and nothing about the
// pixels, and AGENTS.md records three layout bugs that reached a device because
// nothing here did. It has already earned itself once: the two `Link` buttons
// rendered as a flat yellow fill with a missing-glyph symbol and no label,
// because the HStack was missing `.buttonStyle(.plain)`.
//
// Run from the repo root:
//
//     export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
//     xcrun swiftc -o /tmp/render-card \
//       ios/App/PrograWidget/PrograCardView.swift \
//       scripts/render-widget/main.swift -target arm64-apple-macos14.0
//     /tmp/render-card                       # writes live-activity-card.png
//
// DEVELOPER_DIR is load-bearing, for the same reason the type-check recipe in
// AGENTS.md needs it: `xcode-select -p` points at the Command Line Tools, which
// ship no usable SDK.
//
// It compiles THE REAL CARD — PrograCardView.swift — not a copy. That file
// imports SwiftUI alone precisely so this is possible; ActivityKit is iOS-only,
// so PrograLiveActivityWidget.swift (which also declares the target's `@main`)
// cannot build as a plain macOS binary and is left out. Keep PrograCardView.swift
// free of ActivityKit/WidgetKit imports or this stops working and the renders
// start lying.
//
// WHAT IT CANNOT PROVE: this is AppKit rendering SwiftUI on macOS. Fonts,
// metrics, wrapping and colour are real; the system's Live Activity chrome,
// corner radius, press feedback and the Dynamic Island are not. A pixel claim
// about those still needs a device.

let fontDir = "ios/App/PrograWidget"
for name in ["HankenGrotesk-SemiBold.ttf", "Newsreader48pt-Medium.ttf"] {
    var err: Unmanaged<CFError>?
    if !CTFontManagerRegisterFontsForURL(
        URL(fileURLWithPath: "\(fontDir)/\(name)") as CFURL, .process, &err) {
        FileHandle.standardError.write("FAILED to register \(name)\n".data(using: .utf8)!)
        exit(1)
    }
}


// Sample payloads, mapped the way PrograActivityAttributes.ContentState.card
// maps the real ones. The colours are the PALETTE's, lifted by entityOnDark and
// entityChipInk — not the handoff's #A98BF5, which is not a hue Progra can
// store (normalizeFill doesn't recognise it, so it would fall back to grey).
extension PrograCardModel {
    static func sample(
        label: String = "Thesis — chapter 3 redraft",
        attribution: String = "Thesis",
        onDark: String? = "#cbbbd5",
        ink: String? = "#dfd5e5",
        fill: String? = "#A084B3",
        elapsed: TimeInterval = 5047,
        running: Bool = true,
        onBreak: Bool = false
    ) -> PrograCardModel {
        let anchor = Date().addingTimeInterval(-elapsed)
        return PrograCardModel(
            label: label,
            attribution: attribution,
            chipInk: Color(hexString: ink),
            chipFill: Color(hexString: fill),
            accentOnDark: Color(hexString: onDark),
            isRunning: running,
            isOnBreak: onBreak,
            anchor: anchor,
            // Frozen exactly where the running card reads, so the two states
            // are comparable side by side.
            pauseDisplay: running ? nil : Date(),
            // One second short of the 10-hour cap — see clockWidth.
            rangeEnd: anchor.addingTimeInterval(10 * 60 * 60 - 1),
            stateLabel: running ? nil : (onBreak ? "On a break" : "Paused"),
            breakEnd: onBreak ? Date().addingTimeInterval(272) : nil,
            targetEnd: nil,
            secondaryLabel: onBreak ? "End break" : (running ? "Pause" : "Resume"),
            secondaryPath: "/clock/live?la=pause",
            endLabel: "Clock out",
            endPath: "/clock/live?la=end"
        )
    }

    static var preview: PrograCardModel { sample() }
    static var previewPaused: PrograCardModel { sample(running: false) }
    static var previewLong: PrograCardModel {
        sample(label: "Thesis — chapter 3 redraft, literature review and figure cleanup")
    }
    static var previewCategory: PrograCardModel {
        sample(label: "Inbox zero", attribution: "Writing",
               onDark: "#b4d7e0", ink: "#d1e7ec", fill: "#77B7C6")
    }
    static var previewShort: PrograCardModel { sample(elapsed: 1447) }
    static var previewBreak: PrograCardModel {
        sample(running: false, onBreak: true)
    }
    static var previewNoColour: PrograCardModel {
        sample(label: "Reading", attribution: "Uncategorized",
               onDark: nil, ink: nil, fill: nil)
    }
}

struct Sheet: View {
    // A Lock Screen Live Activity is about the screen width less its margins.
    let width: CGFloat = 360
    let cases: [(String, PrograCardModel)] = [
        ("Running", .preview),
        ("Paused", .previewPaused),
        ("Long name — wraps to 2 lines", .previewLong),
        ("Category", .previewCategory),
        ("Under an hour", .previewShort),
        ("On a break", .previewBreak),
        ("No colour (uncategorised)", .previewNoColour),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(Array(cases.enumerated()), id: \.offset) { _, c in
                VStack(alignment: .leading, spacing: 5) {
                    Text(c.0)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.black)
                    ZStack {
                        LockScreenCard(model: c.1)
                        // Marks the 16/14 content box, so "the clock lands on
                        // the same trailing edge as the buttons" is visible
                        // rather than asserted.
                        Rectangle()
                            .strokeBorder(Color.red.opacity(0.5), lineWidth: 0.5)
                            .padding(.vertical, 16)
                            .padding(.horizontal, 14)
                    }
                    .frame(width: width)
                    .background(navy)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .overlay(alignment: .trailing) {
                        HeightReadout()
                    }
                }
            }
        }
        .padding(22)
        .background(Color.white)
    }
}

// Prints the card's resolved height into the render, since staying near 160pt
// is the constraint the descent reclaim exists to satisfy.
struct HeightReadout: View {
    var body: some View {
        GeometryReader { geo in
            Text("\(Int(geo.size.height))pt")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.black)
                .offset(x: 6, y: geo.size.height / 2 - 6)
        }
        .frame(width: 0)
    }
}

MainActor.assumeIsolated {
    let r = ImageRenderer(content: Sheet())
    r.scale = 2
    guard let img = r.nsImage, let tiff = img.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else {
        FileHandle.standardError.write("render failed\n".data(using: .utf8)!)
        exit(1)
    }
    try! png.write(to: URL(fileURLWithPath: "live-activity-card.png"))
    print("wrote live-activity-card.png")
}
