// All words on the page. Korean first, English second (the page shows both). Rendered with textContent, never as HTML.
// Facts carry a confidence tag: V verified, V2 verified (secondary source), E estimate, A assumption, U unverified.
// Numbers that MOVE during the tour live in model.js; static facts live here with their tag and source id (see SRC).

export const TAG = {
  V: { ko: '확인됨', en: 'verified' },
  V2: { ko: '확인됨(2차)', en: 'verified (secondary)' },
  E: { ko: '추정', en: 'estimate' },
  A: { ko: '가정', en: 'assumption' },
  U: { ko: '미확인', en: 'unverified' },
  G: { ko: '자료 없음', en: 'data gap' },
};

export const UI = {
  title: { ko: '카메라 모듈 공장', en: 'Camera Module Factory' },
  sub: { ko: '업계형 · 아이폰급 후면 카메라 모듈이 스마트폰에 들어가기까지', en: 'industry-standard · how an iPhone-class rear camera module is made and fitted into the phone' },
  disclaimer: {
    ko: '비공식 교육용 모식도입니다. 실제 공장의 배치·치수·속도가 아니며, 특정 회사와 제휴·후원 관계가 없고 로고·상표를 쓰지 않습니다. 공개되지 않은 부분은 [추정]·[가정]으로 표시했습니다.',
    en: 'An unofficial educational schematic. It is not any real plant\'s layout, size or speed, has no affiliation with any company, and uses no logos or marks. Anything not public is tagged [estimate] or [assumption].',
  },
  prev: { ko: '이전', en: 'Previous' },
  next: { ko: '다음', en: 'Next' },
  play: { ko: '재생', en: 'Play' },
  pause: { ko: '일시정지', en: 'Pause' },
  skip: { ko: '단계 건너뛰기', en: 'Skip stage' },
  restart: { ko: '처음부터', en: 'Restart' },
  whole: { ko: '공장 전체', en: 'Whole plant' },
  replay: { ko: '다시 보기', en: 'Replay' },
  stages: { ko: '공정 단계', en: 'Stages' },
  stageWord: { ko: '단계', en: 'Stage' },
  what: { ko: '무슨 일이 일어나나', en: 'What happens' },
  equip: { ko: '핵심 설비', en: 'Key equipment' },
  key: { ko: '핵심 숫자', en: 'Key number' },
  inn: { ko: '들어오는 것', en: 'In' },
  out: { ko: '나가는 것', en: 'Out' },
  notes: { ko: '근거와 한계', en: 'Basis and limits' },
  scrub: { ko: '진행 위치', en: 'Progress' },
  loupe: { ko: '확대경 · 모듈', en: 'Loupe · the module' },
  loupeNote: {
    ko: '실제 약 15 mm 모듈을 크게 그렸습니다 · 축척 없음, 모식도',
    en: 'Real module ≈15 mm, drawn far larger · not to scale, schematic',
  },
  partsIn: { ko: '이 단계에서 붙는 부품', en: 'Parts added in this stage' },
  partsNone: { ko: '이 단계에서 붙는 부품 없음', en: 'No parts added in this stage' },
  partCount: { ko: '모듈 부품', en: 'Module parts' },
  compare: { ko: '다른 회사는?', en: 'How others do it' },
  business: { ko: '사업 현황', en: 'Business' },
  sources: { ko: '근거와 신뢰도', en: 'Sources & confidence' },
  close: { ko: '닫기', en: 'Close' },
  legend: { ko: '청정도 등급', en: 'Clean-room classes' },
  tags: { ko: '표기 방법', en: 'Tag key' },
  fail: { ko: '그림을 그리는 중 문제가 생겼습니다. 새로고침하세요.', en: 'Something went wrong drawing the scene. Please reload.' },
  noMotion: { ko: '동작 줄이기 설정이 켜져 있어 자동 재생하지 않습니다. 이전·다음 버튼으로 단계를 넘기세요.', en: 'Reduced motion is on, so nothing autoplays. Use Previous / Next to step.' },
  scaleStrip: { ko: '실제 크기 비교', en: 'Real size comparison' },
  scaleNote: { ko: '폰 149.6 × 71.5 × 8.25 mm(아이폰 16 Pro급) · 모듈 본체 ≈ 15 mm [추정]', en: 'Phone 149.6 × 71.5 × 8.25 mm (iPhone 16 Pro class) · module body ≈ 15 mm [estimate]' },
  mm15: { ko: '≈ 15 mm', en: '≈ 15 mm' },
  dimsFoot: { ko: '확대도의 눈금 막대는 모듈 기준 5 mm입니다.', en: 'The bar in the loupe is 5 mm at module scale.' },
  playing: { ko: '재생합니다', en: 'Playing' },
  paused: { ko: '일시정지했습니다', en: 'Paused' },
  now: { ko: '지금', en: 'Now' },
  hint: {
    ko: '공장 그림에 초점을 두고 방향키·숫자 1~8·Home·End로 단계를 옮길 수 있습니다. 공장의 표식을 누르면 그 공정 설명으로 갑니다.',
    en: 'With focus on the plant, the arrow keys, 1 to 8, Home and End move between stages. Click a marker in the plant to jump to that stage.',
  },
  plantTag: { ko: '공장 모식도 [가정]: 배치·대수·크기는 이 페이지의 그림입니다', en: 'Plant schematic [assumption]: layout, counts and sizes are this page\'s drawing' },
  aaMtf: { ko: '선명도 MTF', en: 'sharpness at 5 points' },
  aaAxes: { ko: '6축 오차', en: '6-axis error' },
  selPart: { ko: '선택한 부품', en: 'Selected part' },
  partsAll: { ko: '이 단계에서 모든 부품 81개가 분해도로 나타납니다', en: 'All 81 parts appear in the exploded view in this stage' },
  clickPart: { ko: '눌러서 확대도에서 부품 강조', en: 'Press a part to highlight it in the loupe' },
  funnelH: { ko: '수율 깔때기 (기준 라인 가상값 [추정])', en: 'Yield funnel (reference-line guess [estimate])' },
  tagKeyH: { ko: '표기 방법', en: 'Tag key' },
  compareLead: { ko: '공정 배치를 공개한 경쟁사는 없습니다. 규모와 역할만 비교하며, 조사에서 근거가 확인된 내용만 적었습니다.', en: 'No competitor publishes its layout. This compares scale and role only, with just the claims the research supports.' },
  sitesH: { ko: '생산 거점', en: 'Sites' },
  bizAll: { ko: '더 많은 숫자', en: 'More numbers' },
  srcH: { ko: '출처 목록', en: 'Source list' },
  bizYear: { ko: '연도·출처는 근거 패널에', en: 'Year and source are in the Sources panel' },
  finished: { ko: '여정이 끝났습니다. 다시 보기를 눌러 처음부터 보세요.', en: 'The tour is finished. Press Replay to watch it again.' },
  first: { ko: '첫 번째 설명입니다', en: 'This is the first step' },
  last: { ko: '마지막 설명입니다', en: 'This is the last step' },
  lastStage: { ko: '마지막 공정입니다', en: 'This is the last stage' },
  restarted: { ko: '처음으로 돌아갑니다', en: 'Back to the start' },
  overOn: { ko: '공장 전체를 봅니다', en: 'Showing the whole plant' },
  overOff: { ko: '공정 보기로 돌아갑니다', en: 'Back to the stage view' },
  hello: { ko: '공정을 고르거나 재생을 눌러 보세요', en: 'Pick a stage or press Play' },
  tolItem: { ko: '허용 오차', en: 'Tolerance' },
};

