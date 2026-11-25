const $=id=>document.getElementById(id);
let provider='bitbucket';
const repository=new URL(location.href).searchParams.get('repository');if(repository)$('repository').value=repository;
async function call(route,body={}){const response=await fetch('/api/connection/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(result.error);return result;}
function display(data){
 const matching=!data.remote||(data.provider||(data.remote.includes('github.com')?'github':'bitbucket'))===provider;
 $('author-form').closest('details').hidden=!matching||!data.connected;

 if(data.remote&&(data.provider||(data.remote.includes('github.com')?'github':'bitbucket'))!==provider){$('account-form').hidden=false;$('disconnect').hidden=true;$('repository').readOnly=false;$('submit').textContent='연결';if($('bitbucket-done'))$('bitbucket-done').hidden=true;$('result').textContent=`현재 ${data.repository} 저장소 ${data.connected?'연결을 사용 중입니다':'주소가 보관되어 있습니다'}. 새 저장소 연결에 성공하면 PR 대상 저장소가 전환됩니다.`;return;}
 $('disconnect').hidden=!data.connected&&!data.needsAuthentication;
 if(data.remote)$('repository').value=data.remote;
 $('account-form').hidden=!!data.connected;
 $('repository').readOnly=!!data.needsAuthentication;
 $('submit').textContent=data.needsAuthentication?'다시 연결':'연결';
 if($('bitbucket-done'))$('bitbucket-done').hidden=!data.connected;
 $('result').textContent=data.connected?`${data.repository} 연결됨\n이 연결을 코드 가져오기와 PR 브랜치 업로드에 함께 사용합니다. 이 창을 닫고 초안 PR 만들기를 진행하세요.`:data.needsAuthentication?data.message:`${provider==='github'?'GitHub':'Bitbucket'}을 한 번 연결하면 코드 가져오기와 PR 작성에 같은 연결을 사용합니다.`;
}
$('account-form').onsubmit=async e=>{e.preventDefault();$('submit').disabled=true;$('result').textContent='인증을 확인하고 코드를 가져오는 중입니다…';const body={provider,email:$('email').value,token:$('token').value,repository:$('repository').value};$('token').value='';try{display(await call('connect',body));}catch(error){$('result').textContent=error.message;}finally{body.token='';$('submit').disabled=false;}};
$('disconnect').onclick=async()=>{try{display(await call('disconnect'));$('result').textContent='연결을 해제하고 서버 메모리의 토큰을 지웠습니다. 내려받은 코드는 유지됩니다.';}catch(error){$('result').textContent=error.message;}};
const refresh=()=>call('status').then(display).catch(error=>{$('result').textContent=error.message;});
if($('bitbucket-dialog')){$('bitbucket-dialog').addEventListener('dragger:open',event=>{
 const next=event.detail?.provider||'bitbucket';if(provider!==next){$('repository').value='';$('token').value='';$('result').textContent='연결 상태를 확인하고 있습니다.';}
 provider=next;const github=provider==='github';$('bitbucket-title').textContent=github?'GitHub 연결':'Bitbucket 연결';$('email').closest('label').hidden=github;$('email').required=!github;$('token-label').textContent=github?'GitHub 개인 액세스 토큰':'Bitbucket API 토큰';$('repository').placeholder=github?'https://github.com/소유자/저장소':'https://bitbucket.org/팀/저장소';$('bitbucket-guide').hidden=github;$('github-guide').hidden=!github;refresh();
 });$('bitbucket-dialog').addEventListener('close',()=>{$('token').value='';});}else refresh();

$('author-form').onsubmit=async e=>{e.preventDefault();try{await call('author',{name:$('author-name').value,email:$('author-email').value});$('author-result').textContent='작성자 정보를 저장했습니다. 연결 창을 닫고 PR 만들기를 다시 진행하세요.';}catch(error){$('author-result').textContent=error.message;}};
