import QtQuick
import QtQuick.Layouts
import Quickshell.Hyprland
import qs.Commons
import qs.Ui

BarWidget {
  id: root
  moduleName: "alex.launchers"

  readonly property real trailingGap: root.vertical ? 0 : Style.spaceReal(1.5)

  implicitWidth: row.implicitWidth + trailingGap
  implicitHeight: row.implicitHeight

  Row {
    id: row
    anchors.fill: parent
    spacing: 0

    WidgetButton {
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

    WidgetButton {
      bar: root.bar
      text: "\uF268"
      tooltipText: "Chrome"
      horizontalMargin: 7.5
      fixedWidth: root.vertical ? root.barSize : Style.space(20)
      fixedHeight: root.barSize
      onPressed: function() {
        if (!root.bar) return
        root.bar.run("hyprctl eval 'hl.exec_cmd(\"google-chrome-stable\")'")
      }
    }

    WidgetButton {
      bar: root.bar
      text: "\uF121"
      tooltipText: "Code"
      horizontalMargin: 7.5
      fixedWidth: root.vertical ? root.barSize : Style.space(20)
      fixedHeight: root.barSize
      onPressed: function() {
        if (!root.bar) return
        root.bar.run("hyprctl eval 'hl.exec_cmd(\"code\")'")
      }
    }

    WidgetButton {
      bar: root.bar
      text: "\uF135"
      tooltipText: "PixInsight"
      horizontalMargin: 7.5
      fixedWidth: root.vertical ? root.barSize : Style.space(20)
      fixedHeight: root.barSize
      onPressed: function() {
        if (!root.bar) return
        root.bar.run("hyprctl eval 'hl.exec_cmd(\"fish -c /opt/PixInsight/bin/PixInsight.sh\")'")
      }
    }
  }
}
