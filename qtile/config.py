import os

from typing import List  # noqa: F401
import subprocess
from libqtile import bar, layout, widget, hook,qtile
from libqtile.config import Click, Drag, Group, Key, Match, Screen, Rule
from libqtile.lazy import lazy
from libqtile.utils import guess_terminal
from qtile_extras import widget
from qtile_extras.widget.decorations import PowerLineDecoration
from qtile_extras.widget.decorations import RectDecoration
from qtile_extras import widget

@lazy.function 
def decrease(qtile):
    qtile.current_layout.shrink()


@lazy.function 
def increase(qtile):
    qtile.current_layout.grow()



@lazy.function 
def move_left(qtile):
    qtile.current_layout.shuffle_up()

@lazy.function 
def move_right(qtile):
    qtile.current_layout.shuffle_down()

@lazy.function 
def close(qtile):
    qtile.current_window.kill()

@lazy.function 
def minimize(qtile):
    qtile.current_window.toggle_minimize()

@lazy.function 
def maximize(qtile):
    qtile.current_window.toggle_maximize()



mod = "mod4"
terminal = guess_terminal()
fg_color="#cccccc"
bg_color="#202020"
alert_color="#c75f5f"
bg_color_alt1="#305080"


home = os.path.expanduser('~')
icons = home + '/.config/icons/'

keys = [

##### Window Operations start #########

    # Switch between windows
    Key(["mod1"], "Tab", lazy.layout.down(), desc="Move focus down"),


#    Key([mod], "Left", lazy.layout.left(), desc="Move focus to left"),
#    Key([mod], "Right", lazy.layout.right(), desc="Move focus to right"),
#    Key(["mod1"], "space", lazy.spawn("rofi -show drun")),
#    Key([mod], "Up", lazy.layout.up(), desc="Move focus up"),
#    Key([mod], "Tab", lazy.layout.next(), desc="Move window focus to other window"),


    # Move window 
    Key([mod], "Left",lazy.layout.shuffle_up(),lazy.layout.section_down(),desc='Move windows down in current stack'),
    Key([mod], "Right",lazy.layout.shuffle_down(), lazy.layout.section_up(), desc='Move windows up in current stack'),



    Key([mod], "Up", lazy.window.toggle_maximize(), desc="Toggle maximize"),  
    Key([mod], "Down", lazy.window.toggle_minimize(), desc="Toggle minimize"),  


    # RESIZE Windows
    Key([mod, "control"], "Right",lazy.layout.grow_right(),lazy.layout.grow(),lazy.layout.increase_ratio(),lazy.layout.delete(),),
    Key([mod, "control"], "Left",lazy.layout.grow_left(),lazy.layout.shrink(),lazy.layout.decrease_ratio(),lazy.layout.add(),),
    Key([mod, "control"], "Up",lazy.layout.grow_up(),lazy.layout.grow(),lazy.layout.decrease_nmaster(),),
    Key([mod, "control"], "Down",lazy.layout.grow_down(),lazy.layout.shrink(),lazy.layout.increase_nmaster(),),


    # Move windows between left/right columns or move up/down in current stack.
    # Moving out of range in Columns layout will create new column.
    Key([mod, "shift"], "Left", lazy.layout.shuffle_left(),  desc="Move window to the left"),
    Key([mod, "shift"], "Right", lazy.layout.shuffle_right(), desc="Move window to the right"),
    Key([mod, "shift"], "Down", lazy.layout.shuffle_down(), desc="Move window down"),
    Key([mod, "shift"], "Up", lazy.layout.shuffle_up(), desc="Move window up"),

    Key([mod], "n",  lazy.layout.normalize(),         desc="Reset all window sizes"),
    Key([mod], 'f', lazy.window.toggle_fullscreen()),


    # Toggle between split and unsplit sides of stack.
    # Split = all windows displayed
    # Unsplit = 1 window displayed, like Max layout, but still with
    # multiple stack panes
    Key([mod, "shift"], "Return", lazy.layout.toggle_split(),
        desc="Toggle between split and unsplit sides of stack"),


    Key([mod], "q", lazy.window.kill(),     desc="Kill focused window"),


##### Window Operations End #########

    # System Commands
    Key([mod], "x", lazy.restart(), desc="Restart Qtile"),
    Key([mod, "control"], "x", lazy.shutdown(), desc="Shutdown Qtile"),
    Key([mod], "Tab", lazy.next_layout(),   desc="Toggle between layouts"),


    #Launchers
    Key(["mod1"], "space", lazy.spawn("rofi -show drun")),
    Key([mod], "space", lazy.spawncmd(), desc="Command prompt widget"),
    Key([mod], "Return", lazy.spawn(terminal), desc="Launch terminal"),
    Key([mod], "b", lazy.spawn("google-chrome-stable"), desc="Launch Browser"),
    Key([mod], "c", lazy.spawn("code"),                 desc="Launch Code"),
    Key([mod], "z", lazy.spawn("zoom"),                 desc="Launch Zoom"),
    Key([mod], "p", lazy.spawn("/opt/PixInsight/bin/PixInsight.sh -n"),  desc="Launch PixInsight"),
    Key([mod], "t", lazy.spawn("teams"), desc="Launch Teams"),    
#    Key([mod], "f", lazy.spawn("freecad"), desc="Launch FreeCAD"),    
    Key([mod], "j", lazy.spawn("joplin-desktop"), desc="Launch Joplin"),
    Key([mod], "v", lazy.spawn("vncviewer"), desc="VNC"),
    Key([mod], "s", lazy.spawn("systemctl suspend"), desc="Suspend"),
]

