import SwiftUI
import WebKit

struct TerminalWebView: UIViewRepresentable {
    let onReady: (TerminalWebViewController) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.userContentController.add(context.coordinator, name: "qadbak")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.06, green: 0.08, blue: 0.10, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.navigationDelegate = context.coordinator
        context.coordinator.webView = webView
        context.coordinator.onReady = onReady

        if let url = Bundle.main.url(forResource: "terminal", withExtension: "html", subdirectory: "terminal") {
            let base = url.deletingLastPathComponent()
            webView.loadFileURL(url, allowingReadAccessTo: base)
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        weak var webView: WKWebView?
        var onReady: ((TerminalWebViewController) -> Void)?
        private var controller: TerminalWebViewController?

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "qadbak",
                  let body = message.body as? [String: Any],
                  let type = body["type"] as? String else { return }
            if type == "ready" {
                let ctrl = TerminalWebViewController(webView: webView)
                controller = ctrl
                onReady?(ctrl)
            } else if type == "status", let state = body["state"] as? String {
                controller?.statusHandler?(state, body["detail"] as? String)
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            controller?.statusHandler?("error", error.localizedDescription)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            controller?.statusHandler?("error", error.localizedDescription)
        }
    }
}

@MainActor
final class TerminalWebViewController {
    private weak var webView: WKWebView?
    var statusHandler: ((String, String?) -> Void)?

    init(webView: WKWebView?) {
        self.webView = webView
    }

    func connect(session: TerminalSessionInfo) {
        guard let data = try? JSONEncoder().encode(session),
              let json = String(data: data, encoding: .utf8) else {
            statusHandler?("error", "Could not encode terminal session.")
            return
        }
        let escaped = json
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        evaluate("window.qadbakTerminal && window.qadbakTerminal.connect('\(escaped)')") { [weak self] _, error in
            if let error {
                self?.statusHandler?("error", error.localizedDescription)
            }
        }
    }

    func disconnect() {
        evaluate("window.qadbakTerminal && window.qadbakTerminal.disconnect()")
    }

    func fit() {
        evaluate("window.qadbakTerminal && window.qadbakTerminal.fit()")
    }

    func focus() {
        evaluate("window.qadbakTerminal && window.qadbakTerminal.focus()")
    }

    func sendKey(_ key: String) {
        let escaped = key.replacingOccurrences(of: "'", with: "\\'")
        evaluate("window.qadbakTerminal && window.qadbakTerminal.sendKey('\(escaped)')")
    }

    func sendText(_ text: String) {
        guard let data = try? JSONEncoder().encode(text),
              let json = String(data: data, encoding: .utf8) else { return }
        evaluate("window.qadbakTerminal && window.qadbakTerminal.sendText(\(json))")
    }

    private func evaluate(_ script: String, completion: ((Any?, Error?) -> Void)? = nil) {
        webView?.evaluateJavaScript(script, completionHandler: completion)
    }
}
