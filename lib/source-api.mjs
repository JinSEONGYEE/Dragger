import {prepareWebPR} from './web-publish.mjs';
import {patchSvg,svgColor} from '../dist/svg.mjs';
import {sessionCredentials,authenticatedGitSync} from './bitbucket-session.mjs';
import {parseRemote,bitbucketClient,pullRequestWebURL} from './bitbucket.mjs';
import {readFile,writeFile,realpath,mkdir,rename,stat} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import compiler from './source.cjs';
import {validChange,validColor} from '../dist/model.mjs';
function diff(before,after){const a=before.split('\n'),b=after.split('\n');let start=0;while(start<a.length&&start<b.length&&a[start]===b[start])start++;let endA=a.length,endB=b.length;while(endA>start&&endB>start&&a[endA-1]===b[endB-1]){endA--;endB--;}return `@@ ${start+1}행 @@\n`+a.slice(start,endA).map(l=>'- '+l).join('\n')+'\n'+b.slice(start,endB).map(l=>'+ '+l).join('\n');}
export async function sourceAPI(repo,appOrigin,{publicationRepository=async()=>null}={}){
 repo=await realpath(repo);const require=createRequire(path.join(repo,'package.json')),ts=require('typescript');const plans=new Map();
 async function target(file,internal=false){if(typeof file!=='string'||file.split('/').includes('..')||(!/^src\/.*\.[jt]sx$/.test(file)&&!/^public\/[\w/.-]+\.svg$/.test(file)&&!(internal&&/^messages\/[a-zA-Z-]+\.json$/.test(file))))throw Error('연결된 소스 파일만 수정할 수 있습니다.');const full=await realpath(path.resolve(repo,file));if(!full.startsWith(repo+path.sep)||(file.startsWith('public/')&&!full.startsWith(path.join(repo,'public')+path.sep)))throw Error('저장소 외부 파일입니다.');return full;}
 async function atomic(file,content){const temporary=file+'.dragger-'+randomUUID()+'.tmp';const info=await stat(file);await writeFile(temporary,content,{mode:info.mode});await rename(temporary,file);}
 const journal=path.join(tmpdir(),'dragger-plans',compiler.hash(repo));
 async function savePlan(id,plan){await mkdir(journal,{recursive:true,mode:0o700});await writeFile(path.join(journal,id+'.json'),JSON.stringify(plan),{mode:0o600});await writeFile(path.join(journal,'latest.json'),JSON.stringify({id}),{mode:0o600});}
 async function loadPlan(id){if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))return null;try{const plan=JSON.parse(await readFile(path.join(journal,id+'.json'),'utf8'));for(const f of plan.files)if(await target(f.file,true)!==f.full)return null;return plan;}catch{return null;}}
 const git=(...a)=>['fetch','push'].includes(a[0])&&parseRemote(execFileSync('git',['-C',repo,'remote','get-url','origin'],{encoding:'utf8'}).trim()).provider==='bitbucket'?authenticatedGitSync(['-C',repo,...a]):execFileSync('git',['-C',repo,...a],{encoding:'utf8',stdio:'pipe'}).trim();
 return async(route,body)=>{
  if(route==='latest-review'){let latest;try{latest=JSON.parse(await readFile(path.join(journal,'latest.json'),'utf8'));}catch{return {review:null};}const p=await loadPlan(latest.id);return {review:p?{id:latest.id,applied:!!p.applied,verified:!!p.verified,prepared:!!p.webPR,webUrl:p.webPR?.url,files:p.files.map(f=>f.file)}:null};}
  if(route==='publication-status'){let gitReady=false;try{gitReady=path.resolve(git('rev-parse','--show-toplevel'))===repo;}catch{}return {connected:gitReady||!!(await publicationRepository())};}
  if(route==='status')return {connected:true,appOrigin,repository:path.basename(repo)};
  if(route==='palette'){if(body.appOrigin!==appOrigin)return {colors:[]};const colors=[];for(const file of ['src/app/globals.css','src/styles/globals.css','src/index.css']){try{const full=await realpath(path.join(repo,file));if(!full.startsWith(repo+path.sep)||(file.startsWith('public/')&&!full.startsWith(path.join(repo,'public')+path.sep)))continue;const text=await readFile(full,'utf8');for(const match of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)){if(validColor(match[2].trim()))colors.push({name:match[1],value:match[2].trim()});}}catch{}}return {colors:colors.slice(0,500)};}
  if(route==='plan'){
   if(body.appOrigin!==appOrigin)throw Error('현재 서비스는 연결된 원본 앱과 다릅니다.');
   if(!Array.isArray(body.changes)||!body.changes.length||body.changes.length>500)throw Error('원본에 적용할 변경을 선택하세요.');
   const groups=new Map();for(const c of body.changes){if(!c.source||!Number.isInteger(c.source.index)||c.source.index<0)throw Error('원본 코드 연결이 없는 요소입니다.');if(c.property==='svgColor'){if(!/^public\/[\w/.-]+\.svg$/.test(c.source.file)||!svgColor(c.value)||typeof c.slot!=='string')throw Error('올바르지 않은 SVG 변경입니다.');}else if(c.property==='text'){if(typeof c.value!=='string'||c.value.length>5000)throw Error('텍스트가 너무 깁니다.');}else if(!validChange({...c,id:'source'}))throw Error('지원하지 않는 UI 변경입니다.');
    const f=c.source.file;if(!groups.has(f))groups.set(f,[]);groups.get(f).push(c);
   }
   const files=[],translations=new Map();for(const [file,changes] of groups){const full=await target(file),before=await readFile(full,'utf8'),direct=[];if(file.endsWith('.svg')){if(changes.some(c=>c.property!=='svgColor'||c.source.revision!==compiler.hash(before)))throw Error('SVG 원본이 변경되었습니다. 다시 선택하세요.');const after=patchSvg(before,changes);if(after!==before)files.push({file,full,before,after});continue;}
    for(const c of changes){if(c.source.revision!==compiler.hash(before))throw Error('원본 파일이 변경되었습니다. 다시 편집하세요.');const key=c.property==='text'?compiler.translation(ts,before,file,c.source.index):null;if(!key){direct.push(c);continue;}
     if(!/^[a-zA-Z-]+$/.test(body.locale||''))throw Error('번역 문구의 언어를 확인할 수 없습니다.');const messageFile=`messages/${body.locale}.json`;if(!translations.has(messageFile)){const full=await target(messageFile,true),before=await readFile(full,'utf8');translations.set(messageFile,{file:messageFile,full,before,data:JSON.parse(before)});}const t=translations.get(messageFile);const keys=key.split('.');if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))throw Error('지원하지 않는 번역 키입니다.');let object=t.data;for(const k of keys.slice(0,-1)){if(!object||!Object.hasOwn(object,k))throw Error('번역 키를 찾을 수 없습니다.');object=object[k];}const leaf=keys.at(-1);if(!object||typeof object[leaf]!=='string')throw Error('번역 문구를 찾을 수 없습니다.');if(/[{}<>]/.test(object[leaf])||/[{}<>]/.test(c.value))throw Error('변수나 서식이 있는 번역 문구는 개발자 확인이 필요합니다.');object[leaf]=c.value;
    }
    const after=direct.length?compiler.patch(ts,before,file,direct):before;if(before!==after)files.push({file,full,before,after});
   }
   for(const t of translations.values()){const after=JSON.stringify(t.data,null,2)+'\n';if(after!==t.before)files.push({file:t.file,full:t.full,before:t.before,after});}
   if(!files.length)throw Error('원본과 다른 변경이 없습니다.');let baseline=null;try{if(path.resolve(git('rev-parse','--show-toplevel'))===repo&&!git('status','--porcelain'))baseline=git('rev-parse','HEAD');}catch{}const id=randomUUID();plans.set(id,{files,changes:body.changes,baseline,applied:false});await savePlan(id,plans.get(id));
   return {id,files:files.map(({file,before,after})=>({file,before,after,diff:diff(before,after)})),warning:'SVG 파일을 수정하면 같은 로고 파일을 쓰는 모든 화면에 적용됩니다. 선택 요소의 원본 컴포넌트가 바뀝니다. 같은 컴포넌트를 사용하는 다른 화면·반복 항목에도 적용될 수 있습니다. 모바일/PC 공용 파일이면 양쪽에 적용됩니다.'};
  }
  if(route==='recover'){
   if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/.test(body.id)||!Array.isArray(body.files)||!body.files.length||!Array.isArray(body.expected))throw Error('복구할 적용 기록이 없습니다.');
   const backup=path.join(tmpdir(),'dragger-backups',body.id),manifest=JSON.parse(await readFile(path.join(backup,'manifest.json'),'utf8'));
   if(JSON.stringify(manifest)!==JSON.stringify(body.files.map(f=>f.file)))throw Error('백업과 검토 파일이 다릅니다.');
   const files=[];for(let i=0;i<body.files.length;i++){const f=body.files[i],full=await target(f.file,true),before=await readFile(path.join(backup,`${i}.txt`),'utf8');if(before!==f.before||await readFile(full,'utf8')!==f.after)throw Error('적용 후 코드가 달라져 자동 복구를 중단했습니다. 변경은 보존됩니다.');files.push({file:f.file,full,before,after:f.after});}
   const restored={files,changes:body.expected,baseline:null,applied:true,verified:false};plans.set(body.id,restored);await savePlan(body.id,restored);return {recovered:true};
  }
  const plan=plans.get(body.id)||await loadPlan(body.id);if(!plan)throw Error('검토가 만료되었습니다. 다시 검토하세요.');
  if(route==='review-status')return {id:body.id,applied:!!plan.applied,verified:!!plan.verified,prepared:!!plan.webPR,webUrl:plan.webPR?.url,files:plan.files.map(f=>f.file)};
  if(route==='apply'){
   if(plan.applied)throw Error('이미 적용한 변경입니다.');for(const f of plan.files){if(await target(f.file,true)!==f.full||await readFile(f.full,'utf8')!==f.before)throw Error('검토 후 파일이 바뀌었습니다. 다시 검토하세요.');}
   const backup=path.join(tmpdir(),'dragger-backups',body.id);await mkdir(backup,{recursive:true});for(let i=0;i<plan.files.length;i++)await writeFile(path.join(backup,`${i}.txt`),plan.files[i].before);await writeFile(path.join(backup,'manifest.json'),JSON.stringify(plan.files.map(f=>f.file)));
   const written=[];try{for(const f of plan.files){await atomic(f.full,f.after);written.push(f);}}catch(e){for(const f of written)await atomic(f.full,f.before);throw e;}plan.applied=true;await savePlan(body.id,plan);
   return {applied:true,expected:plan.changes.map(c=>({...c,source:{...c.source,revision:plan.files.some(f=>f.file===c.source.file)?compiler.hash(plan.files.find(f=>f.file===c.source.file).after):c.source.revision}}))};
  }
  if(route==='rollback'){
   if(plan.webPR)throw Error('이미 업로드한 브랜치입니다. 웹의 PR 작성 화면에서 변경을 검토하세요.');
   if(!plan.applied)throw Error('적용되지 않은 변경입니다.');for(const f of plan.files)if(await readFile(f.full,'utf8')!==f.after)throw Error('적용 이후 다른 수정이 있어 자동 되돌리기를 중단했습니다.');for(const f of plan.files)await atomic(f.full,f.before);plan.applied=false;plan.verified=false;await savePlan(body.id,plan);return {restored:true};
  }
  if(route==='verify'){
   if(!plan.applied)throw Error('먼저 코드를 적용하세요.');
   for(const f of plan.files)if(await readFile(f.full,'utf8')!==f.after)throw Error('코드가 변경되어 다시 검토해야 합니다.');
   plan.verified=body.ok===true;await savePlan(body.id,plan);return {verified:plan.verified};
  }
  if(route==='pr'){
   if(plan.webPR)return plan.webPR;
   if(!plan.applied||!plan.verified)throw Error('코드 적용과 화면 검증을 먼저 완료하세요.');
   {const connected=await publicationRepository();if(connected){for(const f of plan.files)if(await readFile(f.full,'utf8')!==f.after)throw Error('검증 이후 코드가 변경되었습니다.');plan.webPR=await prepareWebPR(connected,plan.files);await savePlan(body.id,plan);return plan.webPR;}}
   if(!plan.baseline)throw Error('Git 기록이 있는 깨끗한 저장소에서 시작해야 PR을 만들 수 있습니다. 현재 변경은 로컬에만 적용되었습니다.');
   if(git('rev-parse','HEAD')!==plan.baseline)throw Error('기준 커밋이 변경되었습니다.');
   if(git('diff','--cached','--name-only'))throw Error('이미 준비된 다른 커밋 변경이 있습니다.');
   const modified=git('diff','--name-only').split('\n').filter(Boolean),allowed=plan.files.map(f=>f.file);
   if(modified.some(f=>!allowed.includes(f))||git('ls-files','--others','--exclude-standard'))throw Error('다른 변경이 있어 UI만 분리해야 합니다.');
   for(const f of plan.files)if(await readFile(f.full,'utf8')!==f.after)throw Error('검증 이후 파일이 변경되었습니다.');
   const remote=git('remote','get-url','origin'),provider=parseRemote(remote).provider;
   const gh=(...args)=>execFileSync('gh',args,{cwd:repo,encoding:'utf8',stdio:'pipe'}).trim();
   const bitbucket=provider==='bitbucket'?bitbucketClient(remote,{env:sessionCredentials()}):null;
   if(bitbucket)await bitbucket.check();else gh('auth','status');
   const base=git('branch','--show-current');if(!base)throw Error('기준 브랜치가 없습니다.');git('fetch','origin',base);if(git('rev-parse',`origin/${base}`)!==plan.baseline)throw Error('원격 브랜치가 변경되었습니다. 최신 코드에서 다시 검토하세요.');
   const branch=`dragger/source-${Date.now()}`;git('switch','-c',branch);git('add','--',...allowed);git('commit','-m','Apply reviewed UI edits with Dragger');if(git('diff','--name-only',plan.baseline,'HEAD').split('\n').filter(Boolean).some(f=>!allowed.includes(f)))throw Error('커밋에 다른 파일이 포함되어 push를 중단했습니다.');for(const f of plan.files)if(await readFile(f.full,'utf8')!==f.after)throw Error('커밋 과정에서 코드가 바뀌어 재검증이 필요합니다.');git('push','-u','origin',branch);
   const url=pullRequestWebURL(remote,branch,base);plan.webPR={url,branch,base,prepared:true};await savePlan(body.id,plan);return plan.webPR;
  }
  throw Error('지원하지 않는 작업입니다.');
 };
}
