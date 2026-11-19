// Fish All Day for the Mac: a see-through strip along the bottom of the screen where an old man fishes off the top of
// the Dock. The scene is a web page (Resources/web) drawn in a WebKit view with no background. Clicks pass through to
// whatever is underneath, except where the page says he is. A fish in the menu bar shows how many he caught today.
import AppKit
import WebKit
import UserNotifications

let STRIP = 380.0                      // points of room above the floor line for him, his cast and his cards

// Serves the bundled page from fad://app/... so that modules, models and fonts load as from one origin.
final class Files: NSObject, WKURLSchemeHandler {
    let root: URL
    init(root: URL) { self.root = root }
    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path; if path.isEmpty || path == "/" { path = "/desk.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(root.standardizedFileURL.path), let data = try? Data(contentsOf: file) else {
            task.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist)); return
        }
        let types = ["html": "text/html", "js": "text/javascript", "css": "text/css", "glb": "model/gltf-binary", "json": "application/json",
                     "woff2": "font/woff2", "woff": "font/woff", "png": "image/png", "jpg": "image/jpeg", "mp3": "audio/mpeg", "wav": "audio/wav", "svg": "image/svg+xml"]
        let mime = types[file.pathExtension.lowercased()] ?? "application/octet-stream"
        let resp = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                   headerFields: ["Content-Type": mime, "Content-Length": "\(data.count)", "Access-Control-Allow-Origin": "*"])!
        task.didReceive(resp); task.didReceive(data); task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

// a panel that never takes focus from the app you are working in, even when he is clicked
final class Strip: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}
// the first click on him counts, without a click to wake the window first
final class Web: WKWebView {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

@MainActor
final class App: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
    var window: Strip!
    var web: Web!
    var holding = false                 // a press that began on him stays his until the button comes up
    var wasDown = false
    var status: NSStatusItem!
    var hits: [NSRect] = []            // where he is, in the window's own points (origin top left, as the page sees it)
    var lastFloor = -1.0
    var soundOn = true
    var voiceOn = UserDefaults.standard.object(forKey: "fad.voiceOn") as? Bool ?? true      // "His voice", remembered

