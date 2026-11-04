# 팀플 기여도 리포터

GitHub 활동(커밋·PR·리뷰·이슈)과 회의록을 분석해 팀원별 기여를 가시화하는 웹 서비스.
목적은 "판정"이 아니라 "근거 제시". 결과물 문구도 단정·비난 표현을 쓰지 않는다.

## 스택
- Next.js (App Router), TypeScript (strict), Tailwind CSS
- GitHub REST / GraphQL API (Octokit)
- Vitest (단위 테스트)
- zod (LLM 응답·API 입력 검증)
- Supabase (커밋 상세 캐시 전용, 3단계 이후 도입)
- LLM API (회의록 파싱, 기여 요약)
- 배포: Vercel

## 명령어
- `npm run dev`: 개발 서버
- `npm run build`: 빌드
- `npm run lint`: 린트
- `npm test`: 단위 테스트 (Vitest)
- 작업을 끝내기 전에 `npm run build`, `npm run lint`, `npm test`가 모두 통과하는지 확인한다.

## 디렉터리 구조 (목표)
```
src/
  app/              # 페이지, API Route (app/api/...)
  components/       # UI 컴포넌트
  lib/
    github/         # GitHub API 호출 (GraphQL 목록 수집, REST 커밋 상세)
    analysis/       # 필터링, 작성자 매핑, 축별 집계 (순수 함수 + 테스트)
    llm/            # LLM 클라이언트, 프롬프트 템플릿, 출력 검증
    cache/          # Supabase 커밋 상세 캐시 (3단계 이후)
  types/            # 공용 타입
docs/               # prompt-log.md, troubleshooting.md
```

## 확정된 설계 결정
- **GitHub 토큰**: MVP는 서버 env의 `GITHUB_TOKEN`으로 공개 레포만 분석한다.
  private 레포 지원은 4단계에서 사용자가 입력하는 토큰으로 확장한다. 이때 사용자 토큰은
  요청 처리 중 메모리에서만 쓰고 DB 저장·로그 출력·클라이언트 응답 포함을 모두 금지한다.
- **데이터 수집 방식**: GraphQL `history`는 커밋 단위 합계만 주고 파일별 변경 내역이 없어서
  생성 파일을 제외할 수 없다. 따라서
  - 커밋 목록, PR, 리뷰, 이슈 → GraphQL로 묶어서 수집
  - 파일별 추가/삭제 라인 → REST `GET /repos/{owner}/{repo}/commits/{sha}`로 커밋마다 조회
  - 커밋 상세 요청은 동시 실행 수를 제한한다(예: 5개).
- **Supabase 범위**: 커밋 상세 응답을 `sha` 키로 캐시하는 용도로만 쓴다. 커밋은 불변이라
  무효화가 필요 없다. 1~2단계에서는 Supabase 코드를 만들지 않는다.
  Supabase 접근은 서버에서만 하며 `SUPABASE_SERVICE_ROLE_KEY`를 클라이언트에 노출하지 않는다.

## 핵심 규칙
1. **비밀값은 서버에서만**: `GITHUB_TOKEN`, `LLM_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 API Route / 서버 코드에서만 사용. 클라이언트 컴포넌트나 `NEXT_PUBLIC_` 변수에 절대 넣지 않는다.
2. **LLM은 계산하지 않는다**: 커밋 수, 라인 수, 비율 등 모든 수치는 `lib/analysis`의 코드로 집계한다. LLM에는 집계 결과를 입력으로 주고 서술형 요약만 받는다.
3. **LLM 출력은 코드로 검증**: LLM 응답은 zod 스키마로 파싱한다. 응답 텍스트에서 숫자를 추출해 입력 집계값에 없는 숫자가 있으면 거부하고 1회 재시도, 그래도 실패하면 요약 없이 수치만 표시한다.
4. **근거 링크 필수**: 요약 문장마다 관련 커밋/PR URL을 연결할 수 있는 형태로 데이터를 유지한다. LLM에는 근거 ID만 주고, URL은 코드에서 붙인다.
5. **생성 파일 제외**: 집계 시 아래 패턴은 라인 수에서 제외한다.
   - `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
   - `dist/`, `build/`, `.next/`, `node_modules/`
   - `*.min.js`, `*.map`, 이미지·폰트 등 바이너리
6. **작성자 매핑**: 커밋 작성자는 이메일이 아니라 매핑된 "팀원" 단위로 집계한다. `author.login`이 null인 커밋도 처리한다.
7. **레이트 리밋 고려**: 페이지네이션을 처리하고, 403/429 응답 시 `retry-after` / `x-ratelimit-reset` 헤더를 보고 대기하거나 사용자에게 안내한다.

## 작업 방식
- 큰 변경은 먼저 계획을 제시하고 승인받은 뒤 구현한다.
- 한 번에 한 기능만 구현한다. 요청 범위 밖의 파일은 수정하지 않는다.
- 새 라이브러리를 추가할 때는 먼저 이유를 설명하고 확인받는다. (위 스택에 적힌 것은 예외)
- `lib/analysis`의 함수는 순수 함수로 작성하고, 같은 작업에서 Vitest 테스트를 함께 작성한다.
- 오류를 해결한 경우 `docs/troubleshooting.md`에 문제 / 원인 / 해결을 3줄로 추가한다.
- 비밀값(토큰, 키)은 프롬프트나 코드, 로그에 붙여넣지 않는다. `docs/prompt-log.md`에 그대로 기록된다.

## 커밋 규칙
- 형식: `<type>: <요약>` (type: feat, fix, refactor, test, docs, chore)
- 예: `feat: 커밋 상세 수집 및 생성 파일 필터링`
- 한 커밋에는 한 가지 변경만 담는다.