// The numbers that appear in the HUD while the tour runs (values come from model.js readoutValues).
export const READOUTS = {
  parts: { ko: '모듈 부품', en: 'Module parts', unit: '개' },
  gown: { ko: '입장 단계', en: 'Gowning step', unit: '/7' },
  gmin: { ko: '경과', en: 'Elapsed', unit: '분' },
  place: { ko: '장착 부품(패널)', en: 'Parts placed (panel)', unit: '개' },
  temp: { ko: '온도', en: 'Temperature', unit: '°C' },
  wires: { ko: '본딩 와이어', en: 'Bond wires', unit: '개' },
  elems: { ko: '렌즈 매수', en: 'Lens elements', unit: '/7' },
  mtfc: { ko: '중심 MTF', en: 'Centre MTF', unit: '%' },
  mtfk: { ko: '모서리 MTF (최저)', en: 'Worst-corner MTF', unit: '%' },
  err: { ko: '초점·기울기 오차', en: 'Focus · tilt error', unit: 'µm' },
  tests: { ko: '검사 항목', en: 'Tests done', unit: '/6' },
  good: { ko: '양품 (1,000개 중)', en: 'Good (of 1,000)', unit: '개' },
  packed: { ko: '포장 수량', en: 'Packed', unit: '개' },
  mod: { ko: '조립 순서', en: 'Assembly step', unit: '/7' },
};

// what the active-alignment machine is doing, by phase (model.js aaOf)
export const AA_PHASE = {
  load: { ko: '로봇이 렌즈 묶음을 집어 정렬 지그에 가져옵니다', en: 'The robot brings the lens group to the aligner' },
  search: { ko: '6축 스테이지가 MTF가 가장 높은 자리를 찾습니다', en: 'The 6-axis stage searches for the peak MTF' },
  dispense: { ko: '접착제를 렌즈 홀더 둘레에 찍습니다', en: 'Adhesive is dotted round the lens holder' },
  uv: { ko: 'UV 램프가 1초 안팎 비춰 임시로 굳힙니다', en: 'The UV lamp flashes for about a second to tack it' },
  verify: { ko: '굳은 뒤 MTF를 다시 읽어 확인합니다', en: 'MTF is read again to confirm nothing moved' },
  bake: { ko: '오븐에서 약 70 °C로 완전히 경화합니다 [추정]', en: 'The oven cures it fully at about 70 °C [estimate]' },
  release: { ko: '정렬이 끝나 모듈을 내보냅니다', en: 'Aligned: the module is released' },
  idle: { ko: '', en: '' },
  done: { ko: '', en: '' },
};

// ---- clean-room class legend (ISO 14644-1 limits at >= 0.5 um per cubic metre; FED-STD-209E class = per cubic foot) ----
export const CLEAN_TABLE = [
  { iso: 'ISO 4', fed: 'Class 10', n: '352', note: { ko: '공개: 광주 라인 핵심 공정(2015–17) [확인됨 2차]', en: 'Public: Gwangju line core process (2015–17) [verified, secondary]' }, hot: true },
  { iso: 'ISO 5', fed: 'Class 100', n: '3,520', note: { ko: '수술실보다 깨끗한 급', en: 'Cleaner than a surgical suite' } },
  { iso: 'ISO 6', fed: 'Class 1,000', n: '35,200', note: { ko: '', en: '' } },
  { iso: 'ISO 7', fed: 'Class 10,000', n: '352,000', note: { ko: '', en: '' } },
  { iso: 'ISO 8', fed: 'Class 100,000', n: '3,520,000', note: { ko: 'SMT 구역은 이 정도로 가정 [가정]', en: 'SMT zone assumed about here [assumption]' } },
];

const T = (tag, ko, en) => ({ tag, ko, en });

