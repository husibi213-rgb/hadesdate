import "server-only";

/**
 * SOOP(숲) API 요청 공통 설정.
 *
 * SOOP 은 브라우저가 아닌 요청(User-Agent 가 없거나 node 인 요청)에
 * 200 대신 404 를 돌려준다. 실제로 Vercel 배포본에서 station API 가
 * 전 멤버 404 로 실패했고, 같은 URL 을 브라우저로 열면 정상 응답이었다.
 * 그래서 브라우저와 동일한 헤더를 붙여서 보낸다.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** SOOP API 호출용 기본 헤더. referer 는 호출부에서 페이지별로 넘긴다. */
export function soopHeaders(referer: string): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "user-agent": USER_AGENT,
    origin: "https://www.sooplive.com",
    referer,
  };
}

/**
 * 실패 시 본문 앞부분까지 담아서 던진다.
 * 상태 코드만으로는 차단인지 경로 변경인지 구분이 안 되기 때문이다.
 */
export async function soopFetchJson(
  url: string,
  referer: string,
  label: string
): Promise<unknown> {
  const response = await fetch(url, {
    headers: soopHeaders(referer),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(`${label} ${response.status}${body ? ` — ${body}` : ""}`);
  }

  return response.json();
}
