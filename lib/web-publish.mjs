import {mergeUIChange} from './merge-ui.mjs';
import {mkdtemp,readFile,writeFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {authenticatedGitSync} from './bitbucket-session.mjs';
import {parseRemote,pullRequestWebURL} from './bitbucket.mjs';
export async function prepareWebPR(repository,files){
 const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:'pipe'}).trim();
 const repo=await realpath(repository),remote=git(repo,'remote','get-url','origin'),provider=parseRemote(remote).provider;
 const network=(cwd,...args)=>authenticatedGitSync(['-C',cwd,...args]);
 const base=git(repo,'symbolic-ref','--short','refs/remotes/origin/HEAD').replace(/^origin\//,'');
 network(repo,'fetch','origin',base);
 const merged=[];
 for(const f of files){if(path.isAbsolute(f.file)||f.file.split('/').includes('..'))throw Error('잘못된 변경 경로입니다.');const original=execFileSync('git',['-C',repo,'show',`origin/${base}:${f.file}`],{encoding:'utf8',stdio:'pipe'});merged.push({...f,after:await mergeUIChange(f,original)});}
 let name='',email='';try{name=git(repo,'config','user.name');email=git(repo,'config','user.email');}catch{}if(!name||!email)throw Error('커밋 작성자 정보가 없습니다. 저장소 연결 모달에서 작성자 이름과 이메일을 설정해주세요.');
 const dir=await realpath(await mkdtemp(path.join(tmpdir(),'dragger-pr-'))),branch=`dragger/ui-${Date.now()}`;
 execFileSync('git',['clone','--no-hardlinks','--',repo,dir],{stdio:'pipe'});
 git(dir,'remote','set-url','origin',remote);git(dir,'config','user.name',name);git(dir,'config','user.email',email);
 git(dir,'checkout','-b',branch,git(repo,'rev-parse',`origin/${base}`));
 for(const f of merged){const full=await realpath(path.join(dir,f.file));if(!full.startsWith(dir+path.sep))throw Error('저장소 밖의 파일은 수정할 수 없습니다.');await writeFile(full,f.after);}
 git(dir,'add','--',...files.map(f=>f.file));git(dir,'commit','-m','Apply reviewed UI edits with Dragger');network(dir,'push','-u','origin',branch);
 return {url:pullRequestWebURL(remote,branch,base),branch,base,prepared:true};
}
