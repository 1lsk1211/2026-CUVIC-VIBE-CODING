# 팀플 기여도 리포터

GitHub 활동(커밋·PR·리뷰·이슈)과 회의록을 분석해 팀원별 기여를 가시화하는 웹 서비스.
목적은 "판정"이 아니라 "근거 제시". 결과물 문구도 단정·비난 표현을 쓰지 않는다.

## 스택
- Next.js (App Router), TypeScript (strict), Tailwind CSS
- GitHub REST / GraphQL API
- Supabase
- LLM API (회의록 파싱, 기여 요약)
- 배포: Vercel

## 명령어
- `npm run dev`: 개발 서버
- `npm run build`: 빌드
- `npm run lint`: 린트
- 작업을 끝내기 전에 `npm run build`와 `npm run lint`가 통과하는지 확인한다.

## 디렉터리 구조 (목표)
```
src/
  app/              # 페이지, API Route (app/api/...)
  components/       # UI 컴포넌트
  lib/
    github/         # GitHub API 호출, 필터링, 작성자 매핑
    analysis/       # 축별 집계 로직 (순수 함수)
    llm/            # LLM 클라이언트, 프롬프트 템플릿
  types/            # 공용 타입
docs/               # prompt-log.md, troubleshooting.md
```

## 핵심 규칙
1. **비밀값은 서버에서만**: `GITHUB_TOKEN`, `LLM_API_KEY`는 API Route / 서버 코드에서만 사용. 클라이언트 컴포넌트나 `NEXT_PUBLIC_` 변수에 절대 넣지 않는다.
2. **LLM은 계산하지 않는다**: 커밋 수, 라인 수, 비율 등 모든 수치는 `lib/analysis`의 코드로 집계한다. LLM에는 집계 결과를 입력으로 주고 서술형 요약만 받는다. LLM 출력에 새로운 수치가 생기면 안 된다.
3. **LLM 출력은 구조화**: LLM 응답은 JSON 스키마로 받고, 파싱 실패 시 처리 로직을 둔다.
4. **근거 링크 필수**: 요약 문장마다 관련 커밋/PR URL을 연결할 수 있는 형태로 데이터를 유지한다.
5. **생성 파일 제외**: 집계 시 아래 패턴은 라인 수에서 제외한다.
   - `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
   - `dist/`, `build/`, `.next/`, `node_modules/`
   - `*.min.js`, `*.map`, 이미지·폰트 등 바이너리
6. **작성자 매핑**: 커밋 작성자는 이메일이 아니라 매핑된 "팀원" 단위로 집계한다. `author.login`이 null인 커밋도 처리한다.
7. **레이트 리밋 고려**: GitHub API 호출은 요청 수를 최소화하고(GraphQL로 묶기, 페이지네이션 처리), 403/429 응답을 처리한다.

## 작업 방식
- 큰 변경은 먼저 계획을 제시하고 승인받은 뒤 구현한다.
- 한 번에 한 기능만 구현한다. 요청 범위 밖의 파일은 수정하지 않는다.
- 새 라이브러리를 추가할 때는 먼저 이유를 설명하고 확인받는다.
- 집계 로직(`lib/analysis`)은 순수 함수로 작성해 테스트하기 쉽게 유지한다.
- 오류를 해결한 경우 `docs/troubleshooting.md`에 문제 / 원인 / 해결을 3줄로 추가한다.