// ---------------- the eight stages ----------------
export const STAGES = [
  {
    id: 'intake', bay: 'recv',
    short: { ko: '자재·입장', en: 'Intake' },
    name: { ko: '자재 입고 · 청정실 입장', en: 'Materials in · clean-room entry' },
    what: {
      ko: '렌즈, 센서, 액추에이터(VCM) 부품, 기판이 들어와 수입검사를 거칩니다. 약 80가지 부품이 한 개의 모듈로 모입니다(분해도). 사람은 7단계 가운 절차(5분 이상)와 에어샤워를 지나 청정실로 들어갑니다.',
      en: 'Lenses, sensors, actuator (VCM) parts and substrates arrive and pass incoming inspection. About 80 part types converge into one module (exploded view). People enter the clean room through a 7-step gowning routine (over 5 minutes) and an air shower.',
    },
    equipment: [
      T('A', '입고 랙과 AGV 반송', 'Receiving racks and AGV transport'),
      T('A', '수입검사대(치수·광학·이물)', 'Incoming-inspection bench (size, optics, particles)'),
      T('V', '에어샤워(입장 7단계 중 하나)', 'Air shower (one of the 7 entry steps)'),
      T('A', '자재 패스박스', 'Material pass-through box'),
    ],
    key: { value: '7단계 · 5분↑', ko: '청정실 입장 절차', en: 'Clean-room entry steps · minutes', tag: 'V2' },
    inn: { ko: '렌즈·센서·VCM 부품·기판', en: 'Lenses, sensors, VCM parts, substrates' },
    out: { ko: '청정실 안의 자재와 작업자', en: 'Materials and people inside the clean room' },
    readouts: ['gown', 'gmin', 'parts'],
    steps: [
      { f: 0, ko: '모듈 한 개 = 약 80개 부품. 분해도로 먼저 보여 줍니다.', en: 'One module is about 80 parts. Here is the exploded bill of materials first.' },
      { f: 0.3, ko: '구매 비중은 센서 41%, 액추에이터 24%, 렌즈 13% [확인됨 2차]. 이미지 센서는 기준 제조사가 만들지 않고 사 옵니다.', en: 'Purchases by value: sensors 41%, actuators 24%, lenses 13% [verified, secondary]. The image sensor is bought in, not made by reference manufacturer.' },
      { f: 0.45, ko: '입장 7단계: 가운·덧신 → 끈끈이 롤러 → 정전기 점검 → 신발 세척 → 에어샤워 → 롤러 → 손 세척 (5분 이상) [확인됨 2017].', en: 'Seven entry steps: gown and boots, sticky roller, static test, shoe wash, air shower, second roller, hand wash (over 5 minutes) [verified, 2017].' },
      { f: 0.86, ko: '자재는 별도의 패스박스로 들어갑니다 [가정]. 캐리어 트레이가 라인에 오릅니다.', en: 'Material goes in through a separate pass-through box [assumption]. The carrier tray steps onto the line.' },
    ],
    notes: [
      T('V2', '입장 7단계·5분 이상·"10급" 청정실은 2017년 광주 G6 라인 보도 기준입니다. 지금 아이폰 라인의 등급이 아닙니다.', 'The 7 steps, over 5 minutes and "class 10" come from a 2017 report on the Gwangju G6 line. They are not today\'s iPhone line rating.'),
      T('V2', '구매 비중(센서 41 / 액추에이터 24 / 렌즈 13 %)은 2025년 사업보고서 인용 2차 자료.', 'Purchase mix is from the 2025 business report as quoted by a secondary source.'),
      T('E', '부품 수 약 80개와 모듈 크기 ≈ 15 mm는 공개 분해 자료가 없어 이 페이지가 그린 모식입니다.', 'The part count of about 80 and the 15 mm size are this page\'s schematic; no public teardown gives them.'),
      T('U', '렌즈 배럴을 기준 제조사가 직접 조립하는지는 확인되지 않았습니다. 업계 관행은 렌즈 업체가 배럴째 납품입니다.', 'Whether reference manufacturer builds the lens barrel itself is unverified. Industry practice is that the lens maker delivers it assembled.'),
    ],
    table: 'clean',
  },
  {
    id: 'smt', bay: 'smt',
    short: { ko: '기판 SMT', en: 'Substrate SMT' },
    name: { ko: '기판 SMT', en: 'Substrate SMT' },
    what: {
      ko: '리지드-플렉스 기판 패널에 솔더 페이스트를 찍고 아주 작은 수동소자·IC·코일·위치센서를 올린 뒤 리플로 오븐에서 녹여 붙이고 AOI로 검사합니다. 연성 테일 끝에는 B2B 커넥터가 있습니다.',
      en: 'Solder paste is printed on a rigid-flex substrate panel, tiny passives, ICs, coils and position sensors are placed, reflowed in an oven and inspected by AOI. The flex tail ends in a B2B connector.',
    },
    equipment: [
      T('E', '솔더 프린터', 'Solder printer'),
      T('E', '고속 마운터 (3대 구성)', 'High-speed mounters (3-head line)'),
      T('E', '리플로 오븐(피크 약 250 °C)', 'Reflow oven (peak about 250 °C)'),
      T('E', 'AOI 검사기', 'AOI inspection machine'),
    ],
    key: { value: '25개/패널', ko: '한 패널에서 나오는 모듈 수(G4, 2015)', en: 'Modules per panel (G4, 2015)', tag: 'V' },
    inn: { ko: '기판 패널(리지드+연성)·부품 릴', en: 'Substrate panels (rigid + flex), component reels' },
    out: { ko: '부품이 붙은 기판 패널', en: 'Populated substrate panel' },
    readouts: ['place', 'temp', 'parts'],
    steps: [
      { f: 0, ko: '기판: 리지드 보드 + 연성 테일 + 보강판 + B2B 플러그.', en: 'The substrate: rigid board, flex tail, stiffener and B2B plug.' },
      { f: 0.2, ko: '스텐실 프린터가 패드마다 솔더 페이스트를 찍습니다.', en: 'The stencil printer deposits solder paste on every pad.' },
      { f: 0.34, ko: '마운터가 수동소자 14개, IC 3개, OIS 코일 4개, TMR 센서 3개를 올립니다 [수량은 추정].', en: 'Mounters place 14 passives, 3 ICs, 4 OIS coils and 3 TMR sensors [counts are estimates].' },
      { f: 0.66, ko: '리플로: 약 250 °C까지 올렸다 식힙니다 [추정].', en: 'Reflow: up to about 250 °C and back down [estimate].' },
      { f: 0.84, ko: 'AOI가 납땜 모양과 위치를 훑어 봅니다.', en: 'AOI scans solder shape and position.' },
    ],
    notes: [
      T('V', '패널 한 장에서 25개를 잘라내는 것은 2015년 G4 모듈 공개 자료.', 'Cutting 25 units from one panel is from the public 2015 G4 module release.'),
      T('E', 'SMT 온도·장비 구성·부품 수는 업계 관행으로 그린 추정입니다.', 'Temperatures, machine mix and part counts are drawn from industry practice.'),
      T('A', 'SMT 구역의 청정 등급은 공개 자료가 없어 낮게(ISO 8급) 가정했습니다.', 'No public clean-room class for the SMT area; ISO 8 is assumed.'),
    ],
  },
  {
    id: 'bond', bay: 'bond',
    short: { ko: '다이본딩·와이어', en: 'Die + wire bond' },
    name: { ko: '센서 다이본딩 · 와이어본딩 · IR 필터', en: 'Sensor die bond · wire bond · IR filter' },
    what: {
      ko: '플라즈마로 패드를 닦고, 웨이퍼에서 잘라 온 CMOS 센서를 OIS 스테이지에 붙여(다이본딩) 열경화합니다. 가는 금 와이어로 센서 패드와 기판을 이어 주고(와이어본딩), 세정·검사 후 IR 차단 필터 홀더와 얇은 유리 필터를 붙입니다.',
      en: 'Plasma cleans the pads, the CMOS sensor die is attached to the OIS stage (die bond) and heat-cured. Fine gold wires join sensor pads to the substrate (wire bond); after cleaning and inspection the IR-cut filter holder and a thin glass filter go on.',
    },
    equipment: [
      T('E', '플라즈마 세정기', 'Plasma cleaner'),
      T('E', '다이본더(칩 마운터)', 'Die bonder (chip placer)'),
      T('E', '와이어본더 다수', 'Several wire bonders'),
      T('V2', '세정·검사 후 IR 필터 부착(사람 손 없이 자동)', 'IR-filter attach after clean and inspect (hands-off, automated)'),
    ],
    key: { value: '104점', ko: '와이어 본딩 지점 수(G4, 2015)', en: 'Wire-bond points (G4, 2015)', tag: 'V' },
    inn: { ko: 'SMT 완료 기판 · 센서 다이 · IR 필터', en: 'Populated substrate, sensor dies, IR filters' },
    out: { ko: '센서가 올라간 센서 어셈블리', en: 'Sensor assembly' },
    readouts: ['wires', 'temp', 'parts'],
    steps: [
      { f: 0, ko: '플라즈마가 패드 표면을 닦습니다.', en: 'Plasma cleans the pad surfaces.' },
      { f: 0.1, ko: '서스펜션 포스트 4개와 OIS 이동 스테이지가 얹힙니다 [OIS 구조는 추정].', en: 'Four suspension posts and the OIS moving stage go on [OIS layout is an estimate].' },
      { f: 0.28, ko: '다이본더가 센서 다이를 접착 필름 위에 올립니다. 정밀도는 ±10–25 µm급 [추정].', en: 'The die bonder places the sensor die on the attach film. Accuracy about ±10–25 µm [estimate].' },
      { f: 0.42, ko: '열경화(약 120–150 °C) [추정].', en: 'Heat cure (about 120–150 °C) [estimate].' },
      { f: 0.5, ko: '와이어본딩: 모듈당 60–120개 [추정]. 2015년 G4는 104점 [확인됨].', en: 'Wire bonding: 60–120 wires per module [estimate]. The 2015 G4 had 104 points [verified].' },
      { f: 0.86, ko: 'IR 필터 홀더와 유리 필터를 접착합니다.', en: 'The IR-filter holder and glass filter are bonded.' },
    ],
    notes: [
      T('V', '순서(센서 세정 → 다이본딩 → 와이어본딩 → 세정·검사 → IR 필터)와 104점·0.11 mm 유리 필터는 기준 제조사 공개 자료.', 'The order (sensor clean, die bond, wire bond, clean and inspect, IR filter) and the 104 points and 0.11 mm glass are from reference manufacturer releases.'),
      T('E', '와이어 수·정밀도·경화 온도는 추정. 센서는 웨이퍼에서 잘라 온 소니급 다이입니다.', 'Wire count, accuracy and cure temperature are estimates. The sensor is a Sony-class die cut from a wafer.'),
      T('U', '아이폰 모듈이 COB(와이어)인지 플립칩인지, 언더필 사용 여부는 공개되지 않았습니다.', 'Whether the iPhone module uses COB (wire) or flip-chip, and underfill, is not public.'),
    ],
  },
  {
    id: 'lens', bay: 'lens',
    short: { ko: '렌즈·VCM', en: 'Lens + VCM' },
    name: { ko: '렌즈 배럴 · VCM · OIS 액추에이터', en: 'Lens barrel · VCM · OIS actuator' },
    what: {
      ko: '센서 둘레에 OIS 자석 4개와 스프링을 달고, 위에서는 AF 액추에이터(VCM)와 7매 렌즈 배럴을 따로 조립합니다. 렌즈는 스페이서·차광링과 함께 한 장씩 쌓입니다.',
      en: 'Four OIS magnets and springs go around the sensor, while the AF actuator (VCM) and the 7-element lens barrel are built as a separate sub-assembly above. Lens elements are stacked one at a time with spacers and light-shield rings.',
    },
    equipment: [
      T('E', 'OIS 자석·스프링 조립 셀', 'OIS magnet and spring assembly cell'),
      T('E', 'VCM 조립 셀', 'VCM assembly cell'),
      T('A', '렌즈 스택 조립기(배럴이 외부 납품이면 생략)', 'Lens stacker (skipped if barrels are delivered finished)'),
      T('A', '이송 로봇', 'Transfer robot'),
    ],
    key: { value: '7매', ko: '렌즈 요소(플라스틱 비구면)', en: 'Lens elements (plastic asphere)', tag: 'V2' },
    inn: { ko: '센서 어셈블리 · 자석·스프링·VCM 부품 · 렌즈 요소', en: 'Sensor assembly, magnets, springs, VCM parts, lens elements' },
    out: { ko: '렌즈-VCM 서브 어셈블리 + 센서 어셈블리', en: 'Lens-VCM sub-assembly plus sensor assembly' },
    readouts: ['elems', 'parts'],
    steps: [
      { f: 0, ko: '센서 둘레 OIS 자석 4개: 센서 쪽이 움직이는 센서시프트 방식(12 Pro Max 분해 자료) [확인됨 2차].', en: 'Four OIS magnets around the sensor: the sensor itself shifts (12 Pro Max teardown) [verified, secondary].' },
      { f: 0.14, ko: '서스펜션 스프링 4개가 이동 스테이지를 띄웁니다 [형상 추정].', en: 'Four suspension springs hold the moving stage [shape estimated].' },
      { f: 0.28, ko: 'AF 액추에이터(VCM): 베이스, 스프링, 캐리어, 코일, 자석, 요크 [추정].', en: 'AF actuator (VCM): base, springs, carrier, coil, magnets, yoke [estimate].' },
      { f: 0.6, ko: '렌즈 배럴: 맨 뒤 L7부터 L1까지 스페이서와 함께 쌓습니다 [배럴 내부 조립은 가정].', en: 'Lens barrel: L7 first, then up to L1, with spacers [in-house barrel build is an assumption].' },
      { f: 0.88, ko: '조리개와 리테이너 링으로 잠급니다.', en: 'The aperture stop and a retainer ring lock the stack.' },
    ],
    notes: [
      T('V2', '7매 구성(F/1.78)과 센서시프트 OIS 2세대는 애플 사양. 자석 4개는 12 Pro Max 분해 자료.', 'The 7-element lens (f/1.78) and second-generation sensor-shift OIS are Apple specs; four magnets come from a 12 Pro Max teardown.'),
      T('U', '기준 제조사가 센서시프트 모듈을 직접 만드는지, 액추에이터를 누가 납품하는지는 미확인입니다.', 'Whether reference manufacturer builds the sensor-shift stage itself, and who supplies the actuator, is unverified.'),
      T('E', 'OIS 스프링·VCM 내부 구조는 이 페이지의 모식(추정)입니다.', 'OIS spring and VCM interiors are this page\'s schematic (estimates).'),
    ],
  },
  {
    id: 'align', bay: 'aa',
    short: { ko: '능동 정렬', en: 'Active alignment' },
    name: { ko: '능동 정렬 (Active Alignment)', en: 'Active alignment (AA)' },
    what: {
      ko: '센서가 시험 차트를 렌즈 너머로 보며 선명도(MTF)를 실시간으로 재는 동안, 6축 스테이지가 렌즈를 X·Y·Z와 세 방향 기울기로 움직여 중심과 네 모서리가 동시에 가장 선명한 자리를 찾습니다. 찾으면 접착제를 찍고 UV로 순간 고정, 오븐에서 굳힙니다.',
      en: 'While the sensor looks at a test chart through the lens and measures sharpness (MTF) live, a 6-axis stage moves the lens in X, Y, Z and three tilts until the centre and all four corners are sharp at once. Then adhesive is dispensed, fixed in a UV flash and baked in an oven.',
    },
    equipment: [
      T('V', '6축 스테이지(X·Y·Z·θx·θy·θz)와 그리퍼', '6-axis stage (X, Y, Z, θx, θy, θz) and gripper'),
      T('V', '시험 차트 + 콜리메이터(중심 + 모서리 4곳)', 'Test chart + collimator (centre + 4 corner fields)'),
      T('V', '접착제 디스펜서 + UV 램프', 'Adhesive dispenser + UV lamp'),
      T('E', '컨베이어 열경화 오븐(약 40분)', 'Conveyor bake oven (about 40 min)'),
    ],
    key: { value: '6축', ko: '정렬 자유도(±4 µm급 초점 허용)', en: 'Degrees of freedom (focus window about ±4 µm)', tag: 'V' },
    inn: { ko: '센서 어셈블리 + 렌즈-VCM 서브 어셈블리', en: 'Sensor assembly + lens-VCM sub-assembly' },
    out: { ko: '접착 고정된 카메라 모듈(실드 전)', en: 'Bonded camera module (before shield)' },
    readouts: ['mtfc', 'mtfk', 'err', 'temp'],
    steps: [
      { f: 0, ko: '차트 앞에 모듈을 놓고 센서를 켭니다. 그리퍼가 렌즈를 잡습니다.', en: 'The module sits in front of the chart and the sensor is powered. A gripper holds the lens.' },
      { f: 0.1, ko: '초점(Z)을 훑고, 기울기, 마지막으로 X·Y·회전을 맞춥니다. MTF가 올라갑니다. (움직임은 보이도록 과장)', en: 'Sweep focus (Z), then tilt, then fine X, Y and rotation. MTF climbs. (Motion exaggerated so you can see it)' },
      { f: 0.55, ko: '접착제를 여러 점에 찍습니다(벤더 자료: 30점 이상).', en: 'Adhesive is dispensed at many points (vendor data: over 30).' },
      { f: 0.62, ko: 'UV를 0.5–1초 쪼여 자리를 고정합니다 [벤더 자료].', en: 'A 0.5–1 s UV flash fixes the position [vendor data].' },
      { f: 0.7, ko: '고정 후 MTF를 다시 확인합니다.', en: 'MTF is checked again after fixing.' },
      { f: 0.76, ko: '오븐에서 열경화(45–80 °C 범위) [벤더 자료].', en: 'Heat cure in an oven (45–80 °C range) [vendor data].' },
    ],
    notes: [
      T('V2', 'AA가 "수율을 좌우"하는 기준 제조사 독자 공정이라는 점은 2017년 보도, 6축·차트 5곳(중심+모서리 4)은 장비 업체 자료.', 'AA being an in-house process that "determines yield" is from a 2017 report; 6 axes and 5 chart fields are from equipment vendors.'),
      T('E', '초점 허용 ±4.3 µm(F/1.78), 기울기 허용 0.04°는 계산으로 얻은 추정. MTF 숫자는 모식입니다.', 'The ±4.3 µm focus window (f/1.78) and 0.04° tilt tolerance are derived estimates. MTF numbers are illustrative.'),
      T('U', '장비 공급사·대수·UPH는 공개되지 않았습니다. 장비 업체의 "대당 1,000 UPH"는 벤더 주장입니다.', 'AA tool vendor, count and UPH are not public. "1,000 UPH per machine" is an equipment vendor\'s claim.'),
    ],
  },
  {
    id: 'test', bay: 'test',
    short: { ko: '보정·검사', en: 'Calibrate + test' },
    name: { ko: 'OIS·AF 보정 · 광학 검사 · 수율', en: 'OIS · AF calibration · optical test · yield' },
    what: {
      ko: '실드 캔을 씌운 뒤 AF 코드, OIS 이득을 맞추고 흔들림 시험대에서 수백 번 흔들며 촬영합니다. MTF·음영·화이트밸런스·결점 화소·이물을 측정하고 보정값을 OTP/EEPROM에 기록합니다. 불량은 걸러 내고, 수율 깔때기가 양품을 센다.',
      en: 'After the shield can goes on, AF codes and OIS gain are calibrated and the module is shaken hundreds of times while shooting. MTF, shading, white balance, defect pixels and dirt are measured, and calibration data is written to OTP/EEPROM. Rejects drop out; the yield funnel counts the good ones.',
    },
    equipment: [
      T('V2', 'OIS 흔들림 시험대(수백 번 흔들며 촬영)', 'OIS shake table (hundreds of shakes while shooting)'),
      T('E', 'AF·OIS 보정 스테이션 약 30여 대(병렬)', 'About 30 AF/OIS calibration stations (parallel)'),
      T('E', '광학 시험(MTF·음영·색)과 OTP 기록', 'Optical test (MTF, shading, colour) and OTP write'),
      T('V2', 'AVI/AOI 외관 검사(최종)', 'AVI/AOI final visual inspection'),
    ],
    key: { value: '≈ 93%', ko: '누적 1차 수율 (기준 라인 가상값)', en: 'Cumulative first-pass yield (reference line, guess)', tag: 'E' },
    inn: { ko: '접착 고정된 모듈 · 실드 캔', en: 'Bonded modules, shield cans' },
    out: { ko: '검사 합격 모듈(보정값 기록 완료)', en: 'Tested modules with calibration data written' },
    readouts: ['tests', 'good', 'parts'],
    steps: [
      { f: 0, ko: '실드 캔을 씌우고 2D 코드 라벨을 붙입니다.', en: 'The shield can goes on and a 2D-code label is applied.' },
      { f: 0.2, ko: 'AF·OIS 보정: 거리별 AF 코드, 홀/TMR 센서 이득, 흔들림 시험 [시간은 추정].', en: 'AF/OIS calibration: AF code per distance, Hall/TMR gain, shake test [times estimated].' },
      { f: 0.42, ko: '광학 시험: MTF, 렌즈 음영, 화이트밸런스, 결점 화소, 이물.', en: 'Optical test: MTF, lens shading, white balance, defect pixels, particles.' },
      { f: 0.62, ko: '보정값을 OTP/EEPROM에 기록합니다 [추정].', en: 'Calibration data is written to OTP/EEPROM [estimate].' },
      { f: 0.72, ko: '외관 검사(AVI/AOI) 후 보호 필름. 단계별 수율 가정치로 양품을 셉니다 [추정].', en: 'Visual inspection (AVI/AOI), then protective film. Good units are counted with guessed per-step yields [estimate].' },
    ],
    notes: [
      T('V2', 'OIS 시험(수백 번 흔들기), 최종 외관 검사, 신뢰성(충격·고온·열충격·먼지) 시험실은 2017년 보도.', 'The OIS shake test, final visual inspection and reliability lab (shock, heat, thermal shock, dust) are from the 2017 report.'),
      T('E', '단계별 수율(SMT 99.5 · 다이 99.8 · 와이어 99.5 · 청정+필터 98.5 · AA 98 · 시험 97.5 %)과 누적 ≈ 93 %는 기준 라인 가상값입니다. 실제 수율은 비공개.', 'Per-step yields (SMT 99.5, die 99.8, wire 99.5, clean+filter 98.5, AA 98, test 97.5 %) and about 93 % cumulative are guesses for a reference line. Real yield is not public.'),
      T('A', '검사 구역은 청정실 밖이라는 2017년 보도를 따라 그렸습니다.', 'The test area is drawn outside the clean room, following the 2017 report.'),
    ],
    funnel: [
      { id: 'smt', ko: 'SMT', en: 'SMT', y: 99.5 },
      { id: 'die', ko: '다이본딩', en: 'Die attach', y: 99.8 },
      { id: 'wire', ko: '와이어', en: 'Wire bond', y: 99.5 },
      { id: 'clean', ko: '세정·필터', en: 'Clean + IRCF', y: 98.5 },
      { id: 'aa', ko: '능동 정렬', en: 'AA', y: 98.0 },
      { id: 'test', ko: '보정·시험', en: 'Cal + test', y: 97.5 },
    ],
  },
  {
    id: 'pack', bay: 'pack',
    short: { ko: '포장·출하', en: 'Pack + ship' },
    name: { ko: '포장 · 물류', en: 'Packing · logistics' },
    what: {
      ko: '합격한 모듈은 정전기 방지(ESD) 트레이에 한 개씩 놓이고, 트레이를 ESD 백에 넣어 진공 포장한 뒤 상자에 담습니다. 상자는 출하장으로 가서 아이폰 조립 공장으로 갑니다.',
      en: 'Good modules sit one by one in ESD-safe trays; trays go into ESD bags, vacuum-sealed, then into cartons. Cartons go to the dock and on to the iPhone assembly site.',
    },
    equipment: [
      T('A', 'ESD 트레이와 릴 포장', 'ESD trays and reel packing'),
      T('A', '진공 포장기·라벨러', 'Vacuum sealer and labeller'),
      T('A', '카톤 적재 로봇과 컨베이어', 'Carton-stacking robot and conveyor'),
      T('V', '아이폰 조립사: 폭스콘·페가트론·위스트론 등(애플 공급업체 명단)', 'iPhone assemblers: Foxconn, Pegatron, Wistron and others (Apple supplier list)'),
    ],
    key: { value: '≈ 9만 개/일', ko: '가상 기준 라인(4,000 UPH 설계)의 하루 출하', en: 'Reference line (4,000 UPH design): output per day', tag: 'E' },
    inn: { ko: '검사 합격 모듈', en: 'Tested modules' },
    out: { ko: '포장된 카톤 → 출하', en: 'Packed cartons → shipping' },
    readouts: ['packed', 'good'],
    steps: [
      { f: 0, ko: '합격 모듈이 ESD 트레이로 옮겨집니다.', en: 'Good modules are moved into ESD trays.' },
      { f: 0.3, ko: '트레이를 ESD 백에 넣고 밀봉합니다.', en: 'Trays go into ESD bags and are sealed.' },
      { f: 0.55, ko: '카톤에 적재하고 라벨을 붙입니다.', en: 'Cartons are stacked and labelled.' },
      { f: 0.8, ko: '출하장으로 이송 → 트럭 → 아이폰 조립 공장.', en: 'To the dock, onto the truck, and on to the iPhone assembly site.' },
    ],
    notes: [
      T('E', '기준 라인(4,000 UPH, 하루 약 9만 개, 22시간·가동률 90%)은 이 페이지의 가정입니다. 실제 그룹 생산량은 월 약 3,200–4,000만 개(2025 상반기 1.916억, 2026 상반기 2.4174억 개) [확인됨 2차].', 'The reference line (4,000 UPH, about 90 k a day at 22 h and 90% OEE) is this page\'s assumption. Real group output is about 32–40 M modules a month (191.6 M in H1 2025, 241.74 M in H1 2026) [verified, secondary].'),
      T('V', '애플 공급업체 명단(FY2022)에는 파주, 구미, 하이퐁이 기준 제조사로 올라 있습니다.', 'Apple\'s FY2022 supplier list shows Paju, Gumi and Hai Phong for reference manufacturer.'),
      T('A', '포장 방식(트레이·릴·진공)과 물류 경로는 공개되지 않아 일반적 전자부품 포장으로 그렸습니다.', 'Packing method and logistics route are not public; drawn as generic electronic-component packing.'),
    ],
  },
  {
    id: 'phone', bay: 'dock',
    short: { ko: '스마트폰에 장착', en: 'Into the phone' },
    name: { ko: '스마트폰 조립 · 마지막 장면', en: 'Phone assembly · the finale' },
    what: {
      ko: '아이폰 조립 공장에서 모듈이 뒷면 프레임의 홈에 들어갑니다. 나사 2개로 고정하고, 연성 테일의 B2B 커넥터를 메인보드 소켓에 눌러 끼웁니다. 후면 유리를 닫고 뒤집으면 카메라 돌출부의 렌즈 창이 보입니다. 폰은 일반 모식입니다(로고 없음).',
      en: 'At the iPhone assembly site the module drops into the recess of the back frame. Two screws hold it, and the flex tail\'s B2B connector is pressed into the logic-board socket. The back glass closes and the phone flips to show the lens windows in the camera plateau. The phone is a generic stand-in (no logo).',
    },
    equipment: [
      T('V', '후면 프레임 홈에 나사 2개(2.9 mm·3.8 mm)로 고정', 'Held in the frame recess by 2 screws (2.9 mm, 3.8 mm)'),
      T('V', 'B2B 프레스핏 커넥터 2개(납땜·접착 아님)', 'Two press-fit B2B connectors (not soldered or glued)'),
      T('A', '후면 유리 접착 가스켓', 'Back-glass adhesive gasket'),
    ],
    key: { value: '149.6 × 71.5 × 8.25', ko: 'mm · 폰 크기(아이폰 16 Pro급)', en: 'mm · phone size (iPhone 16 Pro class)', tag: 'V' },
    inn: { ko: '카메라 모듈 · 후면 프레임 · 메인보드', en: 'Camera module, back frame, logic board' },
    out: { ko: '카메라가 달린 스마트폰', en: 'A phone with its camera fitted' },
    readouts: ['mod'],
    steps: [
      { f: 0, ko: '아이폰 조립 공장에 모듈 도착. 폰 뒷면 프레임을 엽니다.', en: 'The module arrives at the iPhone assembly site. The phone\'s back frame is open.' },
      { f: 0.12, ko: '모듈이 프레임 홈으로 내려앉습니다(폰과 같은 실제 크기 비율).', en: 'The module drops into the frame recess (same real size ratio as the phone).' },
      { f: 0.34, ko: '나사 2개로 고정합니다 [확인됨, 16 Pro 분해].', en: 'Two screws fix it [verified, 16 Pro teardown].' },
      { f: 0.5, ko: '연성 테일이 메인보드로 가서 B2B 커넥터를 눌러 끼웁니다 [확인됨].', en: 'The flex tail runs to the logic board and the B2B connector is pressed in [verified].' },
      { f: 0.66, ko: '후면 유리(가스켓 접착)를 덮습니다.', en: 'The back glass (gasket-bonded) is closed.' },
      { f: 0.8, ko: '폰을 뒤집으면 카메라 돌출부의 렌즈 창이 보입니다. 아래 막대는 실제 크기 비교.', en: 'Flip the phone: the lens windows in the camera plateau. The strip below is a real size comparison.' },
    ],
    notes: [
      T('V', '폰 크기·무게(199 g), 모듈이 프레임 홈에 나사 2개와 프레스핏 B2B 2개로 고정되는 구조는 iFixit 16 Pro 분해 자료.', 'Phone size and weight (199 g) and the two-screw, two-press-fit-connector mounting come from an iFixit iPhone 16 Pro teardown.'),
      T('E', '모듈 크기 ≈ 15 mm 본체와 카메라 돌출부 모양은 이 페이지의 모식입니다.', 'The ≈15 mm module body and the plateau shape are this page\'s schematic.'),
      T('A', '이 페이지는 로고·상표 없는 일반 스마트폰을 그립니다. LiDAR·플래시·다른 렌즈는 껍데기(더미)입니다.', 'A generic phone with no logo or marks; LiDAR, flash and other lenses are dummies.'),
    ],
  },
];

