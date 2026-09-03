import QtQuick
import QtQuick.Layouts
import Quickshell.Hyprland
import qs.Commons
import qs.Ui

BarWidget {
  id: root
  moduleName: "alex.launchers"

  readonly property real trailingGap: root.vertical ? 0 : Style.spaceReal(1.5)

  implicitWidth: button.implicitWidth + trailingGap
  implicitHeight: button.implicitHeight

  WidgetButton {
    id: button
    bar: root.bar
    text: "\uF120"
    tooltipText: "Terminal"
    horizontalMargin: 7.5
    fixedWidth: root.vertical ? root.barSize : Style.space(20)
    fixedHeight: root.barSize
    onPressed: function() {
      if (!root.bar) return
      root.bar.run("hyprctl eval 'hl.exec_cmd(\"foot\")'")
    }
  }
}
