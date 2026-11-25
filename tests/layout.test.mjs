import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validChange,css} from '../dist/model.mjs';
import compiler from '../lib/source.cjs';
import ts from 'typescript';
test('layout values validate, export and compile to type-correct source',()=>{
 const base={id:'layout',viewport:'desktop',unit:''};
 const changes=[{property:'display',value:'flex'},{property:'justifyContent',value:'center'},{property:'position',value:'absolute'},{property:'flexGrow',value:'1'},{property:'width',value:'auto'},{property:'left',value:-20,unit:'px'}].map(c=>({...base,...c}));
 for(const c of changes)assert.ok(validChange(c));
 assert.ok(!validChange({...base,property:'position',value:'fixed'}));
 assert.ok(!validChange({...base,property:'display',value:'flex; color:red'}));
 assert.match(css({schema:'dragger/v1',changes}),/justify-content: center/);
 const code='export default ()=> <div />';const patched=compiler.patch(ts,code,'test.tsx',changes.map(c=>({...c,source:{index:0,revision:compiler.hash(code)}})));
 assert.match(patched,/flexGrow: 1/);assert.match(patched,/left: "-20px"/);
});
