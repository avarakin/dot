-- Local Hyprland overrides — loaded from hyprland.lua via require("local")

hl.bind("mouse:276", hl.dsp.window.fullscreen({ mode = "maximized", action = "toggle" }))
hl.bind("mouse:275", hl.dsp.window.close())
hl.bind("SUPER + U", hl.dsp.exec_cmd("systemctl suspend"))
hl.bind("SUPER + L", hl.dsp.exec_cmd("alacritty -e env LLAMA_LAUNCH_MODE=preset ~/scripts/llama-launch.sh"))
hl.bind("SUPER + RETURN", hl.dsp.exec_cmd("kitty"))

-- Kill session (classic X11 Ctrl+Alt+Backspace)
hl.bind("ALT + CTRL + BackSpace", hl.dsp.exit())

-- ============================================================
-- Hyprland emergency recovery bindings
-- Super + Ctrl + Alt + F1..F6
-- ============================================================

-- F1 — Reload Hyprland configuration
hl.bind("SUPER + CTRL + ALT + F1", hl.dsp.exec_cmd("hyprctl reload"))

-- F2 — Force renderer reload
hl.bind("SUPER + CTRL + ALT + F2", hl.dsp.exec_cmd("hyprctl dispatch forcerendererreload"))

-- F3 — DPMS off/on
hl.bind("SUPER + CTRL + ALT + F3", hl.dsp.exec_cmd("sh -c 'hyprctl dispatch dpms off; sleep 2; hyprctl dispatch dpms on'"))

-- F4 — Renderer reload + DPMS cycle
hl.bind("SUPER + CTRL + ALT + F4", hl.dsp.exec_cmd("sh -c 'hyprctl dispatch forcerendererreload; sleep 2; hyprctl dispatch dpms off; sleep 2; hyprctl dispatch dpms on'"))

-- F5 — Force monitor reconfiguration
hl.bind("SUPER + CTRL + ALT + F5", hl.dsp.exec_cmd("sh -c 'hyprctl reload; sleep 2; hyprctl dispatch forcerendererreload'"))

-- F6 — Aggressive renderer + DPMS recovery
hl.bind("SUPER + CTRL + ALT + F6", hl.dsp.exec_cmd("sh -c 'hyprctl dispatch forcerendererreload; sleep 3; hyprctl dispatch dpms off; sleep 3; hyprctl dispatch dpms on; sleep 2; hyprctl reload'"))

hl.config({
    input = {
        kb_layout = "us,ru",
        kb_variant = ",phonetic",
        kb_options = "grp:alt_shift_toggle",
        follow_mouse = 0,
        sensitivity = 0,
        touchpad = {
            natural_scroll = false,
        },
    },
})

hl.config({
    general = {
    gaps_in = 2,
    gaps_out = 2,
    resize_on_border = true,
 --       layout = "master",
    },
})

--hl.env("__GLX_VENDOR_LIBRARY_NAME", "mesa")
--hl.env("LIBVA_DRIVER_NAME", "radeonsi")
--hl.env("WLR_NO_HARDWARE_CURSORS", "1")
--hl.env("XCURSOR_SIZE", "24")
--hl.env("HYPRCURSOR_SIZE", "24")

--hl.env("XDG_CURRENT_DESKTOP","Hyprland")
--hl.env("XDG_SESSION_TYPE","wayland")
