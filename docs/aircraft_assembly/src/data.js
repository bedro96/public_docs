// All words and facts of the tour, Korean first and English second. Nothing here computes anything: numbers that move come from model.js.
// Confidence tags (shown as small pills): v = verified, s = verified (secondary source), e = estimate, a = assumption, u = unverified.
import { TO, TO_EVENTS, takeoffAt, KT } from './takeoff.js';
import { finaleF, WIRE_KM, SEAT_ROWS } from './model.js';

const ev = TO_EVENTS();
const rd = (v, n = 10) => Math.round(v / n) * n;
const ROLL_M = rd(takeoffAt(ev.lof).dist, 10); // ground roll to lift-off in the model
const VLOF_KT = Math.round(takeoffAt(ev.lof).v * KT);
const F = (t) => finaleF(t);

export const TAGS = {
  v: { ko: '확인됨', en: 'verified', cls: 'v' },
  s: { ko: '확인됨(2차)', en: 'verified, secondary', cls: 'v s' },
  e: { ko: '추정', en: 'estimate', cls: 'e' },
  a: { ko: '가정', en: 'assumption', cls: 'a' },
  u: { ko: '미확인', en: 'unverified', cls: 'u' },
};

export const UI = {
  sub: {
    ko: '위치타의 동체와 오번의 날개 부품이 렌턴에 모여, 약 10일 동안 움직이는 조립 라인 위에서 한 대의 737 MAX 8이 됩니다. 그 한 대를 따라가 이륙까지 봅니다.',
    en: 'A fuselage from Wichita and wing parts from Auburn meet at Renton and become one 737 MAX 8 over about ten days on a moving line. Follow that one plane to take-off.',
  },
  prev: { ko: '이전', en: 'Back' },
  play: { ko: '재생', en: 'Play' },
  pause: { ko: '일시정지', en: 'Pause' },
  next: { ko: '다음', en: 'Next' },
  srcBtn: { ko: '근거와 신뢰도', en: 'Sources & confidence' },
  replay: { ko: '이륙 다시 보기', en: 'Replay take-off' },
  legend: { ko: '', en: '' },
  now: { ko: '지금', en: 'Now' },
  stage: { ko: '전체 여정', en: 'Whole tour' },
  route: { ko: '공정 순서', en: 'Route' },
  equipment: { ko: '주요 설비', en: 'Key equipment' },
  key: { ko: '핵심 수치', en: 'Key number' },
  inLabel: { ko: '들어오는 것', en: 'In' },
  outLabel: { ko: '나가는 것', en: 'Out' },
  numbers: { ko: '생산 수치 (신뢰도 표기)', en: 'Production numbers (with confidence)' },
  reduced: {
    ko: '움직임 줄이기 설정이 켜져 있어 자동 재생을 하지 않습니다. 다음·이전 버튼으로 설명을 한 단계씩 넘기세요.',
    en: 'Reduced motion is on, so nothing plays by itself. Use Next and Back to step through the captions.',
  },
  hint: {
    ko: '도면이나 단계 버튼에 초점을 두고 방향키(←→), 1~8, Home, End, Esc를 쓸 수 있습니다.',
    en: 'With focus on the drawing or the buttons: arrow keys, 1 to 8, Home, End and Esc work.',
  },
  note: {
    ko: '비공식 교육용 도식입니다. 보잉과 무관하며 로고·실제 도장은 쓰지 않았고, 축척이 맞지 않는 곳이 있습니다.',
    en: 'An unofficial educational schematic, not affiliated with Boeing. No logos or real liveries, and not to scale in places.',
  },
  srcTitle: { ko: '근거와 신뢰도', en: 'Sources & confidence' },
  close: { ko: '닫기', en: 'Close' },
  playing: { ko: '재생 중입니다', en: 'Playing' },
  paused: { ko: '일시정지했습니다', en: 'Paused' },
  fail: { ko: '그림 갱신 중 오류가 반복되어 멈췄습니다. 처음부터를 눌러 보세요.', en: 'The drawing stopped after repeated errors. Press Restart.' },
  done: { ko: '여정이 끝났습니다. 이륙 다시 보기나 처음부터를 눌러 보세요.', en: 'The tour is finished. Press Replay take-off or Restart.' },
  fitting: { ko: '지금 장착', en: 'Fitting now' },
};

// live numbers shown in the readout box
export const READOUTS = {
  crates: { ko: '도착한 부품 묶음', en: 'Supplier loads arrived', unit: '/ 6' },
  sections: { ko: '동체 섹션', en: 'Fuselage sections', unit: '/ 4' },
  rail: { ko: '철도 이동', en: 'By rail', unit: 'km' },
  wingparts: { ko: '날개 부품 장착', en: 'Wing parts fitted', unit: '/ 30' },
  day: { ko: '조립 일차', en: 'Flow day', unit: '' },
  speedcm: { ko: '라인 속도', en: 'Line speed', unit: 'cm/min' },
  wire: { ko: '전선 포설', en: 'Wire run', unit: 'km' },
  tests: { ko: '통과한 시험', en: 'Tests passed', unit: '/ 6' },
  jack: { ko: '잭이 든 무게', en: 'Weight on jacks', unit: 't' },
  rows: { ko: '장착한 좌석 열', en: 'Seat rows fitted', unit: `/ ${SEAT_ROWS}` },
  engines: { ko: '엔진', en: 'Engines hung', unit: '/ 2' },
  fuel: { ko: '급유', en: 'Fuel loaded', unit: 'L' },
  n1: { ko: '엔진 회전(예시)', en: 'Engine speed (illustrative)', unit: '%' },
  kt: { ko: '속도', en: 'Speed', unit: 'kt' },
  dist: { ko: '활주로 위 거리', en: 'Distance along runway', unit: 'm' },
  pitch: { ko: '기수 각도', en: 'Pitch', unit: '°' },
  alt: { ko: '고도', en: 'Altitude', unit: 'm' },
  thrust: { ko: '추력(엔진 1기당)', en: 'Thrust per engine', unit: 'kN' },
};

