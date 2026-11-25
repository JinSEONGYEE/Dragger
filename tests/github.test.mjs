import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {githubClient} from '../lib/github.mjs';import {connectionAPI} from '../lib/connection-api.mjs';import {sessionCredentials,gitOptions,clearSessionCredentials} from '../lib/bitbucket-session.mjs';
test('GitHub checks exact repository with bearer auth and never follows redirects',async()=>{
 let request;const c=githubClient('https://github.com/team/repo',{env:{DRAGGER_GITHUB_TOKEN:'test-only'},request:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({full_name:'team/repo',default_branch:'main'})};}});
 assert.equal((await c.check()).mainbranch.name,'main');assert.equal(request.url,'https://api.github.com/repos/team/repo');assert.equal(request.options.headers.Authorization,'Bearer test-only');assert.equal(request.options.redirect,'error');
 for(const status of [401,403,404])await assert.rejects(githubClient('https://github.com/team/repo',{env:{DRAGGER_GITHUB_TOKEN:'secret-not-output'},request:async()=>({ok:false,status})}).check(),new RegExp(`GitHub 요청 실패 \\(${status}\\)`));
});
test('GitHub clone, restart, failed switch and host-bound credentials',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'dragger-gh-')),calls=[];
 try{const api=connectionAPI(root,{client:remote=>({check:async()=>{if(remote.includes('/bad/'))throw Error('failed');return {full_name:'team/repo',mainbranch:{name:'main'}};}}),git:async args=>{calls.push(args);return {stdout:''};}});
 const state=await api('connect',{provider:'github',token:'dummy-github-token',repository:'https://github.com/team/repo'});assert.equal(state.provider,'github');assert.match(state.directory,/github--team--repo$/);assert.equal(calls[0][2],'https://github.com/team/repo.git');
 assert.equal(gitOptions().env.DRAGGER_GIT_HOST,'github.com');assert.equal(JSON.stringify(state).includes('dummy-github-token'),false);assert.equal((await readFile(path.join(root,'.dragger-repository.json'),'utf8')).includes('dummy-github-token'),false);
 await assert.rejects(api('connect',{provider:'github',token:'another-dummy-token',repository:'https://github.com/bad/repo'}));assert.equal((await api('status',{})).connected,true);assert.equal(sessionCredentials().DRAGGER_GITHUB_TOKEN,'dummy-github-token');
 const restored=await connectionAPI(root)('status',{});assert.equal(restored.provider,'github');assert.equal(restored.needsAuthentication,true);
 const run=prompt=>execFileSync(process.execPath,['lib/git-askpass.cjs',prompt],{env:{...process.env,DRAGGER_GIT_HOST:'github.com',DRAGGER_GIT_TOKEN:'dummy-github-token'},encoding:'utf8',stdio:'pipe'});
 assert.equal(run("Username for 'https://github.com':").trim(),'x-access-token');assert.equal(run("Password for 'https://x-access-token@github.com':").trim(),'dummy-github-token');
 for(const host of ['bitbucket.org','github.com.evil.test','github.com:444'])assert.throws(()=>run(`Password for 'https://${host}':`));
 }finally{clearSessionCredentials();await rm(root,{recursive:true,force:true});}
});
