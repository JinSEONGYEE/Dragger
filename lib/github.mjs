import {parseRemote} from './bitbucket.mjs';
export function githubClient(remote,{env=process.env,request=fetch}={}){
 const {provider,workspace,slug}=parseRemote(remote);
 if(provider!=='github'||!env.DRAGGER_GITHUB_TOKEN)throw Error('GitHub 저장소 주소와 개인 액세스 토큰을 확인하세요.');
 return {async check(){
  let response;try{response=await request(`https://api.github.com/repos/${workspace}/${slug}`,{redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${env.DRAGGER_GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});}catch{throw Error('GitHub에 연결하지 못했습니다. 네트워크를 확인하세요.');}
  if(!response.ok)throw Error(`GitHub 요청 실패 (${response.status}). 토큰의 저장소 선택·권한과 조직 승인 여부를 확인하세요.`);
  const data=await response.json();if(data.archived)throw Error('보관된 저장소에는 변경을 올릴 수 없습니다.');
  return {...data,mainbranch:{name:data.default_branch}};
 }};
}
