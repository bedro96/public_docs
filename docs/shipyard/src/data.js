// All words the page shows. Every entry is a { kr, en } pair. Numbers that come from the model are formatted here.
import { DOCK, SHIP, HULL, BLOCKS, dockVolume, floodHours, lightDraft, floatLevel, tipSpeed, radarPeriod, speedAt, ballastTonnes } from './model.js';

const n0 = (v) => Math.round(v).toLocaleString('en-US');
const n1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

export const UI = {
  title: { kr: '조선소 모형', en: 'Shipyard Model' },
  sub: { kr: '철판에서 컨테이너선까지', en: 'From steel plate to container ship' },
  tabYard: { kr: '야드', en: 'Yard' },
  tabVessel: { kr: '선박', en: 'Vessel' },
  tour: { kr: '배 만들기', en: 'Build the ship' },
  prev: { kr: '이전', en: 'Prev' },
  next: { kr: '다음', en: 'Next' },
  play: { kr: '재생', en: 'Play' },
  pause: { kr: '일시정지', en: 'Pause' },
  skip: { kr: '단계 끝으로', en: 'Skip to end of step' },
  reset: { kr: '처음부터', en: 'Restart' },
  systems: { kr: '선박 시스템', en: 'Ship systems' },
  layers: { kr: '보기 층', en: 'Layers' },
  explode: { kr: '분해', en: 'Explode' },
  ballast: { kr: '밸러스트 물', en: 'Ballast water' },
  power: { kr: '엔진 출력', en: 'Engine power' },
  focusAll: { kr: '전체 보기', en: 'Show all' },
  seeVessel: { kr: '선박 속으로', en: 'Inside the ship' },
  seeYard: { kr: '야드로 돌아가기', en: 'Back to the yard' },
  whatDoes: { kr: '하는 일', en: 'What it does' },
  keyParts: { kr: '주요 부품', en: 'Key parts' },
  keyNumber: { kr: '핵심 수치', en: 'Key number' },
  hintYard: { kr: '시설을 누르면 확대됩니다', en: 'Click a facility to zoom in' },
  hintVessel: { kr: '부품을 누르면 설명이 열립니다', en: 'Click a part to read about it' },
  stepOf: { kr: '단계', en: 'Step' },
  facilities: { kr: '시설', en: 'Facilities' },
  schematic: { kr: '도식 그림 · 축척 아님', en: 'Schematic · not to scale' },
  slow: { kr: '프로펠러는 실제보다 6배 느리게 보여 줍니다', en: 'The propeller is shown 6× slower than real' },
  reduced: { kr: '움직임 줄이기 설정을 따릅니다', en: 'Following your reduced-motion setting' },
};

export const STAGES = [
  { id: 'cut', fac: 'cutting', kr: '자재 · 절단', en: 'Plate & cutting',
    say: { kr: '창고의 강판이 절단 공장으로 옵니다. 플라즈마 토치가 도면대로 판을 잘라 냅니다.', en: 'Steel plate leaves the warehouse for the cutting shop. A plasma torch cuts it to the drawing.' } },
  { id: 'weld', fac: 'welding', kr: '용접', en: 'Welding',
    say: { kr: '잘린 판을 이어 붙여 패널을 만듭니다. 서브머지드 아크 용접과 로봇 FCAW 용접을 씁니다.', en: 'Cut plates are joined into panels with submerged-arc and robot FCAW welding.' } },
  { id: 'asm', fac: 'assembly', kr: '조립', en: 'Assembly',
    say: { kr: '패널을 소조립하고 대조립해 블록을 만듭니다. 배관과 전선도 미리 달아 둡니다(선행 의장).', en: 'Panels become sub-assemblies, then a block. Pipes and cables are fitted early (pre-outfitting).' } },
  { id: 'paint', fac: 'painting', kr: '도장', en: 'Painting',
    say: { kr: '쇼트블라스팅으로 녹과 때를 벗기고 프라이머와 도료를 칠한 뒤 말립니다.', en: 'Shot blasting strips rust, then primer and coats go on and dry.' } },
  { id: 'erect', fac: 'dock', kr: '탑재 · 건조 도크', en: 'Dock erection',
    say: { kr: '골리앗 크레인이 블록을 들어 도크에 올립니다. 용골부터 쌓고 블록끼리 용접합니다.', en: 'A goliath crane lifts each block into the dry dock. Keel first, then blocks are welded together.' } },
  { id: 'launch', fac: 'dock', kr: '주수 · 진수', en: 'Flooding & launch',
    say: { kr: '도크에 물을 채우면 배가 뜹니다. 수위가 바다와 같아지면 문을 열고 끌어냅니다.', en: 'The dock is flooded and the hull floats. When the level equals the sea, the gate opens and tugs pull her out.' } },
  { id: 'quay', fac: 'quay', kr: '안벽 의장 · 시운전', en: 'Quay outfitting & trials',
    say: { kr: '안벽에서 선실, 엔진, 전기, 항해 장비를 달고 바다에서 시운전을 합니다.', en: 'At the quay the deckhouse, engine, electrics and navigation gear go in, then the ship runs sea trials.' } },
];

