#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const port=Number(process.env.HARNESS_PORT||4317),url=`http://127.0.0.1:${port}`;
if(Number(process.versions.node.split('.')[0])<20){console.error('Node.js 20 이상이 필요합니다. 설치 후 Dragger를 다시 실행하세요.');process.exit(1);}
async function ready(){try{const r=await fetch(url+'/api/health',{signal:AbortSignal.timeout(700)});return r.ok&&(await r.json()).application==='dragger';}catch{return false;}}
function open(){if(process.env.DRAGGER_NO_OPEN==='1')return;const [cmd,args]=process.platform==='darwin'?['open',[url]]:process.platform==='win32'?['cmd',['/c','start','',url]]:['xdg-open',[url]];const p=spawn(cmd,args,{stdio:'ignore'});p.on('error',()=>console.log(`브라우저에서 ${url} 을 열어 주세요.`));}
if(await ready()){open();console.log('이미 실행 중인 Dragger를 열었습니다.');}else{
 const child=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{stdio:'inherit',env:process.env});let exited=false;child.on('exit',()=>{exited=true;});
 for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.on(signal,()=>child.kill(signal));
 let ok=false;for(let i=0;i<30&&!exited;i++){if(await ready()){ok=true;break;}await new Promise(r=>setTimeout(r,250));}
 if(ok){console.log('Dragger가 준비되었습니다. 이 창을 닫으면 Dragger 서버가 종료됩니다. 회사 서비스의 실행 창은 별도로 유지하세요.');open();}else{child.kill();console.error(`시작하지 못했습니다. ${port}번 포트를 다른 앱이 사용하는지 확인하세요.`);process.exitCode=1;}
}
