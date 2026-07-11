import Foundation
import UIKit
import UserNotifications

@MainActor
final class PushNotificationService: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushNotificationService()

    private var apiProvider: (() -> QadbakAPI?)?
    private var appStateProvider: (() -> AppState?)?
    private var lastPushToken: String?

    func configure(
        apiProvider: @escaping () -> QadbakAPI?,
        appStateProvider: @escaping () -> AppState? = { nil }
    ) {
        self.apiProvider = apiProvider
        self.appStateProvider = appStateProvider
    }

    func requestAuthorizationAndRegister() async {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            guard granted else { return }
            await MainActor.run {
                UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            return
        }
    }

    func handleDeviceToken(_ deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        lastPushToken = token
        Task { @MainActor in
            guard let api = apiProvider?() else { return }
            try? await api.registerPushToken(
                token,
                bundleId: Bundle.main.bundleIdentifier,
                deviceLabel: UIDevice.current.name
            )
        }
    }

    func unregisterFromServer() async {
        guard let token = lastPushToken, let api = apiProvider?() else { return }
        try? await api.unregisterPushToken(token)
        lastPushToken = nil
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        let domain = (userInfo["domain"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        await MainActor.run {
            appStateProvider?()?.handlePushNavigation(domain: domain?.isEmpty == false ? domain : nil)
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            PushNotificationService.shared.handleDeviceToken(deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Simulator / missing push entitlement — ignore.
    }
}
