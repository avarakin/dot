# If not running interactively, don't do anything else (leave this above the rc source)
[[ $- != *i* ]] && return

# Add your own exports, aliases, and functions here.
#
# Make an alias for invoking commands you use constantly
# alias p='python'
#

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
