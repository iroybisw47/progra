import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // PrograBridgeViewController, not CAPBridgeViewController: its
        // capacitorDidLoad() is what registers the Live Activity plugin, which
        // Capacitor's packageClassList cannot do for a plugin compiled into the
        // app target rather than installed from npm. See
        // PrograLiveActivityPlugin.swift. Reverting this line silently removes
        // the Live Activity — the JS accessor just returns null.
        window?.rootViewController = PrograBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
