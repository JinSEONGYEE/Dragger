// This checks the configured front end, not the user's authenticated session or backend.
export async function checkApp(url, request = fetch) {
  if (!url) return {state: 'unconfigured', message: '실행 중인 앱 주소를 먼저 등록하세요.'};
  try {
    const response = await request(url, {redirect: 'manual', signal: AbortSignal.timeout(4000)});
    await response.body?.cancel();
    const status = response.status;
    if (status === 401 || status === 403 || (status >= 300 && status < 400)) {
      return {state: 'login', status, message: '앱이 응답합니다. 앱을 별도 창에서 열어 로그인 또는 이동할 주소를 확인하세요.'};
    }
    if (!response.ok) return {state: 'error', status, message: `앱이 ${status} 오류를 반환했습니다. 앱 실행 창과 시작 주소를 확인하세요.`};
    const framePolicy = response.headers.get('x-frame-options') || '';
    const csp = response.headers.get('content-security-policy') || '';
    if (/deny|sameorigin/i.test(framePolicy) || /frame-ancestors\s+'none'/i.test(csp)) {
      return {state: 'frame-blocked', status, message: '앱은 실행 중이지만 편집기 안에서 열 수 없도록 설정되어 있습니다. 팀 개발자에게 개발 환경의 Dragger 화면 연결을 요청하세요.'};
    }
    return {state: 'reachable', status, message: '앱 응답 확인됨 · 로그인과 실제 데이터는 앱에서 확인하세요.'};
  } catch {
    return {state: 'offline', message: '앱에 연결할 수 없습니다. 앱 실행 창을 켜고 주소·포트·VPN 연결을 확인하세요.'};
  }
}
