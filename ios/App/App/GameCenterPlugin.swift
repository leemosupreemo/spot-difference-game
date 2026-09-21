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
    private var lastAuthError: String?
    private var authViewController: UIViewController?
    private var pendingAuthCalls: [CAPPluginCall] = []
    private var pendingGameCenterUI: [(call: CAPPluginCall, state: GKGameCenterViewControllerState, leaderboardId: String?)] = []

    override public func load() {
        super.load()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func handleAppDidBecomeActive() {
        guard hasConfiguredAuthHandler else { return }
        let isAuth = GKLocalPlayer.local.isAuthenticated
        let playerData = self.playerDictionary()
        self.notifyListeners("gameCenterAuthChanged", data: [
            "isAuthenticated": isAuth,
            "player": playerData
        ])
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
                CAPLog.print("⚡️ GameCenter: Authentication view controller provided by GameKit, presenting...")
                DispatchQueue.main.async {
                    self.presentAuthViewController(vc)
                }
                return
            }

            let isAuth = GKLocalPlayer.local.isAuthenticated
            let playerData = self.playerDictionary()

            if let err = error {
                self.lastAuthError = err.localizedDescription
                CAPLog.print("⚡️ GameCenter authenticateHandler error: \(err.localizedDescription) (code: \((err as NSError).code))")
            } else if isAuth {
                self.lastAuthError = nil
                CAPLog.print("⚡️ GameCenter: Local player authenticated successfully as \(GKLocalPlayer.local.alias)")
            }

            self.notifyListeners("gameCenterAuthChanged", data: [
                "isAuthenticated": isAuth,
                "player": playerData,
                "error": error?.localizedDescription ?? (isAuth ? NSNull() : "Not authenticated")
            ])

            let callsToResolve = self.pendingAuthCalls
            self.pendingAuthCalls.removeAll()

            for call in callsToResolve {
                call.resolve([
                    "isAuthenticated": isAuth,
                    "player": isAuth ? playerData : NSNull(),
                    "error": error?.localizedDescription ?? (isAuth ? NSNull() : "Not authenticated")
                ])
            }

            let uiRequests = self.pendingGameCenterUI
            self.pendingGameCenterUI.removeAll()
            for request in uiRequests {
                if isAuth {
                    self.presentGameCenterUI(state: request.state, leaderboardId: request.leaderboardId, call: request.call)
                } else {
                    request.call.resolve(["success": false, "reason": "not_authenticated"])
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

        if !hasConfiguredAuthHandler {
            pendingAuthCalls.append(call)
            setupSilentAuth()
            return
        }

        if let vc = authViewController, !vc.isBeingPresented && vc.presentingViewController == nil {
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
                "error": lastAuthError ?? "Game Center player is not available"
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

            self.pendingGameCenterUI.append((call: call, state: .leaderboards, leaderboardId: call.getString("leaderboardId")))
            if let authVC = self.authViewController, !authVC.isBeingPresented && authVC.presentingViewController == nil {
                self.presentAuthViewController(authVC)
            } else {
                self.hasConfiguredAuthHandler = false
                self.setupSilentAuth()
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

            self.pendingGameCenterUI.append((call: call, state: .achievements, leaderboardId: nil))
            if let authVC = self.authViewController, !authVC.isBeingPresented && authVC.presentingViewController == nil {
                self.presentAuthViewController(authVC)
            } else {
                self.hasConfiguredAuthHandler = false
                self.setupSilentAuth()
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