const P = (kr, en) => ({ kr, en });

export const FACILITIES = {
  warehouse: {
    kr: '자재 창고', en: 'Warehouse',
    what: P('강판, 배관, 전선, 페인트, 엔진 부품을 쌓아 두었다가 공장에 정해진 때에 내어 줍니다.', 'Stores steel, pipes, cable, paint and engine parts, and releases them to the shops just in time.'),
    parts: [P('강판 야적장', 'Plate stockyard'), P('배관 랙', 'Pipe rack'), P('전선 릴', 'Cable reels'), P('페인트 드럼', 'Paint drums'), P('엔진 부품', 'Engine parts')],
    key: P('한 척에 쓰는 강재', 'Steel in one ship'), value: '≈ 40,000 t',
  },
  cutting: {
    kr: '절단 공장', en: 'Cutting shop',
    what: P('철판 위에 선을 긋고(마킹) 플라즈마·레이저로 부품 모양대로 자릅니다. 컴퓨터가 판을 빈틈없이 배치(네스팅)합니다.', 'Plates are marked, then cut to part shapes by plasma or laser. A computer nests the parts to waste little steel.'),
    parts: [P('강판 적재', 'Plate stack'), P('절단 테이블', 'Cutting table'), P('문형 갠트리', 'Portal gantry'), P('플라즈마 토치', 'Plasma torch'), P('마그넷 크레인', 'Magnet crane')],
    key: P('플라즈마 제트', 'Plasma jet'), value: '> 10,000 °C',
  },
  welding: {
    kr: '용접 공장', en: 'Welding shop',
    what: P('잘린 판을 붙여 평평한 패널과 곡면 부재를 만듭니다. 큰 이음은 서브머지드 아크(SAW), 구석은 로봇 FCAW로 용접합니다.', 'Cut plates are joined into flat panels and curved parts. Long seams use submerged-arc welding (SAW); corners use robot FCAW.'),
    parts: [P('패널 라인', 'Panel line'), P('SAW 용접 헤드', 'SAW heads'), P('용접 로봇', 'Welding robot'), P('플럭스 호퍼', 'Flux hopper'), P('가스 실린더', 'Gas cylinders')],
    key: P('강철이 녹는 온도', 'Steel melts at'), value: '≈ 1,500 °C',
  },
  assembly: {
    kr: '조립 공장', en: 'Assembly shop',
    what: P('패널을 소조립 → 대조립(블록)으로 키우고, 배관·전선·장비를 미리 달아 블록을 거의 완성합니다.', 'Panels grow from sub-assembly into a block, with pipes, cables and fittings added early so the block is nearly finished.'),
    parts: [P('소조립 지그', 'Sub-assembly jigs'), P('블록 정반', 'Block bed'), P('천장 크레인', 'Bridge crane'), P('비계', 'Scaffolding'), P('선행 의장품', 'Pre-outfit parts')],
    key: P('블록 한 개', 'One block'), value: '500–900 t',
  },
  painting: {
    kr: '도장 공장', en: 'Painting shop',
    what: P('쇼트블라스팅(강철 알갱이를 쏴 녹 제거)으로 깨끗이 한 뒤 프라이머와 도료를 뿌리고 건조실에서 굳힙니다.', 'Shot blasting (steel grit) removes rust, then primer and coats are sprayed and dried in a heated bay.'),
    parts: [P('쇼트블라스팅', 'Shot blasting'), P('집진기', 'Dust collector'), P('스프레이 로봇', 'Spray robot'), P('건조 구역', 'Drying bay'), P('도료 탱크', 'Paint tank')],
    key: P('도막 두께', 'Coating thickness'), value: '≈ 300 µm',
  },
  dock: {
    kr: '건조 도크', en: 'Dry dock',
    what: P('물을 뺀 거대한 수조입니다. 블록을 골리앗 크레인으로 올려 쌓고 용접한 뒤 물을 채워 배를 띄웁니다(진수). 주수 시간은 빈 도크의 부피를 유입량으로 나눈 근삿값이며, 실제로는 배가 밀어낸 물만큼 조금 더 빨리 찹니다.', 'A huge basin drained of water. Blocks are lifted in, welded, and the dock is flooded so the ship floats (launch). The flooding time is an empty-basin estimate (volume divided by inflow); in reality the hull displaces some water, so the dock fills a little faster.'),
    parts: [P('골리앗 크레인', 'Goliath crane'), P('용골 받침', 'Keel blocks'), P('도크 문(게이트)', 'Dock gate'), P('블록 탑재', 'Block erection'), P('주수 배관', 'Filling culverts')],
    key: P('주수 시간 (빈 도크 근삿값)', 'Time to flood (empty-basin estimate)'), value: `≈ ${n1(floodHours())} h`,
  },
  quay: {
    kr: '안벽', en: 'Quay',
    what: P('진수한 배를 묶어 두고 선실, 엔진, 전기, 항해 장비를 설치하는 부두입니다(안벽 의장). 끝나면 바다에서 시운전을 합니다.', 'The berth where the floating ship is moored and fitted out with deckhouse, engine, electrics and navigation gear, before sea trials.'),
    parts: [P('지브 크레인', 'Jib crane'), P('계선주(볼라드)', 'Bollards'), P('방현재', 'Fenders'), P('선실 블록', 'Deckhouse block')],
    key: P('시운전 속도', 'Trial speed'), value: `${SHIP.designSpeed} kn`,
  },
  crane: {
    kr: '골리앗 크레인', en: 'Goliath crane',
    what: P('도크 양쪽 레일 위를 달리는 문형 크레인입니다. 트롤리가 가로로, 훅이 위아래로 움직여 블록을 정확히 내려놓습니다.', 'A portal crane running on rails along the dock. The trolley moves across and the hook up and down to set each block exactly.'),
    parts: [P('다리', 'Legs'), P('거더', 'Girder'), P('트롤리', 'Trolley'), P('훅 블록', 'Hook block')],
    key: P('들어올리는 힘', 'Lifting capacity'), value: `${HULL.craneCapacity} t`,
  },
  hull: {
    kr: '건조 중인 선체', en: 'Hull under construction',
    what: P(`선체는 블록을 쌓아 만듭니다. 용골(배의 등뼈)부터 시작해 배 앞뒤로 블록을 올립니다. 그림에는 이해하기 쉽도록 대표 블록 ${BLOCKS.length}개만 그렸고, 실제 300 m급 배는 약 ${HULL.realBlocks}개의 블록(각 300–900 t)으로 만듭니다. 표시된 무게는 대표 블록 한 개의 무게이며 선체 전체(약 ${n0(DOCK.lightship)} t)의 합이 아닙니다.`, `The hull is stacked from blocks, beginning with the keel (the ship's backbone) and working toward bow and stern. To keep the picture readable it shows ${BLOCKS.length} representative blocks; a real 300 m ship is built from about ${HULL.realBlocks} blocks of 300–900 t each. The masses shown are for one representative block, not a share of the whole hull (about ${n0(DOCK.lightship)} t).`),
    parts: BLOCKS.map((b, i) => HULL.names[i]).map((h) => P(h.kr, h.en)),
    key: P('진수 때의 흘수', 'Draft at launch'), value: `${n1(lightDraft())} m`,
  },
};

