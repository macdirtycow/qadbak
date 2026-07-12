import Foundation

enum AgentNotificationSettings {
    private static let enabledKey = "qadbak.agentNotifications.enabled"

    static var enabled: Bool {
        get {
            if UserDefaults.standard.object(forKey: enabledKey) == nil {
                return true
            }
            return UserDefaults.standard.bool(forKey: enabledKey)
        }
        set { UserDefaults.standard.set(newValue, forKey: enabledKey) }
    }
}
