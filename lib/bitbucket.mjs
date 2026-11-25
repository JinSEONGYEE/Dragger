export function parseRemote(remote){
 const normalized=remote.replace(/^git@([^:]+):/,'ssh://git@$1/');let u;try{u=new URL(normalized);}catch{throw Error('지원하지 않는 저장소 주소입니다.');}
 if(!['https:','ssh:'].includes(u.protocol)||u.password||!['github.com','bitbucket.org'].includes(u.hostname))throw Error('GitHub 또는 Bitbucket 저장소 주소가 필요합니다.');
 const parts=u.pathname.replace(/\.git$/,'').split('/').filter(Boolean);if(parts.length!==2||parts.some(p=>! /^[\w.-]+$/.test(p)))throw Error('저장소 주소를 확인하세요.');return {provider:u.hostname==='bitbucket.org'?'bitbucket':'github',workspace:parts[0],slug:parts[1]};
}
export function bitbucketClient(remote,{env=process.env,request=fetch}={}){
 const {workspace,slug}=parseRemote(remote),token=env.DRAGGER_BITBUCKET_TOKEN,email=env.DRAGGER_BITBUCKET_EMAIL;
 if(!token||!email)throw Error('Bitbucket 인증이 필요합니다. 서버에 DRAGGER_BITBUCKET_EMAIL과 DRAGGER_BITBUCKET_TOKEN을 설정하세요. 토큰은 채팅에 보내지 마세요.');
 const base=`https://api.bitbucket.org/2.0/repositories/${workspace}/${slug}`;
 async function call(endpoint,options={}){const response=await request(base+endpoint,{...options,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Basic '+Buffer.from(email+':'+token).toString('base64'),'Content-Type':'application/json',Accept:'application/json'}});if(!response.ok)throw Error(`Bitbucket 요청 실패 (${response.status}). 저장소·PR 권한과 인증을 확인하세요.`);return response.json();}
 return {check:()=>call(''),create:async(branch,baseBranch)=>{const data=await call('/pullrequests',{method:'POST',body:JSON.stringify({title:'Apply reviewed UI edits',description:'Dragger에서 원본 코드에 적용하고 화면 값을 검증한 UI 변경입니다. 공통 컴포넌트의 다른 화면 영향은 검토가 필요합니다.',source:{branch:{name:branch}},destination:{branch:{name:baseBranch}},draft:true,close_source_branch:true})});const url=data.links?.html?.href;if(!url||new URL(url).hostname!=='bitbucket.org')throw Error('PR 응답 주소를 확인할 수 없습니다. Bitbucket에서 생성 여부를 확인하세요.');return url;}};
}

export function pullRequestWebURL(remote,branch,base){
 const {provider,workspace,slug}=parseRemote(remote);
 if(!branch||!base)throw Error('비교할 브랜치가 필요합니다.');
 if(provider==='github'){
  const url=new URL(`https://github.com/${workspace}/${slug}/compare/${encodeURIComponent(base)}...${encodeURIComponent(branch)}`);
  url.search=new URLSearchParams({expand:'1',title:'Apply reviewed UI edits',body:'Dragger에서 원본 코드와 화면 반영을 확인한 UI 변경입니다.'}).toString();return url.href;
 }
 const url=new URL(`https://bitbucket.org/${workspace}/${slug}/pull-requests/new`);
 url.search=new URLSearchParams({source:branch,dest:base,t:'1'}).toString();return url.href;
}