// the eight stages; steps carry the caption (f = progress inside the stage where it starts)
export const STAGES = [
  {
    id: 'supply',
    short: { ko: '부품 모임', en: 'Supply' },
    name: { ko: '1 · 공급망: 부품이 렌턴으로', en: '1 · Supply chain: parts head for Renton' },
    what: {
      ko: '737 한 대는 약 36만 7천 개의 부품으로 이루어지고, 대부분을 세계 곳곳의 협력사가 만듭니다. 최종 조립은 워싱턴주 렌턴 한 곳에서 합니다. 도식 지도이며 위치와 운송 수단은 축척과 무관합니다.',
      en: 'A 737 has about 367,000 parts, most made by suppliers around the world. Final assembly happens in one place, Renton, Washington. This is a schematic map: positions and transport modes are not to scale.',
    },
    equipment: [
      { ko: '전용 철도차(동체)', en: 'Dedicated railcar (fuselage)' },
      { ko: '자동 패널 조립 라인', en: 'Automated panel line (wings)' },
      { ko: '로봇 스파 조립 라인', en: 'Robotic spar line (wings)' },
      { ko: '렌턴 이동식 라인', en: 'Renton moving line' },
    ],
    key: { value: '367,000', ko: '부품 수 (보잉 설명, NG 기준) [확인됨(2차)]', en: 'parts per airplane (Boeing text, NG era) [verified, secondary]' },
    inn: { ko: '전 세계 협력사의 부품과 금속 소재', en: 'Parts and raw metal from suppliers worldwide' },
    out: { ko: '렌턴 공장 앞에 모인 동체, 날개 부품, 꼬리, 엔진', en: 'Fuselage, wing parts, tail and engines gathered at Renton' },
    legend: { ko: '축척 아님: 지도는 도식이고 지점 위치는 임의입니다. 철도만 확인된 운송 수단이고 나머지는 도식입니다.', en: 'Not to scale: the map is schematic and the places are arbitrary. Only rail is a confirmed mode; the others are schematic.' },
    readouts: ['crates'],
    steps: [
      { f: 0, ko: '부품이 렌턴을 향해 모입니다. 한 대에 약 36만 7천 개의 부품이 들어갑니다 [확인됨(2차)].', en: 'Parts converge on Renton. About 367,000 parts go into one airplane [verified, secondary].' },
      { f: 0.2, ko: '동체는 캔자스 위치타에서 하나로 이어 붙여 철도로 옵니다. 약 3,500 km입니다 [확인됨(2차)].', en: 'The fuselage is joined whole in Wichita, Kansas and comes by rail, about 3,500 km [verified, secondary].' },
      { f: 0.45, ko: '날개는 스피릿이 아니라 보잉이 오번·프레더릭슨에서 외판과 스파를 깎고, 렌턴에서 조립합니다 [확인됨(2차)].', en: 'Wings are not Spirit’s: Boeing machines skins and spars at Auburn and Frederickson and assembles them at Renton [verified, secondary].' },
      { f: 0.7, ko: '꼬리 안정판은 한국항공우주산업(KAI), 수직 꼬리 구조물은 타타 보잉(인도)이 맡습니다. 둘의 역할 겹침은 정리되지 않았습니다 [미확인].', en: 'Stabilizers come from Korea Aerospace Industries; vertical-fin structures from Tata Boeing, India. How the two overlap is unresolved [unverified].' },
      { f: 0.85, ko: '엔진은 CFM의 LEAP-1B입니다 [확인됨(2차)]. 착륙장치와 항공전자의 제작사는 이번 조사에서 확인하지 못했습니다 [미확인].', en: 'Engines are CFM LEAP-1B [verified, secondary]. The makers of the landing gear and avionics were not confirmed in this research [unverified].' },
    ],
  },
  {
    id: 'fuselage',
    short: { ko: '동체 제작', en: 'Fuselage' },
    name: { ko: '2 · 위치타: 동체를 만들고 이어 붙여 철도로', en: '2 · Wichita: build and join the fuselage, ship it by rail' },
    what: {
      ko: '프레임과 스트링어 위에 알루미늄 외판을 두르고 리벳을 박아 네 개의 통(섹션 41, 43, 46, 48)을 만든 뒤 한 몸으로 잇습니다. 그린 프라이머를 입혀 전용 철도차에 싣고 렌턴으로 보냅니다.',
      en: 'Aluminium skins are wrapped on frames and stringers and riveted into four barrels (sections 41, 43, 46, 48), which are then joined as one. It gets green primer, goes onto a dedicated railcar and heads for Renton.',
    },
    equipment: [
      { ko: '자동 천공·리벳 장비', en: 'Automated drilling and riveting' },
      { ko: '섹션 조립 지그', en: 'Section assembly jigs' },
      { ko: '섹션 결합 장치', en: 'Section-join tooling' },
      { ko: 'BNSF 철도 · 전용 철도차', en: 'BNSF rail, dedicated railcar' },
    ],
    key: { value: '≈ 3,500 km', ko: '위치타 → 렌턴 철도 거리 (약 2,175마일) [확인됨(2차)]', en: 'Wichita to Renton by rail (about 2,175 miles) [verified, secondary]' },
    inn: { ko: '알루미늄 외판, 프레임, 스트링어, 리벳', en: 'Aluminium skins, frames, stringers, rivets' },
    out: { ko: '하나로 이어진 그린 동체 (섹션 41~48)', en: 'One joined green fuselage (sections 41 to 48)' },
    legend: { ko: '축척 아님: 3,500 km 철도 구간은 줄여 그렸고 가운데 끊은 표시가 있습니다.', en: 'Not to scale: the 3,500 km rail leg is compressed and broken in the middle.' },
    readouts: ['sections', 'rail'],
    steps: [
      { f: 0, ko: '위치타의 조립장입니다. 동체는 네 개의 통, 곧 섹션 41(조종실), 43, 46, 48(꼬리)로 만듭니다 [확인됨(2차)].', en: 'Wichita’s fuselage bay. The fuselage is four barrels: sections 41 (flight deck), 43, 46 and 48 (tail) [verified, secondary].' },
      { f: 0.1, ko: '먼저 둥근 프레임을 세우고 길이 방향 스트링어를 끼웁니다. 둘이 뼈대입니다.', en: 'First the round frames go up and the lengthwise stringers slot in. Together they are the skeleton.' },
      { f: 0.26, ko: '알루미늄 외판을 두르고 자동 장비가 구멍을 뚫어 리벳을 박습니다. 위치타의 자동 천공·리벳은 기업 공시에 일반 역량으로만 확인됩니다 [확인됨(일반)·737 세부 미확인].', en: 'Aluminium skins are wrapped on and automated machines drill and rivet. Spirit’s filings confirm automated fastening only as a general capability; 737-specific detail is [unverified].' },
      { f: 0.52, ko: '네 개의 통을 맞대어 한 몸으로 잇습니다. 렌턴에서 잇는 것이 아니라 위치타에서 이미 이어서 보냅니다 [확인됨(2차)].', en: 'The four barrels are brought together and joined. This happens in Wichita, not at Renton [verified, secondary].' },
      { f: 0.72, ko: '운송 중 부식을 막는 그린 프라이머와 보호막을 입혀 철도차에 싣습니다. 초록색은 페인트가 아니라 프라이머와 벗겨내는 보호막입니다 [확인됨(2차)].', en: 'It gets the green corrosion primer and strippable film and is loaded onto a railcar. The green is primer plus protective film, not paint [verified, secondary].' },
      { f: 0.86, ko: '약 3,500 km를 철도로 옵니다. 걸리는 시간은 2013년 기사에서 약 8일, 2026년 견학기에서 약 2주입니다 [미확인·약한 근거].', en: 'About 3,500 km by rail. Transit is about 8 days in a 2013 account and about two weeks in a 2026 tour report [unverified, weak sources].' },
    ],
  },
  {
    id: 'wing',
    short: { ko: '날개 제작', en: 'Wing' },
    name: { ko: '3 · 렌턴: 날개를 만든다', en: '3 · Renton: building the wings' },
    what: {
      ko: '날개는 렌턴 공정의 첫 부품입니다. 오번·프레더릭슨에서 깎아 온 외판과 스파를 자동 패널 라인과 로봇 스파 라인에서 조립해 연료통을 겸한 날개 상자를 만듭니다.',
      en: 'Wings are the first parts built in the Renton flow. Skins and spars machined at Auburn and Frederickson are assembled on an automated panel line and a robotic spar line into a wing box that doubles as the fuel tank.',
    },
    equipment: [
      { ko: '자동 패널 조립 라인', en: 'Automated panel assembly line' },
      { ko: '로봇 스파 조립 라인', en: 'Robotic spar assembly line' },
      { ko: '날개 지그', en: 'Wing jig' },
      { ko: '연료통 실링·시험', en: 'Fuel-tank sealing and test' },
    ],
    key: { value: '+35 %', ko: '자동 패널 라인으로 하부 외판 조립 속도 향상 (로봇 스파 라인은 +33 %) [확인됨(2차)]', en: 'lower-skin assembly speed from the panel line (robotic spar line +33 %) [verified, secondary]' },
    inn: { ko: '가공된 날개 외판, 스트링어, 스파', en: 'Machined wing skins, stringers and spars' },
    out: { ko: '왼쪽·오른쪽 날개 한 쌍 (연료통 포함)', en: 'A left and a right wing, fuel tank included' },
    legend: { ko: '축척 아님: 날개 공정은 조립장 한쪽에 압축해 그렸습니다. 도구와 크레인은 도식입니다.', en: 'Not to scale: the wing process is compressed into one corner of the hall. Tooling and cranes are schematic.' },
    readouts: ['wingparts'],
    steps: [
      { f: 0, ko: '조립장 한쪽의 날개 구역입니다. 날개는 스피릿이 아니라 보잉 렌턴에서 만듭니다 [확인됨(2차)].', en: 'The wing corner of the hall. Wings are built by Boeing at Renton, not by Spirit [verified, secondary].' },
      { f: 0.1, ko: '하부 외판이 먼저 지그에 놓입니다. 자동 패널 라인이 이 작업을 약 35 % 빠르게 했습니다 [확인됨(2차)].', en: 'The lower skin goes on the jig first. The automated panel line sped this up by about 35 % [verified, secondary].' },
      { f: 0.28, ko: '앞·뒤 스파를 세우고, 그 사이에 리브와 스트링어를 끼웁니다. 로봇 스파 라인은 처리량을 약 33 % 늘렸습니다 [확인됨(2차)].', en: 'Front and rear spars stand up and ribs and stringers slot between them. The robotic spar line raised throughput by about 33 % [verified, secondary].' },
      { f: 0.5, ko: '상자 안쪽이 그대로 연료통이 됩니다. 실링하고 닫은 뒤 상부 외판을 덮습니다.', en: 'The inside of the box is the fuel tank. It is sealed, then closed with the upper skin.' },
      { f: 0.72, ko: '앞전 슬랫, 스포일러, 플랩, 에일러론, 그리고 갈라진 끝 모양의 윙렛을 답니다. 윙렛 제작사는 자료마다 달라 미확인입니다 [미확인].', en: 'Leading-edge slats, spoilers, flaps, ailerons and the split-tip winglet go on. Sources disagree on who makes the winglet [unverified].' },
    ],
  },
  {
    id: 'line',
    short: { ko: '라인 1~4일', en: 'Line, days 1–4' },
    name: { ko: '4 · 렌턴 이동식 라인: 1~4일째, 동체·날개·꼬리·바퀴가 모인다', en: '4 · Renton moving line, days 1–4: fuselage, wings, tail and gear come together' },
    what: {
      ko: '그린 동체가 철도차에서 내려 공장 안으로 들어옵니다. 1~3일째는 위층에서 단열재, 배선, 유압 배관을 넣고, 3일째 밤 천장 크레인이 아래층 라인으로 내립니다. 4일째 한 자리에서 날개, 수평·수직 꼬리, 착륙장치가 붙습니다.',
      en: 'The green fuselage comes off the railcar and into the plant. Days 1 to 3 on a raised level: insulation, wiring and hydraulic tubing. On the night of day 3 an overhead crane lowers it to the main line. On day 4, in one position, the wings, both tails and the landing gear go on.',
    },
    equipment: [
      { ko: '천장 크레인 (바닥에서 약 27 m)', en: 'Overhead crane (about 27 m up)' },
      { ko: '레이저 정렬 장치', en: 'Laser alignment' },
      { ko: '이동식 라인(분당 5 cm)', en: 'Moving line (5 cm per minute)' },
      { ko: '바닥의 일차 표시선', en: 'Day stripes on the floor' },
    ],
    key: { value: '2 in/min', ko: '이동식 라인 속도, 곧 분당 5 cm [확인됨]', en: 'moving-line speed, 5 cm per minute [verified]' },
    inn: { ko: '그린 동체, 날개 한 쌍, 수평·수직 꼬리, 착륙장치', en: 'Green fuselage, wing pair, both tails, landing gear' },
    out: { ko: '4일째 말: 스스로 바퀴로 선 비행기 (엔진·내장은 아직)', en: 'End of day 4: a plane standing on its own wheels (no engines or interior yet)' },
    legend: { ko: '축척 아님: 라인 간격과 시간은 압축했고, 크레인·지그는 도식입니다. 1~3일째 위층 높이는 추정입니다.', en: 'Not to scale: line spacing and time are compressed; crane and jigs are schematic. The raised level’s height is an estimate.' },
    readouts: ['day', 'speedcm', 'wire'],
    steps: [
      { f: 0, ko: '위치타에서 온 그린 동체를 철도차에서 내려 큰 대차에 싣고 공장 안으로 들입니다 [확인됨(2차)].', en: 'The green fuselage from Wichita is lifted off the railcar onto a large cart and wheeled into the plant [verified, secondary].' },
      { f: 0.12, ko: '1일째: 위층에서 단열재와 첫 전기·유압·기계 부품을 넣고 등지느러미(도살 핀)를 답니다 [확인됨(2차)].', en: 'Day 1, raised level: insulation and the first electrical, hydraulic and mechanical parts, plus the dorsal fin [verified, secondary].' },
      { f: 0.27, ko: '2일째: 전선 약 70 km(43마일), 유압 배관, 조종 케이블을 깝니다 [확인됨(2차)]. 초기 자리에서는 멈췄다 움직이는 방식입니다.', en: 'Day 2: about 70 km (43 miles) of wiring, hydraulic tubing and control cables [verified, secondary]. The early positions move in pulses.' },
      { f: 0.4, ko: '3일째: 기수 레이돔을 달고 조종실 패널을 연결하며 유압 시험을 시작합니다 [확인됨(2차)].', en: 'Day 3: the nose radome goes on, flight-deck panels are connected and hydraulic testing begins [verified, secondary].' },
      { f: 0.5, ko: '3일째 밤: 천장 크레인(바닥에서 약 27 m)이 동체를 위층에서 아래 메인 라인으로 내립니다 [확인됨(2차)].', en: 'Night of day 3: the overhead crane (about 27 m up) lowers the fuselage from the raised level to the main line [verified, secondary].' },
      { f: 0.62, ko: '4일째: 한 자리에서 날개, 수평·수직 꼬리, 주·앞 착륙장치가 붙습니다. 날개는 레이저로 정렬합니다 [확인됨(2차)]. 일부 옛 자료는 이를 여러 자리로 나눕니다.', en: 'Day 4: in one position the wings, both tails and the main and nose gear are fitted. Lasers align the wings [verified, secondary]. Some older sources spread this over several positions.' },
      { f: 0.75, ko: '높이 약 7 m의 수직 꼬리(핀)는 천장 크레인이 들어 올려 답니다 [확인됨(2차)].', en: 'The vertical fin, about 7 m tall, is lifted into place by the overhead crane [verified, secondary].' },
      { f: 0.88, ko: '착륙장치까지 달면 비행기는 처음으로 자기 바퀴로 섭니다. 날개 안쪽의 연료통은 5일째에 시험합니다.', en: 'With the gear on, the plane stands on its own wheels for the first time. The wing fuel tanks are tested on day 5.' },
    ],
  },
  {
    id: 'systems',
    short: { ko: '시스템·시험', en: 'Systems' },
    name: { ko: '5 · 5~7일째: 시스템을 깔고 시험한다', en: '5 · Days 5–7: systems go in and are tested' },
    what: {
      ko: '뒤쪽 갤리와 화장실, 물탱크를 넣고 연료통에 압력을 겁니다. 6일째 처음으로 전기를 넣고 측벽과 머리 위 짐칸을 답니다. 7일째에는 객실에 압력을 걸고, 잭으로 비행기를 들어 올려 착륙장치를 접었다 펴 봅니다.',
      en: 'Rear galleys, lavatories and water tanks go in and the fuel tanks are pressure-tested. On day 6 power goes on for the first time and sidewalls and overhead bins are fitted. On day 7 the cabin is pressurized and jacks lift the plane to swing the landing gear.',
    },
    equipment: [
      { ko: '지상 전원·유압 연결(탯줄)', en: 'Ground power and hydraulic umbilicals' },
      { ko: '객실 가압 시험', en: 'Cabin pressure ("high blow") test' },
      { ko: '노란 리프트 잭', en: 'Yellow lift jacks' },
      { ko: '조종면 작동 시험', en: 'Flight-control checks' },
    ],
    key: { value: '70.3 t', ko: '착륙장치 시험 때 잭이 드는 비행기 무게 (154,983 lb) [확인됨(2차)]', en: 'airplane weight on the jacks for the gear swing (154,983 lb) [verified, secondary]' },
    inn: { ko: '날개·꼬리·바퀴가 달린 비행기, 객실 부품', en: 'The plane with wings, tail and gear; cabin modules' },
    out: { ko: '전기가 들어가고 가압·착륙장치·조종면 시험을 마친 비행기', en: 'A powered plane that has passed pressure, gear and control tests' },
    legend: { ko: '축척 아님: 잭과 가압 화살표는 도식입니다. 가압 압력값은 공개되지 않아 표시하지 않습니다.', en: 'Not to scale: jacks and the pressure arrows are schematic. The test pressure is not published, so none is shown.' },
    readouts: ['day', 'tests', 'jack'],
    steps: [
      { f: 0, ko: '5일째: 뒤쪽 갤리와 화장실을 팔레트째 넣고 물탱크와 마지막 전자장비를 답니다 [확인됨(2차)].', en: 'Day 5: rear galleys and lavatories go in on pallets, with the water tanks and the last electronics [verified, secondary].' },
      { f: 0.17, ko: '날개 연료통에 압력을 걸어 새는 곳이 없는지 시험합니다 [확인됨(2차)].', en: 'The wing fuel tanks are pressurized to check for leaks [verified, secondary].' },
      { f: 0.34, ko: '6일째: 처음으로 전기와 유압유를 넣습니다(지상 연결선으로). 이어서 측벽, 머리 위 짐칸, 앞쪽 갤리와 화장실을 답니다 [확인됨(2차)].', en: 'Day 6: electrical power and hydraulic fluid go in for the first time, through ground umbilicals. Then sidewalls, overhead bins and the forward galley and lavatories [verified, secondary].' },
      { f: 0.67, ko: '7일째: 객실 가압 시험(“하이 블로”). 보잉은 고도 약 28,300 m(92,847 ft)에 맞먹는 조건이라고만 밝히며 압력값은 공개하지 않았습니다 [확인됨(2차)].', en: 'Day 7: the cabin pressure test (“high blow”). Boeing only says it is equivalent to about 28,300 m (92,847 ft) of altitude and does not publish the pressure [verified, secondary].' },
      { f: 0.82, ko: '노란 잭이 비행기(약 70.3 t)를 들어 올리고, 착륙장치를 접었다 폅니다. 조종면 작동 시험도 합니다 [확인됨(2차)].', en: 'Yellow jacks lift the plane (about 70.3 t) and the landing gear is swung up and down. Flight controls are exercised too [verified, secondary].' },
    ],
  },
  {
    id: 'interior',
    short: { ko: '좌석·엔진', en: 'Seats & engines' },
    name: { ko: '6 · 8~10일째: 좌석, 그리고 엔진', en: '6 · Days 8–10: seats, then engines' },
    what: {
      ko: '8일째 비스듬한 컨베이어로 좌석을 세 개씩 밀어 넣고 카펫을 깝니다. 9일째 엔진(LEAP-1B)을 날개 아래 파일론에 겁니다. 10일째는 여유 날이고 라인 끝에서 공장 문을 나섭니다.',
      en: 'On day 8 seats are fed in three at a time on an angled conveyor and carpet goes down. On day 9 the engines (LEAP-1B) are hung from the pylons under the wings. Day 10 is a buffer, and at the end of the line it rolls out of the plant.',
    },
    equipment: [
      { ko: '좌석 컨베이어', en: 'Seat conveyor' },
      { ko: '엔진 리프트 대차 (도식)', en: 'Engine lift cart (schematic)' },
      { ko: '엔진 파일론', en: 'Engine pylons' },
      { ko: '객실 마감 장비', en: 'Cabin finishing tools' },
    ],
    key: { value: '130.4 kN', ko: 'LEAP-1B28 한 기의 이륙 추력 (엔진 무게 ≤ 2,780 kg) [확인됨]', en: 'take-off thrust of one LEAP-1B28 (engine mass up to 2,780 kg) [verified]' },
    inn: { ko: '좌석, 카펫, LEAP-1B 엔진 두 기', en: 'Seats, carpet, two LEAP-1B engines' },
    out: { ko: '엔진과 좌석까지 갖춘 그린 비행기 (도장 전)', en: 'A complete green plane, seats and engines on (not yet painted)' },
    legend: { ko: '축척 아님: 엔진 거치 방식은 자료가 없어 대차로 도식화했습니다. 좌석 열 수와 배치는 단순화했습니다.', en: 'Not to scale: how the engines are hoisted is undocumented, so a cart is drawn schematically. Seat rows and layout are simplified.' },
    readouts: ['day', 'rows', 'engines'],
    steps: [
      { f: 0, ko: '8일째: 좌석이 비스듬한 컨베이어로 세 개씩 들어옵니다(“건초 압축기”). 카펫을 깔고 하루를 마치기 전 점검합니다 [확인됨(2차)]. 좌석은 항공사가 고릅니다.', en: 'Day 8: seats arrive three at a time on an angled conveyor (the “hay baler”), carpet goes down and there is a shakedown at the end of the day [verified, secondary]. The airline chooses the seats.' },
      { f: 0.33, ko: '9일째: 엔진 LEAP-1B를 날개 아래 파일론에 겁니다 [확인됨(2차)]. 들어 올리는 장비의 종류는 기록이 없습니다 [미확인].', en: 'Day 9: the LEAP-1B engines are hung from the pylons under the wings [verified, secondary]. What lifts them is not documented [unverified].' },
      { f: 0.5, ko: '엔진은 한 기 2,780 kg 이하, 팬 지름 1.76 m, 이륙 추력 130.4 kN(LEAP-1B28)입니다 [확인됨].', en: 'Each engine is up to 2,780 kg with a 1.76 m fan and 130.4 kN take-off thrust (LEAP-1B28) [verified].' },
      { f: 0.68, ko: '10일째: 여유 날. 이동식 라인은 하루 약 한 자리씩 움직여 열 자리 끝에서 비행기를 내보냅니다 [확인됨(2차)].', en: 'Day 10: a buffer day. The line moves about one position a day and delivers the plane at the end of ten [verified, secondary].' },
      { f: 0.88, ko: '여기까지 열흘 남짓입니다. 2026년 견학기는 달력으로 약 15일이라고 전합니다 [확인됨(2차)]. 11일은 2005년 수치, 22일은 그 이전입니다.', en: 'About ten flow days. A 2026 tour report says about 15 calendar days [verified, secondary]. 11 days is the 2005 figure and 22 days the earlier one.' },
    ],
  },
  {
    id: 'rollout',
    short: { ko: '롤아웃', en: 'Roll-out' },
    name: { ko: '7 · 공장 밖으로: 플라이트 라인, 급유, 엔진 시동', en: '7 · Out of the plant: flight line, fuel, engine runs' },
    what: {
      ko: '비행기가 도장 없이 초록색 그대로 공장을 나와 렌턴의 플라이트 라인(시험 비행 준비 구역)에 섭니다. 연료를 채우고 엔진을 돌려 보고 점검한 뒤 활주로로 향합니다. 도장은 첫 비행 뒤 보잉 필드에서 합니다.',
      en: 'The plane leaves the building green, with no livery, and stands on the Renton flight line. It is fuelled, engines are run and checks are made before it taxis to the runway. Paint comes after the first flight, at Boeing Field.',
    },
    equipment: [
      { ko: '급유차', en: 'Fuel truck' },
      { ko: '엔진 지상 시운전', en: 'Engine ground runs' },
      { ko: '렌턴 플라이트 라인', en: 'Renton flight line' },
      { ko: '렌턴 시영 공항 활주로 16/34', en: 'Renton Municipal runway 16/34' },
    ],
    key: { value: '1,640 m', ko: '렌턴 공항(RNT) 활주로 16/34 길이, 5,382 ft [확인됨]', en: 'Renton Municipal (RNT) runway 16/34 length, 5,382 ft [verified]' },
    inn: { ko: '엔진·좌석까지 갖춘 그린 비행기', en: 'The complete green plane' },
    out: { ko: '급유와 점검을 마치고 이륙 준비가 된 비행기', en: 'A fuelled, checked plane ready for take-off' },
    legend: { ko: '축척 아님: 공장에서 활주로까지의 거리를 줄였습니다. 급유량은 가정입니다. 플라이트 라인 체류 기간은 2013년 기사의 약 5일을 따랐으나 약한 근거입니다.', en: 'Not to scale: the distance from the plant to the runway is shortened. The fuel quantity is an assumption. The flight-line stay (about 5 days in a 2013 report) is a weak source and is not shown at scale.' },
    readouts: ['fuel', 'n1'],
    steps: [
      { f: 0, ko: '공장 문을 나섭니다. 초록색 그대로이고 도장은 없습니다 [확인됨(2차)].', en: 'It leaves the plant door, still green, with no livery [verified, secondary].' },
      { f: 0.25, ko: '렌턴 플라이트 라인(주기장)에서 급유를 합니다. 도면의 급유량(약 17,500 L)은 보여 주기 위한 가정입니다 [가정].', en: 'On the Renton flight line it is fuelled. The quantity shown (about 17,500 L) is an assumption for illustration [assumption].' },
      { f: 0.5, ko: '엔진을 지상에서 돌려 보고 항공전자와 조종면을 점검합니다. 2013년 기사는 이 단계가 약 5일이라고 전합니다 [미확인·약한 근거].', en: 'Engines are run on the ground and avionics and controls are checked. A 2013 report puts this stage at about five days [unverified, weak source].' },
      { f: 0.8, ko: '시험 조종사가 활주로 쪽으로 천천히 움직입니다. 모든 737의 첫 비행은 렌턴에서 이륙합니다 [확인됨(2차)].', en: 'A test crew taxis toward the runway. Every 737’s first flight takes off from Renton [verified, secondary].' },
    ],
  },
  {
    id: 'takeoff',
    short: { ko: '이륙!', en: 'Take-off' },
    name: { ko: '8 · 피날레: 이륙', en: '8 · Finale: take-off' },
    what: {
      ko: '완성된 비행기가 렌턴 활주로 끝에서 정렬해 엔진 출력을 올리고, 가속해, 기수를 들어 이륙하고, 바퀴를 접고, 보잉 필드를 향해 선회합니다. 아래 속도·거리·각도·고도는 모형이 계산한 값입니다.',
      en: 'The finished plane lines up at the end of Renton’s runway, spools its engines, accelerates, rotates, lifts off, retracts its gear and turns toward Boeing Field. Speed, distance, pitch and altitude below come from a simple model.',
    },
    equipment: [
      { ko: 'LEAP-1B28 엔진 2기 (각 130.4 kN)', en: '2 × LEAP-1B28 (130.4 kN each)' },
      { ko: '렌턴 활주로 16/34 (1,640 m)', en: 'Renton runway 16/34 (1,640 m)' },
      { ko: '접히는 앞·주 착륙장치', en: 'Retracting nose and main gear' },
      { ko: '슬랫·플랩 (이륙 설정)', en: 'Slats and flaps (take-off setting)' },
    ],
    key: { value: `≈ ${ROLL_M} m`, ko: `모형이 계산한 이륙까지 지상 활주 거리 [추정]. 실제 값은 중량·추력 설정·바람으로 달라집니다.`, en: `ground roll to lift-off from this model [estimate]. Real values depend on weight, thrust setting and wind.` },
    inn: { ko: '급유와 점검을 마친 비행기', en: 'The fuelled, checked plane' },
    out: { ko: '하늘에 오른 비행기. 보잉 필드에 내려 도장, 최종 점검, 고객 비행, 인도를 거칩니다.', en: 'An airborne plane. It lands at Boeing Field for paint, final checks, customer flight and delivery.' },
    legend: { ko: '활주로는 실제 길이(1,640 m)로 그렸습니다. 길어서 카메라가 비행기를 따라 움직입니다. 속도·거리·각도·고도는 단순 모형의 추정값입니다.', en: 'The runway is drawn at its true length (1,640 m), so the camera pans along with the plane. Speed, distance, pitch and altitude are estimates from a simple model.' },
    readouts: ['kt', 'dist', 'pitch', 'alt', 'thrust'],
    steps: [
      { f: 0, ko: '완성된 비행기가 렌턴 공항의 활주로 16/34 쪽으로 이동합니다. 활주로는 1,640 m(5,382 ft)입니다 [확인됨].', en: 'The finished plane taxis toward Renton Municipal’s runway 16/34. The runway is 1,640 m (5,382 ft) long [verified].' },
      { f: F(0) - 0.14, ko: '활주로 끝에 맞춰 섭니다. 렌턴에서 이륙한 737은 모두 보잉 필드에 착륙합니다 [확인됨(2차)].', en: 'It lines up on the runway. Every 737 that departs Renton lands at Boeing Field [verified, secondary].' },
      { f: F(-4), ko: '브레이크를 밟은 채 엔진 출력을 올립니다. 엔진 한 기의 이륙 추력은 130.4 kN(LEAP-1B28)입니다 [확인됨].', en: 'Brakes on, power comes up. One engine’s take-off thrust is 130.4 kN (LEAP-1B28) [verified].' },
      { f: F(0), ko: '브레이크를 풀고 가속합니다. 아래 속도와 거리는 일정 추력에서 항력을 뺀 단순 모형의 값입니다 [추정].', en: 'Brakes off, accelerating. Speed and distance come from a simple thrust-minus-drag model [estimate].' },
      { f: F(ev.vr) - 0.01, ko: `기수를 듭니다(회전). 초당 약 2.5°로 15°까지 올립니다 [확인됨(2차)]. 회전 속도는 약 ${TO.vrKt} kt로 가정했습니다 [추정].`, en: `Rotation: the nose comes up at about 2.5° per second toward 15° [verified, secondary]. Rotation speed is assumed at about ${TO.vrKt} kt [estimate].` },
      { f: F(ev.lof), ko: `이륙합니다. 모형에서는 활주 약 ${ROLL_M} m, 속도 약 ${VLOF_KT} kt입니다. 실제 가벼운 신조기는 900~1,200 m 정도로 알려져 있습니다 [추정].`, en: `Lift-off. In the model the ground roll is about ${ROLL_M} m at about ${VLOF_KT} kt. Light new aircraft are usually quoted around 900 to 1,200 m [estimate].` },
      { f: F(ev.gear0), ko: '바퀴를 접습니다. 앞바퀴는 앞으로, 주바퀴는 날개 아래 동체 쪽으로 접히고 문이 닫힙니다. 보통 8~12초 걸립니다 [추정].', en: 'The gear retracts: the nose gear folds forward, the main gear folds inward and the doors close. It usually takes 8 to 12 seconds [estimate].' },
      { f: F(ev.bank0), ko: '상승하며 왼쪽으로 부드럽게 기울여 보잉 필드가 있는 북북서쪽(약 8 km)으로 향합니다. 첫 비행은 약 2~3시간 [확인됨(2차)].', en: 'Climbing out in a gentle left bank toward Boeing Field, about 8 km north-north-west. A type’s first flight lasts about 2 to 3 hours [verified, secondary].' },
      { f: F(40), ko: '보잉 필드에 내리면 도장(약 189 L, 최대 3일)과 최종 점검, 고객 비행, 인도가 이어집니다 [확인됨/확인됨(2차)].', en: 'At Boeing Field come paint (about 189 L, up to 3 days), final checks, the customer flight and delivery [verified / verified, secondary].' },
    ],
  },
];

