import Foundation

#if canImport(Citadel)
import Citadel
import Crypto

enum SSHPrivateKeyAuth {
    enum KeyError: LocalizedError {
        case invalidFormat
        case unsupportedType
        case passphraseRequired

        var errorDescription: String? {
            switch self {
            case .invalidFormat:
                return "Could not parse SSH private key. Use OpenSSH format (BEGIN OPENSSH PRIVATE KEY)."
            case .unsupportedType:
                return "Unsupported key type. Use Ed25519 or RSA OpenSSH keys."
            case .passphraseRequired:
                return "This key is encrypted. Enter the passphrase or use an unencrypted key."
            }
        }
    }

    static func authenticationMethod(
        username: String,
        privateKeyPEM: String,
        passphrase: String = ""
    ) throws -> SSHAuthenticationMethod {
        let trimmed = privateKeyPEM.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw KeyError.invalidFormat }

        let keyType: SSHKeyType
        do {
            keyType = try SSHKeyTypeDetection.detectPrivateKeyType(from: trimmed)
        } catch SSHKeyDetectionError.passphraseRequired, SSHKeyDetectionError.encryptedPrivateKey {
            throw KeyError.passphraseRequired
        } catch {
            throw KeyError.invalidFormat
        }

        let passData = passphrase.isEmpty ? nil : Data(passphrase.utf8)

        switch keyType {
        case .ed25519:
            let key = try OpenSSH.PrivateKey<Curve25519.Signing.PrivateKey>(string: trimmed, decryptionKey: passData)
            return .ed25519(username: username, privateKey: key.privateKey)
        case .rsa:
            let key = try OpenSSH.PrivateKey<Insecure.RSA.PrivateKey>(string: trimmed, decryptionKey: passData)
            return .rsa(username: username, privateKey: key.privateKey)
        default:
            throw KeyError.unsupportedType
        }
    }
}
#endif