export const SYSTEMS = {
  hull: {
    kr: '선체', en: 'Hull',
    what: P('물에 뜨고 짐을 싣고 파도를 견디는 강철 상자입니다. 이중저, 밸러스트 탱크, 격벽과 늑골이 구조를 이룹니다.', 'The steel box that floats, carries cargo and resists waves. Double bottom, ballast tanks, bulkheads and frames make the structure.'),
    parts: [P('이중저', 'Double bottom'), P('밸러스트 탱크', 'Ballast tank'), P('격벽', 'Bulkhead'), P('늑골', 'Frames')],
    key: P('이중저 높이', 'Double-bottom height'), value: `${SHIP.doubleBottom} m`,
  },
  engine: {
    kr: '기관 · 추진', en: 'Engine & propulsion',
    what: P('저속 2행정 디젤 엔진이 축으로 프로펠러를 직접 돌립니다. 프로펠러가 물을 뒤로 밀어 배를 앞으로 보냅니다.', 'A slow two-stroke diesel turns the propeller directly through a shaft. The propeller pushes water aft and the ship moves ahead.'),
    parts: [P('주기관', 'Main engine'), P('추진축', 'Shaft'), P('프로펠러', 'Propeller'), P('방향타', 'Rudder')],
    key: P('주기관 출력', 'Main engine power'), value: `${n0(SHIP.mcr / 1000)} MW @ ${SHIP.mcrRpm} rpm`,
  },
  nav: {
    kr: '항해 장비', en: 'Navigation',
    what: P('선교에서 레이더, GPS, ECDIS 전자해도, AIS로 위치와 주변 배를 보고, 자이로컴퍼스와 자동조타기로 항로를 지킵니다.', 'On the bridge, radar, GPS, ECDIS charts and AIS show position and nearby ships; the gyrocompass and autopilot hold the course.'),
    parts: [P('선교', 'Bridge'), P('레이더', 'Radar'), P('ECDIS', 'ECDIS'), P('자이로컴퍼스', 'Gyrocompass'), P('자동조타기', 'Autopilot')],
    key: P('레이더 회전', 'Radar sweep'), value: `${SHIP.radarRpm} rpm · ${n1(radarPeriod())} s`,
  },
  elec: {
    kr: '전기 시스템', en: 'Electrical',
    what: P('발전기 3대가 전기를 만들어 주배전반으로 보내고, 전선 트레이를 따라 펌프, 조명, 냉동 컨테이너로 나눕니다. 비상발전기가 정전에 대비합니다.', 'Three generators feed the main switchboard; cable trays share power with pumps, lights and reefer containers. An emergency generator covers a blackout.'),
    parts: [P('발전기', 'Generators'), P('주배전반', 'Main switchboard'), P('전선 트레이', 'Cable trays'), P('비상발전기', 'Emergency generator')],
    key: P('발전기', 'Generators'), value: `${SHIP.gens} × ${n0(SHIP.genKw)} kW`,
  },
  other: {
    kr: '화물 · 거주 · 안전', en: 'Cargo, living & safety',
    what: P('컨테이너를 싣는 화물창, 선원이 사는 거주구와 공조(HVAC), 연료·밸러스트 배관, 구명정과 닻이 있습니다.', 'Cargo holds for containers, the crew accommodation and HVAC, fuel and ballast piping, the lifeboat and anchor.'),
    parts: [P('화물창', 'Cargo hold'), P('거주구 · 공조', 'Accommodation · HVAC'), P('배관', 'Piping'), P('구명정', 'Lifeboat')],
    key: P('적재량', 'Capacity'), value: `${n0(SHIP.teu)} TEU`,
  },
};