groups = [
        Group(name='1', matches=None, spawn='google-chrome-stable', layout="MonadTall", label='1:main',position=1),
        Group(name='2', matches=[Match(wm_class=["PixInsight"])], spawn='/opt/PixInsight/bin/PixInsight.sh -n=1', layout="MonadTall", label='2:PI1',position=2),
        Group(name='3', matches=[Match(wm_class=["code"]),Match(title=["INDI Control Panel"]) ], spawn='code', layout="MonadTall", label='3:Dev',position=3),
        Group(name='4', matches=[Match(title=["KStars"])], spawn='vncviewer', layout="MonadTall", label='4:Astro',position=4),
        Group(name='5', matches=None,  layout="MonadTall", label='5:CAD',position=5),

    ]


for i in groups:
    keys.extend([
        # mod1 + letter of group = switch to group
        Key([mod], i.name, lazy.group[i.name].toscreen(),
            desc="Switch to group {}".format(i.name)),

        # mod1 + shift + letter of group = switch to & move focused window to group
        Key([mod, "shift"], i.name, lazy.window.togroup(i.name, switch_group=True),
            desc="Switch to & move focused window to group {}".format(i.name)),
        # Or, use below if you prefer not to switch to that group.
        # # mod1 + shift + letter of group = move focused window to group
        # Key([mod, "shift"], i.name, lazy.window.togroup(i.name),
        #     desc="move focused window to group {}".format(i.name)),
    ])

layouts = [
    #layout.Columns(border_focus_stack=['#d75f5f', '#8f3d3d'], border_width=4),
    layout.Max(),
    # Try more layouts by unleashing below layouts.
    #layout.Stack(num_stacks=2),
    #layout.Bsp(),
    #layout.Matrix(),
    layout.MonadTall(),
    #layout.MonadWide(),
    #layout.RatioTile(),
    #layout.Tile(),
    #layout.TreeTab(),
    #layout.VerticalTile(),
    #layout.Zoomy(),
]


powerline = {
    "decorations": [

        PowerLineDecoration(path='rounded_left')        
    ]
}


widget_defaults = dict(
    font='Roboto Condensed',
    fontsize=16,
    padding=10,
    foreground=fg_color, 
    background=bg_color,

)
extension_defaults = widget_defaults.copy()

