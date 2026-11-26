// Migrate tab-local drafts once; subsequent navigation shares one durable record.
for(let i=0;i<sessionStorage.length;i++){const key=sessionStorage.key(i);if(key==='dragger.lastApplied'||key==='dragger.verification'||key?.startsWith('dragger.sourceDraft.')){if(localStorage.getItem(key)===null)localStorage.setItem(key,sessionStorage.getItem(key));}}
const oldKeys=[];for(let i=0;i<sessionStorage.length;i++){const key=sessionStorage.key(i);if(key==='dragger.lastApplied'||key==='dragger.verification'||key?.startsWith('dragger.sourceDraft.'))oldKeys.push(key);}for(const key of oldKeys)sessionStorage.removeItem(key);
const $=id=>document.getElementById(id),frame=$('preview');
let edits=new Map(),plan=null,appliedPlan=null,expected=null,verificationTimer=null,retryTimer=null,token=null,verificationReady=false;
try{appliedPlan=JSON.parse(localStorage.getItem('dragger.lastApplied')||'null');if(appliedPlan?.id){$('undo-code').disabled=false;$('source-rollback').disabled=false;}}catch{}
let currentPage=null;
const origin=()=>{try{return new URL(frame.src).origin;}catch{return null;}};
async function api(route,body){const r=await fetch('/api/source/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok){if(route!=='recover'&&data.error?.includes('검토가 만료')&&appliedPlan?.review?.files){const saved=JSON.parse(localStorage.getItem('dragger.verification')||'null');await api('recover',{id:appliedPlan.id,files:appliedPlan.review.files,expected:saved?.expected||[]});appliedPlan.verified=false;localStorage.setItem('dragger.lastApplied',JSON.stringify(appliedPlan));$('source-pr').disabled=true;throw Error('적용 기록을 복구했습니다. 화면 반영 다시 확인을 누르면 PR 작성을 계속할 수 있습니다.');}throw Error(data.error);}return data;}
const draftKey=()=>`dragger.sourceDraft.${origin()}`;
let draftSync=Promise.resolve();
function syncAIDraft(){const body={appOrigin:origin(),locale:new URL(frame.src).pathname.split('/')[1],changes:[...edits.values()]};draftSync=draftSync.catch(()=>{}).then(async()=>{const r=await fetch('/api/draft/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('AI 검토용 변경 동기화 실패');}).catch(()=>{});}
function persist(){localStorage.setItem(draftKey(),JSON.stringify([...edits]));syncAIDraft();}
const editKey=c=>JSON.stringify([c.source.file,c.source.index,c.instance?.file,c.instance?.index,c.property,c.slot]);
function restoreDraft(){try{edits=new Map(JSON.parse(localStorage.getItem(draftKey())||'[]').map(([,c])=>[editKey(c),c]));}catch{edits=new Map();}}
function replayDraft(){frame.contentWindow.postMessage({type:'dragger:source-replay',changes:[...edits.values()]},origin());}
const verificationDetails=document.createElement('pre');verificationDetails.id='verification-details';verificationDetails.setAttribute('aria-live','polite');$('source-status').after(verificationDetails);
const status=s=>$('source-status').textContent=s;
function verify(){frame.contentWindow.postMessage({type:'dragger:verify',expected,token},origin());}
addEventListener('message',async e=>{
 if(e.source!==frame.contentWindow||e.origin!==origin())return;const m=e.data;try{if(m?.pageUrl&&new URL(m.pageUrl).origin===origin())currentPage=m.pageUrl;}catch{}
 if(['dragger:applied','dragger:text-applied','dragger:svg-applied'].includes(m?.type)&&m.source&&!expected){const property=m.type==='dragger:text-applied'?'text':m.property;const key=editKey({...m,property});edits.set(key,{pageUrl:currentPage||frame.src,source:m.source,occurrences:m.occurrences,scope:m.scope||'selection',instance:m.instance,property,slot:m.slot,value:m.value,unit:m.unit,viewport:$('mobile').classList.contains('active')?'mobile':'desktop'});persist();if(appliedPlan)return;plan=null;$('source-apply').disabled=true;$('source-pr').disabled=true;}
 if(['dragger:restored','dragger:svg-restored'].includes(m?.type)&&m.source){for(const [key,c] of edits)if(c.source.file===m.source.file&&c.source.index===m.source.index&&JSON.stringify(c.instance||null)===JSON.stringify(m.instance||null))edits.delete(key);persist();plan=null;$('source-apply').disabled=true;$('source-pr').disabled=true;}
 if(m?.type==='dragger:restored-all'&&!expected){edits.clear();persist();plan=null;$('source-apply').disabled=true;$('source-pr').disabled=true;}
 if(m?.type==='dragger:ready'&&!expected&&!appliedPlan){restoreDraft();replayDraft();syncAIDraft();}
 if(m?.type==='dragger:ready'&&expected){verificationReady=true;verify();}
 if(m?.type==='dragger:verified'&&expected&&m.token===token){
  verificationDetails.textContent=(m.results||[]).map(r=>`${r.ok?'확인 완료':'확인 필요'} ${r.file||'이미지'} · ${r.property||'색상'}\n${r.reason||(r.ok?'반영 확인':'확인 실패')}${r.expected!==undefined?'\n변경값: '+r.expected:''}${r.actual?' / 화면값: '+(r.actual.join(', ')||'없음'):''}`).join('\n\n');
  if(!m.ok){const failed=(m.results||[]).filter(r=>!r.ok);status(`코드는 적용됐지만 화면에서 ${failed.length}개 변경을 아직 확인하지 못했습니다. 화면을 유지한 채 다시 확인 중…`);return;}
  clearTimeout(verificationTimer);clearInterval(retryTimer);expected=null;
  try{await api('verify',{id:appliedPlan.id,ok:m.ok});status(m.ok?'원본 코드를 다시 실행한 화면에서 변경값을 확인했습니다. 다른 화면에 미치는 영향은 PR에서 검토하세요.':'화면 검증에 실패했습니다. PR을 만들 수 없습니다. 코드 되돌리기를 사용할 수 있습니다.');appliedPlan.verified=m.ok;if(m.ok&&m.pageUrl&&new URL(m.pageUrl).origin===origin())appliedPlan.url=m.pageUrl;localStorage.setItem('dragger.lastApplied',JSON.stringify(appliedPlan));$('source-pr').disabled=!m.ok;}catch(error){status(error.message);}
  expected=null;$('reset-all').disabled=false;
 }
});
function showImpact(review){
 const warning=typeof review?.warning==='string'?review.warning.trim():'';
 $('source-warning').textContent=warning||(review?.files?.length?'공통 컴포넌트나 아이콘을 수정하면 같은 파일을 사용하는 다른 화면에도 반영될 수 있습니다. 이 기록에는 화면별 영향 분석이 저장되어 있지 않습니다. 아래 변경 파일을 확인해 주세요.':'아직 검토된 변경 내용이 없습니다. 코드 변경 검토가 완료되면 영향 안내를 확인할 수 있습니다.');
}
$('source-review').onclick=async()=>{
 $('changes').close();$('source-dialog').showModal();if(appliedPlan){plan=appliedPlan.review||plan;showImpact(plan);$('source-diff').textContent=plan?.files?.map(f=>`${f.file}\n${f.diff}`).join('\n\n')||'적용한 변경 내역을 보관 중입니다.';$('source-pr').disabled=!!expected||!appliedPlan.verified;status('이미 코드에 적용한 변경입니다. 화면 재확인, PR 만들기 또는 코드 되돌리기를 선택하세요.');return;}$('source-apply').disabled=true;$('source-pr').disabled=true;status('원본 파일과 변경 내용을 확인하는 중…');$('source-warning').textContent='변경 파일을 확인하고 있습니다. 검토가 완료되면 영향 안내가 표시됩니다.';
 try{plan=await api('plan',{appOrigin:origin(),locale:new URL(frame.src).pathname.split('/')[1],changes:[...edits.values()]});plan.pageUrl=[...edits.values()].at(-1)?.pageUrl||currentPage||frame.src;showImpact(plan);$('source-diff').textContent=plan.files.map(f=>`${f.file}\n${f.diff}`).join('\n\n');$('source-apply').disabled=false;status(`${plan.files.length}개 원본 파일을 수정합니다. 아직 코드는 변경하지 않았습니다.`);}catch(error){plan=null;showImpact(null);status(error.message);$('source-diff').textContent='';}
};
$('source-apply').onclick=async()=>{
 if(!plan){$('source-dialog').close();await $('source-review').onclick();return;}
 $('source-apply').disabled=true;status('원본 코드에 적용 중…');
 try{const result=await api('apply',{id:plan.id});appliedPlan={id:plan.id,origin:origin(),url:plan.pageUrl||currentPage||frame.src,review:plan,verified:false};localStorage.setItem('dragger.lastApplied',JSON.stringify(appliedPlan));$('undo-code').disabled=false;$('reset-all').disabled=true;expected=result.expected;localStorage.setItem('dragger.verification',JSON.stringify({id:plan.id,expected}));verificationReady=false;token=crypto.randomUUID();persist();$('source-rollback').disabled=false;status('앱을 새로 실행해 코드 반영을 확인하는 중…');const url=new URL(appliedPlan.url);url.searchParams.set('draggerReload',Date.now());frame.src=url.href;retryTimer=setInterval(()=>{if(expected&&verificationReady)verify();},5000);verificationTimer=setTimeout(()=>{if(!expected)return;clearInterval(retryTimer);expected=null;$('reset-all').disabled=false;status('코드는 적용됐지만 화면 반영을 확인하지 못했습니다. 자동 확인을 중단했습니다. PR은 보류되며, 코드 적용 되돌리기를 사용할 수 있습니다.');},45000);}catch(error){status(error.message);$('source-apply').disabled=false;}
};
$('source-rollback').onclick=async()=>{try{if(!appliedPlan)throw Error('현재 세션에서 되돌릴 코드 적용이 없습니다.');if(origin()!==appliedPlan.origin)throw Error('코드를 적용했던 서비스를 먼저 선택해주세요.');await api('rollback',{id:appliedPlan.id});expected=null;clearTimeout(verificationTimer);clearInterval(retryTimer);$('source-pr').disabled=true;$('source-rollback').disabled=true;persist();frame.src=appliedPlan.url;appliedPlan=null;localStorage.removeItem('dragger.lastApplied');plan=null;$('reset-all').disabled=false;$('undo-code').disabled=true;$('source-apply').disabled=false;status('코드를 되돌렸습니다. 편집한 값은 초안에 보관했고 미리보기에 복원합니다. 다시 변경 검토를 진행할 수 있습니다.');}catch(error){status(error.message);}};
const webLink=document.createElement('a');webLink.textContent='웹에서 PR 작성 계속';webLink.target='_blank';webLink.rel='noopener noreferrer';webLink.hidden=true;webLink.className='secondary-action';$('source-pr').before(webLink);
function showWebPR(url){const u=new URL(url);if(u.protocol!=='https:'||!['github.com','bitbucket.org'].includes(u.hostname))throw Error('PR 작성 주소가 올바르지 않습니다.');webLink.textContent='웹에서 PR 작성 계속';webLink.href=u.href;webLink.hidden=false;}
if(appliedPlan?.webUrl)showWebPR(appliedPlan.webUrl);
$('source-pr').onclick=async()=>{
 if(appliedPlan?.webUrl){showWebPR(appliedPlan.webUrl);webLink.click();return;}
 if(expected||!appliedPlan?.verified){status('화면 반영 확인이 완료된 뒤 PR을 만들 수 있습니다.');return;}
 clearTimeout(verificationTimer);clearInterval(retryTimer);token=null;$('source-pr').disabled=true;
 try{const connection=await api('publication-status',{});if(!connection.connected){const response=await fetch('/api/connection/status',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const account=await response.json();status(account.needsAuthentication?'저장소 연결은 유지되어 있습니다. 서버 재시작으로 인증이 풀렸으니 API 토큰만 다시 입력해주세요. 편집한 변경은 보관됩니다.':'저장소 연결을 PR에도 사용합니다. 먼저 계정과 저장소를 연결해주세요. 편집한 변경은 보관됩니다.');webLink.href=account.provider==='github'?'github.html':'bitbucket.html';webLink.textContent=account.needsAuthentication?'저장소 다시 인증':'저장소 연결';webLink.hidden=false;$('source-pr').disabled=false;return;}}catch(error){status(error.message);$('source-pr').disabled=false;return;}
 const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
 status('변경 브랜치를 업로드하고 웹 PR 작성 페이지를 준비하는 중…');
 try{const result=await api('pr',{id:appliedPlan.id});showWebPR(result.url);appliedPlan.webUrl=result.url;localStorage.setItem('dragger.lastApplied',JSON.stringify(appliedPlan));
  status('변경 브랜치를 업로드했습니다. 웹에서 제목과 변경 내용을 확인한 뒤 PR을 등록하세요. 아직 PR은 생성되지 않았습니다.');
  if(popup)popup.location.href=result.url;
  $('undo-code').disabled=true;$('source-rollback').disabled=true;$('source-pr').textContent='PR 작성 페이지 다시 열기';
 }catch(error){if(popup)popup.close();status(error.message);}finally{$('source-pr').disabled=!appliedPlan?.verified;}
};

$('undo-code').onclick=()=>{$('source-dialog').showModal();$('source-rollback').click();};
addEventListener('dragger:preview-reset',()=>{if(appliedPlan)return;edits.clear();persist();plan=null;$('source-apply').disabled=true;$('source-pr').disabled=true;});

const retry=document.createElement('button');retry.textContent='화면 반영 다시 확인';$('source-rollback').before(retry);
retry.onclick=async()=>{
 if(!appliedPlan){status('아직 코드에 적용한 변경이 없습니다.');return;}
 try{
  const saved=JSON.parse(localStorage.getItem('dragger.verification')||'null');
  if(!saved||saved.id!==appliedPlan.id)throw Error('이전 확인 정보를 찾을 수 없습니다. 초안을 유지한 채 코드 되돌리기를 진행하세요.');
  const target=new URL(appliedPlan.url);if(target.origin!==origin())throw Error('코드를 적용했던 서비스를 먼저 선택해주세요.');
  clearTimeout(verificationTimer);clearInterval(retryTimer);
  expected=saved.expected;token=crypto.randomUUID();verificationReady=false;appliedPlan.verified=false;localStorage.setItem('dragger.lastApplied',JSON.stringify(appliedPlan));$('source-pr').disabled=true;
  status('변경한 화면으로 이동해 실제 반영값을 확인하는 중…');
  target.searchParams.set('draggerReload',Date.now());frame.src=target.href;
  retryTimer=setInterval(()=>{if(expected&&verificationReady)verify();},2000);
  verificationTimer=setTimeout(()=>{if(!expected)return;clearInterval(retryTimer);expected=null;status('화면 반영을 확인하지 못했습니다. 아래 항목별 결과를 확인하세요. 편집 초안은 보관되어 있습니다.');},45000);
 }catch(error){status(error.message);}
};

function syncAppliedBadge(){if(appliedPlan){const count=appliedPlan.review?.files?.length||0;if($('review').firstChild?.nodeType===3)$('review').firstChild.textContent='적용 내역';$('count').textContent=count;$('source-review').textContent='적용 내역 · PR 계속하기';}}
addEventListener('load',syncAppliedBadge);addEventListener('message',e=>{if(e.source===frame.contentWindow&&e.data?.type==='dragger:ready')syncAppliedBadge();});

function syncReviewActions(){showImpact(appliedPlan?.review||plan);$('source-apply').hidden=!!appliedPlan;$('source-pr').hidden=!appliedPlan;}
new MutationObserver(syncReviewActions).observe($('source-dialog'),{attributes:true,attributeFilter:['open']});
new MutationObserver(syncReviewActions).observe($('source-apply'),{attributes:true,attributeFilter:['disabled']});
new MutationObserver(syncReviewActions).observe($('source-pr'),{attributes:true,attributeFilter:['disabled']});
syncReviewActions();
$('review').addEventListener('click',()=>setTimeout(()=>{if(appliedPlan){$('diff').textContent=`코드에 적용한 ${appliedPlan.review?.files?.length||0}개 파일이 보관되어 있습니다.\n\n`+(appliedPlan.review?.files||[]).map(f=>f.file).join('\n')+'\n\n아래에서 적용 내역을 확인하고 PR 작성을 이어가세요.';}}));
