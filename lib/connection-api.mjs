import {mkdir,lstat,realpath,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {githubClient} from './github.mjs';
import {parseRemote,bitbucketClient} from './bitbucket.mjs';
import {setSessionCredentials,clearSessionCredentials,authenticatedGit,sessionCredentials,setCredentialEnvironment} from './bitbucket-session.mjs';
export function connectionAPI(root,{client=null,git=authenticatedGit}={}){let state={connected:false},busy=false;const savedFile=path.join(root,'.dragger-repository.json');let loaded=false;
 async function load(){if(loaded)return;loaded=true;try{const saved=JSON.parse(await readFile(savedFile,'utf8'));const parsed=parseRemote(saved.remote);state={provider:parsed.provider,connected:false,needsAuthentication:true,repository:`${parsed.workspace}/${parsed.slug}`,remote:saved.remote,message:'저장소는 기억하고 있습니다. 서버가 재시작되어 API 토큰 인증만 다시 필요합니다.'};}catch{}}
 return async(route,body)=>{
  await load();
  if(route==='status')return state;
  if(route==='author'){
   if(!state.connected||!state.directory)throw Error('저장소를 먼저 연결해주세요.');
   const name=body.name?.trim(),email=body.email?.trim();if(typeof name!=='string'||!name||name.length>100||/[\r\n<>]/.test(name)||typeof email!=='string'||!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email))throw Error('작성자 이름과 이메일을 확인해주세요.');
   for(const [key,value] of [['user.name',name],['user.email',email]])execFileSync('git',['-C',state.directory,'config','--local',key,value],{stdio:'pipe'});
   return {saved:true};
  }
  if(busy)throw Error('저장소 연결이 진행 중입니다.');
  if(route==='disconnect'){clearSessionCredentials();state={connected:false};await rm(savedFile,{force:true});return state;}
  if(route!=='connect')throw Error('지원하지 않는 연결 요청입니다.');
  const {email,token,repository}=body;
  if(typeof repository!=='string')throw Error('저장소 주소를 입력하세요.');
  const parsed=parseRemote(repository),provider=parsed.provider;
  if(body.provider&&body.provider!==provider)throw Error('선택한 서비스의 저장소 주소를 입력하세요.');
  if(typeof token!=='string'||token.trim().length<10||token.length>4096||/[\r\n]/.test(token))throw Error('개인 액세스 토큰을 입력하세요.');
  if(provider==='bitbucket'&&(typeof email!=='string'||!email.includes('@')))throw Error('Atlassian 계정 이메일을 입력하세요.');
  const remote=`https://${provider==='github'?'github.com':'bitbucket.org'}/${parsed.workspace}/${parsed.slug}.git`;
  const env=provider==='github'?{DRAGGER_GITHUB_TOKEN:token.trim()}:{DRAGGER_BITBUCKET_EMAIL:email.trim(),DRAGGER_BITBUCKET_TOKEN:token.trim()};
  const previousCredentials=sessionCredentials();
  busy=true;try{
   const info=await (client||(provider==='github'?githubClient:bitbucketClient))(remote,{env}).check();await mkdir(root,{recursive:true});const parent=await realpath(root),destination=path.join(parent,`${provider==='github'?'github--':''}${parsed.workspace}--${parsed.slug}`);
   let exists=false;try{const entry=await lstat(destination);if(entry.isSymbolicLink()||!entry.isDirectory())throw Error('연결 대상 폴더를 확인해야 합니다.');exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
   setCredentialEnvironment(env);
   if(exists){const result=await git(['-C',destination,'remote','get-url','origin']);if(result.stdout.trim()!==remote)throw Error('다른 저장소 폴더가 이미 있습니다.');await git(['-C',destination,'fetch','origin']);}
   else await git(['clone','--',remote,destination]);
   await writeFile(savedFile,JSON.stringify({remote}),{mode:0o600});
   state={provider,connected:true,needsAuthentication:false,remote,repository:info.full_name||`${parsed.workspace}/${parsed.slug}`,directory:destination,branch:info.mainbranch?.name||null,message:'PR 저장소를 연결했습니다. 편집기로 돌아가 초안 PR 만들기를 누르세요. 최신 원본과 일치하는 변경만 별도 브랜치에 업로드합니다.'};return state;
  }catch(error){setCredentialEnvironment(previousCredentials);throw error;}finally{busy=false;}
 };
}