// ---------------- business strip: only verified / verified-secondary numbers; year and source id given ----------------
export const BUSINESS = [
  { id: 'rev', v: '₩21.90 T', ko: '2025 매출', en: '2025 revenue', tag: 'V', src: 'R1-1' },
  { id: 'optics', v: '83.6 %', ko: '광학솔루션 매출 비중(2025)', en: 'Optics share of revenue (2025)', tag: 'V2', src: 'R1-7' },
  { id: 'cust', v: '≈ 80 %', ko: '최대 고객 비중(비공개, 애플로 읽힘)', en: 'Top customer (unnamed; read as Apple)', tag: 'V2', src: 'R1-18' },
  { id: 'out', v: '483 M', ko: '2025 모듈 생산(능력 591 M)', en: '2025 modules made (capacity 591 M)', tag: 'V2', src: 'R1-22' },
  { id: 'util', v: '81.7 %', ko: '가동률 2025 (2024 70.8 %)', en: 'Utilisation 2025 (2024: 70.8 %)', tag: 'V', src: 'R1-24' },
  { id: 'capex', v: '₩341.1 B', ko: '광학 투자 승인(2025-11)', en: 'Optics capex approved (Nov 2025)', tag: 'V', src: 'R1-27' },
];
export const BUSINESS_FULL = [
  { v: '₩20.61 T → 21.20 T → 21.90 T', ko: '매출 2023 → 2024 → 2025', en: 'Revenue 2023 → 2024 → 2025', tag: 'V', src: 'R1-1' },
  { v: '₩830.8 B → 706.0 B → 665.0 B', ko: '영업이익 2023 → 2024 → 2025', en: 'Operating profit 2023 → 2024 → 2025', tag: 'V', src: 'R1-1' },
  { v: '₩17.29 T → 17.80 T → 18.32 T', ko: '광학솔루션 매출(2025는 2차 자료)', en: 'Optics revenue (2025 secondary)', tag: 'V2', src: 'R1-7' },
  { v: '3.8 % → 3.4 % → 2.6 % (2026 상반기 4.5 %)', ko: '광학 영업이익률', en: 'Optics operating margin (H1 2026: 4.5 %)', tag: 'V2', src: 'R1-7' },
  { v: '센서 41 % · 액추에이터 24 % · 렌즈 13 %', ko: '원재료 매입 비중(2025, 매입 ₩15.6 T)', en: 'Raw-material purchases mix (2025; ₩15.6 T)', tag: 'V2', src: 'R1-7' },
  { v: '241.74 M (2025 상반기 191.6 M)', ko: '2026 상반기 모듈 생산', en: 'H1 2026 modules produced (H1 2025: 191.6 M)', tag: 'V2', src: 'S16' },
  { v: '구미 ₩1.4 T(2022) + ₩0.6 T(2025) · 베트남 ₩1.3 T(2023–25)', ko: '투자 계획(MOU·발표)', en: 'Investment plans (MOUs, announcements)', tag: 'V', src: 'R1-30' },
  { v: '₩375.9 B vs ₩480.1 B', ko: '2025 광학 시설투자: 자료마다 다름(주의)', en: '2025 optics facility investment: sources disagree (caution)', tag: 'V', src: 'R1-27' },
];
export const SITES = [
  { ko: '구미', en: 'Gumi', note: { ko: '"마더 팩토리": 연구·고부가 모듈. 부지 약 37만 m², 5개 공장', en: '"Mother factory": R&D and high-value modules. About 370,000 m² of land, five plants' }, tag: 'V' },
  { ko: '파주', en: 'Paju', note: { ko: '카메라 모듈 생산(애플 공급업체 명단 FY2022)', en: 'Camera modules (Apple supplier list FY2022)' }, tag: 'V' },
  { ko: '하이퐁(베트남)', en: 'Hai Phong (Vietnam)', note: { ko: 'V3 신공장 약 15만 m²(2025-09 준공), 전체 242,600 m², 직원 약 6,500명, 2017년부터 양산', en: 'New V3 plant about 150,000 m² (Sep 2025), total 242,600 m², about 6,500 staff, mass production since 2017' }, tag: 'V2' },
  { ko: '광주', en: 'Gwangju', note: { ko: '예전 카메라 공장이었으나 지금은 모빌리티 거점. 2017년 보도의 청정실 정보는 여기서 나왔습니다', en: 'Formerly the camera plant, now a mobility base. The 2017 clean-room report came from here' }, tag: 'V' },
];

