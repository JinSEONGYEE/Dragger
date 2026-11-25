import {fields,css,serviceURL} from './model.mjs';
const $=id=>document.getElementById(id),frame=$('preview');let services=[],service=null,device='desktop',selection=null,connected=false,timer,changes=[],previewChanges=[];
try{services=JSON.parse(localStorage.getItem('dragger.services')||'[]');if(!Array.isArray(services))services=[];}catch{}
const key=()=>`dragger.changes.${service.id}`;
const send=m=>service&&frame.contentWindow?.postMessage(m,new URL(device==='mobile'&&service.mobile?service.mobile:service.url).origin);
const bundle=()=>({schema:'dragger/v1',changes});
function updateCount(){$('count').textContent=changes.length+previewChanges.length;}
function save(){localStorage.setItem(key(),JSON.stringify(changes));updateCount();}
function fit(){const available=Math.max(280,$('stage').clientWidth-20),w=device==='mobile'?390:Math.max(1024,available),scale=Math.min(1,available/w),h=Math.max(320,(innerHeight-$('stage').getBoundingClientRect().top-20)/scale);Object.assign(frame.style,{width:w+'px',height:h+'px',transform:`scale(${scale})`});Object.assign($('frame-shell').style,{width:w*scale+'px',height:h*scale+'px'});}
function load(preservePage=false){if(!service)return;previewChanges=[];updateCount();connected=false;$('edit').disabled=true;$('history-undo').disabled=true;$('history-redo').disabled=true;selection=null;syncLayout();$('fields').disabled=true;$('text-fields').disabled=true;$('restore').disabled=true;$('text-content').disabled=true;$('status').textContent='앱 연결 중…';$('empty').hidden=true;$('frame-shell').hidden=false;frame.hidden=false;clearTimeout(timer);if(!preservePage)frame.src=device==='mobile'&&service.mobile?service.mobile:service.url;else{const current=frame.src;frame.src=current;}fit();timer=setTimeout(()=>{if(!connected)$('status').textContent='화면 편집 연결을 확인하지 못했습니다. ‘시작하기 · 연결 상태’에서 준비 상태를 확인하세요.';},9000);}
function choose(id){service=services.find(s=>s.id===id);if(!service)return;try{changes=JSON.parse(localStorage.getItem(key())||'[]');css(bundle());}catch{changes=[];}$('count').textContent=changes.length;load();}
function renderServices(){ $('services').replaceChildren(...services.map(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.name;return o;}));if(service)$('services').value=service.id;}
$('services').addEventListener('change',e=>choose(e.target.value));$('connect').onclick=()=>$('connection').showModal();
$('snippet').textContent=`<script src="${location.origin}/bridge.js" data-dragger-origin="${location.origin}"><\/script>`;
$('sdk').onclick=()=>download('dragger-bridge.js',fetch('bridge.js').then(r=>r.text()));
$('connection-form').onsubmit=e=>{e.preventDefault();try{const url=serviceURL($('url').value),mobile=$('mobile-url').value?serviceURL($('mobile-url').value):'';const existing=services.find(s=>s.url===url);const entry={id:existing?.id||crypto.randomUUID(),name:$('name').value.trim(),url,mobile};if(!entry.name)throw Error('이름을 입력하세요.');services=services.filter(s=>s.id!==entry.id);services.push(entry);localStorage.setItem('dragger.services',JSON.stringify(services));renderServices();$('services').value=entry.id;choose(entry.id);$('connection').close();}catch(error){$('connection-error').textContent=error.message;}};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
for(const d of ['desktop','mobile'])$(d).onclick=()=>{device=d;for(const x of ['desktop','mobile']){ $(x).classList.toggle('active',x===d);$(x).setAttribute('aria-pressed',String(x===d)); }load();};
$('reload').onclick=()=>load(true);addEventListener('resize',fit);
$('edit').onclick=()=>{$('panel').hidden=!$('panel').hidden;send({type:'dragger:mode',enabled:!$('panel').hidden});};
$('close-panel').onclick=()=>{$('panel').hidden=true;send({type:'dragger:mode',enabled:false});};
$('text-content').oninput=()=>send({type:'dragger:text',selection,value:$('text-content').value});
$('reset-all').onclick=()=>{if(!service)return;changes=[];previewChanges=[];save();send({type:'dragger:restore-all'});dispatchEvent(new Event('dragger:preview-reset'));$('feedback').textContent='화면 수정과 저장된 스타일 변경을 모두 취소했습니다. 이미 코드에 적용한 변경은 별도로 되돌려주세요.';};
$('parent').onclick=()=>send({type:'dragger:parent'});$('restore').onclick=()=>send({type:'dragger:restore'});
const labels={width:'너비',height:'높이',padding:'안쪽 여백',gap:'요소 간격',borderRadius:'모서리',fontSize:'글자 크기',lineHeight:'줄 높이',letterSpacing:'자간',top:'위',right:'오른쪽',bottom:'아래',left:'왼쪽'};
const controls=new Map();
for(const [property,[min,max]] of Object.entries(fields)){
 const row=document.createElement('label');
 row.innerHTML=`<span>${labels[property]}</span><input data-property="${property}" aria-label="${labels[property]} 값" type="number" min="${min}" max="${max}" step="0.5"><select aria-label="${labels[property]} 단위"><option>px</option>${['width','height'].includes(property)?'<option>%</option>':''}</select><input class="value-slider" aria-label="${labels[property]} 드래그 조절" type="range" min="${min}" max="${max}" step="0.5">`;
 const input=row.querySelector('input'),unit=row.querySelector('select'),slider=row.querySelector('.value-slider');
 function sync(){input.max=slider.max=unit.value==='%'?100:max;slider.value=input.value||min;slider.setAttribute('aria-valuetext',`${input.value||min}${unit.value}`);}
 function apply(){sync();if(input.value===''||!input.checkValidity()){$('feedback').textContent='허용 범위의 숫자를 입력하세요.';return;}send({type:'dragger:style',selection,property,value:Number(input.value),unit:unit.value});}
 input.oninput=apply;
 slider.oninput=()=>{input.value=slider.value;apply();};
 unit.onchange=()=>{input.value=Math.max(min,Math.min(Number(input.value)||min,unit.value==='%'?100:max));apply();};
 if(['top','right','bottom','left'].includes(property)){const auto=document.createElement('button');auto.type='button';auto.className='offset-auto';auto.textContent='자동';auto.onclick=()=>send({type:'dragger:style',selection,property,value:'auto',unit:''});row.append(auto);}controls.set(property,{input,unit,sync});$(['top','right','bottom','left'].includes(property)?'offset-fields':['fontSize','lineHeight','letterSpacing'].includes(property)?'text-fields':'fields').append(row);
}
const layoutControls=new Map();
const optionGroups={
 'size-modes':[['width','너비 맞춤',[['','직접 지정'],['auto','자동'],['max-content','내용에 맞춤'],['100%','부모 너비 채우기']]],['height','높이 맞춤',[['','직접 지정'],['auto','자동'],['max-content','내용에 맞춤'],['100%','부모 높이 채우기']]],['flexGrow','남은 공간',[['0','유지'],['1','채우기']]],['flexShrink','공간 부족 시',[['1','줄이기'],['0','크기 유지']]]],
 'layout-options':[['display','배치 방식',[['block','기본'],['flex','유연한 배치 (Flex)'],['inline-flex','내용 너비 Flex']]],['flexDirection','배치 방향',[['row','가로'],['column','세로'],['row-reverse','가로 역순'],['column-reverse','세로 역순']]],['justifyContent','진행 방향 정렬',[['flex-start','시작'],['center','가운데'],['flex-end','끝'],['space-between','양끝에 맞춰 균등'],['space-around','주변 여백 균등'],['space-evenly','모든 간격 균등']]],['alignItems','교차 방향 정렬',[['stretch','늘리기'],['flex-start','시작'],['center','가운데'],['flex-end','끝'],['baseline','글자 기준선']]],['flexWrap','줄바꿈',[['nowrap','한 줄 유지'],['wrap','공간 부족 시 줄바꿈'],['wrap-reverse','역순 줄바꿈']]]],
 'position-options':[['position','위치 방식',[['static','흐름에 따라 배치'],['relative','현재 위치 기준 이동'],['absolute','부모 기준 자유 배치']]],['alignSelf','부모 안에서 정렬',[['auto','부모 설정 따르기'],['stretch','늘리기'],['flex-start','시작'],['center','가운데'],['flex-end','끝']]]]
};
for(const [group,items] of Object.entries(optionGroups))for(const [property,label,options] of items){const row=document.createElement('label'),caption=document.createElement('span'),select=document.createElement('select');caption.textContent=label;select.setAttribute('aria-label',label);for(const [value,text] of options)select.add(new Option(text,value));select.onchange=()=>{let value=select.value,unit='';if(value===''){const c=controls.get(property);value=Number(c.input.value)||0;unit=c.unit.value;}send({type:'dragger:style',selection,property,value,unit});};row.append(caption,select);$(group).append(row);layoutControls.set(property,select);}
function syncLayout(values={}){for(const id of ['size-modes','layout-options','position-options','offset-fields'])$(id).disabled=!selection;for(const [property,select] of layoutControls){const value=values[property]||'';if([...select.options].some(o=>o.value===value))select.value=value;else select.value='';}const flex=['flex','inline-flex'].includes(values.display);for(const p of ['flexDirection','justifyContent','alignItems','flexWrap']){layoutControls.get(p).disabled=!flex;layoutControls.get(p).title=flex?'':'유연한 배치 (Flex)를 선택하면 사용할 수 있습니다';}$('position-offsets').hidden=!['absolute','relative'].includes(values.position);}
addEventListener('message',e=>{if(!service||e.source!==frame.contentWindow||e.origin!==new URL(frame.src).origin)return;const m=e.data;
 if(m?.type==='dragger:ready'){connected=true;$('edit').disabled=false;$('reset-all').disabled=false;clearTimeout(timer);$('status').textContent='편집 연결됨';send({type:'dragger:replay',changes:changes.filter(c=>c.viewport===device)});send({type:'dragger:mode',enabled:!$('panel').hidden});}
 if(m?.type==='dragger:selection'){selection=m.selection;syncLayout(m.values);$('restore').disabled=!selection;$('text-content').disabled=!m.textEditable;$('text-content').value=m.text||'';$('text-help').textContent=m.textEditable?'입력 즉시 반영 · 변경 검토에서 원본 코드 반영을 진행하세요.':'글자 자체를 선택하세요. 여러 텍스트가 섞인 컨테이너·입력 필드는 지원하지 않습니다.';$('fields').disabled=!selection;$('text-fields').disabled=!selection;$('selected').textContent=selection?`${m.tag} · ${m.source?'원본 연결됨':m.id||'원본 코드 위치를 확인할 수 없는 요소'}`:'앱에서 요소를 클릭하세요.';for(const [property,{input,unit,sync}] of controls){const v=String(m.values?.[property]||'');input.value=Number.isFinite(parseFloat(v))?parseFloat(v):'';unit.value=v.endsWith('%')?'%':'px';sync();}}

 if(m?.type==='dragger:svg-applied'){previewChanges=previewChanges.filter(c=>!(c.selection===m.selection&&c.property==='svgColor'&&c.slot===m.slot&&c.viewport===device));previewChanges.push({source:m.source,selection:m.selection,property:'svgColor',slot:m.slot,value:m.value,unit:'',viewport:device});updateCount();$('feedback').textContent='로고 색상 반영됨 · 변경 검토에서 SVG 원본 파일에 적용할 수 있습니다.';}
 if(m?.type==='dragger:svg-restored'){previewChanges=previewChanges.filter(c=>!(c.selection===m.selection&&c.property==='svgColor'));updateCount();}
 if(m?.type==='dragger:text-applied'){previewChanges=previewChanges.filter(c=>!(c.selection===m.selection&&c.property==='text'&&c.viewport===device));if(m.value!==m.before)previewChanges.push({source:m.source,selection:m.selection,property:'text',value:m.value,before:m.before,viewport:device});updateCount();$('feedback').textContent='텍스트 반영됨 · 변경 검토에서 원본 코드 연결을 확인하세요.';}
 if(m?.type==='dragger:applied'){if(m.id){const change={id:m.id,property:m.property,value:m.value,unit:m.unit,viewport:device};try{css({schema:'dragger/v1',changes:[change]});changes=changes.filter(c=>!(c.id===m.id&&c.property===m.property&&c.viewport===device));changes.push(change);save();}catch{return;}}else{previewChanges=previewChanges.filter(c=>!(c.selection===m.selection&&c.property===m.property&&c.viewport===device));previewChanges.push({source:m.source,selection:m.selection,property:m.property,value:m.value,unit:m.unit,viewport:device});updateCount();}$('feedback').textContent=m.source?'화면에 반영됨 · 변경 검토에서 원본 코드 반영을 진행하세요.':m.id?'반영됨 · CSS 내보내기용 변경값 저장됨':'화면에만 반영됨 · 이 요소의 원본 코드 위치를 확인할 수 없습니다.';}
 if(m?.type==='dragger:restored-all'){changes=[];previewChanges=[];save();}
 if(m?.type==='dragger:restored'){if(m.id)changes=changes.filter(c=>!(c.id===m.id&&c.viewport===device));previewChanges=previewChanges.filter(c=>!(c.selection===m.selection&&c.viewport===device));save();$('feedback').textContent='선택한 요소의 스타일과 텍스트를 원래대로 되돌렸습니다.';}
});
$('review').onclick=()=>{
 const ready=changes.map(c=>`${c.viewport} / ${c.id} / ${c.property}: ${c.value}${c.unit}`);
 const describe=c=>c.property==='text'?`${c.viewport} / 요소 ${c.selection} / 텍스트: ${JSON.stringify(c.before)} → ${JSON.stringify(c.value)}`:`${c.viewport} / 요소 ${c.selection} / ${c.property==='svgColor'?'로고 색상':c.property}: ${c.value}${c.unit}`;
 const mapped=previewChanges.filter(c=>c.source).map(describe),unmapped=previewChanges.filter(c=>!c.source).map(describe);
 $('diff').textContent=[ready.length?`CSS 내보내기 가능 ${ready.length}건\n${ready.join('\n')}`:'',mapped.length?`원본 코드 변경 검토 가능 ${mapped.length}건\n${mapped.join('\n')}`:'',unmapped.length?`화면에서만 수정됨 ${unmapped.length}건 — 원본 코드 위치를 확인할 수 없습니다.\n${unmapped.join('\n')}`:''].filter(Boolean).join('\n\n')||'아직 변경이 없습니다.';
 for(const id of ['export-json','export-css','export-pr'])$(id).disabled=!changes.length;
 $('changes').showModal();
};
async function download(name,value){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([await value],{type:'text/plain'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-json').onclick=()=>download('dragger-changes.json',JSON.stringify(bundle(),null,2));$('export-css').onclick=()=>download('dragger.generated.css',css(bundle()));$('export-pr').onclick=()=>download('dragger-pr.md','# UI 변경\n\n'+changes.map(c=>`- ${c.viewport} / ${c.id} / ${c.property}: ${c.value}${c.unit}`).join('\n')+'\n\n검증: 실제 화면 및 반응형 확인 필요. 변경 범위: Dragger UI 값과 생성 CSS.\n');
$('desktop').classList.add('active');renderServices();if(services.length)choose(services[0].id);else{frame.hidden=true;$('frame-shell').hidden=true;}


addEventListener('dragger:source-applied',()=>{changes=[];previewChanges=[];save();});

const pageForm=$('page-form'),pageInput=$('page-url');pageInput.value=service?frame.src:'';
pageForm.onsubmit=e=>{e.preventDefault();$('navigation-error').hidden=true;try{const target=new URL(pageInput.value);if(!service){$('url').value=serviceURL(target.href);$('connection').showModal();return;}if(target.origin!==new URL(frame.src).origin)throw Error('다른 서비스는 서비스 연결 메뉴에서 추가하세요.');frame.src=target.href;}catch(error){$('navigation-error').textContent=error.message;$('navigation-error').hidden=false;}};
addEventListener('message',e=>{if(e.source!==frame.contentWindow||!service||e.origin!==new URL(frame.src).origin)return;try{if(e.data?.pageUrl&&new URL(e.data.pageUrl).origin===e.origin)pageInput.value=e.data.pageUrl;}catch{}});
$('history-undo').onclick=()=>send({type:'dragger:undo'});
$('history-redo').onclick=()=>send({type:'dragger:redo'});
addEventListener('message',e=>{if(e.source!==frame.contentWindow||!service||e.origin!==new URL(frame.src).origin)return;if(e.data?.type==='dragger:history'){$('history-undo').disabled=!e.data.undo;$('history-redo').disabled=!e.data.redo;}});

addEventListener('dragger:open-project',e=>{const p=e.detail;try{const url=serviceURL(p.url);let entry=services.find(s=>s.url===url);if(!entry){entry={id:crypto.randomUUID(),name:p.name,url,mobile:''};services.push(entry);localStorage.setItem('dragger.services',JSON.stringify(services));}renderServices();$('services').value=entry.id;choose(entry.id);}catch(error){$('status').textContent=error.message;}});
