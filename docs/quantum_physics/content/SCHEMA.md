# 양자물리학 칠판 강의 — 콘텐츠 계약 (SCHEMA)

`docs/elliptic_curve/` 의 칠판 강의 형식을 그대로 따른다. 장면은 `content/*.json` 에 나뉘어 있고
`build.mjs` 가 파일 이름순으로 모아 하나의 장면(scene)으로 조립한다.
엔진 담당(`player.js`, `build.mjs`, `validate.mjs`, ...)과 콘텐츠 담당은 이 문서만 믿고 병렬로 일한다.

## 파일

| 파일 | 내용 |
|---|---|
| `00-meta.json` | `schema`, `lang`, `eyebrow`, `title`, `subtitle`, `author`, `ui`, `misconceptions[]`, `references[]` |
| `NN-<id>.json` (01~14) | **단계 객체 하나** (아래). 파일명 `NN` 순서 = 강의 순서 |

`schema` 는 `"quantum-physics-lesson/1"`, `lang` 은 `"ko"`, `author` 는 `"Microsoft Korea STU"` 고정.
`ui.hint` 는 `"눌러서 판서 시작"`. 조립된 장면은 `docs/elliptic_curve/elliptic-curve.scene.json` 과 같은 모양
(`steps` 배열 + `misconceptions` + `references`)이다.

## 단계 객체 (elliptic_curve 와 동일한 필드)

```jsonc
{
  "id": "blackbody",              // 소문자 영문/숫자, 파일명과 일치
  "nav": "흑체복사",               // 목차 짧은 이름 (8자 안팎)
  "title": "...?",                // 칠판 제목 (질문형 권장)
  "tag": { "tone": "concept|experiment|math|apply|open", "text": "실험: 1900년 ..." },
  "summary": "요약 1~2문장",        // 화면 요약. 서식 허용
  "narration": "...",             // 음성 대본. 아래 '음성 대본 규칙'
  "beats": [ { "at": 0.3, "text": "자막" }, ... ],   // 자막 3~4개, at = 판서 시작 후 초
  "callout": { "tone": "info|warn|ok", "title": "...", "text": "..." },
  "legend": [ { "color": "mint", "style": "line|dot|dash|bar|box", "text": "..." } ],
  "alt": "보드를 보지 못하는 사람을 위한 서술 (축, 곡선 모양, 값 포함)",
  "board": { ... },               // 아래
  "panel": [ { "text": "수식 한 줄", "color": "white", "size": "xl|l|m|s", "at": 0.3 }, ... ]
}
```

- `tag.tone` 의미: `concept` 개념 · `experiment` 실험 · `math` 증명/유도 · `apply` 응용 · `open` 열린 문제.
- `panel` 은 오른쪽(또는 아래) 수식 노트. 3~7줄. 한 줄은 짧게(약 28자 이내).
- `beats` 의 `at` 는 오름차순, 마지막 beat 도 narration 이 끝나기 전 시각에 놓는다.
- 서식: `^{2}` 위첨자, `_{n}` 아래첨자(토큰 안에는 `{}^_\*[]` 금지), `**강조**`. 낱개 `*`, `^`, `_`, `{`, `}`, `\\`, `[[` 금지.
  `[[점]]` 자리표시자와 `math` 블록은 **쓰지 않는다**(타원곡선 전용이었음, 삭제).
- 색: `white mint yellow pink sky orange`.
- 모든 단계에는 `tag`, `summary`, `narration`, `beats`, `callout`, `legend`, `alt`, `board`, `panel` 이 있어야 한다
  (`legend` 가 의미 없는 flow 단계는 빈 배열 가능).

## 글꼴·글자 집합 (보장)

기본 글꼴 NanumPenScript 에는 그리스 문자·수학 기호가 없다. 엔진이 **DejaVu Sans 부분 집합**을 함께 내장해
아래 글자를 보장한다. 이 밖의 글자는 쓰지 말 것.

- ASCII, 한글, `≠ ± × ÷ °`
- 그리스: `α β γ δ ε θ λ μ ν π ρ σ τ φ ψ ω Γ Δ Θ Λ Σ Φ Ψ Ω`, `ħ ℏ ℓ`
- 연산/관계: `≥ ≤ ≈ ≡ ∼ ∝ ∈ √ ∞ ∫ ∂ ∇ ∑ ∏ ⊗ ⊕ † ‖ ⊥ ·`
- 화살표/기타: `→ ← ↑ ↓ ↔ ⇒ ⇔ ⟨ ⟩ ½ ′ ″ … – — ✓ ℂ ℝ`
- 숫자 첨자는 가능하면 `^{2}` / `_{0}` 서식으로, 유니코드 첨자(`²`,`₀`)는 쓰지 말 것.
- 켓 표기: `|ψ⟩`, `⟨φ|ψ⟩`. 막대 `|` 는 ASCII.

