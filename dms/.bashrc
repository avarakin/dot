# If not running interactively, don't do anything else (leave this above the rc source)
[[ $- != *i* ]] && return

# Add your own exports, aliases, and functions here.
#
# Make an alias for invoking commands you use constantly
# alias p='python'
#

# herdr: attach to remote workspace over SSH
alias ws='herdr --remote ws'

export PATH="$HOME/scripts:$PATH"

export LLAMA_CPP_BASE_URL=http://ws:8080


# Bash history
HISTFILE="$HOME/.bash_history"
HISTSIZE=100000
HISTFILESIZE=200000

# Append rather than overwrite history
shopt -s histappend

# Write each command to the history file immediately
PROMPT_COMMAND="history -a${PROMPT_COMMAND:+;$PROMPT_COMMAND}"

# Useful history behavior
HISTCONTROL=ignoredups:erasedups
HISTTIMEFORMAT='%F %T '
eval "$(mise activate bash)"

fastfetch

# Hermes Agent command
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac


# Machine-specific settings
case "$HOSTNAME" in
  ws) export QT_SCALE_FACTOR=1.5 ;;
esac

# Run a GUI app that lives on the `ws` server, displayed on this machine.
# -C <dir> sets the remote working directory (ccdciel needs its project dir as cwd).
# Note the nested single quotes: ssh/waypipe join args with spaces and drop local
# quoting, so `cd dir && app` would otherwise split at `&&` and escape waypipe.
ws-gui() {
    local dir=""
    [[ $1 == -C ]] && { dir=$2; shift 2; }
    local cmd="env QT_QPA_PLATFORM=wayland $*"
    [[ -n $dir ]] && cmd="cd $dir && $cmd"
    waypipe -n ssh ws sh -c "'$cmd'"
}

ccd() { ws-gui -C /home/alex/Projects/ccdciel ./src/ccdciel "$@"; }

PI()  { ws-gui /opt/PixInsight/bin/PixInsight.sh; }

. $HOME/secrets.sh

