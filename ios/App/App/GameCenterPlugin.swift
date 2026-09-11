import Foundation
import Capacitor
import GameKit

@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAuthenticated", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPlayer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showAchievements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unlockAchievement", returnType: CAPPluginReturnPromise)
    ]

    private var hasConfiguredAuthHandler = false
    private var hasCompletedInitialAuth = false
    private var authViewController: UIViewController?
    private var pendingAuthCalls: [CAPPluginCall] = []

    override public func load() {
        super.load()
        setupSilentAuth()
    }

    private func getTopViewController(base: UIViewController? = nil) -> UIViewController? {
        let baseVC: UIViewController?
        if let base = base {
            baseVC = base
        } else if let bridgeVC = bridge?.viewController {
            baseVC = bridgeVC
        } else {
            let keyWindow = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.isKeyWindow }
            baseVC = keyWindow?.rootViewController
        }

        if let nav = baseVC as? UINavigationController {
            return getTopViewController(base: nav.visibleViewController)
        }
        if let tab = baseVC as? UITabBarController {
            return getTopViewController(base: tab.selectedViewController)
        }
        if let presented = baseVC?.presentedViewController, !presented.isBeingDismissed {
            return getTopViewController(base: presented)
        }
        return baseVC
    }

    private func setupSilentAuth() {
        guard !hasConfiguredAuthHandler else { return }
        hasConfiguredAuthHandler = true

        GKLocalPlayer.local.authenticateHandler = { [weak self] viewController, error in
            guard let self = self else { return }
            self.hasCompletedInitialAuth = true
            self.authViewController = viewController

            if let vc = viewController {
                // If there are explicit pending calls waiting for auth, present the controller
                if !self.pendingAuthCalls.isEmpty {
                    DispatchQueue.main.async {
                        self.presentAuthViewController(vc)
                    }
                }
            } else {
                let isAuth = GKLocalPlayer.local.isAuthenticated
                let playerData = self.playerDictionary()

                self.notifyListeners("gameCenterAuthChanged", data: [
                    "isAuthenticated": isAuth,
                    "player": playerData
                ])

                let callsToResolve = self.pendingAuthCalls
                self.pendingAuthCalls.removeAll()

                for call in callsToResolve {
                    if let err = error, !isAuth {
                        call.resolve([
                            "isAuthenticated": false,
                            "error": err.localizedDescription,
                            "player": NSNull()
                        ])
                    } else {
                        call.resolve([
                            "isAuthenticated": isAuth,
                            "player": isAuth ? playerData : NSNull()
                        ])
                    }
                }
            }
        }
    }

    private func presentAuthViewController(_ vc: UIViewController, completion: (() -> Void)? = nil) {
        guard !vc.isBeingPresented && vc.presentingViewController == nil else {
            completion?()
            return
        }
        guard let topVC = getTopViewController() else {
            completion?()
            return
        }
        topVC.present(vc, animated: true) {
            completion?()
        }
    }

    private func playerDictionary() -> [String: Any] {
        guard GKLocalPlayer.local.isAuthenticated else {
            return [:]
        }
        return [
            "alias": GKLocalPlayer.local.alias,
            "displayName": GKLocalPlayer.local.displayName,
            "gamePlayerID": GKLocalPlayer.local.gamePlayerID,
            "teamPlayerID": GKLocalPlayer.local.teamPlayerID
        ]
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        if GKLocalPlayer.local.isAuthenticated {
            call.resolve([
                "isAuthenticated": true,
                "player": playerDictionary()
            ])
            return
        }

        if let vc = authViewController {
            pendingAuthCalls.append(call)
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                self.presentAuthViewController(vc)
            }
            return
        }

        if hasCompletedInitialAuth {
            call.resolve([
                "isAuthenticated": false,
                "player": NSNull(),
                "reason": "not_authenticated"
            ])
            return
        }

        pendingAuthCalls.append(call)
    }

    @objc func isAuthenticated(_ call: CAPPluginCall) {
        let isAuth = GKLocalPlayer.local.isAuthenticated
        call.resolve([
            "isAuthenticated": isAuth,
            "player": isAuth ? playerDictionary() : NSNull()
        ])
    }

    @objc func getPlayer(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve([
                "isAuthenticated": false,
                "player": NSNull()
            ])
            return
        }

        call.resolve([
            "isAuthenticated": true,
            "player": playerDictionary()
        ])
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve([
                "success": false,
                "reason": "not_authenticated"
            ])
            return
        }

        guard let leaderboardId = call.getString("leaderboardId") else {
            call.reject("Must provide a leaderboardId")
            return
        }

        guard let score = call.getInt("score") else {
            call.reject("Must provide a score as an integer")
            return
        }

        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [leaderboardId]) { error in
            if let error = error {
                call.reject("Failed to submit score: \(error.localizedDescription)")
            } else {
                call.resolve([
                    "success": true,
                    "leaderboardId": leaderboardId,
                    "score": score
                ])
            }
        }
    }

    @objc func showLeaderboard(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            if GKLocalPlayer.local.isAuthenticated {
                self.presentGameCenterUI(state: .leaderboards, leaderboardId: call.getString("leaderboardId"), call: call)
                return
            }

            if let authVC = self.authViewController {
                self.presentAuthViewController(authVC) { [weak self] in
                    guard let self = self else { return }
                    if GKLocalPlayer.local.isAuthenticated {
                        self.presentGameCenterUI(state: .leaderboards, leaderboardId: call.getString("leaderboardId"), call: call)
                    } else {
                        call.resolve(["success": false, "reason": "not_authenticated"])
                    }
                }
            } else {
                self.showGameCenterSettingsPrompt(call: call)
            }
        }
    }

    @objc func showAchievements(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            if GKLocalPlayer.local.isAuthenticated {
                self.presentGameCenterUI(state: .achievements, leaderboardId: nil, call: call)
                return
            }

            if let authVC = self.authViewController {
                self.presentAuthViewController(authVC) { [weak self] in
                    guard let self = self else { return }
                    if GKLocalPlayer.local.isAuthenticated {
                        self.presentGameCenterUI(state: .achievements, leaderboardId: nil, call: call)
                    } else {
                        call.resolve(["success": false, "reason": "not_authenticated"])
                    }
                }
            } else {
                self.showGameCenterSettingsPrompt(call: call)
            }
        }
    }

    private func presentGameCenterUI(state: GKGameCenterViewControllerState, leaderboardId: String?, call: CAPPluginCall) {
        guard let topVC = getTopViewController() else {
            call.reject("No visible view controller found to present Game Center")
            return
        }

        let gcVC: GKGameCenterViewController
        if state == .leaderboards, let lId = leaderboardId, !lId.isEmpty {
            gcVC = GKGameCenterViewController(leaderboardID: lId, playerScope: .global, timeScope: .allTime)
        } else {
            gcVC = GKGameCenterViewController(state: state)
        }

        gcVC.gameCenterDelegate = self
        topVC.present(gcVC, animated: true) {
            call.resolve(["success": true])
        }
    }

    private func showGameCenterSettingsPrompt(call: CAPPluginCall) {
        guard let topVC = getTopViewController() else {
            call.resolve(["success": false, "reason": "not_authenticated"])
            return
        }

        let alert = UIAlertController(
            title: "Game Center Required",
            message: "Sign in to Apple Game Center in your device Settings to view live leaderboards, track your rank, and unlock achievements.",
            preferredStyle: .alert
        )

        alert.addAction(UIAlertAction(title: "Settings", style: .default) { _ in
            if let settingsUrl = URL(string: UIApplication.openSettingsURLString),
               UIApplication.shared.canOpenURL(settingsUrl) {
                UIApplication.shared.open(settingsUrl, options: [:], completionHandler: nil)
            }
        })

        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel, handler: nil))

        topVC.present(alert, animated: true) {
            call.resolve(["success": false, "reason": "settings_prompted"])
        }
    }

    @objc func unlockAchievement(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve([
                "success": false,
                "reason": "not_authenticated"
            ])
            return
        }

        guard let achievementId = call.getString("achievementId") else {
            call.reject("Must provide an achievementId")
            return
        }

        let percentComplete = call.getDouble("percentComplete") ?? 100.0
        let showsCompletionBanner = call.getBool("showsCompletionBanner") ?? true

        let achievement = GKAchievement(identifier: achievementId)
        achievement.percentComplete = percentComplete
        achievement.showsCompletionBanner = showsCompletionBanner

        GKAchievement.report([achievement]) { error in
            if let error = error {
                call.reject("Failed to report achievement: \(error.localizedDescription)")
            } else {
                call.resolve([
                    "success": true,
                    "achievementId": achievementId,
                    "percentComplete": percentComplete
                ])
            }
        }
    }

    // MARK: - GKGameCenterControllerDelegate
    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true, completion: nil)
    }
}
