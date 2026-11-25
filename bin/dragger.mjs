#!/usr/bin/env node
import {readFile,writeFile,mkdir,realpath,lstat} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateBundle,css} from '../dist/model.mjs';
const [command,bundlePath,...args]=process.argv.slice(2);
try {
 if(!['plan','apply','pr'].includes(command)||!bundlePath)throw Error('Usage: dragger plan|apply|pr changes.json --repo /repository [--base main] [--publish]');
 const option=k=>args[args.indexOf(k)+1];if(!args.includes('--repo'))throw Error('--repo is required');
 const repo=await realpath(option('--repo'));const git=(...a)=>execFileSync('git',['-C',repo,...a],{encoding:'utf8'}).trim();
 if(path.resolve(git('rev-parse','--show-toplevel'))!==repo)throw Error('Use the repository root.');
 const b=validateBundle(JSON.parse(await readFile(bundlePath,'utf8')));if(!b.changes.length)throw Error('No UI changes.');
 const dir=path.join(repo,'dragger');try{if((await lstat(dir)).isSymbolicLink())throw Error('Symlink directory refused');}catch(e){if(e.code!=='ENOENT')throw e;}
 const targets=['dragger/ui.json','dragger/ui.css'];for(const f of targets){try{if((await lstat(path.join(repo,f))).isSymbolicLink())throw Error('Symlink file refused');}catch(e){if(e.code!=='ENOENT')throw e;}}
 const output=[JSON.stringify(b,null,2)+'\n',css(b)];
 if(command==='plan'){for(let i=0;i<2;i++){console.log(`--- ${targets[i]} (proposed)\n${output[i]}`);}console.log('Load dragger/ui.css after product styles once; IDs must exist in the target app.');process.exit(0);}
 if(command==='pr'){
  if(!args.includes('--publish'))throw Error('PR publication requires --publish. Run plan first.');
  if(git('status','--porcelain'))throw Error('Repository must be clean before PR creation.');
  const base=args.includes('--base')?option('--base'):'main';if(!/^[A-Za-z0-9._/-]+$/.test(base)||base.startsWith('-'))throw Error('Invalid base');
  const gh=(...a)=>execFileSync('gh',a,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  gh('auth','status');git('fetch','origin',base);
  if(git('rev-parse','HEAD')!==git('rev-parse',`origin/${base}`))throw Error('Check out the latest base branch before creating a UI-only PR.');
  const branch='dragger/ui-'+Date.now();git('switch','-c',branch);
  await mkdir(dir,{recursive:true});for(let i=0;i<2;i++)await writeFile(path.join(repo,targets[i]),output[i]);
  git('add','--',...targets);if(!git('diff','--cached','--name-only'))throw Error('No changes compared with base.');
  git('commit','-m','Update UI values with Dragger');git('push','-u','origin',branch);
  const body=path.join(repo,'.git','dragger-pr-body.md');await writeFile(body,'## UI changes\n\nOnly Dragger UI values and generated CSS.\n\nVerify data-dragger-id mapping and load dragger/ui.css.\nReview desktop/mobile layouts before merging.\n');
  console.log(gh('pr','create','--draft','--base',base,'--head',branch,'--title','Update UI values with Dragger','--body-file',body));
 }else{await mkdir(dir,{recursive:true});for(let i=0;i<2;i++)await writeFile(path.join(repo,targets[i]),output[i]);console.log(git('diff','--',...targets));console.log('Wrote only dragger/ui.json and dragger/ui.css. Review before committing.');}
}catch(error){console.error(error.message);process.exitCode=1;}