// numbers strip: production rate history and totals, each with a confidence
export const NUMBERS = {
  rates: [
    { when: '2005', v: 31, tag: 's' },
    { when: '2014', v: 42, tag: 's' },
    { when: '2017', v: 47, tag: 's' },
    { when: '2019', v: 52, tag: 's', whenEn: 'early 2019' },
    { when: '2020.1', v: 0, tag: 's', whenEn: 'Jan 2020', note: { ko: '생산 중단', en: 'production stopped' } },
    { when: '2022.1', v: 27, tag: 's' },
    { when: '2024.1', v: 38, tag: 's', note: { ko: 'FAA 상한', en: 'FAA cap' } },
    { when: '2025.10', v: 42, tag: 's', note: { ko: 'FAA 허용', en: 'FAA allowed' } },
    { when: '2026.5', v: 47, tag: 's', note: { ko: 'FAA 승인', en: 'FAA approved' } },
  ],
  cumulative: [
    { v: '12,739', ko: '737 누적 인도 (2026.9.30)', en: '737 deliveries to date (30 Sep 2026)', tag: 's' },
    { v: '2,483', ko: '그중 737 MAX', en: 'of which 737 MAX', tag: 's' },
    { v: '≈ 41', ko: '2026년 월 평균 인도 (대수)', en: 'average deliveries per month in 2026', tag: 's' },
  ],
  lines: { ko: '렌턴 3개 라인(서·중앙·동) + 에버렛 북 라인(2026.7 시작) · 약 110만 ft² · 직원 약 12,000명', en: 'Renton: 3 lines (West, Central, East) plus the Everett North Line (started July 2026); about 1.1 million sq ft; about 12,000 employees', tag: 's' },
};

