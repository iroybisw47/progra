# Handoff: Progra home screen widget ("Current session")

## Overview
An iOS home screen widget that shows the session the user is clocked in on: its goal, its name and the live elapsed time, with **Pause / Resume** and **Clock out** controls. The chosen variant is **1b: the time is drawn in the goal's color**.

## About the design files
The files in `design/` are **design references built in HTML**. They are prototypes that show the intended look and behaviour, not production code. iOS widgets have to be native, so the task is to **rebuild this design with WidgetKit and SwiftUI** inside the Progra app's existing project, following its established patterns.

`reference/PrograSessionWidget.swift` is a starting point that matches this spec. It has not been compiled against the Progra codebase. Adapt names, the App Group ID, the URL scheme and the session service to what exists.

## Fidelity
**High fidelity.** Colors, typography, spacing and copy are final. 1 CSS px in the mock = 1 pt on device.

## Platform
- iOS 17+. Interactive buttons need App Intents, and iOS 17 requires `containerBackground`.
- Widget family: **`.systemMedium` only**.
- The design frame is **364 × 170 pt**, the medium widget size on Plus and Pro Max iPhones. On 6.1" iPhones the medium widget is 338 × 158 pt. The layout is the same and only the width shrinks.
- Same colors in light and dark mode. The widget is always navy.

---

## Layout (systemMedium)

```
┌──────────────────────────────────────────────────┐  ← navy #1C3A5E
│ ▌ (Goal · Thesis)                                │
│ ▌ Thesis — chapter 3                             │
│ ▌ redraft                            1:24:07     │  ← time baseline = name's last baseline
│                                                  │
│ [ ❚❚  Pause            ] [ ■  Clock out        ] │
└──────────────────────────────────────────────────┘
```

- **Content margins:** turn off the system margins (`.contentMarginsDisabled()`) and pad the content **16 pt top/bottom and 14 pt leading/trailing**.
- **Vertical structure:** top block → flexible space (min 8 pt) → button row pinned to the bottom.
- **Corner radius:** the system draws the widget corners. Don't draw your own.

### Top block
An HStack, top-aligned, with 10 pt spacing:
1. **Goal bar:** 4 pt wide, corner radius 2 (continuous), filled with the goal color. It runs from the top of the chip to the bottom of the session name. Use `.fixedSize(horizontal: false, vertical: true)` on the HStack so the bar matches the text height.
2. **Text column:** a leading-aligned VStack with 6 pt spacing.
   - **Goal chip:** see Components.
   - **Name + time row:** an HStack aligned on `.lastTextBaseline` with 10 pt spacing. The session name fills the width (leading) and the time sits at the trailing edge. The time's baseline lines up with the **last line** of the name. The HTML gets this with `margin-bottom:-9px`; SwiftUI's `.lastTextBaseline` alignment does it natively.

### Button row
An HStack with 8 pt spacing and **two equal-width buttons** (`maxWidth: .infinity`). Each is **40 pt tall** with a **12 pt continuous corner radius**. Icon and label are centered with 8 pt between them.

---

## Components

| Element | Spec |
|---|---|
| Widget background | `#1C3A5E` via `.containerBackground(…, for: .widget)` |
| Goal bar | 4 × (text height) pt, radius 2, goal color (`#A98BF5` for Thesis) |
| Goal chip text | `Goal · {goalName}`. Hanken Grotesk SemiBold 12.5 pt, line height 16. Color `#E2D8FF` (the goal color blended about 65% toward white). Single line. |
| Goal chip shape | Capsule. Fill = goal color at **28%** opacity. Padding 4 pt vertical, 11 pt horizontal. |
| Session name | Hanken Grotesk SemiBold 17 pt (20 pt line height in the mock). `#FFFFFF`. Wraps with a max of **2 lines** in SwiftUI and a tail ellipsis. The mock allows 3 lines at a 20 pt line height. SwiftUI uses the font's natural line height, so only allow 3 if previews show it fits the 170 pt height. |
| Time (running) | Newsreader **Medium 48 pt**, tracking −0.48 pt (−1%), **tabular lining figures** (`.monospacedDigit()`). Color = **goal color** `#A98BF5`. Single line, trailing. |
| Time (paused) | Same style, color `#8FA3BC`. |
| Pause / Resume button | Fill: white at **14%** opacity. Content `#FFFFFF`. Icon: SF Symbol `pause.fill` when running, `play.fill` when paused, 13 pt bold. Label `Pause` / `Resume`, Hanken Grotesk SemiBold 16 pt. |
| Clock out button | Fill `#FFFFFF`. Content navy `#1C3A5E`. Icon: SF Symbol `stop.fill`, 11 pt bold. Label `Clock out`, Hanken Grotesk SemiBold 16 pt. |
| Pressed state | The system's default widget press feedback. The mock dims to 75% opacity. |

Copy is exact: `Goal · Thesis` (the middle dot is U+00B7), `Pause`, `Resume`, `Clock out`. The sample session name is `Thesis — chapter 3 redraft`, with an em dash.

---

