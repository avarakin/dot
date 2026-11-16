---
name: dank-material-shell
description: Reference for DankMaterialShell (DMS), the Material Design desktop shell for Linux. Covers DankBar widgets, DankDash launcher, settings, QML plugins, theming, and Matugen colour propagation. Use when working on DMS configuration, widget or theme changes, or shell-related dotfiles.
---

# DankMaterialShell (DMS) Skill

## What is DankMaterialShell?

DankMaterialShell (DMS) is a Material Design–styled desktop shell for Linux. It provides:

- **DankBar** — a system status bar with widgets
- **DankDash** — an application launcher/dashboard
- **DankActionButton** — Material-style action buttons
- **Plugin system** — extensible widgets and settings panels (QML)
- **Theme system** — Material Design themes with dark/light modes and color variants
- **Color propagation** — DMS colors flow into GTK3/4, kitty, foot, alacritty, and more via Matugen

## Key Paths

| Purpose | Path |
|---|---|
| Config root | `~/.config/DankMaterialShell/` |
| Cache (colors, clipboard, image cache, notifications) | `~/.cache/DankMaterialShell/` |
| CLI binary | `/usr/bin/dms` |
| System stats backend | `/usr/bin/dgop` |
| dgop config | `~/.config/dgop/` |

## User Configuration Files

### Main Settings (`~/.config/DankMaterialShell/settings.json`)

The primary configuration file. Controls shell-wide behavior:

| Key | Type | Description |
|---|---|---|
| `currentThemeName` | string | Active theme name (e.g., `"blue"`) |
| `customThemeFile` | string | Path to custom theme JSON |
| `registryThemeVariants` | object | Per-theme variant selections (flavor + accent) |
| `cornerRadius` | number | Global corner radius (e.g., `12`) |
| `showSeconds` | boolean | Show seconds in clock |
| `useFahrenheit` | boolean | Temperature unit (true = °F) |
| `controlCenterShowMicPercent` | boolean | Show mic level as percentage |
| `appsDockColorizeActive` | boolean | Colorize active dock app |
| `appsDockEnlargeOnHover` | boolean | Enlarge dock icons on hover |
| `appsDockIconSizePercentage` | number | Dock icon size percentage (e.g., `125`) |
| `fontScale` | number | Global font scale factor (e.g., `1.25`) |
| `acMonitorTimeout` | number | AC monitor timeout (seconds) |
| `acLockTimeout` | number | AC lock timeout (seconds) |
| `acSuspendTimeout` | number | AC suspend timeout (seconds) |
| `lockBeforeSuspend` | boolean | Lock screen before suspend |
| `osdPowerProfileEnabled` | boolean | Show power profile OSD |
| `configVersion` | number | Settings schema version |

#### Cursor Settings (`cursorSettings`)

```json
{
  "theme": "System Default",
  "size": 24,
  "niri": { "hideWhenTyping": false, "hideAfterInactiveMs": 0 },
  "hyprland": { "hideOnKeyPress": false, "hideOnTouch": false, "inactiveTimeout": 0 },
  "mango": { "cursorHideTimeout": 0 }
}
```

#### Bar Configuration (`barConfigs`)

Array of bar configurations. Each bar has:

| Key | Type | Description |
|---|---|---|
| `id` | string | Unique bar identifier |
| `name` | string | Display name |
| `enabled` | boolean | Enable/disable bar |
| `position` | number | Bar position (0=bottom, 1=top, 2=left, 3=right) |
| `screenPreferences` | array | Which screens to show on (e.g., `["all"]`) |
| `showOnLastDisplay` | boolean | Show only on last display |
| `leftWidgets` | array | Left section widgets |
| `centerWidgets` | array | Center section widgets |
| `rightWidgets` | array | Right section widgets |
| `spacing` | number | Widget spacing |
| `innerPadding` | number | Inner padding |
| `transparency` | number | Bar transparency (0-1) |
| `widgetTransparency` | number | Widget transparency (0-1) |
| `squareCorners` | boolean | Disable rounded corners |
| `noBackground` | boolean | Remove background |
| `fontScale` | number | Bar-specific font scale |
| `iconScale` | number | Bar-specific icon scale |
| `autoHide` | boolean | Auto-hide bar |
| `autoHideDelay` | number | Auto-hide delay (ms) |
| `visible` | boolean | Bar visibility |
| `scrollEnabled` | boolean | Enable scrolling |
| `scrollXBehavior` | string | Horizontal scroll behavior ("column") |
| `scrollYBehavior` | string | Vertical scroll behavior ("workspace") |
| `shadowIntensity` | number | Shadow intensity |
| `shadowOpacity` | number | Shadow opacity |
| `clickThrough` | boolean | Allow click-through |
| `hoverPopouts` | boolean | Enable hover popouts |

