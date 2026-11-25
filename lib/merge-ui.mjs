import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
export async function mergeUIChange(file,latest){
 if(latest===file.before)return file.after;
 const dir=await mkdtemp(path.join(tmpdir(),'dragger-merge-'));
 try{
  const current=path.join(dir,'latest'),base=path.join(dir,'before'),edited=path.join(dir,'edited');
  await Promise.all([writeFile(current,latest),writeFile(base,file.before),writeFile(edited,file.after)]);
  try{return execFileSync('git',['merge-file','-p',current,base,edited],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}
  catch{throw Error(`같은 부분이 최신 저장소에서도 수정되어 자동 반영할 수 없습니다: ${file.file}. 편집한 변경은 보관됩니다.`);}
 }finally{await rm(dir,{recursive:true,force:true});}
}