## States
- **Running:** the time ticks every second, drawn in the goal color. The left button shows the pause icon and **Pause**.
- **Paused:** the time is frozen and grey (`#8FA3BC`). The left button shows the play icon and **Resume**. Nothing else changes.
- **Long name:** wraps to 2 lines, then ends with an ellipsis. The time stays baseline-aligned to the last visible line.
- **10-hour limit:** Progra auto clocks out at 10 h, so the timer never shows more than `9:59:59`. The timeline schedules an entry at the 10 h mark that drops the widget out of the session state.
- **No active session:** ⚠️ **Not designed yet.** The reference code has a plain placeholder marked `TODO`. Ask design before shipping it.

## Interactions & behaviour
- **Pause** runs `TogglePauseIntent` through `Button(intent:)`. It banks the elapsed time, marks the session paused, saves it and reloads the widget.
- **Resume** runs the same intent. It starts a new running segment.
- **Clock out** is a `Link` to `progra://session/clock-out?id={sessionId}`. The app ends the session and opens the **Finish & Post ("Session complete")** screen. A link opens the app reliably, which this step needs anyway.
- **Tapping anywhere else** follows `widgetURL` `progra://session/current` and opens the app on the running session.
- **Timer:** use `Text(timerInterval:pauseTime:countsDown:false)`. The system ticks it with no timeline reloads. For the paused state, pass `pauseTime` so both states use the same format. The system format is **H:MM:SS at one hour or more** (`1:24:07`) and **M:SS under an hour** (`24:07`).
- **Timer width:** in widgets a timer `Text` can reserve more width than it shows. Give it a fixed trailing frame sized to `0:00:00` in Newsreader Medium 48 pt, measured once the font is installed. The 10 h cap keeps the string at 7 characters at most.

## State management and data flow
- **The shared model** (`ActiveSession`) is compiled into both targets: `id`, `title`, `goalName`, `goalColorHex`, `segmentStartedAt`, `accumulatedSeconds`, `isPaused`.
  - Elapsed time = `accumulatedSeconds` while paused, otherwise `accumulatedSeconds + (now − segmentStartedAt)`.
  - The timer start date is `segmentStartedAt − accumulatedSeconds`.
- **Storage:** JSON in `UserDefaults(suiteName: <App Group>)` under `activeSession`. A nil value means no active session.
- **The app writes** the model on every change: clock in, pause, resume, clock out and auto clock-out. Then it calls `WidgetCenter.shared.reloadTimelines(ofKind: "PrograSessionWidget")`.
- **The widget writes** the model when the user taps Pause or Resume (inside the intent).
- **Reconciling:** when the app becomes active, it reads the shared model and applies any pause or resume done from the widget to its own session service, and to the backend if sessions sync. If the app has a server-side source of truth, the intent should call the same API.
- **Timeline policy:** `.never`. The app and the intent trigger reloads, plus the one extra entry at the 10 h mark.

## Design tokens
**Colors**
- Navy (background, Clock out text): `#1C3A5E`
- Goal color (per goal, from app data). Thesis: `#A98BF5`
- Goal chip fill: goal color at 28%
- Goal chip text: `#E2D8FF`, or the goal color blended 65% toward white for other goals
- Session name: `#FFFFFF`
- Time running: goal color. Time paused: `#8FA3BC`
- Secondary button fill: `#FFFFFF` at 14%
- Primary button fill: `#FFFFFF`

**Typography**
- Hanken Grotesk SemiBold: 12.5 (chip) · 16 (buttons) · 17 (name)
- Newsreader Medium: 48 (time), tabular lining figures, −1% tracking

**Spacing:** padding 16 / 14 · bar → text 10 · chip → name 6 · name → time ≥ 10 · min gap above buttons 8 · button gap 8 · icon → label 8

**Radii:** buttons 12 (continuous) · chip capsule · goal bar 2 · widget corners drawn by the system

## Assets
- **Fonts** (SIL Open Font License, from Google Fonts):
  - **Hanken Grotesk** SemiBold, static TTF.
  - **Newsreader** Medium. Use a display optical-size cut (the 36 pt or 60 pt static instance) or the variable font.
  - Add both to the **widget extension** target and list them under `UIAppFonts` in the extension's Info.plist. Then check the PostScript names by printing `UIFont.fontNames(forFamilyName:)` and update `WidgetFonts` to match.
- **Icons:** SF Symbols `pause.fill`, `play.fill` and `stop.fill`. The mock draws them in CSS at these sizes: bars 3.5 × 14, triangle 11 × 14, square 12 × 12 with radius 3.
- **No images.**

## Non-native apps
If Progra is built in React Native, Expo or Flutter, the widget still has to be a native SwiftUI Widget Extension. Share `ActiveSession` through the App Group:
- **Expo:** a config plugin such as `@bacons/apple-targets`.
- **React Native:** a small native module that writes App Group `UserDefaults`.
- **Flutter:** the `home_widget` package.

Handle the `progra://` deep links in the app's existing router.

## Files
- `design/Progra Widget.dc.html` is the interactive reference. Open it in a browser (it needs `support.js` next to it and internet access for Google Fonts). The timer ticks and Pause/Resume works. Clock out does nothing in the mock.
- `reference/PrograSessionWidget.swift` is the WidgetKit/SwiftUI starting point: model, store, intent, provider, views and previews.
- `CLAUDE_CODE_PROMPT.md` is a ready-to-paste prompt for Claude Code.

## Open questions
1. Design for the **no-active-session** state.
2. Does every goal already have a color in the app's data? This handoff assumes it does (Thesis = `#A98BF5`).
3. Where does the session's source of truth live (on device or on the server)? The intent and the deep link must go through it.
