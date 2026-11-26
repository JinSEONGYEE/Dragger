import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';import {createHash} from 'node:crypto';
import {validChange} from '../dist/model.mjs';
export function draftAPI(directory,setup){let queue=Promise.resolve();
 return async(route,body={})=>{const state=await setup.call('status');if(!state.project)throw Error('먼저 프로젝트를 연결하세요.');const appOrigin=new URL(state.project.url).origin;
 const key=createHash('sha256').update(state.project.repo+'\n'+appOrigin).digest('hex'),file=path.join(directory,key+'.json');
 if(route==='read'){await queue;try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return {appOrigin,changes:[],updatedAt:null};throw e;}}
 if(route!=='save'||body.appOrigin!==appOrigin)throw Error('현재 연결된 프로젝트의 변경만 보관할 수 있습니다.');
 if(!Array.isArray(body.changes)||body.changes.length>500)throw Error('변경 개수를 확인하세요.');
 const changes=body.changes.map(c=>{if(c.scope&&!['selection','component'].includes(c.scope))throw Error('편집 범위를 확인하세요.');if(!c?.source||typeof c.source.file!=='string'||!Number.isInteger(c.source.index)||c.source.index<0||typeof c.source.revision!=='string')throw Error('원본 연결 정보가 없습니다.');if(c.property==='text'){if(typeof c.value!=='string'||c.value.length>5000)throw Error('텍스트 변경을 확인하세요.');}else if(c.property==='svgColor'){if(typeof c.value!=='string'||!/^#[\da-f]{3,8}$/i.test(c.value)||typeof c.slot!=='string')throw Error('SVG 변경을 확인하세요.');}else if(!validChange({...c,id:'source'}))throw Error('지원하지 않는 UI 변경입니다.');return {occurrences:Number.isInteger(c.occurrences)?c.occurrences:undefined,scope:c.scope||'selection',instance:c.instance?{file:c.instance.file,index:c.instance.index,revision:c.instance.revision,kind:c.instance.kind}:undefined,source:{file:c.source.file,index:c.source.index,revision:c.source.revision},property:c.property,value:c.value,unit:c.unit,slot:c.slot,viewport:c.viewport};});
 const data={appOrigin,locale:typeof body.locale==='string'&&/^[a-zA-Z-]+$/.test(body.locale)?body.locale:undefined,changes,updatedAt:new Date().toISOString()};
 const save=queue.catch(()=>{}).then(async()=>{await mkdir(directory,{recursive:true});await writeFile(file+'.tmp',JSON.stringify(data),{mode:0o600});await rename(file+'.tmp',file);});queue=save;await save;return {saved:true,count:changes.length,updatedAt:data.updatedAt};
 };
}
