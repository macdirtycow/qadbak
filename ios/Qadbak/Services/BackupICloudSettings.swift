import Foundation

/// User preferences for saving server backups to iCloud Drive.
enum BackupICloudSettings {
    private static let defaults = UserDefaults.standard
    private static let autoSaveKey = "qadbak.backup.icloud.autoSave"
    private static let wifiOnlyKey = "qadbak.backup.icloud.wifiOnly"

    /// After "Run backup now", automatically download the new archive to iCloud.
    static var autoSaveAfterBackup: Bool {
        get { defaults.bool(forKey: autoSaveKey) }
        set { defaults.set(newValue, forKey: autoSaveKey) }
    }

    /// Only download backups when connected via Wi-Fi (recommended for large archives).
    static var wifiOnly: Bool {
        get {
            if defaults.object(forKey: wifiOnlyKey) == nil {
                return true
            }
            return defaults.bool(forKey: wifiOnlyKey)
        }
        set { defaults.set(newValue, forKey: wifiOnlyKey) }
    }
}
