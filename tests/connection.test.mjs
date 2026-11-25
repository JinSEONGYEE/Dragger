import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,realpath} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {connectionAPI} from '../lib/connection-api.mjs';import {sessionCredentials} from '../lib/bitbucket-session.mjs';
test('connection clones separately, keeps credentials out of state and clears session',async()=>{const root=await mkdtemp(path.join(tmpdir(),'dragger-connection-')),calls=[];try{const api=connectionAPI(root,{client:()=>({check:async()=>({full_name:'team/repo',mainbranch:{name:'main'}})}),git:async args=>{calls.push(args);return {stdout:''};}});const state=await api('connect',{email:'test@example.invalid',token:'dummy-secret-token',repository:'https://bitbucket.org/team/repo.git'});assert.equal(state.connected,true);assert.equal(state.directory,path.join(await realpath(root),'team--repo'));assert.equal(JSON.stringify(state).includes('dummy-secret-token'),false);assert.deepEqual(calls[0],['clone','--','https://bitbucket.org/team/repo.git',state.directory]);assert.equal(sessionCredentials().DRAGGER_BITBUCKET_TOKEN,'dummy-secret-token');await api('disconnect',{});assert.notEqual(sessionCredentials().DRAGGER_BITBUCKET_TOKEN,'dummy-secret-token');assert.equal((await api('status',{})).connected,false);}finally{await rm(root,{recursive:true,force:true});}});
test('askpass gives dummy credentials only to exact Bitbucket host',()=>{const helper=fileURLToPath(new URL('../lib/git-askpass.cjs',import.meta.url)),run=prompt=>execFileSync(process.execPath,[helper,prompt],{env:{...process.env,DRAGGER_GIT_TOKEN:'dummy-test'},encoding:'utf8',stdio:'pipe'});assert.equal(run("Username for 'https://bitbucket.org': ").trim(),'x-bitbucket-api-token-auth');assert.equal(run("Password for 'https://x-bitbucket-api-token-auth@bitbucket.org': ").trim(),'dummy-test');assert.throws(()=>run("Password for 'https://bitbucket.org.evil.test': "));});

test('restart remembers repository without retaining credentials; disconnect forgets it',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'dragger-reconnect-'));
 try{
  const options={client:()=>({check:async()=>({full_name:'team/repo'})}),git:async()=>({stdout:''})};
  const first=connectionAPI(root,options);
  await first('connect',{email:'test@example.invalid',token:'test-token-not-persisted',repository:'https://bitbucket.org/team/repo.git'});
  const {readFile}=await import('node:fs/promises');const saved=await readFile(path.join(root,'.dragger-repository.json'),'utf8');
  assert.equal(saved.includes('test-token'),false);assert.equal(saved.includes('test@example'),false);
  const restarted=connectionAPI(root,options),state=await restarted('status',{});
  assert.equal(state.connected,false);assert.equal(state.needsAuthentication,true);assert.equal(state.remote,'https://bitbucket.org/team/repo.git');
  await restarted('disconnect',{});assert.equal((await connectionAPI(root,options)('status',{})).needsAuthentication,undefined);
 }finally{await rm(root,{recursive:true,force:true});}
});
