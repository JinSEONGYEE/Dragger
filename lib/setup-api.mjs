import {readFile,writeFile,mkdir,rename,realpath} from 'node:fs/promises';
import path from 'node:path';
import {sourceAPI} from './source-api.mjs';
import {serviceURL} from '../dist/model.mjs';
import {checkApp} from './app-check.mjs';
export function setupAPI(file,{env=process.env,createSource=sourceAPI,publicationRepository,request=fetch}={}){
 let current=null,handler=null,problem='',loading=null,busy=false;
 async function prepare(input){
  const name=typeof input.name==='string'?input.name.trim():'';
  if(!name||name.length>80)throw Error('서비스 이름을 입력하세요.');
  const url=serviceURL(input.url),u=new URL(url);if(u.search||u.hash)throw Error('연결 주소에는 로그인 정보나 검색 조건을 넣지 마세요. 화면 이동은 연결 후 사용할 수 있습니다.');
  if(typeof input.repo!=='string'||!path.isAbsolute(input.repo))throw Error('이 컴퓨터에 있는 서비스 원본 폴더의 전체 경로를 입력하세요.');
  let repo;try{repo=await realpath(input.repo);JSON.parse(await readFile(path.join(repo,'package.json'),'utf8'));}catch{throw Error('서비스 원본 폴더를 찾지 못했습니다. package.json이 있는 폴더를 선택하세요.');}
  let next;try{next=await createSource(repo,u.origin,{publicationRepository});}catch{throw Error('원본 연결 준비가 필요합니다. AI에게 이 서비스 폴더의 실행 준비와 TypeScript 설치를 요청하세요.');}
  return {config:{name,url,repo},next};
 }
 async function save(config){await mkdir(path.dirname(file),{recursive:true});const temp=file+'.tmp';await writeFile(temp,JSON.stringify(config,null,2),{mode:0o600});await rename(temp,file);}
 async function load(){if(loading)return loading;loading=(async()=>{let input;try{input=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')problem='저장된 연결 설정을 읽지 못했습니다. 다시 등록하세요.';}
  if(!input&&env.DRAGGER_REPO)input={repo:env.DRAGGER_REPO,url:env.DRAGGER_APP_ORIGIN||'http://127.0.0.1:4319',name:path.basename(env.DRAGGER_REPO)};
  if(input)try{const p=await prepare(input);current=p.config;handler=p.next;await save(current);}catch(e){problem=e.message;}
 })();return loading;}
 const status=()=>({configured:!!handler,project:current?{...current}:null,problem});
 return {async source(){await load();return handler;},async call(route,body={}){await load();if(route==='status')return status();if(route==='check-app')return checkApp(current?.url,request);if(route!=='save')throw Error('지원하지 않는 설정입니다.');if(busy)throw Error('연결을 저장하고 있습니다. 잠시 후 다시 시도하세요.');busy=true;try{const p=await prepare(body);await save(p.config);current=p.config;handler=p.next;problem='';return status();}finally{busy=false;}}};
}