    func applicationDidFinishLaunching(_ n: Notification) {
        NSApp.setActivationPolicy(.accessory)
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        let cfg = WKWebViewConfiguration()
        let root = Bundle.main.resourceURL!.appendingPathComponent("web")
        cfg.setURLSchemeHandler(Files(root: root), forURLScheme: "fad")
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.userContentController.add(self, name: "fad")
        cfg.preferences.setValue(true, forKey: "developerExtrasEnabled")
        // his records, kept by the app, handed to the page before it starts
        // (only what reads back as a record or a number goes into the page)
        let saved = UserDefaults.standard.string(forKey: "fad.v1").flatMap { s in (try? JSONSerialization.jsonObject(with: Data(s.utf8))) is [String: Any] ? s : nil } ?? "null"
        let spot = UserDefaults.standard.string(forKey: "fad.spot").flatMap(Double.init).map { String($0) } ?? ""
        let boot = "window.__fadSaved = \(saved); window.__fadVoice = \(voiceOn); try { if ('\(spot)') localStorage.setItem('fad.spot', '\(spot)'); } catch (e) {}"
        cfg.userContentController.addUserScript(WKUserScript(source: boot, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        window = Strip(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        window.isFloatingPanel = true; window.hidesOnDeactivate = false; window.becomesKeyOnlyIfNeeded = true
        window.isOpaque = false; window.backgroundColor = .clear; window.hasShadow = false
        window.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.dockWindow)) + 1)   // drawn over the Dock
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
        window.ignoresMouseEvents = true; window.acceptsMouseMovedEvents = true

        web = Web(frame: .zero, configuration: cfg)
        web.setValue(false, forKey: "drawsBackground")
        if #available(macOS 13.3, *) { web.isInspectable = true }
        window.contentView = web
        place(load: true)
        window.orderFrontRegardless()

        status = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        status.button?.title = "🐟 0"
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Fish book", action: #selector(book), keyEquivalent: "b"))
        menu.addItem(NSMenuItem(title: "Sound on", action: #selector(toggleSound(_:)), keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "His voice", action: #selector(toggleVoice(_:)), keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "A bite now", action: #selector(biteNow), keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "Send him home", action: #selector(toggleHere), keyEquivalent: "h"))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit Fish All Day", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        menu.items[1].state = soundOn ? .on : .off
        menu.items[2].state = voiceOn ? .on : .off
        status.menu = menu

        // follow the mouse: let clicks through unless it is over him
        Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak self] _ in MainActor.assumeIsolated { self?.track() } }
        // for filming (only with --demo): commands for the page dropped into /tmp/fad-cmd.js are run and removed
        if CommandLine.arguments.contains("--demo") {
            Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { [weak self] _ in MainActor.assumeIsolated {
                let f = "/tmp/fad-cmd.js"
                if let js = try? String(contentsOfFile: f, encoding: .utf8) { try? FileManager.default.removeItem(atPath: f); self?.web.evaluateJavaScript(js) }
            } }
        }
        // how long you have been at the screen: minutes of use with no break of five minutes or more
        Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in MainActor.assumeIsolated { self?.screenTime() } }
        // asleep is a break: the count starts again when the Mac wakes
        NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.since = Date(); self?.lastTick = Date(); self?.screenTime() }
        }
        // the Dock may grow, hide or move; screens may change
        Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in MainActor.assumeIsolated { self?.place(load: false) } }
        NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.place(load: false) }
        }
    }

    // the strip: the full width of the main screen, from its bottom edge up to STRIP points above the Dock's top
    func place(load: Bool) {
        // the screen with the Dock along its bottom; else the one with the menu bar (never simply the focused one)
        guard let s = NSScreen.screens.first(where: { $0.visibleFrame.minY - $0.frame.minY > 8 }) ?? NSScreen.screens.first else { return }
        let f = s.frame, v = s.visibleFrame
        var floor = v.minY - f.minY                       // the Dock's height when it sits at the bottom
        if floor < 4 { floor = 4 }                        // hidden Dock, or Dock at a side: sit on the screen's edge
        let frame = NSRect(x: f.minX, y: f.minY, width: f.width, height: floor + STRIP)
        if window.frame != frame { window.setFrame(frame, display: true) }
        if load {
            var demo = CommandLine.arguments.contains("--demo") ? "&demo" : ""      // bites every half minute, for showing it
            if CommandLine.arguments.contains("--mute") { demo += "&mute"; soundOn = false }
            web.load(URLRequest(url: URL(string: "fad://app/desk.html?floor=\(Int(floor))\(demo)")!))
        } else if floor != lastFloor {
            web.evaluateJavaScript("window.fad && window.fad.layout({floor: \(Int(floor))})")
        }
        lastFloor = floor
    }

    func track() {
        let m = NSEvent.mouseLocation, f = window.frame
        let p = NSPoint(x: m.x - f.minX, y: f.height - (m.y - f.minY))     // into the page's points
        let down = NSEvent.pressedMouseButtons & 1 != 0
        var over = hits.contains { $0.contains(p) }
        if down && !wasDown && !window.ignoresMouseEvents { holding = true }   // pressed on him: keep the press for him
        if !down { holding = false }                                         // (a drag from elsewhere passing over him is not his)
        wasDown = down
        if holding { over = true }
        if window.ignoresMouseEvents == over { window.ignoresMouseEvents = !over }
    }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let s = message.body as? String, let data = s.data(using: .utf8),
              let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        let rects = (o["hit"] as? [[Double]])?.compactMap { $0.count == 4 ? NSRect(x: $0[0], y: $0[1], width: $0[2], height: $0[3]) : nil }
        let today = o["today"] as? Int
        let focus = o["focus"] as? Bool
        if o["bite"] as? Bool == true { notifyBite() }
        if o["shake"] as? Bool == true { shake() }
        if let k = o["control"] as? String { control(k) }
        if let l = o["log"] as? [Any], CommandLine.arguments.contains("--demo"), let d = try? JSONSerialization.data(withJSONObject: l),   // filming: the page's sounds, for the edit
           let h = FileHandle(forWritingAtPath: "/tmp/fad-events.log") ?? { FileManager.default.createFile(atPath: "/tmp/fad-events.log", contents: nil); return FileHandle(forWritingAtPath: "/tmp/fad-events.log") }() {
            h.seekToEndOfFile(); h.write(d); h.write("\n".data(using: .utf8)!); try? h.close()
        }
        if let save = o["save"] as? [String: String] { for (k, v) in save { UserDefaults.standard.set(v, forKey: k) } }
        if let r = rects { hits = r }
        if let n = today { status.button?.title = "🐟 \(n)" }
        if focus == true { NSApp.activate(ignoringOtherApps: true); window.makeKey() }
    }

    @objc func book() { web.evaluateJavaScript("window.fad && window.fad.book && window.fad.book()") }
    // a bite also shows as a notification, for when you are looking at another screen
    func notifyBite() {
        let c = UNMutableNotificationContent()
        c.title = "Something's biting!"; c.body = "Put the mouse on him and hold to reel. Ten seconds."; c.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "bite", content: c, trigger: nil))
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ["bite"]) }
    }
    var since = Date(), lastTick = Date()
    func screenTime() {
        let idle = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: CGEventType(rawValue: ~0)!)
        let gap = Date().timeIntervalSince(lastTick); lastTick = Date()
        if idle > 300 || gap > 300 { since = Date() }                 // five minutes away, or the Mac was asleep (no ticks)
        let minutes = Int(Date().timeIntervalSince(since) / 60)
        web.evaluateJavaScript("window.fad && window.fad.screen && window.fad.screen(\(minutes))")
    }
    // he wants attention: his strip shudders, and a trackpad being touched gives a thump
    func shake() {
        let f = window.frame; var k = 0
        NSHapticFeedbackManager.defaultPerformer.perform(.levelChange, performanceTime: .now)
        Timer.scheduledTimer(withTimeInterval: 0.035, repeats: true) { [weak self] t in MainActor.assumeIsolated {
            guard let self else { t.invalidate(); return }
            k += 1; let dx = k >= 14 ? 0 : (k % 2 == 0 ? 7.0 : -7.0) * (1 - Double(k) / 14)
            self.window.setFrameOrigin(NSPoint(x: f.minX + dx, y: f.minY))
            if k >= 14 { t.invalidate() }
        } }
    }
    @objc func biteNow() { web.evaluateJavaScript("window.fad && window.fad.bite && window.fad.bite()") }
    @objc func toggleVoice(_ item: NSMenuItem) {
        voiceOn.toggle(); item.state = voiceOn ? .on : .off; UserDefaults.standard.set(voiceOn, forKey: "fad.voiceOn"); sync()
    }
    @objc func toggleSound(_ item: NSMenuItem) {
        soundOn.toggle(); item.state = soundOn ? .on : .off
        web.evaluateJavaScript("window.fad && window.fad.sound && window.fad.sound(\(soundOn))"); sync()
    }
    // his toolbar and the menu bar show the same switches
    func sync() { web.evaluateJavaScript("window.fad && window.fad.state && window.fad.state({voice: \(voiceOn), sound: \(soundOn)})") }
    // the buttons by his head (and a right-click on him) work the same switches as the menu bar, which a notch may hide
    func control(_ k: String) {
        guard let menu = status.menu else { return }
        switch k {
        case "voice": toggleVoice(menu.items[2])
        case "sound": toggleSound(menu.items[1])
        case "hide": toggleHere()
        case "menu": menu.popUp(positioning: nil, at: NSEvent.mouseLocation, in: nil)
        default: break
        }
    }
    // send him home: the strip goes, nothing bites or talks; the menu bar or opening the app again brings him back
    @objc func toggleHere() {
        let away = window.isVisible
        if away { window.orderOut(nil) } else { window.orderFrontRegardless() }
        web.evaluateJavaScript("window.fad && window.fad.hidden && window.fad.hidden(\(away))")
        status.menu?.items.first { $0.action == #selector(toggleHere) }?.title = away ? "Bring him back" : "Send him home"
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !window.isVisible { toggleHere() }
        return false
    }
}

let app = NSApplication.shared
let delegate = MainActor.assumeIsolated { App() }
app.delegate = delegate
app.run()