// sources and confidence panel. Plain-text host names, no links: the page makes no external requests.
export const SOURCES = [
  {
    h: { ko: '이 그림이 보여 주는 것', en: 'What this picture is' },
    items: [
      { t: 'a', ko: '한 대의 737 MAX 8급 비행기를 따라가는 교육용 도식입니다. 보잉과 무관하고, 로고와 실제 도장은 쓰지 않았으며, 크기와 배치는 곳곳에서 단순화·압축했습니다.', en: 'An educational schematic that follows one 737 MAX 8-class airplane. Not affiliated with Boeing; no logos or real liveries; sizes and layouts are simplified or compressed in places.' },
      { t: 'a', ko: '비행기 모형은 공개된 치수(길이 39.5 m, 날개폭 35.9 m, 동체 폭 3.76 m)로 직접 그렸으며 부품 197개가 이름을 갖습니다. 안쪽 구조는 개념도입니다.', en: 'The airplane model is drawn from published dimensions (39.5 m long, 35.9 m span, 3.76 m fuselage width) with 197 named parts. Inner structure is conceptual.' },
    ],
  },
  {
    h: { ko: '공급망과 동체', en: 'Supply chain and fuselage' },
    items: [
      { t: 'v', ko: '동체는 위치타(캔자스)에서 섹션 41~48을 이어 한 덩이로 보냅니다. 스피릿 에어로시스템즈는 2025년 12월 8일 보잉이 인수를 마쳤습니다.', en: 'The fuselage, sections 41 to 48 joined, comes from Wichita, Kansas. Boeing completed its acquisition of Spirit AeroSystems on 8 December 2025.', src: 'boeing.mediaroom.com (2025-12-08)' },
      { t: 's', ko: '철도 약 2,175마일(3,500 km). 소요 시간은 약 8일(2013년 기사)에서 약 2주(2026년 견학기)까지 자료마다 다릅니다.', en: 'About 2,175 rail miles (3,500 km). Transit time runs from about 8 days (2013 account) to about two weeks (2026 tour report).', src: 'b737.org.uk, aviationa2z.com' },
      { t: 's', ko: '날개는 보잉 오번·프레더릭슨이 외판·스파를 가공하고 렌턴에서 조립합니다(스피릿 제작 아님). 자동 패널 라인 +35 %, 로봇 스파 라인 +33 %.', en: 'Wings: Boeing Auburn and Frederickson machine skins and spars, assembled at Renton (not built by Spirit). Panel line +35 %, robotic spar line +33 %.', src: 'worldairlinenews.com, Wikipedia' },
      { t: 'v', ko: 'MAX 수평·수직 안정판은 KAI(한국)가 2022년부터 공급합니다. 타타 보잉(하이데라바드)의 수직 꼬리 구조물과의 겹침은 정리되지 않았습니다.', en: 'KAI supplies MAX stabilizers since 2022. Overlap with Tata Boeing’s vertical-fin structures is unresolved.', src: 'koreaherald.com' },
      { t: 'u', ko: '착륙장치 제작사, 윙렛 제작사(가와사키 대 GKN), 엔진 거치 장비의 종류는 확인하지 못했습니다. 그림은 이를 단정하지 않습니다.', en: 'The landing-gear maker, the winglet maker (Kawasaki vs GKN) and the engine hoist type were not confirmed. The picture does not assert them.' },
      { t: 's', ko: '초록색은 페인트가 아니라 부식 방지 프라이머와 벗겨 내는 보호막입니다. 상표명 “코로폰”은 확인하지 못했습니다.', en: 'The green is corrosion-protection primer plus a strippable film, not paint. The brand name “Koropon” was not confirmed.', src: 'simpleflying.com' },
    ],
  },
  {
    h: { ko: '렌턴 이동식 라인', en: 'Renton moving line' },
    items: [
      { t: 's', ko: '라인 속도 분당 2 in(5 cm). 바닥에 일차 표시선이 칠해져 있습니다. 약 10일 흐름(2005년 11일, 이전 약 22일). 2026년 견학기는 달력으로 약 15일.', en: 'Line speed 2 in (5 cm) per minute, with day stripes painted on the floor. About a 10-day flow (11 in 2005, about 22 before). A 2026 tour report says about 15 calendar days.', src: 'boeing.com article via b737.org.uk, simpleflying.com' },
      { t: 's', ko: '일차별 순서(2026년 견학기): 1일 위층·단열·등지느러미 / 2일 배선 약 70 km·유압 / 3일 레이돔·유압시험 / 3→4일 밤 크레인 하강 / 4일 날개·꼬리·바퀴 / 5일 갤리·물탱크·연료통 시험 / 6일 전원 켬·측벽·짐칸 / 7일 가압·착륙장치 / 8일 좌석 / 9일 엔진 / 10일 여유.', en: 'Day sequence (2026 tour report): 1 raised level, insulation, dorsal fin / 2 wiring about 70 km, hydraulics / 3 radome, hydraulic test / night 3 to 4 crane lowering / 4 wings, tails, gear / 5 galleys, water tanks, fuel-tank test / 6 power on, sidewalls, bins / 7 pressure test, gear swing / 8 seats / 9 engines / 10 buffer.', src: 'aviationa2z.com, pointhacks.com.au, simpleflying.com' },
      { t: 's', ko: '일부 옛 자료는 날개·꼬리·바퀴를 서로 다른 자리에 두어 일차가 어긋납니다. 그림은 2026년 순서를 따릅니다.', en: 'Some older sources place wings, tail and gear at different positions, so days differ. The picture follows the 2026 sequence.' },
      { t: 's', ko: '천장 크레인은 바닥에서 약 27 m(89 ft), 수직 꼬리 높이 약 7 m. 가압 시험은 고도 28,300 m(92,847 ft)에 해당한다는 표현만 공개되었고 압력값은 없습니다. 잭이 드는 무게 70.3 t(154,983 lb).', en: 'Overhead crane about 27 m (89 ft) up, vertical fin about 7 m tall. The pressure test is quoted only as an equivalent altitude of 28,300 m (92,847 ft), with no pressure. Weight on jacks 70.3 t (154,983 lb).', src: 'b737.org.uk' },
      { t: 'e', ko: '자리 간격 52 m, 위층 높이 5 m, 한 대당 약 21명 작업은 추정입니다.', en: 'The 52 m pitch between positions, the 5 m raised level and about 21 workers per airplane are estimates.' },
      { t: 'a', ko: '천장 크레인의 움직임, 엔진 대차, 좌석 컨베이어의 모양은 도식입니다. 무인 운반차(AGV)는 자료에 없어 그리지 않았습니다.', en: 'The crane motion, the engine cart and the seat conveyor shape are schematic. Automated guided vehicles are not documented and are not drawn.' },
    ],
  },
  {
    h: { ko: '첫 비행과 이륙', en: 'First flight and take-off' },
    items: [
      { t: 'v', ko: '렌턴 공항(RNT) 활주로 16/34는 5,382 × 200 ft(1,640 × 61 m)입니다. 737 MAX 8의 첫 비행은 2016년 1월 29일 활주로 34에서 이륙해 2시간 47분 뒤 보잉 필드에 착륙했습니다.', en: 'Renton Municipal (RNT) runway 16/34 is 5,382 x 200 ft (1,640 x 61 m). The 737 MAX 8’s first flight took off from runway 34 on 29 January 2016 and landed at Boeing Field after 2 h 47 min.', src: 'b737.org.uk, globalair.com' },
      { t: 'v', ko: 'LEAP-1B28 이륙 추력 130.41 kN, 팬 지름 1.76 m, 무게 최대 2,780 kg. 비행기 길이 39.5 m, 날개폭 35.9 m.', en: 'LEAP-1B28 take-off thrust 130.41 kN, fan 1.76 m, mass up to 2,780 kg. Airplane 39.5 m long, 35.9 m span.', src: 'CFM type certificate data sheet, Boeing 737 airport planning' },
      { t: 's', ko: '렌턴에서 이륙해 보잉 필드(KBFI 14R/32L, 약 8 km 북북서)에 착륙합니다. 도장(약 189 L, 최대 3일)·최종 점검·고객 비행·인도는 그곳에서 이뤄집니다. 첫 비행이 “B-1”로 불리는지는 미확인입니다.', en: 'Planes take off from Renton and land at Boeing Field (KBFI 14R/32L, about 8 km north-north-west), where paint (about 189 L, up to 3 days), final checks, the customer flight and delivery happen. Whether the first flight is called “B-1” is unverified.', src: 'boeing.mediaroom.com, nycaviation.com, b737.org.uk' },
      { t: 'e', ko: '이륙 모형(점질량, 일정 추력, 제곱 항력, 받음각에 선형인 양력)의 질량 68 t, 날개 면적 127 m², 회전 속도 130 kt, 구름 마찰 0.02 등은 추정·가정입니다. 회전 속도 2~3°/s, 15°까지, 바퀴 접힘 8~12초도 추정 범위입니다. V1·V2는 보여 주지 않고, 회전 속도(VR)만 130 kt로 가정했습니다.', en: 'The take-off model (point mass, constant thrust with lapse, quadratic drag, lift linear in angle of attack) uses estimates and assumptions: 68 t mass, 127 m² wing area, 130 kt rotation speed, 0.02 rolling friction. The 2 to 3 deg/s rotation rate, 15 degree target and 8 to 12 s gear time are estimate ranges. V1 and V2 are not shown; only the rotation speed (VR) is assumed, at 130 kt.' },
    ],
  },
  {
    h: { ko: '생산 수치와 배경 사실', en: 'Production numbers and background' },
    items: [
      { t: 's', ko: '생산율: 2005년 월 31대, 2014년 42, 2017년 47, 2019년 초 52, 2020년 1월 생산 중단, 2022년 1월 27, 2024년 1월 FAA 상한 38, 2025년 10월 42, 2026년 5월 47.', en: 'Production rate: 31 per month in 2005, 42 in 2014, 47 in 2017, 52 in early 2019, stopped in January 2020, 27 in January 2022, FAA cap of 38 from January 2024, 42 in October 2025, 47 in May 2026.', src: 'b737.org.uk, Wikipedia, Reuters' },
      { t: 's', ko: '누적 인도 12,739대(2026년 9월 30일 기준), 그중 MAX 2,483대.', en: 'Cumulative deliveries 12,739 (as of 30 September 2026), of which 2,483 are MAX.', src: 'Boeing delivery data via press' },
      { t: 's', ko: '2019년 3월 두 건의 사고(2018년 라이온에어, 2019년 에티오피아항공) 뒤 737 MAX 운항이 중지되었습니다.', en: 'The 737 MAX was grounded in March 2019 after two fatal accidents (Lion Air 2018, Ethiopian Airlines 2019).', src: 'Wikipedia' },
      { t: 's', ko: '2024년 1월 5일 알래스카항공 1282편의 도어 플러그가 비행 중 떨어졌고, NTSB는 볼트 네 개가 장착되지 않았다고 밝혔습니다.', en: 'On 5 January 2024 a door plug came off Alaska Airlines flight 1282 in flight; the NTSB found four bolts had not been installed.', src: 'NTSB, NPR' },
      { t: 's', ko: '렌턴 공장은 서·중앙·동 3개 라인이며 에버렛에 4번째 라인(북 라인)이 2026년 7월 가동을 시작했습니다. 약 110만 ft², 직원 약 12,000명.', en: 'Renton has three lines (West, Central, East); a fourth, the North Line in Everett, began in July 2026. About 1.1 million sq ft and 12,000 employees.', src: 'boeing.com, Wikipedia' },
    ],
  },
];

