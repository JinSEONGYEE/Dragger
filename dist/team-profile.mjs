import {serviceURL} from './model.mjs';
export function teamProfile(input){
 if(input?.schema!=='dragger/team-v1'||typeof input.name!=='string'||!input.name.trim()||input.name.length>80)throw Error('Dragger 팀 연결 파일이 아닙니다.');
 const url=serviceURL(input.url),u=new URL(url);if(u.search||u.hash)throw Error('연결 파일 주소에는 인증 정보나 검색 조건을 포함할 수 없습니다.');
 return {schema:'dragger/team-v1',name:input.name.trim(),url};
}
