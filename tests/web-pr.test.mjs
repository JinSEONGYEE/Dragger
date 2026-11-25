import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pullRequestWebURL} from '../lib/bitbucket.mjs';
test('web PR links retain source and destination branches without creating a PR',()=>{
 const bb=new URL(pullRequestWebURL('git@bitbucket.org:team/app.git','dragger/ui color','develop'));
 assert.equal(bb.pathname,'/team/app/pull-requests/new');assert.equal(bb.searchParams.get('source'),'dragger/ui color');assert.equal(bb.searchParams.get('dest'),'develop');
 const gh=new URL(pullRequestWebURL('https://github.com/team/app.git','dragger/ui','main'));
 assert.equal(gh.hostname,'github.com');assert.equal(decodeURIComponent(gh.pathname),'/team/app/compare/main...dragger/ui');assert.equal(gh.searchParams.get('expand'),'1');
 assert.throws(()=>pullRequestWebURL('https://evil.test/team/app','x','main'));
});
