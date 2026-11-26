import path from 'node:path';
import compiler from './source.cjs';
export async function routeChanges(ts,repo,changes,target,readFile){
 const routed=[];
 for(const input of changes){const {strategy:ignored,...c}=input;if(c.scope&&!['selection','component'].includes(c.scope))throw Error('편집 범위를 다시 선택하세요.');if(c.source?.kind)throw Error('브라우저의 원본 요소 연결로 다시 선택하세요.');
  if(c.property==='svgColor'){if(c.scope==='selection')throw Error('이 이미지 파일은 여러 곳에서 사용됩니다. 공용 컴포넌트 범위를 선택해야 원본 색상을 변경할 수 있습니다.');routed.push(c);continue;}
  const sharedSource=/(?:^|\/)(?:icons|_?components)\//.test(c.source?.file||'')||(c.instance&&c.instance.file!==c.source?.file);
  if(!sharedSource){if(c.scope!=='component'&&c.occurrences>1)throw Error('같은 원본의 반복 요소입니다. 하나만 분리해서 적용할 수 없으므로 공용 컴포넌트 범위를 선택하세요.');routed.push(c);continue;}
  const shared=await readFile(await target(c.source.file),'utf8');if(compiler.hash(shared)!==c.source.revision)throw Error('아이콘 원본이 변경되었습니다. 다시 선택하세요.');
  const {nodes:sharedNodes,tree:sharedTree}=compiler.elements(ts,shared,c.source.file);const selected=sharedNodes[c.source.index];
  const svgNode=selected&&['svg','path','circle','rect','line','polyline','polygon','ellipse'].includes(selected.tagName.getText(sharedTree));
  if(c.scope==='component'&&!svgNode){routed.push(c);continue;}
  const fail=()=>{throw Error('공용 컴포넌트의 사용처를 확정하지 못했습니다. 화면을 새로고침해 다시 선택하세요. 공용 파일을 직접 변경하지 않습니다.');};
  if(!c.instance||c.instance.kind!=='component'||c.instance.file===c.source.file)fail();
  const contract=compiler.iconContract(ts,shared,c.source.file,c.source.index,c.property);
  const caller=await target(c.instance.file),code=await readFile(caller,'utf8');if(compiler.hash(code)!==c.instance.revision)throw Error('아이콘 사용처가 변경되었습니다. 다시 선택하세요.');
  const {tree,calls}=compiler.elements(ts,code,c.instance.file),node=calls[c.instance.index];if(!node)fail();
  const local=node.tagName.getText(tree);const imp=tree.statements.find(s=>ts.isImportDeclaration(s)&&s.importClause?.name?.text===local);if(!imp)fail();
  let options={};const config=ts.findConfigFile(repo,ts.sys.fileExists);if(config){const loaded=ts.readConfigFile(config,ts.sys.readFile);if(loaded.error)fail();options=ts.parseJsonConfigFileContent(loaded.config,ts.sys,path.dirname(config)).options;}
  const resolved=ts.resolveModuleName(imp.moduleSpecifier.text,caller,options,ts.sys).resolvedModule?.resolvedFileName;if(!resolved||path.resolve(resolved)!==path.resolve(await target(c.source.file)))fail();
  if(node.attributes.properties.some(a=>ts.isJsxSpreadAttribute(a)))fail();
  const color=node.attributes.properties.find(a=>a.name?.getText(tree)==='color');
  if(c.scope==='component'){const classes=node.attributes.properties.find(a=>a.name?.getText(tree)==='className');if(color||node.attributes.properties.some(a=>a.name?.getText(tree)==='style')||(classes&&(!ts.isStringLiteral(classes.initializer)||/(?:^|[\s:])!?text-/.test(classes.initializer.text))))throw Error('이 사용처에는 개별 색상이 지정되어 있습니다. 선택한 요소만 편집하거나, 개별 색상이 없는 사용처에서 공용 기본값을 편집하세요.');routed.push({...c,strategy:'icon-default'});continue;}
  const useClass=contract.currentColor&&!color&&/^var\(--color-[a-z]+-\d{2,3}\)$/.test(String(c.value));
  routed.push({...c,source:c.instance,property:'color',strategy:useClass?'class':'prop'});
 }
 for(const a of changes)for(const b of changes)if(a!==b&&a.source?.file===b.source?.file&&a.source?.index===b.source?.index&&a.property===b.property&&(a.scope==='component')!==(b.scope==='component'))throw Error('같은 속성의 개별 변경과 공용 변경을 한 번에 적용할 수 없습니다. 한 범위의 변경을 먼저 마무리하세요.');
 const unique=new Map();for(const c of routed){const key=JSON.stringify([c.source.file,c.source.kind,c.source.index,c.property,c.slot]);if(unique.has(key)&&JSON.stringify([unique.get(key).value,unique.get(key).unit])!==JSON.stringify([c.value,c.unit]))throw Error('같은 컴포넌트 사용처에 서로 다른 값이 요청되었습니다.');unique.set(key,c);}return [...unique.values()];
}
