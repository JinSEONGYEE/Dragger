import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import compiler from '../lib/source.cjs';
import {sourceAPI} from '../lib/source-api.mjs';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('component scope changes shared defaults and preserves caller overrides; selection scope stays local',async()=>{
 const repo=await mkdtemp(path.join(tmpdir(),'dragger-scope-'));
 try {
  await mkdir(path.join(repo,'src/components'),{recursive:true});
  await mkdir(path.join(repo,'src/icons'),{recursive:true});
  await writeFile(path.join(repo,'package.json'),'{}');
  await symlink(fileURLToPath(new URL('../node_modules',import.meta.url)),path.join(repo,'node_modules'),'junction');
  const label='export default ()=> <p className="text-sm text-slate-900">Label</p>';
  const icon="export default props=> <svg {...props}><path stroke={props.color || 'currentColor'}/></svg>";
  const page='import Icon from "./icons/Icon";export default ()=> <div><Icon/><Icon color="red"/></div>';
  for(const [file,code] of [['src/components/Label.tsx',label],['src/icons/Icon.tsx',icon],['src/Page.tsx',page]])await writeFile(path.join(repo,file),code);
  const api=await sourceAPI(repo,'http://localhost:3000');
  const c={scope:'component',viewport:'desktop',source:{file:'src/components/Label.tsx',index:0,revision:compiler.hash(label)},property:'color',value:'var(--color-slate-500)',unit:''};
  const plan=await api('plan',{appOrigin:'http://localhost:3000',changes:[c]});
  assert.match(plan.files[0].after,/text-sm text-slate-500/);
  assert.match(plan.warning,/공용 컴포넌트 변경/);
  await assert.rejects(api('plan',{appOrigin:'http://localhost:3000',changes:[{...c,scope:'selection'}]}),/사용처/);
  await api('apply',{id:plan.id});await api('rollback',{id:plan.id});
  assert.equal(await readFile(path.join(repo,c.source.file),'utf8'),label);
  const repeated={...c,scope:'selection',occurrences:2,source:{file:'src/Page.tsx',index:0,revision:compiler.hash(page)},property:'width',value:200,unit:'px'};
  await assert.rejects(api('plan',{appOrigin:'http://localhost:3000',changes:[repeated]}),/반복 요소/);
  assert.equal((await api('plan',{appOrigin:'http://localhost:3000',changes:[{...repeated,scope:'component'}]})).files[0].file,'src/Page.tsx');
  const i={...c,property:'stroke',source:{file:'src/icons/Icon.tsx',index:1,revision:compiler.hash(icon)},instance:{file:'src/Page.tsx',index:0,revision:compiler.hash(page),kind:'component'}};
  const global=await api('plan',{appOrigin:'http://localhost:3000',changes:[i]});
  assert.equal(global.files.length,1);assert.equal(global.files[0].file,i.source.file);
  assert.match(global.files[0].after,/color="var\(--color-slate-500\)"\s+\{\.\.\.props\}/);
  assert.match(global.files[0].after,/stroke=\{props.color \|\| 'currentColor'\}/);
  assert.ok(!global.files[0].after.includes('style='));
  await api('apply',{id:global.id});assert.equal(await readFile(path.join(repo,'src/Page.tsx'),'utf8'),page);await api('rollback',{id:global.id});
  const local=await api('plan',{appOrigin:'http://localhost:3000',changes:[{...i,scope:'selection'}]});
  assert.equal(local.files[0].file,'src/Page.tsx');assert.match(local.files[0].after,/<Icon className="text-slate-500"/);assert.match(local.files[0].after,/<Icon color="red"/);
  await assert.rejects(api('plan',{appOrigin:'http://localhost:3000',changes:[{...i,instance:{...i.instance,index:1}}]}),/개별 색상/);
  await assert.rejects(api('plan',{appOrigin:'http://localhost:3000',changes:[i,{...i,scope:'selection'}]}),/한 번에/);
  await assert.rejects(api('plan',{appOrigin:'http://localhost:3000',changes:[{...i,scope:'invalid'}]}),/편집 범위/);
 } finally {await rm(repo,{recursive:true,force:true});}
});

test('icon default color remains editable and keeps prop precedence',()=>{
 for(const source of ["<svg {...props}><path stroke={props.color || 'black'}/></svg>","<svg {...props}><path stroke={props.color || 'currentColor'}/></svg>"]){
  const edit=code=>compiler.patch(ts,code,'src/icons/Icon.tsx',[{source:{index:1,revision:compiler.hash(code)},property:'stroke',strategy:'icon-default',value:'#62748e',unit:''}]);
  const result=edit(source);assert.match(result,/props.color/);assert.equal(edit(result),result);
 }
});
