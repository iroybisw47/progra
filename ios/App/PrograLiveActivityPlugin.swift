import ActivityKit
import Capacitor
import Foundation

// The JS → ActivityKit bridge. APP TARGET ONLY (not the widget extension).
//
// Deliberately the only native code this feature adds to the app target, and
// deliberately NOT in AppDelegate.swift: that file carries hand-written APNs
// delegate methods with a warning that `npx cap sync` can clobber them. Capacitor
// discovers CAPPlugin subclasses conforming to CAPBridgedPlugin from the
// Objective-C runtime, so a plugin needs no registration, no AppDelegate edit and
// no capacitor.config.ts entry. This file lives somewhere `cap sync` has never
// heard of.
//
// `jsName` is what appears on window.Capacitor.Plugins — it must stay
// "PrograLiveActivity" to match liveActivityPlugin() in lib/native-plugins.ts.
//
// ONE `sync` METHOD, not start/update. TypeScript cannot know whether an activity
// exists, because iOS ends them on its own: the ~8h lifetime limit, the user
// switching Live Activities off, force-quit cleanup. A TS-side "did we start it"
// boolean would be wrong after every one of those. The sharp case is real — pause
// at hour 7, resume at hour 12, and `update()` has nothing to update where
// `request()` is needed. So that decision lives here, where
// Activity.activities can actually be inspected.
@objc(PrograLiveActivityPlugin)
public class PrograLiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PrograLiveActivityPlugin"
    public let jsName = "PrograLiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise)
    ]

    @objc func sync(_ call: CAPPluginCall) {
        // iOS 15/16: the app target's floor is 15.0 on purpose, so nobody loses
        // the app for this. Below 17 the whole feature is simply absent, which
        // the JS side never has to know — resolve and say nothing.
        guard #available(iOS 17.0, *) else {
            call.resolve()
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            // The user has Live Activities off for Progra. Not an error: the card
            // is a nicety and may never break the session it decorates.
            call.resolve()
            return
        }

        // A null snapshot means "end whatever is showing" — teardown is the
        // degenerate case of the same call, so there is no separate path to
        // forget. Mirrors clockReminders returning [].
        guard let raw = call.getObject("snapshot") else {
            Task {
                await Self.endAll()
                call.resolve()
            }
            return
        }

        guard
            let sessionId = raw["sessionId"] as? String,
            let state = Self.contentState(from: raw)
        else {
            call.reject("Malformed Live Activity snapshot")
            return
        }

        Task {
            await Self.apply(sessionId: sessionId, state: state)
            call.resolve()
        }
    }

    // MARK: - ActivityKit

    @available(iOS 17.0, *)
    private static func apply(
        sessionId: String,
        state: PrograActivityAttributes.ContentState
    ) async {
        let content = ActivityContent(
            state: state,
            // Lets iOS retire the card on its own at the point we stop trusting
            // it, rather than leaving a stale timer on the Lock Screen if the app
            // is never opened again. staleAtMs is min(startedAt + 8h, capEndMs).
            staleDate: state.staleDate
        )

        // Update the activity for THIS session if one is live.
        for activity in Activity<PrograActivityAttributes>.activities
        where activity.attributes.sessionId == sessionId {
            await activity.update(content)
            return
        }

        // A card for a DIFFERENT session is stale by definition — one active
        // session per user, enforced by a partial unique index. End it before
        // requesting, or two cards race on the Lock Screen.
        await endAll()

        do {
            _ = try Activity.request(
                attributes: PrograActivityAttributes(sessionId: sessionId),
                content: content,
                // No push token: app-driven updates need no APNs entitlement,
                // and ActivityKit push tokens would inherit the
                // aps-environment-is-"development" footgun documented in
                // docs/app-review-notes.md. Deliberate, not an oversight.
                pushType: nil
            )
        } catch {
            // Throws when the system activity limit is hit, or the user revoked
            // permission between the check above and here. Swallowed: the JS
            // bridge leaves its fingerprint stale on a throw, so the next state
            // transition retries.
        }
    }

    @available(iOS 17.0, *)
    private static func endAll() async {
        for activity in Activity<PrograActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    // MARK: - Decoding

    // Hand-mapped rather than JSONSerialization + JSONDecoder, because
    // CAPPluginCall hands over a JSObject of NSNumber/NSString and every numeric
    // field here is epoch milliseconds — large enough that an Int round-trip is
    // worth being explicit about. Unknown keys are ignored and missing keys stay
    // nil, which is the forward/backward compatibility the attributes file
    // explains.
    @available(iOS 17.0, *)
    private static func contentState(
        from raw: JSObject
    ) -> PrograActivityAttributes.ContentState? {
        let version = (raw["snapshotVersion"] as? NSNumber)?.intValue
        // Refuse a shape this binary predates rather than rendering a
        // half-understood card. Only a MAJOR break bumps this.
        if let version, version > 1 { return nil }

        func num(_ key: String) -> Double? {
            (raw[key] as? NSNumber)?.doubleValue
        }
        func str(_ key: String) -> String? {
            raw[key] as? String
        }

        return PrograActivityAttributes.ContentState(
            snapshotVersion: version,
            label: str("label"),
            state: str("state"),
            timerAnchorMs: num("timerAnchorMs"),
            frozenWorkedMs: num("frozenWorkedMs"),
            targetEndMs: num("targetEndMs"),
            plannedWorkMs: num("plannedWorkMs"),
            breakEndsAtMs: num("breakEndsAtMs"),
            staleAtMs: num("staleAtMs"),
            capEndMs: num("capEndMs"),
            staleLabel: str("staleLabel"),
            secondaryAction: str("secondaryAction"),
            secondaryLabel: str("secondaryLabel"),
            endLabel: str("endLabel"),
            tapPath: str("tapPath"),
            endPath: str("endPath"),
            fallbackPath: str("fallbackPath")
        )
    }
}
