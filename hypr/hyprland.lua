-- HYPRLAND LUA CONFIGURATION
-- Migrated from hyprlang (.conf) format for Hyprland v0.55+
-- See: https://wiki.hypr.land/Configuring/Start/

---------------------
-- MONITORS --
---------------------

-- monitor configuration (auto-detected)
hl.monitor({
    output   = "",
    mode     = "preferred",
    position = "auto",
    scale    = "auto",
})

---------------------
-- XWAYLAND --
---------------------

hl.config({
    xwayland = {
        force_zero_scaling = true,
    },
})

---------------------
-- ENVIRONMENT --
---------------------

hl.env("WLR_NO_HARDWARE_CURSORS", "0")
hl.env("XCURSOR_SIZE", "24")
hl.env("HYPRCURSOR_SIZE", "24")

hl.env("XDG_CURRENT_DESKTOP","Hyprland")
hl.env("XDG_SESSION_TYPE","wayland")

---------------------
-- VARIABLES --
---------------------

-- Set programs that you use
local terminal    = "ghostty"
local fileManager = "nemo"
local menu        = "rofi -show drun"
local mainMod     = "SUPER"

---------------------
-- AUTOSTART --
---------------------




-- Autostart necessary processes
-- Use hl.on("hyprland.start", function() ...) for startup hooks
-- See https://wiki.hypr.land/Configuring/Basics/Autostart/


hl.on("hyprland.start", function()
    --hl.exec_cmd("/home/alex/.config/hypr/setup_monitor.sh")
    hl.exec_cmd("waybar")
    hl.exec_cmd("echo 0 | sudo tee /sys/devices/system/cpu/cpufreq/boost")
    hl.exec_cmd(terminal)
    hl.exec_cmd("env GTK_THEME=adwaita nm-applet")
    --hl.exec_cmd("telegram-desktop")
    hl.exec_cmd("dropbox start")
    hl.exec_cmd("swayidle -w timeout 600 'hyprctl dispatch dpms off' resume 'hyprctl dispatch dpms on' timeout 1800 'systemctl suspend'")
--    hl.exec_cmd("/usr/lib/x86_64-linux-gnu/libexec/polkit-kde-authentication-agent-1")
--    hl.exec_cmd("/usr/libexec/xdg-desktop-portal-hyprland")
    hl.exec_cmd("hyprpaper")
    hl.exec_cmd("cliphist store")
    hl.exec_cmd("wl-paste --type text --watch cliphist store")
    hl.exec_cmd("wl-paste --type image --watch cliphist store")
    hl.exec_cmd("xhost +local:")
    hl.exec_cmd("/usr/lib/polkit-gnome/polkit-gnome-authentication-agent-1")

end)

---------------------
-- LOOK AND FEEL --
---------------------

hl.monitor({ output = "", mode = "preferred", position = "auto", scale = 1.25 })

hl.config({
    general = {
        gaps_in = 2,
        gaps_out = 2,
        border_size = 2,
        col = {
            active_border = { colors = { "rgba(33ccffee)", "rgba(00ff99ee)" }, angle = 45 },
            inactive_border = "rgba(595959aa)",
        },
        resize_on_border = true,
        allow_tearing = false,
        layout = "master",
    },

    decoration = {
        rounding = 10,
        active_opacity = 1.0,
        inactive_opacity = 1.0,
        shadow = {
            enabled = false,
        },
        blur = {
            enabled = false,
            size = 3,
            passes = 1,
            vibrancy = 0.1696,
        },
    },

    debug = {
        disable_logs = false,
    },

    cursor = {
        no_warps = true,
    },

    misc = {
        force_default_wallpaper = 0,
        disable_hyprland_logo = false,
    },
})

---------------------
-- ANIMATIONS --
---------------------

hl.config({
    animations = {
        enabled = true,
    },
})

-- Custom bezier curve
hl.curve("myBezier", { type = "bezier", points = { { 0.05, 0.9 }, { 0.1, 1.05 } } })

hl.animation({ leaf = "global",        enabled = true,  speed = 10,   bezier = "myBezier" })
hl.animation({ leaf = "windows",       enabled = true,  speed = 7,    bezier = "myBezier" })
hl.animation({ leaf = "windowsOut",    enabled = true,  speed = 7,    bezier = "default",  style = "popin 80%" })
hl.animation({ leaf = "border",        enabled = true,  speed = 10,   bezier = "default" })
hl.animation({ leaf = "borderangle",   enabled = true,  speed = 8,    bezier = "default" })
hl.animation({ leaf = "fade",          enabled = true,  speed = 7,    bezier = "default" })
hl.animation({ leaf = "workspaces",    enabled = true,  speed = 6,    bezier = "default" })

---------------------
-- LAYOUTS --
---------------------

hl.config({
    dwindle = {
        preserve_split = true,
    },
})

hl.config({
    master = {
        new_status = "master",
    },
})

---------------------
-- INPUT --
---------------------

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

hl.device({
    name = "epic-mouse-v1",
    sensitivity = -0.5,
})

---------------------
-- KEYBINDINGS --
---------------------

