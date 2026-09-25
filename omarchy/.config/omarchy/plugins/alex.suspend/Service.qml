import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland

// Suspend the system after a configurable idle timeout.
//
// Configuration: ~/.config/omarchy/shell.json -> idle.suspend (seconds).
//   0 or absent = disabled. The file is watched; edits apply live, no
//   shell restart needed (the IdleMonitor is re-armed on timeout changes,
//   mirroring omarchy.idle's Stay Awake behavior).
//
// Inhibitors: IdleMonitor runs with respectInhibitors: true, so anything
// holding an idle inhibitor (video playback, systemd-inhibit, etc.)
// prevents the timeout from firing. Suspend itself is a plain
// `systemctl suspend` — user-authorized by polkit, no sudo/pkexec.

Item {
  id: root

  readonly property string shellConfigPath:
    Quickshell.env("HOME") + "/.config/omarchy/shell.json"

  property int suspendSeconds: 0
  property bool rearming: false
  property string lastError: ""

  readonly property bool enabled: suspendSeconds > 0

  function secondsFromConfig(value) {
    var number = Number(value)
    if (!isFinite(number)) return 0
    number = Math.round(number)
    if (number <= 0) return 0
    // Keep seconds*1000 inside a 32-bit int (same bound as Sandman).
    return Math.min(number, 7 * 24 * 60 * 60)
  }

  function applyConfig() {
    try {
      var shell = JSON.parse(configFile.text() || "{}")
      var idle = shell.idle && typeof shell.idle === "object" ? shell.idle : {}
      root.suspendSeconds = root.secondsFromConfig(idle.suspend)
    } catch (error) {
      root.suspendSeconds = 0
    }
  }

  function rearmIdleMonitor() {
    // Quickshell's IdleMonitor does not re-register its idle notification
    // when only `timeout` changes; toggle it off and back on.
    root.rearming = true
    Qt.callLater(function() { root.rearming = false })
  }

  function requestSuspend() {
    if (!root.enabled || suspendProcess.running) return
    console.log("alex.suspend: idle timeout reached, suspending")
    suspendProcess.running = true
  }

  onSuspendSecondsChanged: rearmIdleMonitor()

  FileView {
    id: configFile
    path: root.shellConfigPath
    watchChanges: true
    printErrors: false
    onLoaded: root.applyConfig()
    onFileChanged: {
      reload()
      root.applyConfig()
    }
  }

  IdleMonitor {
    id: idleMonitor
    enabled: root.enabled && !root.rearming
    timeout: root.enabled ? root.suspendSeconds : 1
    respectInhibitors: true
    onIsIdleChanged: {
      if (idleMonitor.isIdle) root.requestSuspend()
    }
  }

  Process {
    id: suspendProcess
    command: ["systemctl", "suspend"]
    onExited: function(exitCode, exitStatus) {
      console.log("alex.suspend: suspend exitCode=" + exitCode + " status=" + exitStatus)
      if (exitCode !== 0)
        root.lastError = "Suspend was blocked by the system or an application"
    }
  }

  IpcHandler {
    target: "alex.suspend"

    function status(): string {
      return JSON.stringify({
        enabled: root.enabled,
        suspend: root.suspendSeconds,
        idle: idleMonitor.isIdle,
        rearming: root.rearming,
        suspendPending: suspendProcess.running,
        error: root.lastError
      })
    }
  }
}
