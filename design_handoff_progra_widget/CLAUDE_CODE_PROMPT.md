Implement the Progra "Current session" iOS home screen widget.

Read `design_handoff_progra_widget/README.md` first. It is the source of truth for layout, colors, type, states and behaviour. `design/Progra Widget.dc.html` is an interactive HTML reference that you can open in a browser. `reference/PrograSessionWidget.swift` is a SwiftUI/WidgetKit starting point. Adapt it to the codebase rather than pasting it in unchanged.

1. Explore the repo. Find:
   - the app's stack
   - how clock-in sessions and goals (including goal colors) are modelled and stored
   - how the running timer works
   - where the 10-hour auto clock-out happens
   - how the app navigates to the Finish & Post ("Session complete") screen
2. Add an iOS 17+ Widget Extension, or extend the existing one. Add an App Group shared by the app and the extension.
3. Bundle Hanken Grotesk SemiBold and Newsreader Medium in the extension (list them under `UIAppFonts`). Check their PostScript names.
4. Share the active session through the App Group. Write it from the app's session service on every change (clock in, pause, resume, clock out, auto clock-out), then reload the widget timeline.
5. Build the `.systemMedium` widget exactly to the README spec:
   - Pause/Resume is an App Intent button.
   - Clock out is a deep link that ends the session and opens Finish & Post.
   - Tapping elsewhere opens the running session.
6. Make sure a pause or resume from the widget reaches the app's source of truth, and the backend if sessions sync.
7. Register the `progra://` URL scheme, or reuse the app's existing scheme or universal links, and handle the two routes.
8. Add Xcode previews for running, paused and a long session name, at both 364×170 and 338×158.
9. Don't invent a no-active-session design. Leave the TODO in place and ask me.

If the app isn't native iOS (React Native, Expo or Flutter), keep the widget native SwiftUI and bridge the shared session data. See "Non-native apps" in the README.