## 음성 대본(`narration`) 규칙

- **250~440자**(공백 포함). 440자를 넘기면 MAI-Voice-2 가 거부한다. 한 단계 약 40~60초.
- **숫자·기호·로마자·한자 금지**: 전부 한글로 풀어 쓴다. (`h` → "플랑크 상수", `ψ` → "프사이", `ħ` → "에이치바",
  `1900년` → "천구백 년", `10^{-34}` → "십의 마이너스 삼십사 제곱", `|0⟩` → "켓 영", `≥` → "크거나 같다", `√2` → "루트 이".)
  허용 문자: 한글, 공백, `. , ? ! '`.
- 소리 나는 대로 읽히는지 점검한다(예: "삼십육" "십육" 같은 연음/격음 변화, "육" vs "륙"). 어색할 수 있는 한자어는 풀어 쓴다.
- 구어체 존댓말 "~해요/~예요". 칠판 앞에서 말하듯 한 번에 한 가지 주장. 마지막 문장은 다음 단계로 이어지는 한 줄.
- `beats` 의 자막은 narration 과 같은 내용을 화면용 기호(수식 서식 포함)로 쓴 것.

## 사실 규율 (가장 중요)

- 확립된 물리·역사만 쓴다. 인용 가능한 이름·연도·수치(플랑크 상수, 슬릿 간격 공식, CHSH 한계 2 와 2√2, 노벨상 연도 등)만 쓰고,
  **출처 없는 통계·성능 수치를 지어내지 않는다.** 확신이 없으면 빼거나 질적 서술로 바꾼다.
- "증명했다"는 말은 신중히: 실험이 *이론 예측을 확인*한 것, 수학적 *증명*(예: 불확정성 부등식 유도, 벨 부등식 유도)을 구분한다.
- 열린 문제(측정 문제, 해석 논쟁, 양자 중력, 오류 정정 규모 확장)는 "아직 합의가 없다"고 솔직하게 쓴다.
- 양자 컴퓨팅은 과장 금지: 쇼어 알고리즘의 이론적 속도 향상과 현재 장치의 규모/오류 한계를 구분해서 쓴다.
- 칠판 위 모든 수식·값은 서로 일관되어야 한다(예: 그래프에 그린 함수와 panel 의 식이 같다).

## 보드 (`board.kind`)

네 종류. 시간(`at`, `dur`)은 단계 시작 후 초 단위.

### 1. `graph` — 일반 함수 그래프·도식 (새로 추가되는 보드)

```jsonc
"board": {
  "kind": "graph",
  "view": { "x": [0, 4], "y": [0, 1.2] },       // 데이터 좌표 범위
  "equalAspect": false,                         // true 면 가로세로 눈금 간격 같음 (원/구 도식)
  "elements": [ ... ]
}
```

`elements[].type`:

| type | 필드 | 설명 |
|---|---|---|
| `axes` | `at,dur, xLabel, yLabel, xTicks:[{v,label}], yTicks:[{v,label}], grid?:false` | 축·눈금. 라벨은 서식 허용. 눈금을 주지 않으면 눈금 없음 |
| `fn` | `expr, x?:[a,b], color, at, dur, dash?, samples?, label?:{text,x,y}` | `y = expr(x)` 곡선. `x` 생략 시 view 전체 |
| `area` | `expr, x:[a,b], color, at, dur, base?:0` | 곡선 아래 빗금 채우기 (확률 넓이 등) |
| `point` | `x, y, color, at, label?, dir?` | 점. `dir` 은 `ul ur dl dr u d l r` |
| `seg` | `from:[x,y], to:[x,y], color, at, dur, style?:"solid|dash", arrow?:true, label?:{text,x,y}` | 선분·화살표·준위선·점선 |
| `ellipse` | `cx, cy, rx, ry, color, at, dur, dash?, from?, to?` | 원/타원(각도 `from`,`to` 라디안으로 호). 블로흐 구 도식 등 |
| `text` | `x, y, text, color, size?:"m|l|s", at, dir?` | 자유 글자 |

**`expr` 문법**(엔진이 자체 파서로 계산, `eval` 사용 금지): 숫자, 변수 `x`, 상수 `pi`, `e`,
연산 `+ - * / ^`, 괄호, 함수 `sin cos tan exp ln sqrt abs sinc tanh sinh cosh step`
(`sinc(u)=sin(u)/u`, `sinc(0)=1`; `step(u)` = u≥0 이면 1 아니면 0). 예: `"cos(pi*x)^2*sinc(2*pi*x)^2"`,
`"1/(x^5*(exp(1/x)-1))"`. 정의되지 않는 구간은 선이 끊긴다. 조각별 함수는 `x` 범위가 다른 `fn` 을 여러 개 쓴다.