#### Widget entries in bar sections

Widgets can be simple strings (e.g., `"clock"`) or objects with configuration:

```json
{
  "id": "systemMonitor",
  "enabled": true
}
```

Available built-in widgets: `launcherButton`, `workspaceSwitcher`, `appsDock`, `clock`, `weather`, `systemTray`, `clipboard`, `notificationButton`, `battery`, `controlCenterButton`.

### Plugin Settings (`~/.config/DankMaterialShell/plugin_settings.json`)

Per-plugin configuration. Each plugin ID has its own settings block:

```json
{
  "systemMonitor": {
    "enabled": true,
    "cpuShowValue": true,
    "tempShowValue": true,
    "showCpuFreq": true,
    "cpuFreqShowValue": true,
    "memShowValue": true,
    "diskShowValue": true,
    "showGpu": true,
    "gpuPciId": "10de:2d04",
    "gpuShowValue": true,
    "showGpuUtil": true,
    "showGpuMemUtil": true,
    "showGpuPower": true,
    "gpuUtilShowValue": true,
    "gpuMemUtilShowValue": true,
    "gpuPowerShowValue": true,
    "chartWidth": 40,
    "historyLength": 121
  }
}
```

### dgop Configuration (`~/.config/dgop/`)

- **`colors.json`** — UI, chart, progress bar, temperature, and status colors for the system monitor TUI
- **`keybinds.json`** — Keybindings for dgop (vim-style: j/k nav, q quit, / search, c/m/n/p sort)

### Generated/Propagated Theme Files

DMS generates theme files for other applications:

| Target | Path | Format |
|---|---|---|
| GTK3 | `~/.config/gtk-3.0/dank-colors.css` | CSS `@define-color` |
| GTK4 | `~/.config/gtk-4.0/dank-colors.css` | CSS `@define-color` |
| kitty | `~/.config/kitty/dank-theme.conf` | kitty config |
| kitty tabs | `~/.config/kitty/dank-tabs.conf` | Tab bar styling |
| foot | `~/.config/foot/dank-colors.ini` | INI colors |
| alacritty | `~/.config/alacritty/dank-theme.toml` | TOML colors |

These are marked with `/* BEGIN DMS OVERRIDE */` / `/* END DMS OVERRIDE */` comments.

### Cache Files (`~/.cache/DankMaterialShell/`)

| File | Purpose |
|---|---|
| `dms-colors.json` | Generated color palette (dank16 + full token sets) |
| `notification_history.json` | Notification log |
| `launcher_cache.json` | Launcher cache |
| `matugen.lock` | Matugen lock file |
| `clipboard/db` | Clipboard history database |
| `imagecache/` | Cached artwork images |
| `notification_images/` | Notification screenshots |

## The `dms` CLI

`dms` is the management CLI and backend server. Key subcommands:

| Command | Purpose |
|---|---|
| `dms ipc call <target> <function> [args...]` | Send IPC commands to the running shell |
| `dms plugins install <plugin>` | Install a plugin |
| `dms plugins list` | List installed plugins |
| `dms config` | Configuration utilities |
| `dms matugen` | Generate Material Design themes |
| `dms color` | Color utilities |
| `dms keybinds` | Manage keybinds and cheatsheets |
| `dms clipboard` | Manage clipboard |
| `dms notify` | Send desktop notifications |
| `dms doctor` | Diagnose installation |
| `dms kill` | Kill running DMS processes |
| `dms dank16` | Generate Base16 color palettes |
| `dms backup` | Backup/restore config |

### IPC Targets (common)

- `bar` — toggle, hide, reveal, position, autoHide
- `launcher` — open, toggle, openQuery, openWith
- `dash` — open, toggle, openAt
- `dock` — toggle, hide, reveal
- `control-center` — open, toggle, hide
- `clipboard` — open, close, toggle
- `color-picker` — open, toggle
- `desktopWidget` — enable, disable, list
- `audio` — increment, decrement, mute, setvolume, status
- `brightness` — increment, decrement, set, status

Example:
```sh
dms ipc call bar toggle
dms ipc call launcher open
dms ipc call clipboard toggle
```

## Plugins

Plugins live in `~/.config/DankMaterialShell/plugins/`. Each plugin is a directory with:

- `plugin.json` — metadata (id, name, version, type, capabilities, component path)
- `*.qml` — QML component files (widget + settings)
- `screenshots/` — optional screenshots

### Plugin manifest (`plugin.json`)

```json
{
  "id": "systemMonitor",
  "name": "System Monitor",
  "description": "...",
  "version": "1.3.0",
  "author": "...",
  "icon": "monitoring",
  "type": "widget",
  "capabilities": ["dankbar-widget"],
  "component": "./SystemMonitorWidget.qml",
  "settings": "./SystemMonitorSettings.qml",
  "permissions": ["settings_read", "settings_write"],
  "requires_dms": ">=1.5.0"
}
```

