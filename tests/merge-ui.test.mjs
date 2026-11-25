import {test} from 'node:test';import assert from 'node:assert/strict';import {mergeUIChange} from '../lib/merge-ui.mjs';
test('preserves upstream logic and applies only independent UI changes',async()=>{
 const before='old logic\n'+Array.from({length:10},(_,i)=>`line ${i}\n`).join('')+'color: black\n';
 const file={file:'src/Page.tsx',before,after:before.replace('color: black','color: gray')};
 const latest=before.replace('old logic','new logic');const merged=await mergeUIChange(file,latest);
 assert.equal(merged,latest.replace('color: black','color: gray'));
 await assert.rejects(mergeUIChange(file,latest.replace('color: black','color: blue')),/같은 부분/);
});
