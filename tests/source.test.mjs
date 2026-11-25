import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {sourceAPI} from '../lib/source-api.mjs';
import compiler from '../lib/source.cjs';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
test('source plan, exact apply, translation, rollback and stale-edit protection',async()=>{
const dir=await mkdtemp(path.join(tmpdir(),'dragger-source-test-'));
try{
 await mkdir(path.join(dir,'src'));await mkdir(path.join(dir,'messages'));await writeFile(path.join(dir,'package.json'),'{}');await symlink(fileURLToPath(new URL('../node_modules',import.meta.url)),path.join(dir,'node_modules'),'junction');
 const original=`import {useTranslations} from 'next-intl'; export default function Page(){const t=useTranslations();return <main><p style={{color:'red'}}>Hello</p><p>{t('welcome')}</p></main>}`;
 await writeFile(path.join(dir,'src/Page.tsx'),original);await writeFile(path.join(dir,'messages/ko.json'),'{"welcome":"안녕하세요"}');
 const api=await sourceAPI(dir,'http://localhost:3000'),source={file:'src/Page.tsx',index:1,revision:compiler.hash(original)},change={source,property:'width',value:200,unit:'px',viewport:'desktop'};
 const plan=await api('plan',{appOrigin:'http://localhost:3000',locale:'ko',changes:[change,{...change,property:'text',value:'New <text>'},{source:{...source,index:2},property:'text',value:'새 문구'}]});assert.equal(plan.files.length,2);assert.equal(await readFile(path.join(dir,'src/Page.tsx'),'utf8'),original);
 const applied=await api('apply',{id:plan.id});const code=await readFile(path.join(dir,'src/Page.tsx'),'utf8');assert.match(code,/width: "200px"/);assert.match(code,/color:'red'/);assert.match(code,/New <text>/);assert.equal(JSON.parse(await readFile(path.join(dir,'messages/ko.json'),'utf8')).welcome,'새 문구');assert.equal(applied.expected[0].source.revision,compiler.hash(code));
 await assert.rejects(api('pr',{id:plan.id}),/검증/);const restarted=await sourceAPI(dir,'http://localhost:3000');await restarted('verify',{id:plan.id,ok:true});await api('verify',{id:plan.id,ok:true});await assert.rejects(api('pr',{id:plan.id}),/Git/);
 await (await sourceAPI(dir,'http://localhost:3000'))('rollback',{id:plan.id});assert.equal(await readFile(path.join(dir,'src/Page.tsx'),'utf8'),original);
 await assert.rejects(api('plan',{appOrigin:'http://evil',changes:[change]}),/다릅니다/);
 const stale=await api('plan',{appOrigin:'http://localhost:3000',changes:[change]});await writeFile(path.join(dir,'src/Page.tsx'),original+'\n// external edit');await assert.rejects(api('apply',{id:stale.id}),/바뀌었습니다/);
 await mkdir(path.join(dir,'public'));const svg='<svg><path fill="#314158" d="M0 1"/></svg>';await writeFile(path.join(dir,'public/logo.svg'),svg);
 const svgPlan=await api('plan',{appOrigin:'http://localhost:3000',changes:[{source:{file:'public/logo.svg',index:0,revision:compiler.hash(svg)},property:'svgColor',slot:'0',value:'#abcdef',unit:'',viewport:'desktop'}]});
 const svgResult=await api('apply',{id:svgPlan.id});assert.match(await readFile(path.join(dir,'public/logo.svg'),'utf8'),/#abcdef/);assert.equal(svgResult.expected[0].source.revision,compiler.hash('<svg><path fill="#abcdef" d="M0 1"/></svg>'));await api('rollback',{id:svgPlan.id});assert.equal(await readFile(path.join(dir,'public/logo.svg'),'utf8'),svg);
 console.log('PASS: exact source mapping, style preservation, literal and translation text, plan without writes, apply, revision verification, rollback, PR gates and concurrent-edit refusal');
}finally{await rm(dir,{recursive:true,force:true});}

});
