#!/bin/zsh
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js 20 이상이 필요합니다. https://nodejs.org/en/download 에서 Mac용 설치 파일을 받아 설치한 뒤 다시 열어 주세요. README의 AI 설치 요청을 사용해도 됩니다.'
  read '?아무 키나 누르면 닫힙니다.'
  exit 1
fi
node bin/launch.mjs