-- Toggle terminal
hl.bind(mainMod .. " + T", hl.dsp.exec_cmd(terminal))
hl.bind(mainMod .. " + Q", hl.dsp.window.close())
hl.bind(mainMod .. " + X", hl.dsp.exit())
hl.bind("ALT + S", hl.dsp.exec_cmd("systemctl suspend"))
hl.bind("ALT + CONTROL + BackSpace", hl.dsp.exit())
hl.bind(mainMod .. " + F", hl.dsp.exec_cmd(fileManager))
hl.bind(mainMod .. " + V", hl.dsp.window.float({ action = "toggle" }))
hl.bind(mainMod .. " + space", hl.dsp.exec_cmd(menu))
hl.bind(mainMod .. " + P", hl.dsp.exec_cmd("hyprctl pseudo"))
hl.bind("f12", hl.dsp.exec_cmd("hyprctl dispatch fullscreen 1"))

-- Move focus with mainMod + arrow keys
hl.bind(mainMod .. " + left",   hl.dsp.focus({ direction = "left" }))
hl.bind(mainMod .. " + right",  hl.dsp.focus({ direction = "right" }))
hl.bind(mainMod .. " + up",     hl.dsp.focus({ direction = "up" }))
hl.bind(mainMod .. " + down",   hl.dsp.focus({ direction = "down" }))

-- Switch workspaces with mainMod + [0-9]
-- Move active window to a workspace with mainMod + SHIFT + [0-9]
for i = 1, 10 do
    local key = i % 10
    hl.bind(mainMod .. " + " .. key,             hl.dsp.focus({ workspace = i }))
    hl.bind(mainMod .. " + SHIFT + " .. key,     hl.dsp.window.move({ workspace = i }))
end

-- Special workspace (scratchpad)
hl.bind(mainMod .. " + S",         hl.dsp.workspace.toggle_special("magic"))
hl.bind(mainMod .. " + SHIFT + S", hl.dsp.window.move({ workspace = "special:magic" }))

-- Scroll through workspaces with mainMod + scroll
hl.bind(mainMod .. " + mouse_down", hl.dsp.focus({ workspace = "e+1" }))
hl.bind(mainMod .. " + mouse_up",   hl.dsp.focus({ workspace = "e-1" }))

hl.bind("ALT + TAB", function()
    hl.dispatch(hl.dsp.focus({ last = true }))
end)

-- Move/resize windows with mainMod + LMB/RMB and dragging
hl.bind(mainMod .. " + mouse:272", hl.dsp.window.drag(), { mouse = true })
hl.bind(mainMod .. " + mouse:273", hl.dsp.window.resize(), { mouse = true })

-- Mouse buttons
--hl.bind("mouse:276", hl.dispatch("fullscreen", "1"))
hl.bind("mouse:276", hl.dsp.window.fullscreen({ mode = "maximized", action = "toggle" }))

hl.bind("mouse:275", hl.dsp.window.close())

-- Laptop multimedia keys for volume and LCD brightness
hl.bind("XF86AudioRaiseVolume", hl.dsp.exec_cmd("wpctl set-volume -l 1 @DEFAULT_AUDIO_SINK@ 5%+"), { locked = true, repeating = true })
hl.bind("XF86AudioLowerVolume", hl.dsp.exec_cmd("wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-"),      { locked = true, repeating = true })
hl.bind("XF86AudioMute",        hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle"),     { locked = true, repeating = true })
hl.bind("XF86AudioMicMute",     hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle"),   { locked = true, repeating = true })
hl.bind("XF86MonBrightnessUp",  hl.dsp.exec_cmd("/home/alex/dot/hypr/brightness-exp.sh 5 up"),     { locked = true, repeating = true })
hl.bind("XF86MonBrightnessDown",hl.dsp.exec_cmd("/home/alex/dot/hypr/brightness-exp.sh 5 down"),   { locked = true, repeating = true })

-- Requires playerctl
hl.bind("XF86AudioNext",  hl.dsp.exec_cmd("playerctl next"),       { locked = true })
hl.bind("XF86AudioPause", hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioPlay",  hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioPrev",  hl.dsp.exec_cmd("playerctl previous"),   { locked = true })

-- Take screenshot
hl.bind("Print", hl.dsp.exec_cmd("grim -g \"$(slurp)\" - | wl-copy"))

-- Create kitty window for long running claude processes
hl.bind(mainMod .. " + k", hl.dsp.exec_cmd("kitty --class claude-terminal"))

---------------------
-- WINDOW RULES --
---------------------

-- VNC Viewer does not tile by default
hl.window_rule({
    name  = "vnc-tile",
    match = { class = "realvnc-vncviewer" },
    tile  = true,
})

-- Create kitty window for long running claude processes
hl.window_rule({
    name    = "claude-terminal-float",
    match   = { class = "claude-terminal" },
    float   = true,
    pin     = true,
    size    = "900 600",
    center  = true,
    opacity = 0.9,
})

hl.window_rule({
    name    = "bitwarden-float",
    match   = { title = "Bitwarden" },
    float   = true,
    size    = "400 600",
    center  = true,
})
