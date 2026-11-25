#!/usr/bin/env node
import {execFileSync} from 'node:child_process';import path from 'node:path';import {existsSync} from 'node:fs';import {parseRemote} from '../lib/bitbucket.mjs';
const [remote,destination]=process.argv.slice(2);
try{if(!remote||!destination)throw Error('사용법: node bin/connect-bitbucket.mjs https://bitbucket.org/팀/저장소.git 새폴더');if(parseRemote(remote).provider!=='bitbucket')throw Error('Bitbucket 주소를 입력하세요.');const dir=path.resolve(destination);if(existsSync(dir))throw Error('기존 폴더를 덮어쓰지 않습니다. 새로운 폴더를 지정하세요.');execFileSync('git',['clone','--',remote,dir],{stdio:'inherit'});console.log('저장소 연결 완료: '+dir);console.log('기존 ZIP 폴더는 유지됩니다. 기존 수정은 diff 검토 후 필요한 부분만 옮기세요.');}catch(error){console.error(error.message);process.exitCode=1;}