// ---------------- competitors ("다른 회사는? · How others do it"): only what the research supports ----------------
export const COMPETITORS = [
  {
    name: { ko: '기준 제조사(익명)', en: 'reference manufacturer (reference)' },
    role: { ko: '모듈 조립 + 자체 OIS 액추에이터·3D 센싱', en: 'Module assembly + own OIS actuators and 3D sensing' },
    claims: [
      { tag: 'V2', ko: '2026 상반기 모듈 2.4174억 개', en: '241.74 M modules in H1 2026' },
      { tag: 'V', ko: '청정실 "10급"·AA 독자 개발(2015–17 광주)', en: '"Class 10" clean room, in-house AA (Gwangju 2015–17)' },
    ],
  },
  {
    name: { ko: 'Sunny Optical (중국)', en: 'Sunny Optical (China)' },
    role: { ko: '렌즈 + 모듈 수직 통합', en: 'Lenses + modules, vertically integrated' },
    claims: [
      { tag: 'V2', ko: '폰 렌즈 13.24억 개(2024, 1위), 매출 RMB 382.9억', en: '1,324 M phone lenses (2024, #1); revenue RMB 38.29 B' },
      { tag: 'E', ko: '모듈 약 5.3억 개(증권사 추정, 성장률 자료 상충)', en: 'About 530 M modules (broker estimate; growth figures conflict)' },
      { tag: 'V2', ko: '애플 렌즈 공급은 2021년경부터', en: 'Apple lens supply since about 2021' },
    ],
  },
  {
    name: { ko: 'Largan (대만)', en: 'Largan (Taiwan)' },
    role: { ko: '렌즈 전문(모듈 아님). 계열사가 VCM 생산', en: 'Lenses only (not modules). A group company makes VCMs' },
    claims: [
      { tag: 'V', ko: '2024 매출 NT$594.6억, 매출총이익률 약 52.5%', en: '2024 revenue NT$59.46 B, gross margin about 52.5%' },
      { tag: 'V', ko: 'Largan Digital: VCM 설계·공정 설비 자체 개발', en: 'Largan Digital designs its own VCMs and process tooling' },
    ],
  },
  {
    name: { ko: '삼성전기 (한국)', en: 'Samsung Electro-Mechanics (Korea)' },
    role: { ko: '주로 삼성 폰용 모듈', en: 'Modules, mostly for Samsung phones' },
    claims: [
      { tag: 'V2', ko: '카메라·통신 솔루션 매출 ₩2.094조(2024 상반기)', en: 'Camera and communication revenue ₩2.094 T (H1 2024)' },
      { tag: 'V2', ko: '베트남 타이응우옌이 카메라 모듈 양산 거점', en: 'Thai Nguyen (Vietnam) is the camera-module mass-production hub' },
    ],
  },
  {
    name: { ko: 'Cowell · Luxvisions (중국)', en: 'Cowell · Luxvisions (China)' },
    role: { ko: 'Cowell: 전면 카메라 2009~, 후면 2024~. Luxvisions가 지배(한국 회사 아님)', en: 'Cowell: front cameras since 2009, rear since 2024; controlled by Luxvisions (not Korean)' },
    claims: [
      { tag: 'V', ko: 'Cowell FY2024 매출 US$24.94억(+170%)', en: 'Cowell FY2024 revenue US$2,494 M (+170%)' },
      { tag: 'V2', ko: 'Luxvisions 2025 매출 RMB 347.6억, 애플 71%, 18축 AA 설비 자체 보유', en: 'Luxvisions 2025 revenue RMB 34.76 B, 71% Apple, own 18-axis AA' },
    ],
  },
  {
    name: { ko: 'MCNEX · Partron (한국)', en: 'MCNEX · Partron (Korea)' },
    role: { ko: '폰·차량용 모듈, 삼성향 모듈', en: 'Phone and automotive modules; Samsung phone modules' },
    claims: [
      { tag: 'V2', ko: 'MCNEX 2024 매출 ₩1.057조·영업이익 ₩443억', en: 'MCNEX 2024 revenue ₩1.057 T, operating profit ₩44.3 B' },
      { tag: 'V2', ko: 'Partron 2024 매출 ₩1.4864조', en: 'Partron 2024 revenue ₩1.4864 T' },
    ],
  },
  {
    name: { ko: '폭스콘 · 샤프', en: 'Foxconn · Sharp' },
    role: { ko: '아이폰 13 시기부터 다중 카메라 조립·정렬은 폭스콘', en: 'Since the iPhone 13 cycle Foxconn does multi-camera assembly and alignment' },
    claims: [
      { tag: 'V2', ko: '샤프는 2020년경 아이폰 2위 모듈 업체였으나 2021년 이후 물러남. 위치 자료는 상충', en: 'Sharp was the second iPhone module maker about 2020 and withdrew after 2021; location sources conflict' },
    ],
  },
  {
    name: { ko: 'Foxconn Interconnect(FIT) · Truly · AAC', en: 'Foxconn Interconnect (FIT) · Truly · AAC' },
    role: { ko: '믿을 만한 자료를 찾지 못했습니다', en: 'No reliable data was found' },
    claims: [{ tag: 'G', ko: '주장하지 않습니다(자료 공백)', en: 'No claim is made (data gap)' }],
  },
  {
    name: { ko: 'Q Tech (중국)', en: 'Q Technology (China)' },
    role: { ko: '안드로이드 폰 모듈만', en: 'Android phone modules only' },
    claims: [{ tag: 'V', ko: '2024 폰 모듈 4.22억 개', en: '422 M phone modules in 2024' }],
  },
];
export const COMPETE_NOTE = {
  ko: '전체 시장(2023): 상위 4곳(기준 제조사·Sunny·폭스콘/샤프·삼성전기)이 60% 이상이라는 시장조사 추정치가 있습니다 [추정]. 공정 레이아웃을 공개한 경쟁사는 없어, 이 표는 규모와 역할만 비교합니다.',
  en: 'Market (2023): a market-research estimate says the top four (reference manufacturer, Sunny, Foxconn/Sharp, SEMCO) hold over 60% [estimate]. No competitor publishes its layout, so this table compares scale and role only.',
};