// Clickable parts of the ship, each belongs to one system and has its own small card.
export const ITEMS = {
  'double-bottom': { sys: 'hull', kr: '이중저', en: 'Double bottom',
    what: P('배 바닥을 두 겹으로 만든 구조입니다. 사이 공간은 밸러스트 물이나 연료를 담고, 바깥 판이 찢어져도 안쪽 바닥이 한 번 더 바닷물을 막아 줍니다.', 'A two-layer ship bottom. The space between holds ballast water or fuel, and if the outer plate is torn the inner bottom is a second barrier against the sea.'),
    key: P('높이', 'Height'), value: `${SHIP.doubleBottom} m` },
  'ballast': { sys: 'hull', kr: '밸러스트 탱크', en: 'Ballast tank',
    what: P('물을 채우고 빼서 배의 무게와 균형을 조절합니다. 짐이 없을 때는 물을 채워 프로펠러가 물에 잠기게 합니다.', 'Filled or emptied with seawater to trim weight and balance. With no cargo, water ballast keeps the propeller deep enough.'),
    key: P('용량', 'Capacity'), value: `≈ ${n0(SHIP.ballastT)} t` },
  'bulkhead': { sys: 'hull', kr: '격벽', en: 'Bulkhead',
    what: P('배를 가로로 나누는 튼튼한 벽입니다. 한 칸이 새어도 물이 다른 칸으로 번지는 것을 막아 가라앉을 위험을 줄입니다. 얼마나 버티는지는 배의 손상 복원성 설계에 달려 있습니다.', 'A strong transverse wall dividing the ship. If one compartment floods, the wall holds the water back and lowers the risk of sinking. How well a damaged ship stays afloat depends on its damage-stability design.'),
    key: P('가로 격벽', 'Transverse'), value: '5' },
  'hull-shell': { sys: 'hull', kr: '외판', en: 'Shell plating',
    what: P('배의 옆면과 바닥을 이루는 두꺼운 강판입니다. 블록을 용접으로 이어 붙여 물이 새지 않는 한 덩어리로 만듭니다.', 'The thick steel plates forming the sides and bottom. Welded blocks join into one watertight skin.'),
    key: P('판 두께', 'Plate thickness'), value: '≈ 25 mm' },
  'frames': { sys: 'hull', kr: '늑골(프레임)', en: 'Frames',
    what: P('외판 안쪽에 일정 간격으로 붙인 갈비뼈 모양 보강재입니다. 바깥 판이 물 압력에 찌그러지지 않게 받칩니다.', 'Rib-like stiffeners fixed to the inside of the shell at regular spacing. They stop the plating from buckling under water pressure.'),
    key: P('간격', 'Spacing'), value: `${SHIP.frame} m` },
  'main-engine': { sys: 'engine', kr: '주기관', en: 'Main engine',
    what: P('실린더가 아래로 한 번 눌러 힘을 내는 저속 2행정 디젤입니다. 크랭크축이 곧바로 프로펠러 축에 연결되어 기어가 없습니다.', 'A slow two-stroke diesel: each piston gives a power stroke every turn. Its crankshaft joins the propeller shaft directly, with no gearbox.'),
    key: P('실린더', 'Cylinders'), value: `${SHIP.cyl} × Ø ${Math.round(SHIP.bore * 1000)} mm` },
  'shaft': { sys: 'engine', kr: '추진축', en: 'Propeller shaft',
    what: P('엔진의 회전력을 프로펠러까지 전하는 긴 강철 축입니다. 축받이가 떠받치고, 선미관이 바닷물을 막습니다.', 'A long steel shaft carrying engine torque to the propeller, held by bearings, with a stern tube that keeps the sea out.'),
    key: P('회전수', 'Speed'), value: `${SHIP.mcrRpm} rpm` },
  'propeller': { sys: 'engine', kr: '프로펠러', en: 'Propeller',
    what: P('비틀어진 날개 5장이 물을 뒤로 밀어 앞으로 가는 힘(추력)을 만듭니다. 지금 화면의 회전은 실제보다 6배 느립니다.', 'Five twisted blades push water aft to make thrust. The spin on screen is 6× slower than real.'),
    key: P('날개 끝 속도', 'Tip speed'), value: `${n1(tipSpeed(SHIP.mcrRpm))} m/s` },
  'rudder': { sys: 'engine', kr: '방향타', en: 'Rudder',
    what: P('프로펠러 뒤의 큰 판입니다. 각도를 바꾸면 물 흐름이 휘어 배가 방향을 바꿉니다. 조타기가 유압으로 돌립니다.', 'A large plate behind the propeller. Turning it bends the water flow so the ship turns; a hydraulic steering gear moves it.'),
    key: P('최대 각도', 'Max angle'), value: '± 35°' },
  'bridge': { sys: 'nav', kr: '선교', en: 'Bridge',
    what: P('배를 조종하는 지휘소입니다. 창이 넓고 높아 바다가 잘 보이며 항해 장비가 모여 있습니다.', 'The command centre. Wide high windows give a clear view and the navigation equipment is gathered here.'),
    key: P('눈높이', 'Eye height'), value: '≈ 35 m' },
  'radar': { sys: 'nav', kr: '레이더 · 안테나', en: 'Radar & antennas',
    what: P('안테나가 돌며 전파를 쏘고 반사된 신호로 다른 배와 육지를 찾습니다. GPS 안테나는 위성으로 위치를, AIS는 서로의 신원과 속도를 알려 줍니다.', 'The scanner turns, sends radio pulses and finds ships and land from echoes. GPS finds position from satellites; AIS swaps identity and speed with other ships.'),
    key: P('한 바퀴', 'One sweep'), value: `${n1(radarPeriod())} s` },
  'ecdis': { sys: 'nav', kr: 'ECDIS · 자이로 · 자동조타', en: 'ECDIS, gyro, autopilot',
    what: P('전자해도(ECDIS)가 위치와 항로를 보여 주고, 자이로컴퍼스는 진북을 가리키며, 자동조타기가 이를 읽어 방향타를 움직입니다.', 'ECDIS shows position on the chart, the gyrocompass points to true north, and the autopilot reads both to steer the rudder.'),
    key: P('항로 유지', 'Holds course'), value: '± 0.5°' },
  'generators': { sys: 'elec', kr: '발전기', en: 'Generators',
    what: P('작은 디젤 엔진이 발전기를 돌려 전기를 만듭니다. 필요한 전력에 따라 한 대, 두 대 켜 둡니다.', 'Small diesel engines drive alternators. One, two or three run, depending on the power needed.'),
    key: P('한 대 출력', 'Each'), value: `${n0(SHIP.genKw)} kW` },
  'switchboard': { sys: 'elec', kr: '주배전반', en: 'Main switchboard',
    what: P('발전기의 전기를 모아 각 설비로 나누는 큰 제어반입니다. 차단기가 과전류를 끊어 줍니다.', 'The big panel that gathers generator power and shares it out. Breakers cut off an overload.'),
    key: P('전압 · 주파수', 'Voltage · Hz'), value: `${n0(SHIP.volts)} V · ${SHIP.hz} Hz` },
  'cables': { sys: 'elec', kr: '전선 트레이', en: 'Cable trays',
    what: P('수백 킬로미터의 전선을 정리해 얹는 금속 받침입니다. 불이 번지지 않는 난연 케이블을 씁니다.', 'Metal trays that carry hundreds of kilometres of cable in order. Flame-retardant cable keeps a fire from spreading.'),
    key: P('케이블 길이', 'Cable length'), value: '≈ 400 km' },
  'emergency': { sys: 'elec', kr: '비상발전기', en: 'Emergency generator',
    what: P('주전원이 모두 꺼져도 몇 초 안에 켜지는 작은 발전기입니다. 기관실에 불이 나도 영향을 받지 않도록 기관실과 떨어진 높은 갑판에 따로 둡니다.', 'A small generator that starts within seconds if all main power fails. It sits on a high deck, separated from the engine room, so an engine-room fire does not stop it.'),
    key: P('출력', 'Output'), value: `${SHIP.emerKw} kW` },
  'cargo': { sys: 'other', kr: '화물창', en: 'Cargo hold',
    what: P('컨테이너를 쌓는 칸입니다. 셀 가이드 기둥이 상자를 맞춰 주고 윗갑판 위에도 더 얹습니다.', 'The bays that take containers. Cell guides line each box up, and more are stacked on deck above.'),
    key: P('적재', 'Capacity'), value: `${n0(SHIP.teu)} TEU` },
  'house': { sys: 'other', kr: '거주구 · 공조', en: 'Accommodation & HVAC',
    what: P('선원 숙소, 식당, 사무실이 있는 건물입니다. 공조(HVAC) 장치가 바닷가 더위와 추위를 막아 줍니다.', 'The block with cabins, mess and offices. HVAC units keep the heat and cold of the sea out.'),
    key: P('층수', 'Decks'), value: '6' },
  'anchor': { sys: 'other', kr: '닻 · 윈들러스', en: 'Anchor & windlass',
    what: P('뱃머리의 윈들러스가 쇠사슬로 닻을 내리고 올립니다. 닻이 바닥을 물어 배가 바람과 물결에 밀리지 않게 잡아 줍니다.', 'At the bow a windlass pays out and hauls the anchor chain. The anchor bites the sea bed and holds the ship against wind and current.'),
    key: P('닻 한 개', 'One anchor'), value: '≈ 20 t' },
  'piping': { sys: 'other', kr: '연료 · 밸러스트 배관', en: 'Fuel & ballast piping',
    what: P('펌프와 밸브가 연료와 밸러스트 물을 탱크에서 엔진이나 바다로 보냅니다. 색으로 용도를 구분합니다.', 'Pumps and valves send fuel and ballast water between tanks, engine and sea. Colours show what each pipe carries.'),
    key: P('종류', 'Systems'), value: '2' },
  'lifeboat': { sys: 'other', kr: '구명정', en: 'Lifeboat',
    what: P('선미 쪽에 달린 자유낙하식 구명정입니다. 비상시 선원 전원이 타고 미끄럼틀로 바다에 떨어져 나갑니다.', 'A free-fall lifeboat at the stern. In an emergency the whole crew boards and it slides off into the sea.'),
    key: P('탑승', 'Seats'), value: '≈ 25' },
};

export const ITEM_ORDER = Object.keys(ITEMS);
export const SYSTEM_ORDER = ['hull', 'engine', 'nav', 'elec', 'other'];

// What the card says before any part is picked in the vessel view.
export const VESSEL_INTRO = {
  kr: SHIP.kind.kr, en: SHIP.kind.en,
  what: P('컨테이너선은 규격 상자(컨테이너)를 높이 쌓아 바다를 건넙니다. 가까운 쪽 반을 잘라 낸 단면으로 선체, 기관, 전기, 항해 장비를 한눈에 볼 수 있습니다. 부품이나 시스템을 눌러 보세요.', 'A container ship carries standard boxes in tall stacks across the ocean. The near half is cut away so hull, engine, electrics and navigation show at once. Pick a part or a system to read about it.'),
  key: P('길이 × 폭', 'Length × beam'), value: `${SHIP.loa} m × ${SHIP.beam} m`,
};
