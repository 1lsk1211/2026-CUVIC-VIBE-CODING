# 트러블슈팅 기록

문제가 생기고 해결할 때마다 아래 형식으로 추가합니다.

<!--
## YYYY-MM-DD 제목
- **문제**:
- **원인**:
- **해결**:
-->

## 2026-11-04 Vitest 설치 시 ERESOLVE 오류
- **문제**: `npm install -D vitest`가 `@types/node` 피어 의존성 충돌로 실패했다.
- **원인**: create-next-app의 `@types/node ^20`이 Vitest 5의 요구 범위(`^22 || >=24`)에 맞지 않았다.
- **해결**: `--force` 없이 `@types/node`를 `^24`로 올렸다.

## 2026-11-04 Claude Code 훅 때문에 npm run lint 실패
- **문제**: `.claude/hooks/log-prompt.js`에서 `no-require-imports` 오류가 나서 lint가 실패했다.
- **원인**: 훅은 node로 직접 실행하는 CommonJS 스크립트인데 앱 코드와 같은 ESLint 규칙이 적용됐다.
- **해결**: 훅은 수정하지 않고 `eslint.config.mjs`의 `globalIgnores`에 `.claude/**`를 추가했다.