### Plugin lockfile

`~/.config/DankMaterialShell/plugins.lock.json` tracks installed plugin repos and commits.

### Current plugins on this machine

- **systemMonitor** (v1.3.0) — by Christoforos Aslanov. Real-time CPU, temp, RAM, network, disk, GPU charts in the bar. Uses `dgop` for stats. Repo: `https://github.com/chr314/dms-system-monitor`.

## Themes

Themes live in `~/.config/DankMaterialShell/themes/`. Each theme is a directory with:

- `theme.json` — theme manifest with color tokens
- `preview-dark.svg`, `preview-light.svg` — preview images

### Theme structure (`theme.json`)

Themes use Material Design color tokens: `surface`, `surfaceText`, `background`, `backgroundText`, `primary`, `secondary`, `tertiary`, `error`, `warning`, `info`, `outline`, `surfaceContainer`, `surfaceContainerHigh`, `surfaceContainerHighest`, etc.

Themes can have **variants** (flavors + accents). The Catppuccin theme has 4 flavors (Mocha, Macchiato, Frappé, Latte) and 13 accent colors.

### Current themes on this machine

- **catppuccin** (v1.0.0) — by Avenge Media. Multi-variant theme with Mocha/Macchiato/Frappé/Latte flavors and 13 accent options. Default dark accent: mauve/mocha. Default light accent: mauve/latte.

## Color Propagation

DMS propagates colors to other applications via **Matugen** integration:

| Target | Config file | Format |
|---|---|---|
| GTK3 | `~/.config/gtk-3.0/dank-colors.css` | CSS with `@define-color` |
| GTK4 | `~/.config/gtk-4.0/dank-colors.css` | CSS with `@define-color` |
| kitty | `~/.config/kitty/dank-theme.conf` | kitty config |
| kitty tabs | `~/.config/kitty/dank-tabs.conf` | tab bar styling |
| foot | `~/.config/foot/dank-colors.ini` | INI colors |
| alacritty | `~/.config/alacritty/dank-theme.toml` | TOML colors |

The generated color palette is stored in `~/.cache/DankMaterialShell/dms-colors.json` and includes:
- `dank16` — Base16 palette (color0–color15)
- `colors.dark` / `colors.light` — full Material Design token sets

### Current color scheme

The active scheme on this machine uses a **blue** palette (source color `#42a5f5`):
- Background: `#101418` (dark), `#f7f9ff` (light)
- Primary: `#42a5f5` (dark), `#1976d2` (light)
- Secondary: `#8ab4f8`
- Error: `#f2b8b5`
- Surface containers: `#1d2024`, `#272a2f`

## dgop (DMS System Stats Backend)

`dgop` provides system statistics to DMS. Config in `~/.config/dgop/`:

- `colors.json` — UI, chart, progress bar, temperature, and status colors
- `keybinds.json` — vim-style keybindings (j/k nav, q quit, / search, etc.)

## Cache Files

| File | Purpose |
|---|---|
| `~/.cache/DankMaterialShell/dms-colors.json` | Generated color palette |
| `~/.cache/DankMaterialShell/notification_history.json` | Notification log |
| `~/.cache/DankMaterialShell/launcher_cache.json` | Launcher cache |
| `~/.cache/DankMaterialShell/matugen.lock` | Matugen lock file |
| `~/.cache/DankMaterialShell/clipboard/db` | Clipboard history |
| `~/.cache/DankMaterialShell/imagecache/` | Cached artwork images |
| `~/.cache/DankMaterialShell/notification_images/` | Notification screenshots |

## Useful Commands

```sh
# IPC control
dms ipc call bar toggle
dms ipc call launcher open
dms ipc call clipboard toggle
dms ipc call control-center toggle

# Plugin management
dms plugins list
dms plugins install systemMonitor
dms ipc call plugins reload systemMonitor

# Theme generation
dms matugen
dms dank16

# Diagnostics
dms doctor
dms config

# Kill/restart
dms kill
```

## QML Plugin Development

Plugins use QML with DMS-specific imports:
```qml
import QtQuick
import qs.Common
import qs.Services
import qs.Widgets
import qs.Modules.Plugins
```

Key DMS QML components:
- `PluginComponent` — base for widgets
- `PluginSettings` — base for settings panels
- `DgopService` — system stats service (CPU, memory, network, disk, GPU)
- `Theme` — current theme colors
- `DankIcon`, `DankActionButton`, `DankTabBar` — UI components
- `StyledText`, `SliderSetting`, `ToggleSetting`, `ColorSetting`, `SelectionSetting` — settings widgets

## Website

- Project: https://danklinux.com/