// ---------------- sources ----------------
export const SRC = [
  { id: 'R1-1', label: '기준 제조사 보도자료(2023–2025 실적)', en: 'reference manufacturer earnings releases (2023–2025)', tag: 'V' },
  { id: 'R1-7', label: 'DART 사업보고서(2차 인용): 광학 매출·비중·고객·생산능력·원재료', en: 'DART business report via secondary sources: optics revenue, share, customer, capacity, raw materials', tag: 'V2' },
  { id: 'R1-18', label: '언론 인용: 최대 고객 비중 79.6 / 80.5 / 81.1 %(2023–25)', en: 'Press: top-customer share 79.6 / 80.5 / 81.1 % (2023–25)', tag: 'V2' },
  { id: 'R1-22', label: '뉴스웨이 · DART 2차 인용: 2025 생산능력 591,411천 개, 생산 483,093천 개', en: 'Newsway and DART via secondary sources: 2025 capacity 591,411 k, output 483,093 k', tag: 'V2' },
  { id: 'R1-24', label: '뉴스웨이 2026-03-13: 가동률 2025 81.7 % · 2024 70.8 % · 2022 52.5 %', en: 'Newsway 2026-03-13: utilisation 81.7 % (2025), 70.8 % (2024), 52.5 % (2022)', tag: 'V' },
  { id: 'R1-27', label: '전자신문 2025-11-27: 광학 시설투자 3,411억 원', en: 'ETNews 2025-11-27: ₩341.1 B optics capex', tag: 'V' },
  { id: 'R1-30', label: '기준 제조사 보도자료: 구미 투자 MOU 2022 ₩1.4 T · 2025 ₩0.6 T, 베트남 ₩1.3 T(2023–25)', en: 'reference manufacturer releases: Gumi investment MOUs 2022 ₩1.4 T and 2025 ₩0.6 T, Vietnam ₩1.3 T (2023–25)', tag: 'V' },
  { id: 'S11', label: '전자신문 2017-04-06: 광주 G6 라인 — 10급 청정실, 입장 7단계, AA 독자 개발', en: 'ETNews 2017-04-06: Gwangju G6 line: class 10 clean room, 7 entry steps, in-house AA', tag: 'V' },
  { id: 'G4', label: '기준 제조사 G4 OIS 모듈 보도자료(2015, visionsystem.kr 전재): 104점·25개 패널·3 µm 틸트·0.11 mm 유리', en: 'reference manufacturer G4 OIS module release (2015, reposted): 104 points, 25 per panel, 3 µm tilt step, 0.11 mm glass', tag: 'V' },
  { id: 'S19', label: '장비 업체(Asue/Japan Finetech) AA 설비: 6축, 1,000 UPH, ±10 µm', en: 'Equipment vendor (Asue / Japan Finetech) AA: 6 axes, 1,000 UPH, ±10 µm', tag: 'V' },
  { id: 'S22', label: 'DELO 카메라 모듈 접착제: UV 0.5–1 s, 열경화 45–80 °C, 접착점 30+', en: 'DELO camera-module adhesives: UV 0.5–1 s, heat cure 45–80 °C, 30+ bond points', tag: 'V' },
  { id: 'S25', label: 'Luxvisions IPO 분석(Tencent News 2026): 18축 AA, 매출, 애플 71%', en: 'Luxvisions IPO analysis (Tencent News 2026): 18-axis AA, revenue, 71% Apple', tag: 'V2' },
  { id: 'S9', label: 'iFixit 아이폰 16 Pro 후면 카메라 교체: 나사 2개, 프레스핏 B2B 2개', en: 'iFixit iPhone 16 Pro rear camera replacement: 2 screws, 2 press-fit connectors', tag: 'V' },
  { id: 'S1', label: '애플 아이폰 16 Pro 사양: 149.6 × 71.5 × 8.25 mm, 199 g, 48 MP, F/1.78', en: 'Apple iPhone 16 Pro specs: 149.6 × 71.5 × 8.25 mm, 199 g, 48 MP, f/1.78', tag: 'V' },
  { id: 'S37', label: 'Gadgets360 / JerryRigEverything: 12 Pro Max 센서시프트 분해, 자석 4개', en: 'Gadgets360 / JerryRigEverything: 12 Pro Max sensor-shift teardown, 4 magnets', tag: 'V2' },
  { id: 'S18', label: '애플 공급업체 명단 FY2022: 파주·구미·하이퐁(기준 제조사)', en: 'Apple supplier list FY2022: Paju, Gumi, Hai Phong (reference manufacturer)', tag: 'V' },
  { id: 'S13', label: 'Korea Times 2025-09-21 · 디지털타임스: 하이퐁 V3 공장', en: 'Korea Times 2025-09-21 · Digital Times: Hai Phong V3 plant', tag: 'V2' },
  { id: 'S16', label: 'ZDNet Korea: 기준 제조사 2026 상반기 모듈 2.4174억 개, 이익률', en: 'ZDNet Korea: reference manufacturer H1 2026 modules 241.74 M, margin', tag: 'V2' },
  { id: 'S27', label: 'Sunny Optical FY2024 · 증권사 노트', en: 'Sunny Optical FY2024 and a broker note', tag: 'V2' },
  { id: 'S28-30', label: 'Cowell FY2024(MarketScreener) · Q Tech FY2024 · Largan(TWSE)', en: 'Cowell FY2024 (MarketScreener), Q Tech FY2024, Largan (TWSE)', tag: 'V' },
  { id: 'S33-34', label: 'THE ELEC · 삼성전기 글로벌 네트워크', en: 'THE ELEC; Samsung Electro-Mechanics global network', tag: 'V2' },
  { id: 'S31', label: 'Zeon COP: 굴절률 1.53, 아베수 56, 투과율 > 91 %', en: 'Zeon COP: n 1.53, Abbe 56, transmission > 91 %', tag: 'V' },
  { id: 'AI', label: '기준 제조사 보도자료(2024-05): AI 레시피 탐색 72시간 → 6시간 이하(회사 주장)', en: 'reference manufacturer release (2024-05): AI recipe search 72 h → ≤ 6 h (company claim)', tag: 'V' },
  { id: 'BEST', label: '이 페이지의 기준 라인(4,000 UPH, 단계 수율, 설비 대수): 조사 보고서 R2 §4의 가상 추정', en: 'This page\'s reference line (4,000 UPH, step yields, machine counts): best guesses in research report R2 §4', tag: 'E' },
];
export const SOURCES_NOTE = {
  ko: '주의: 광주 2015–17년 자료를 2026년 아이폰 라인으로 확대 해석하지 않았습니다. 장비 업체 사양은 벤더 주장입니다. 연구 보고서 전체(S1–S40)는 research 폴더에 있습니다.',
  en: 'Caution: 2015–17 Gwangju facts are not stretched to a 2026 iPhone line. Equipment specs are vendor claims. The full research reports (S1–S40) are in the research folder.',
};

