#!/bin/zsh
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js 20 이상이 필요합니다. 개발자에게 최초 설치를 요청한 뒤 이 파일을 다시 열어 주세요.'
  read '?아무 키나 누르면 닫힙니다.'
  exit 1
fi
node bin/launch.mjs