### 2. `flow` — 상자와 화살표 (elliptic_curve 와 동일)

```jsonc
"board": { "kind": "flow", "cols": 3, "elements": [
  { "type": "node", "id": "a", "color": "sky", "at": 0.6, "title": "...", "lines": ["...", "..."] } ] }
```
노드 2~6개, `cols` 1~4, 순서대로 화살표로 이어진다. 시간선·절차·구조도에 쓴다.

### 3. `bars` — 가로 막대 비교

```jsonc
"board": { "kind": "bars", "axisLabel": "CHSH 값 S", "axisMax": 4, "axisTicks": [0,1,2,3,4],
  "markers": [ { "at": 2, "label": "고전 한계 2", "color": "pink" } ],       // 선택: 기준 세로선
  "elements": [ { "type": "bar", "color": "mint", "at": 1.0, "dur": 1.0,
                  "amount": 2.0, "label": "고전 이론의 최대", "value": "2" } ] }
```
`amount` 는 축 단위의 길이(0 ≤ amount ≤ axisMax). (기존 `count`, `pow2` 는 쓰지 않는다.)

### 4. `chalk` — 판서 글자만(빈 보드)

```jsonc
"board": { "kind": "chalk", "elements": [] }
```
`panel` 만으로 전개하는 순수 수식 유도 단계에 쓴다.

## 단계 구성 (14단계) 와 담당

| # | id | 주제 | tone | 보드 | 담당 |
|---|---|---|---|---|---|
| 01 | `blackbody` | 흑체복사와 자외선 파국, 플랑크의 양자 가설 E=nhν | experiment | graph (레일리-진스 vs 플랑크 곡선) | C1 |
| 02 | `photoelectric` | 광전 효과, 아인슈타인 광양자 K=hν−φ | experiment | graph (K_max vs ν 직선, 문턱) | C1 |
| 03 | `doubleslit` | 이중 슬릿, 드브로이 λ=h/p, 데이비슨-거머, 한 알씩 쌓이는 간섭무늬 | experiment | graph (간섭 세기 곡선) | C1 |
| 04 | `schrodinger` | 파동함수, 보른 규칙, 슈뢰딩거 방정식 | math | graph (ψ, |ψ|² 확률 넓이) 또는 chalk | C1 |
| 05 | `box` | 상자 속 입자: 경계조건 → 에너지 양자화 E_n=n²π²ħ²/2mL², 원자 스펙트럼으로 연결 | math | graph (준위선 + 파동함수) | C1 |
| 06 | `uncertainty` | 불확정성 원리 ΔxΔp ≥ ħ/2 : 푸리에 직관 + 로버트슨 유도, 측정 교란과 구분 | math | graph (좁은/넓은 파속) | C2 |
| 07 | `tunneling` | 양자 터널링: 장벽 안 지수 감쇠, 알파 붕괴·STM·플래시 메모리 | concept | graph (장벽 + ψ) | C2 |
| 08 | `spin` | 슈테른-게를라흐, 스핀 1/2, 중첩 상태 α|↑⟩+β|↓⟩, 큐비트로 가는 길 | experiment | graph(equalAspect, 블로흐 원) 또는 flow | C2 |
| 09 | `entanglement` | 얽힘, EPR 논증, 벨 부등식과 CHSH 유도 (S≤2 vs 2√2) | math | bars (고전 한계 / 양자 최대 / 대수적 최대) | C2 |
| 10 | `bell-tests` | 벨 실험의 증명 역사: 프리드먼-클라우저, 아스페(1982), 허점 없는 실험(2015), 2022 노벨 물리학상 | experiment | flow (시간선) | C2 |
| 11 | `measurement` | 측정 문제, 결어긋남(decoherence), 해석들(코펜하겐·다세계·보옴·QBism), 고양이 | open | flow | C3 |
| 12 | `qcomputing` | 큐비트·게이트·간섭, 쇼어·그로버, 오류 정정, 현재의 한계 (과장 금지) | apply | flow (회로/비교) 또는 graph | C3 |
| 13 | `applications` | 이미 쓰는 양자: 레이저, 트랜지스터/반도체, MRI, 원자시계/GPS, 양자 암호(BB84), 양자 센싱 | apply | flow 또는 bars(질적 비교 금지) → flow 권장 | C3 |
| 14 | `frontier` | 열린 문제와 고찰: 측정 문제, 양자 중력, 상대론과의 결합, 양자 우위의 의미, 앞으로 무엇을 의심할까 | open | flow | C3 |