// ---------- parts: Korean and English names for every part id the drawing contains (the build checks the coverage) ----------
export const PARTS = {
  frames: { ko: '동체 프레임', en: 'Fuselage frames' },
  stringers: { ko: '스트링어', en: 'Stringers' },
  barrel: { ko: '동체 외판 섹션', en: 'Fuselage barrel skin' },
  tailcone: { ko: '꼬리 원뿔', en: 'Tailcone' },
  windows: { ko: '객실 창', en: 'Cabin windows' },
  door_l1: { ko: '앞 출입문', en: 'Forward entry door' },
  door_l2: { ko: '뒤 출입문', en: 'Aft entry door' },
  door_plug: { ko: '도어 플러그', en: 'Door plug' },
  exit_hatches: { ko: '날개 위 비상구', en: 'Overwing exits' },
  cockpit_windows: { ko: '조종실 창', en: 'Cockpit windows' },
  pitot_capt: { ko: '기장 피토관', en: 'Captain pitot tube' },
  pitot_stby: { ko: '예비 피토관', en: 'Standby pitot tube' },
  radome: { ko: '기수 레이돔', en: 'Nose radome' },
  wing_lower_skin: { ko: '날개 하부 외판', en: 'Wing lower skin' },
  wing_spar_front: { ko: '날개 앞 스파', en: 'Front spar' },
  wing_spar_rear: { ko: '날개 뒤 스파', en: 'Rear spar' },
  wing_fuel_tank: { ko: '날개 연료통', en: 'Wing fuel tank' },
  wing_ribs: { ko: '날개 리브', en: 'Wing ribs' },
  wing_stringers: { ko: '날개 스트링어', en: 'Wing stringers' },
  wing_upper_skin: { ko: '날개 상부 외판', en: 'Wing upper skin' },
  slats: { ko: '앞전 슬랫', en: 'Leading-edge slats' },
  spoilers: { ko: '스포일러', en: 'Spoilers' },
  flap_in: { ko: '안쪽 플랩', en: 'Inboard flap' },
  flap_out: { ko: '바깥 플랩', en: 'Outboard flap' },
  aileron: { ko: '에일러론', en: 'Aileron' },
  flap_fairings: { ko: '플랩 페어링', en: 'Flap-track fairings' },
  winglet: { ko: '스플릿 윙렛', en: 'Split-tip winglet' },
  wing_tip_light: { ko: '항법등', en: 'Navigation light' },
  h_stab: { ko: '수평 안정판', en: 'Horizontal stabilizer' },
  elevator: { ko: '승강타', en: 'Elevator' },
  dorsal_fin: { ko: '등지느러미', en: 'Dorsal fin' },
  fin: { ko: '수직 꼬리', en: 'Vertical fin' },
  rudder: { ko: '방향타', en: 'Rudder' },
  apu_exhaust: { ko: '보조동력장치 배기구', en: 'APU exhaust' },
  mlg_wheel_in: { ko: '주바퀴(안)', en: 'Main wheel (inner)' },
  mlg_wheel_out: { ko: '주바퀴(밖)', en: 'Main wheel (outer)' },
  mlg_strut: { ko: '주 착륙장치 다리', en: 'Main gear strut' },
  mlg_brace: { ko: '주 착륙장치 버팀대', en: 'Main gear brace' },
  mlg_door: { ko: '주 착륙장치 문', en: 'Main gear door' },
  nlg_wheel_l: { ko: '앞바퀴(왼)', en: 'Nose wheel (left)' },
  nlg_wheel_r: { ko: '앞바퀴(오)', en: 'Nose wheel (right)' },
  nlg_strut: { ko: '앞 착륙장치 다리', en: 'Nose gear strut' },
  nlg_door: { ko: '앞 착륙장치 문', en: 'Nose gear door' },
  engine_pylon: { ko: '엔진 파일론', en: 'Engine pylon' },
  engine_core: { ko: '엔진 코어', en: 'Engine core' },
  engine_reverser: { ko: '역추력 장치 덮개', en: 'Thrust-reverser cowl' },
  engine_fan_cowl: { ko: '팬 덮개', en: 'Fan cowl' },
  engine_inlet: { ko: '엔진 흡입구', en: 'Engine inlet' },
  engine_fan: { ko: '엔진 팬', en: 'Engine fan' },
  pressure_bulkhead_aft: { ko: '뒤 압력 격벽', en: 'Aft pressure bulkhead' },
  pressure_bulkhead_fwd: { ko: '앞 압력 격벽', en: 'Forward pressure bulkhead' },
  bags_aft: { ko: '뒤 화물(짐)', en: 'Aft baggage' },
  bags_fwd: { ko: '앞 화물(짐)', en: 'Forward baggage' },
  water_tanks: { ko: '물탱크', en: 'Water tanks' },
  lavatory_aft: { ko: '뒤 화장실', en: 'Aft lavatories' },
  lavatory_fwd: { ko: '앞 화장실', en: 'Forward lavatory' },
  bins_far: { ko: '머리 위 짐칸(먼쪽)', en: 'Overhead bins (far side)' },
  bins_near: { ko: '머리 위 짐칸(가까운 쪽)', en: 'Overhead bins (near side)' },
  cargo_aft: { ko: '뒤 화물칸', en: 'Aft cargo hold' },
  cargo_fwd: { ko: '앞 화물칸', en: 'Forward cargo hold' },
  galley_aft: { ko: '뒤 갤리', en: 'Aft galley' },
  galley_fwd: { ko: '앞 갤리', en: 'Forward galley' },
  ac_packs: { ko: '공조 장치', en: 'Air-conditioning packs' },
  sidewall_far: { ko: '측벽', en: 'Sidewall panels' },
  center_tank: { ko: '중앙 연료통', en: 'Centre fuel tank' },
  cabin_floor: { ko: '객실 바닥', en: 'Cabin floor' },
  elec_bay: { ko: '전자장비실', en: 'Electronics bay' },
  flight_deck: { ko: '조종실', en: 'Flight deck' },
  cockpit_door: { ko: '조종실 문', en: 'Cockpit door' },
  flight_deck_floor: { ko: '조종실 바닥', en: 'Flight-deck floor' },
  wiring_harness: { ko: '배선 다발', en: 'Wiring harness' },
  hydraulic_lines: { ko: '유압 배관', en: 'Hydraulic lines' },
  seat_row: { ko: '좌석 열', en: 'Seat row' },
};
// id -> key into PARTS: exact name, else without the side suffix (_p port / _s starboard), else without a trailing number
export function partKey(id) {
  if (PARTS[id]) return id;
  const noSide = id.replace(/_(p|s)$/, '');
  if (PARTS[noSide]) return noSide;
  const noNum = id.replace(/_\d+$/, '');
  if (PARTS[noNum]) return noNum;
  return null;
}
export const partName = (id) => PARTS[partKey(id)] || { ko: id, en: id };
// whole assemblies that move as one (wings lowered by the crane, engines on a cart, ...): used for the "Fitting now" line
export const ASM_NAMES = {
  wingS: { ko: '우현 날개', en: 'Starboard wing' }, wingP: { ko: '좌현 날개', en: 'Port wing' },
  htailS: { ko: '우현 수평 안정판', en: 'Starboard stabilizer' }, htailP: { ko: '좌현 수평 안정판', en: 'Port stabilizer' },
  mlgS: { ko: '주 착륙장치', en: 'Main landing gear' }, mlgP: { ko: '주 착륙장치', en: 'Main landing gear' },
  mlgdoorS: { ko: '주 착륙장치 문', en: 'Main gear door' }, mlgdoorP: { ko: '주 착륙장치 문', en: 'Main gear door' },
  nlg: { ko: '앞 착륙장치', en: 'Nose landing gear' }, nlgdoor: { ko: '앞 착륙장치 문', en: 'Nose gear door' },
  engS: { ko: '우현 엔진', en: 'Starboard engine' }, engP: { ko: '좌현 엔진', en: 'Port engine' },
  b48: { ko: '동체 섹션 48', en: 'Fuselage section 48' }, b46: { ko: '동체 섹션 46', en: 'Fuselage section 46' },
  b43: { ko: '동체 섹션 43', en: 'Fuselage section 43' }, b41: { ko: '동체 섹션 41', en: 'Fuselage section 41' },
};
// headings of the numbers strip
export const NUMBER_HEADS = {
  rates: { ko: '월 생산 대수의 변화 (737)', en: 'Monthly production rate (737)' },
  cumulative: { ko: '누적 인도', en: 'Deliveries' },
  lines: { ko: '렌턴 공장', en: 'The Renton plant' },
};