screens = [
    Screen(

        wallpaper='~/.config/qtile/M33.jpg',
        wallpaper_mode='fill',

        top=bar.Bar(
            [

                widget.GroupBox(background=bg_color_alt1, highlight_method='block', this_current_screen_border="009999", **powerline),

                widget.Prompt(),

                widget.TextBox("  "),

                widget.Image(filename = "~/.config/qtile/icons/code.png",  mouse_callbacks = {'Button1': lambda: qtile.cmd_spawn("code")}),
                widget.Image(filename = "~/.config/qtile/icons/joplin.png",  mouse_callbacks = {'Button1': lambda: qtile.cmd_spawn("joplin-desktop")}),
                widget.Image(filename = "~/.config/qtile/icons/octopi.png",  mouse_callbacks = {'Button1': lambda: qtile.cmd_spawn("/usr/bin/octopi")}),
                widget.Image(filename = "~/.config/qtile/icons/freecad.png",  mouse_callbacks = {'Button1': lambda: qtile.cmd_spawn("freecad")}),
                widget.Image(filename = "~/.config/qtile/icons/chrome.png",  mouse_callbacks = {'Button1': lambda: qtile.cmd_spawn("google-chrome-stable")}),
                widget.Image(filename = "~/.config/qtile/icons/kstars.png",  mouse_callbacks = {'Button1': lambda: qtile.cmd_spawn("kstars")}),
                widget.Image(filename = "~/.config/qtile/icons/nemo.png",  mouse_callbacks = {'Button1': lambda: qtile.cmd_spawn("nemo")}),
                widget.Image(filename = "~/.config/qtile/icons/terminator.png",  mouse_callbacks = {'Button1': lambda: qtile.cmd_spawn("alacritty")}),

                widget.TextBox("  "),

                widget.TaskList(padding=2, margin = 0 ,icon_size=18, max_title_width = 300, highlight_method="block" ),


                widget.Volume( fmt = '{} '),

  
                widget.TextBox("  ",  background=bg_color , foreground=fg_color, **powerline),

                widget.CurrentLayoutIcon(background=bg_color_alt1, **powerline),
                widget.TextBox("🠨",  mouse_callbacks = {'Button1': move_left}, background=bg_color_alt1, **powerline),
                widget.TextBox("🠪",  mouse_callbacks = {'Button1': move_right}, background=bg_color_alt1, **powerline),
                widget.TextBox("🡆",  mouse_callbacks = {'Button1': increase}, background=bg_color_alt1, **powerline),
#                widget.Sep(),
                widget.TextBox("🡄",  mouse_callbacks = {'Button1': decrease}, background=bg_color_alt1, **powerline),
                widget.TextBox("🞏",  mouse_callbacks = {'Button1': maximize}, background=bg_color_alt1, **powerline),
                widget.TextBox("🞃",  mouse_callbacks = {'Button1': minimize}, background=bg_color_alt1, **powerline),
                widget.TextBox("🞮",  mouse_callbacks = {'Button1': close}, background=bg_color_alt1, **powerline),


                widget.TextBox(text = "",  font = "JetBrainsMono Nerd Font", ),
                widget.CPU(),
                widget.CPUGraph(),

                widget.TextBox(text = "", font = "JetBrainsMono Nerd Font",),
                widget.Memory(),
                widget.MemoryGraph(),

                widget.TextBox(text = "🖧", font = "JetBrainsMono Nerd Font",),
                widget.NetGraph(),


                widget.OpenWeather( app_key="ec7ed767f9ca851136134f04d9a3177d",  location="Parsippany", format='{icon} {temp}°C {clouds_all}%  {wind_speed}km/h'),
                widget.Sep(),
                widget.KeyboardLayout(configured_keyboards=['us', 'ru'],foreground=fg_color),
                widget.Sep(),
                widget.CheckUpdates(display_format="{updates} Pkg Updates",
                                    colour_no_updates=fg_color,
                                    colour_have_updates="FF0000",
                                    distro='Arch_Sup',
                                    execute=lazy.spawn("/usr/bin/octopi"),
                                    foreground=fg_color),

                widget.Systray(),
                widget.Clock(format='%Y-%m-%d %a %I:%M:%S %p'),

                widget.QuickExit(default_text=" ⏻ "),

            ],
            24,
        ),
    ),
]


# Drag floating layouts.
mouse = [
    Drag([mod], "Button1", lazy.window.set_position_floating(),
         start=lazy.window.get_position()),
    Drag([mod], "Button3", lazy.window.set_size_floating(),
         start=lazy.window.get_size()),
    Click([mod], "Button2", lazy.window.bring_to_front()),

    Click([], "Button9", lazy.window.toggle_maximize()),
    Click([], "Button8", lazy.window.toggle_minimize())    

]

dgroups_key_binder = None
dgroups_app_rules = [Rule(Match(title=['INDI Control Panel - KStars']), group="1:main"),]  # type: List
follow_mouse_focus = False
bring_front_click = False
cursor_warp = False
floating_layout = layout.Floating(float_rules=[
    # Run the utility of `xprop` to see the wm class and name of an X client.
    *layout.Floating.default_float_rules,
    Match(wm_class='confirmreset'),  # gitk
    Match(wm_class='makebranch'),  # gitk
    Match(wm_class='maketag'),  # gitk
    Match(wm_class='ssh-askpass'),  # ssh-askpass
    Match(title='branchdialog'),  # gitk
    Match(title='pinentry'),  # GPG key password entry
])
auto_fullscreen = True
focus_on_window_activation = "smart"
reconfigure_screens = True


@hook.subscribe.startup
def autostart():
    home = os.path.expanduser('~/.config/qtile/autostart.sh')
    subprocess.Popen([home])

# If things like steam games want to auto-minimize themselves when losing
# focus, should we respect this or not?
auto_minimize = True

# XXX: Gasp! We're lying here. In fact, nobody really uses or cares about this
# string besides java UI toolkits; you can see several discussions on the
# mailing lists, GitHub issues, and other WM documentation that suggest setting
# this string if your java app doesn't work correctly. We may as well just lie
# and say that we're a working one by default.
#
# We choose LG3D to maximize irony: it is a 3D non-reparenting WM written in
# java that happens to be on java's whitelist.
wmname = "LG3D"