콘텐츠 담당은 위 표에서 **자기 단계 파일만** 쓴다. C3 는 추가로 `00-meta.json`(오해 바로잡기 4~5개, 참고문헌 8~12개) 을 쓴다.
참고문헌은 실제 존재하는 논문/교재/기관 자료만(예: Planck 1900, Einstein 1905, Davisson-Germer 1927, Heisenberg 1927,
Bell 1964, Clauser-Horne-Shimony-Holt 1969, Aspect et al. 1982, Hensen et al. 2015 Nature 526, Shor 1994,
Griffiths *Introduction to Quantum Mechanics*, Nielsen-Chuang, 노벨상 위원회 2022 물리학상 해설 등). 연도·권호가 불확실하면 쓰지 않는다.

## 검증 (`validate.mjs`, 엔진 담당이 구현)

필수 필드, 서식 토큰, 허용 글자(위 글자 집합), narration 길이(250~440)와 금지 문자, `beats.at` 오름차순,
`board.kind`별 요소/필드, `expr` 파싱 가능 여부와 view 안에서 값이 존재하는지, panel 줄 길이, 단계 id 와 파일명 일치.
콘텐츠 담당은 `node docs/quantum_physics/validate.mjs` 가 생기면 실행해서 자기 파일의 오류를 모두 고친다.

## Engine notes (엔진 담당이 덧붙임 — 위 계약의 의미는 바꾸지 않음)

- **검증 실행**: `node docs/quantum_physics/validate.mjs` (아직 없는 파일은 "pending" 으로만 표시, 있는 파일의 오류가 있으면 종료 코드 1).
  `node validate.mjs content/03-doubleslit.json` 처럼 파일을 지정하면 그 파일의 결과만 보여 준다. `--strict` 는 14단계+meta 가 모두 있어야 통과.
- **오류 vs 경고**: 계약 위반(필수 필드, 열거값, 해설 250~440자·금지 문자, 글리프 없음, `expr` 해석 불가/값 없음, beats 오름차순·해설 끝 이후, 중복 id/파일명 불일치)은 오류.
  글 길이·개수 권장치 초과는 경고(너무 심하면 오류). 경고도 읽어 보고 고칠 수 있으면 고칠 것. 알 수 없는 필드는 경고(엔진이 무시함).
- **글 길이 권장치(보이는 글자 수, 서식 토큰 제외)**: nav 8(≤12), title 48, tag.text 44, summary 160, beats 각 100, callout.title 30, callout.text 150, legend.text 30,
  panel 한 줄 28(34 초과는 오류), graph 라벨/점/글자 22~26, flow 노드 title 14·lines 각 20, bars label 22·value 12, 참고문헌 한 줄 200(320 초과는 오류).
- **허용 글자**: 글꼴 합집합(NanumPenScript ∪ QMath)에 없는 글자는 오류. QMath 는 위 '보장' 목록 + ASCII 에 더해, 참고문헌의 인명용 라틴-1/라틴 확장 A(ö é ü ł …)와 둥근 따옴표 `‘ ’ “ ”` 를 덤으로 가진다
  (본문에서는 가급적 ASCII 따옴표를 쓸 것). 그 밖의 글자(유니코드 첨자 `²`, 이모지, 한자 등)는 쓰지 말 것.
- **해설 길이 추정**: ko-KR-Haena 는 공백 포함 초당 약 6.8자(6.2~7.6)이다. 마지막 beat 의 `at` 가 `글자수/7.6 − 1`초 이상이면 오류, `글자수/6.8 − 3`초 초과면 경고.
  판서(요소·panel)가 추정 해설 길이보다 1초 넘게 늦게 끝나면 경고.
- **graph**: `view` 밖의 점·글자·라벨 좌표는 오류. `fn`/`area` 의 `expr` 는 240표본 중 view.y 안에 들어오는 값이 하나도 없으면 오류(대부분 밖이면 경고). 곡선이 view.y 를 넘어가면 보드 가장자리에서 잘려 그려진다.
  `area` 의 `x` 는 필수. 라벨 `{text,x,y}` 의 x,y 는 라벨이 놓일 기준점이다(엔진이 겹침을 피해 약간 밀 수 있음).
- **기업명**: 고객사로 보일 수 있는 이름(삼성·LG·SK·KT·현대·네이버·카카오·쿠팡·테슬라 …)은 오류, 기술 기업명(구글·마이크로소프트·IBM·엔비디아 …)은 경고(정책 확인용). 저자 줄 `Microsoft Korea STU` 는 예외.
- **참고문헌에 URL**: 화면에 글자로만 보인다(링크 아님). `https://` 는 써도 되지만 빌드가 산출물의 "외부 URL 금지" 검사에서 참고문헌 속 URL 글자는 제외한다.