// numbered stage chips and label chips on the drawing (world anchors; the live layer projects them)
export const CHIP_ANCHORS = [
  { x: -4900, y: 470, z: 0 },
  { x: -3300, y: 390, z: 0 },
  { x: 2625, y: -545, z: 0, back: true },
  { x: 2000, y: 410, z: 0 },
  { x: 3900, y: 410, z: 0 },
  { x: 5400, y: 410, z: 0 },
  { x: 8300, y: 350, z: 0 },
  { x: 12600, y: 330, z: 0 },
];
// small text labels; u0..u1 is the range of tour progress in which each one shows
export const LABELS = [
  { x: -5050, y: 160, z: 0, u0: 0, u1: 1.02, ko: '렌턴 (워싱턴주)', en: 'Renton, Washington', cls: 'hub' },
  { x: -3300, y: -380, z: 0, u0: 0.98, u1: 2.0, ko: '위치타 · 동체 공장', en: 'Wichita · fuselage plant', back: true },
  { x: -1300, y: 70, z: 0, u0: 1.7, u1: 2.0, ko: '철도 ≈3,500 km (줄여 그림)', en: 'Rail ≈3,500 km (compressed)' },
  { x: 3000, y: -285, z: 0, u0: 2.0, u1: 3.0, ko: '날개 구역', en: 'Wing area' },
  { x: 1800, y: 330, z: 0, u0: 3.0, u1: 3.9, ko: '위층(1~3일째)', en: 'Raised level (days 1–3)' },
  { x: 8000, y: 120, z: 0, u0: 6.0, u1: 7.0, ko: '렌턴 플라이트 라인', en: 'Renton flight line' },
  { x: 11700, y: 360, z: 0, u0: 7.0, u1: 8.0, ko: '렌턴 공항 활주로 16/34 · 1,640 m', en: 'Renton Municipal runway 16/34 · 1,640 m' },
  { x: 3000, y: 430, z: 0, u0: 3.0, u1: 6.0, ko: '위치 = 흐름일 (줄 하나가 하루)', en: 'Position = flow day (one stripe a day)' },
  { x: 2625, y: -250, z: 0, u0: 2.0, u1: 3.0, ko: '스파 · 패널 라인', en: 'Spar and panel lines', back: true },
  { x: 36700, y: 1000, z: 0, u0: 7.4, u1: 8.0, ko: '보잉 필드(BFI) 약 8 km → 도장·인도', en: 'Boeing Field (BFI) about 8 km → paint, delivery' },
];
