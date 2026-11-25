import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const execute=promisify(execFile);let credentials=null;
export const sessionCredentials=()=>credentials||process.env;
export function setSessionCredentials(email,token){credentials={DRAGGER_BITBUCKET_EMAIL:email,DRAGGER_BITBUCKET_TOKEN:token};}
export function setCredentialEnvironment(env){credentials={...env};}
export function clearSessionCredentials(){credentials=null;}
export function gitOptions(){const current=sessionCredentials(),isGithub=!!current.DRAGGER_GITHUB_TOKEN,token=isGithub?current.DRAGGER_GITHUB_TOKEN:current.DRAGGER_BITBUCKET_TOKEN;if(!token)throw Error('Dragger에서 저장소 계정을 먼저 연결하세요.');return {env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_ASKPASS:fileURLToPath(new URL('./git-askpass.cjs',import.meta.url)),DRAGGER_GIT_TOKEN:token,DRAGGER_GIT_HOST:isGithub?'github.com':'bitbucket.org',GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_0:'credential.helper',GIT_CONFIG_VALUE_0:'',GIT_CONFIG_KEY_1:'http.followRedirects',GIT_CONFIG_VALUE_1:'false'},encoding:'utf8',timeout:180000,maxBuffer:2*1024*1024};}
export async function authenticatedGit(args){try{return await execute('git',args,gitOptions());}catch{throw Error('저장소 코드 연결에 실패했습니다. 토큰의 저장소 읽기·쓰기 권한을 확인하세요.');}}
export function authenticatedGitSync(args){try{return execFileSync('git',args,{...gitOptions(),stdio:'pipe'}).trim();}catch{throw Error('저장소 Git 작업에 실패했습니다. 인증·권한·네트워크를 확인하세요.');}}
