# yacd bash 补全 —— 选择性 source(与主入口解耦)
# 用法: source deploy/completions/yacd.bash
_yacd_complete() {
  local cur prev
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  # 一级子命令
  local commands="up rebuild start stop restart logs status down clean network install update self-update uninstall version config help"

  case "$prev" in
    config)
      COMPREPLY=( $(compgen -W "show edit reload path" -- "$cur") )
      return
      ;;
    *)
      COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
      return
      ;;
  esac
}
complete -F _yacd_complete yacd
complete -F _yacd_complete manage.sh
