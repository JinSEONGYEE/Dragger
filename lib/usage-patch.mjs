import path from 'node:path';
import compiler from './source.cjs';
export async function routeChanges(ts,repo,changes,target,readFile){
 const routed=[];
 for(const input of changes){const {strategy:ignored,...c}=input;if(c.source?.kind)throw Error('브라우저의 원본 요소 연결로 다시 선택하세요.');
  if(c.property==='svgColor'||!/(?:^|\/)(?:icons|components)\//.test(c.source?.file||'')){routed.push(c);continue;}
  const fail=()=>{throw Error('공용 컴포넌트의 사용처를 확정하지 못했습니다. 화면을 새로고침해 다시 선택하세요. 공용 파일을 직접 변경하지 않습니다.');};
  if(!c.instance||c.instance.kind!=='component'||c.instance.file===c.source.file)fail();
  const shared=await readFile(await target(c.source.file),'utf8');if(compiler.hash(shared)!==c.source.revision)throw Error('아이콘 원본이 변경되었습니다. 다시 선택하세요.');
  const contract=compiler.iconContract(ts,shared,c.source.file,c.source.index,c.property);
  const caller=await target(c.instance.file),code=await readFile(caller,'utf8');if(compiler.hash(code)!==c.instance.revision)throw Error('아이콘 사용처가 변경되었습니다. 다시 선택하세요.');
  const {tree,calls}=compiler.elements(ts,code,c.instance.file),node=calls[c.instance.index];if(!node)fail();
  const local=node.tagName.getText(tree);const imp=tree.statements.find(s=>ts.isImportDeclaration(s)&&s.importClause?.name?.text===local);if(!imp)fail();
  let options={};const config=ts.findConfigFile(repo,ts.sys.fileExists);if(config){const loaded=ts.readConfigFile(config,ts.sys.readFile);if(loaded.error)fail();options=ts.parseJsonConfigFileContent(loaded.config,ts.sys,path.dirname(config)).options;}
  const resolved=ts.resolveModuleName(imp.moduleSpecifier.text,caller,options,ts.sys).resolvedModule?.resolvedFileName;if(!resolved||path.resolve(resolved)!==path.resolve(await target(c.source.file)))fail();
  if(node.attributes.properties.some(a=>ts.isJsxSpreadAttribute(a)))fail();
  const color=node.attributes.properties.find(a=>a.name?.getText(tree)==='color');
  const useClass=contract.currentColor&&!color&&/^var\(--color-[a-z]+-\d{2,3}\)$/.test(String(c.value));
  routed.push({...c,source:c.instance,property:'color',strategy:useClass?'class':'prop'});
 }
 const unique=new Map();for(const c of routed){const key=JSON.stringify([c.source.file,c.source.kind,c.source.index,c.property,c.slot]);if(unique.has(key)&&JSON.stringify([unique.get(key).value,unique.get(key).unit])!==JSON.stringify([c.value,c.unit]))throw Error('같은 컴포넌트 사용처에 서로 다른 값이 요청되었습니다.');unique.set(key,c);}return [...unique.values()];
}
