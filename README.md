# 팀플 기여도 리포터

> GitHub 활동과 회의록을 근거로 팀원별 기여를 **가시화**하는 웹 서비스

팀 프로젝트가 끝나면 기여도 평가는 대개 감, 인상, 목소리 크기로 정해집니다.
무임승차는 모두가 체감하지만 근거로 보여주기는 어렵습니다.

이 프로젝트는 팀원을 **판정**하지 않습니다.
커밋, PR, 리뷰, 이슈, 회의록을 모아 **팀이 같은 근거를 보고 대화할 수 있게** 정리합니다.

---

## 주요 기능

| 기능 | 설명 |
|---|---|
| GitHub 레포 분석 | 커밋·PR·리뷰·이슈를 팀원별로 집계 |
| 회의록 분석 | 회의록에서 사람별 발언과 담당 액션아이템 추출 |
| 기여도 리포트 | 축별 레이더 차트 + AI 요약 + 근거 링크 |

## 설계 원칙

- **커밋 수·라인 수는 기여도가 아니다**: `package-lock.json`, `dist/`, 이미지 등 생성 파일은 집계에서 제외
- **단일 점수 대신 다차원 시각화**: 코드 / 리뷰 / 이슈·기획 / 회의 축으로 분리
- **비코드 기여 반영**: 리뷰, 이슈 정리, 회의 참여도 기여로 인정
- **작성자 매핑**: 한 사람이 여러 git 이메일을 쓰는 경우 하나로 통합
- **근거 우선**: 모든 요약에 해당 커밋·PR 링크 첨부
- **LLM은 계산하지 않고 해석만 한다**: 수치는 코드로 집계, LLM은 요약 서술만 담당

## 동작 흐름

```
레포 URL + 토큰 입력
  → GitHub 데이터 수집 (커밋 / PR / 리뷰 / 이슈)
  → 생성 파일 필터링
  → 작성자 매핑
  → 축별 집계
  → 회의록 분석 결과 병합
  → AI 요약 생성
  → 리포트 출력 (차트 + 요약 + 근거 링크)
```

## 기술 스택

- **Frontend / API**: Next.js (App Router), TypeScript, Tailwind CSS
- **데이터 수집**: GitHub REST / GraphQL API
- **DB**: Supabase
- **AI**: LLM API (회의록 파싱, 기여 요약)
- **배포**: Vercel

## 시작하기

> 개발 진행 중입니다. 아래 내용은 구현에 맞춰 갱신됩니다.

```bash
git clone https://github.com/<아이디>/<레포명>.git
cd <레포명>
npm install
npm run dev
```

`.env.local` 파일에 다음 값을 설정합니다.

```
GITHUB_TOKEN=        # GitHub Personal Access Token
LLM_API_KEY=         # LLM API 키
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## 로드맵

- [ ] 1단계: GitHub 데이터 수집, 생성 파일 필터링, 작성자 매핑
- [ ] 2단계: 집계 로직 + 차트 리포트 UI
- [ ] 3단계: 회의록 LLM 분석 및 결과 병합
- [ ] 4단계: AI 요약, 배포, 데모 준비

## 개발 기록

이 프로젝트는 Claude Code를 활용한 바이브 코딩으로 개발합니다.

- 프롬프트 로그: [`docs/prompt-log.md`](docs/prompt-log.md)
- 트러블슈팅 기록: [`docs/troubleshooting.md`](docs/troubleshooting.md)
- AI 작업 규칙: [`CLAUDE.md`](CLAUDE.md)