// ---------------- plant station chips (names for the plant view) ----------------
export const BAY_LABELS = {
  recv: { ko: '1 자재·입장', en: '1 Intake' },
  smt: { ko: '2 SMT', en: '2 SMT' },
  bond: { ko: '3 다이·와이어', en: '3 Die + wire' },
  lens: { ko: '4 렌즈·VCM', en: '4 Lens + VCM' },
  aa: { ko: '5 능동 정렬', en: '5 Active align' },
  test: { ko: '6 보정·검사', en: '6 Cal + test' },
  pack: { ko: '7 포장', en: '7 Pack' },
  dock: { ko: '8 출하·폰 조립', en: '8 Dock · phone' },
};
export const ZONE_LABELS = {
  clean: { ko: '청정실 경계 (공개: 10급 [확인됨 2017] · 구역 범위는 [가정])', en: 'Clean-room boundary (public: class 10 [verified 2017]; zone extent [assumption])' },
};
export const GOWN_STEPS = [
  { ko: '가운·덧신', en: 'Gown, boots' },
  { ko: '끈끈이 롤러', en: 'Sticky roller' },
  { ko: '정전기 점검', en: 'Static test' },
  { ko: '신발 세척', en: 'Shoe wash' },
  { ko: '에어샤워', en: 'Air shower' },
  { ko: '끈끈이 롤러 2', en: 'Sticky roller 2' },
  { ko: '손 세척', en: 'Hand wash' },
];
