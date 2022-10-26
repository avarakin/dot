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


myKeys = [ ("M1-<Tab>"   , cycleRecentWindows [xK_Alt_L] xK_Tab xK_Tab ) -- classic alt-tab behaviour
         , ("M-<Return>" , dwmpromote                                  ) -- swap the focused window and the master window
         , ("M-<Tab>"    , toggleWS                                    ) -- toggle last workspace (super-tab)
         , ("M-<Right>"  , nextWS                                      ) -- go to next workspace
         , ("M-<Left>"   , prevWS                                      ) -- go to prev workspace
         , ("M-S-<Right>", shiftToNext                                 ) -- move client to next workspace
         , ("M-S-<Left>" , shiftToPrev                                 ) -- move client to prev workspace
         , ("M-c"        , spawn "kcalc"                               ) -- calc
         , ("M-<F2>"     , spawn "rofi -show run -theme Monokai"       ) -- rofi app launcher
         , ("M-<F3>"     , spawn "rofi -show window -theme Monokai"    ) -- rofi window switch
         , ("M-r"        , spawn "xmonad --restart"                    ) -- restart xmonad w/o recompiling
         , ("M-g"        , spawn "google-chrome-stable"                              ) -- launch browser
         , ("M-t"        , spawn "terminator"              ) -- launch system top
         , ("M-f"        , spawn "xfe"                                 ) -- launch xfe file manager
         , ("M-j"        , spawn "joplin"                          ) -- launch mindforger
         ]

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
