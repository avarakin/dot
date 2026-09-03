import XMonad

import XMonad.Hooks.DynamicLog
import XMonad.Hooks.ManageDocks
import XMonad.Hooks.ManageHelpers
import XMonad.Hooks.StatusBar
import XMonad.Hooks.StatusBar.PP
import XMonad.Actions.SpawnOn

import XMonad.Actions.DwmPromote   -- swap master like dwm
import XMonad.Actions.CycleWindows -- classic alt-tab
import XMonad.Actions.CycleWS      -- cycle workspaces
import XMonad.Hooks.EwmhDesktops   -- for rofi/wmctrl
import XMonad.Layout.ResizableTile -- for resizeable tall layout
import XMonad.Layout.MouseResizableTile -- for mouse control
import XMonad.Layout.ThreeColumns  -- for three column layout
import XMonad.Layout.Grid          -- for additional grid layout
import XMonad.Layout.NoBorders     -- for fullscreen without borders
import XMonad.Layout.Fullscreen    -- fullscreen mode

import XMonad.Util.EZConfig
import XMonad.Util.Loggers
import XMonad.Util.Ungrab

import XMonad.Layout.Magnifier
import XMonad.Layout.ThreeColumns

import XMonad.Hooks.EwmhDesktops


myStartupHook :: X()
myStartupHook = do
     spawnOn "4" "/usr/bin/google-chrome-stable"
     spawn "nm-applet"
     spawn "mate-panel"

main :: IO ()
main = xmonad
     . ewmhFullscreen
     . ewmh
     . withEasySB (statusBarProp "xmobar" (pure myXmobarPP)) defToggleStrutsKey
     $ myConfig

myConfig = def
    { modMask    = mod4Mask      -- Rebind Mod to the Super key
    , layoutHook = myLayout      -- Use custom layouts
    , workspaces = myWorkspaces
    , startupHook = myStartupHook
    , manageHook = myManageHook  -- Match on certain windows
    }
  `additionalKeysP` myKeys


-- | Build workspace switching bindings for each workspace.
--   M-1..M-0     -> view workspace N
--   M-S-1..M-S-0 -> shift window to workspace N
myWSKeys :: [(String, X ())]
myWSKeys =
    [ (keyView i c,  windows (W.view i))
    , (keyShift i c, windows (W.shift i))
    | (i, c) <- zip [1..] "1234567890"
    ]
  where
    keyView  n c = "M-"  ++ c : ""
    keyShift n c = "M-S-" ++ c : ""


-- | All keyboard shortcuts, migrated from Hyprland + preserved from existing Xmonad config.
myKeys :: [(String, X ())]
myKeys =
    [ -- === Window management ===
      ("M-<Q>"     , kill)                                                    -- kill focused window (Hyprland: M-Q)
    , ("M-<X>"     , io (exitWith ExitSuccess))                              -- exit xmonad (Hyprland: M-X)
    , ("M-<Return>", dwmpromote)                                             -- promote to master (Hyprland: M-Return)

      -- === Layout / window state ===
    , ("M-V"      , withFocused toggleFullscreen)                            -- toggle fullscreen (Hyprland: M-V)

      -- === Launchers ===
    , ("M-<Space>" , spawn "rofi -show run -theme Monokai")                  -- app launcher (Hyprland: M-Space)
    , ("M-<F3>"    , spawn "rofi -show window -theme Monokai")               -- window switcher (Hyprland: M-F3)

      -- === Navigation ===
    , ("M-<Tab>"   , toggleWS)                                               -- toggle last workspace (Hyprland: M-Tab)
    , ("M-<Right>" , nextWS)                                                 -- next workspace (Hyprland: M-Right)
    , ("M-<Left>"  , prevWS)                                                 -- prev workspace (Hyprland: M-Left)
    , ("M-S-<Right>", shiftToNext)                                           -- move window to next workspace
    , ("M-S-<Left>" , shiftToPrev)                                           -- move window to prev workspace

      -- === Apps ===
    , ("M-<T>"     , spawn "ghostty")                                        -- terminal (Hyprland: M-T)
    , ("M-<F>"     , spawn "dolphin")                                        -- file manager (Hyprland: M-F)
    , ("M-<G>"     , spawn "google-chrome-stable")                           -- browser (Hyprland: M-G)
    , ("M-<C>"     , spawn "kcalc")                                          -- calculator
    , ("M-<J>"     , spawn "joplin")                                         -- notes (Hyprland: M-J)
    , ("M-<R>"     , spawn "xmonad --restart")                               -- restart xmonad (Hyprland: M-R)

      -- === Media keys (with Mod4 modifier like Hyprland) ===
    , ("M-<XF86AudioRaiseVolume>", spawn "wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%+")
    , ("M-<XF86AudioLowerVolume>", spawn "wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-")
    , ("M-<XF86AudioMute>"       , spawn "wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle")
    , ("M-<XF86AudioMicMute>"    , spawn "wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle")
    , ("M-<XF86AudioNext>"       , spawn "playerctl next")
    , ("M-<XF86AudioPause>"      , spawn "playerctl play-pause")
    , ("M-<XF86AudioPlay>"       , spawn "playerctl play-pause")
    , ("M-<XF86AudioPrev>"       , spawn "playerctl previous")

      -- === Workspace switching (generated) ===
    ] ++ myWSKeys


myLayout = smartBorders (
--ResizableTall 1 (3/100) (1/2) []
--                        ||| Mirror (ResizableTall 1 (3/100) (3/4) [])
--                        ||| Grid
--                        ||| ThreeColMid 1 (3/100) (1/2)
                        noBorders Full
                        ||| mouseResizableTile)


myManageHook :: ManageHook
myManageHook = composeAll
    [ className =? "Gimp" --> doFloat
    , isDialog            --> doFloat
    ]


myWorkspaces = ["Main","PI1","PI2","Dev","Imaging","Work"]

myXmobarPP :: PP
myXmobarPP = def
    { ppSep             = magenta " • "
    , ppTitleSanitize   = xmobarStrip
    , ppCurrent         = wrap " " "" . xmobarBorder "Top" "#8be9fd" 2
    , ppHidden          = white . wrap " " ""
    , ppHiddenNoWindows = lowWhite . wrap " " ""
    , ppUrgent          = red . wrap (yellow "!") (yellow "!")
    , ppOrder           = \[ws, l, _, wins] -> [ws, l, wins]
    , ppExtras          = [logTitles formatFocused formatUnfocused]
    }
  where
    formatFocused   = wrap (white    "[") (white    "]") . magenta . ppWindow
    formatUnfocused = wrap (lowWhite "[") (lowWhite "]") . blue    . ppWindow

    -- | Windows should have *some* title, which should not not exceed a
    -- sane length.
    ppWindow :: String -> String
    ppWindow = xmobarRaw . (\w -> if null w then "untitled" else w) . shorten 30

    blue, lowWhite, magenta, red, white, yellow :: String -> String
    magenta  = xmobarColor "#ff79c6" ""
    blue     = xmobarColor "#bd93f9" ""
    white    = xmobarColor "#f8f8f2" ""
    yellow   = xmobarColor "#f1fa8c" ""
    red      = xmobarColor "#ff5555" ""
    lowWhite = xmobarColor "#bbbbbb" ""
