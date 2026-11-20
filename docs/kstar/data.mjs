export const sources = {
  results: ["한국핵융합에너지연구원(KFE) · KSTAR 운전 성과", "연도별 이온온도 유지 시간과 H-모드 운전 성과", "https://www.kfe.re.kr/menu.es?mid=a20202040100"],
  record: ["KFE / 국가과학기술연구회 · 48초와 102초", "2024.03.28 · 이온온도 기록, H-모드 기록, 300초 목표, 텅스텐 디버터", "https://www.eurekalert.org/news-releases/1039244"],
  magnets: ["KFE · KSTAR 장치 소개", "건설 기간, 장치 크기, 헬륨·가열·진단 설비", "https://www.kfe.re.kr/menu.es?mid=a20202030200"],
  tokamak: ["ITER · What is a tokamak?", "진공 용기, 플라스마, 토카막 자기 가둠", "https://www.iter.org/machine/what-tokamak"],
  coils: ["ITER · Magnets", "초전도 코일의 원리와 TF·PF·중앙 솔레노이드의 역할", "https://www.iter.org/machine/magnets"],
  divertor: ["ITER · Divertor", "플라스마 가장자리의 열과 입자를 받아 내보내는 부품", "https://www.iter.org/machine/divertor"],
  nature: ["Han 외 · Nature 609, 269–275", "2022 · 빠른 이온과 내부 수송 장벽을 이용한 KSTAR 고온 운전 연구", "https://doi.org/10.1038/s41586-022-05008-1"],
  feedback: ["Ko 외 · Nuclear Fusion 64, 112010", "2024 · KSTAR 고온 시나리오, 실시간 진단·기계학습·피드백 실험", "https://www.osti.gov/servlets/purl/2441286"],
  overview: ["KSTAR 연구진 · Nuclear Fusion 66, 116015", "2026.11 · 텅스텐 환경의 손실, 방전 예측·열속 제어, 후속 계획", "https://snu.elsevierpure.com/en/publications/overview-of-the-kstar-experiments-and-future-plan/"],
  tungsten: ["KFE · KSTAR–EU 공동연구 착수", "2026.08 · 장시간 운전 공동연구 및 장치 내부 텅스텐 확대 계획", "https://www.kfe.re.kr/board.es?mid=a20402000000&bid=0026&act=view&list_no=19761"],
  east: ["ITER · Achievements at EAST and WEST", "2025.02 · EAST의 고가둠 운전과 장시간 운전의 제어 과제", "https://www.iter.org/node/20687/achievements-east-and-west"],
  west: ["CEA · WEST plasma-duration result", "2025.02 · WEST의 1,337초 수소 플라스마 방전", "https://www.cea.fr/drf/english/Pages/News/Scientific-results/2025/nuclear-fusion-west-beats-the-world-record-for-plasma-duration.aspx"],
  jet: ["UKAEA · JET final deuterium–tritium experiments", "2024.02 · JET의 중수소–삼중수소 핵융합 에너지 실험", "https://www.gov.uk/government/news/jets-final-tritium-experiments-yield-new-fusion-energy-record"],
  iter: ["ITER · Goals and FAQs", "핵융합 이득 Q의 정의, ITER의 설계 목표, 전기 생산 여부", "https://www.iter.org/faqs"],
};

export const parts = [
  { id: "vessel", title: "진공 용기", technical: "VACUUM VESSEL", info: "플라스마가 도는 도넛형 밀폐 공간입니다. 기체를 미리 빼면 불순물이 줄고, 포트로 연료 주입·가열·관측 장치를 연결할 수 있습니다. 앞쪽은 내부를 보기 위해 그림에서만 잘라 냈습니다.", refs: ["magnets", "tokamak"] },
  { id: "tf", title: "토로이달 자기장 코일", technical: "TF · TOROIDAL FIELD", info: "용기를 둘러싼 D자형 초전도 코일은 도넛의 큰 둘레를 따라가는 주 자기장을 만듭니다. 초전도체는 극저온에서 저항 없이 전류를 흘릴 수 있어, 자석 자체의 저항 발열을 줄입니다. 냉각에는 여전히 에너지가 듭니다.", refs: ["magnets", "coils"] },
  { id: "pf", title: "폴로이달 자기장 코일", technical: "PF · POLOIDAL FIELD", info: "수평 고리로 보이는 외부 코일은 플라스마의 위치와 단면 모양을 조절합니다. 플라스마 전류가 만드는 폴로이달 장과 함께 전체 자기장 구조를 정합니다. 그림은 코일 배치를 단순화했습니다.", refs: ["coils", "tokamak"] },
  { id: "cs", title: "중앙 솔레노이드", technical: "CS · CENTRAL SOLENOID", info: "가운데 세로 자석은 변압기의 1차 코일처럼 작동합니다. 변화하는 자속이 고리 방향의 플라스마 전류를 유도합니다. 이 방식만으로 전류를 무한히 유지할 수는 없어 장시간 운전에는 비유도 전류 구동 연구도 중요합니다.", refs: ["coils", "record"] },
  { id: "divertor", title: "텅스텐 디버터", technical: "W · DIVERTOR", info: "가장자리의 열린 자기력선을 따라 빠져나가는 열과 입자가 아래쪽 표적에 도달합니다. 열은 냉각수가 빼내고 입자는 배기 계통이 처리합니다. KSTAR는 2023년 이 표적을 텅스텐 모노블록으로 바꿨습니다.", refs: ["divertor", "record"] },
  { id: "plasma", title: "플라스마와 관측", technical: "PLASMA · DIAGNOSTICS", info: "빛나는 고리는 금속 부품이 아니라 이온과 전자가 섞인 플라스마입니다. 계측 장치는 밀도·온도·위치·불안정성 등을 관측해 제어에 필요한 정보를 제공합니다. 1억 °C는 플라스마 이온온도 기준이지 진공 용기 벽의 온도가 아닙니다.", refs: ["record", "feedback"] },
];

export const steps = [
  { id: "seed", short: "플라스마 만들기", title: "기체를 이온과 전자로 나눈다", track: "진공 용기 · 초기 플라스마", info: "진공 용기에 소량의 수소계 기체를 넣고 이온화하면 플라스마가 생깁니다. 중앙 솔레노이드의 자속을 변화시키면 플라스마에 도넛 방향의 전류가 유도됩니다.", note: "그림은 개념도입니다. 궤적, 비율과 재생 시간은 실제 방전 데이터가 아닙니다.", refs: ["tokamak"] },
  { id: "toroidal", short: "둘레 방향", title: "큰 둘레를 따라 토로이달 장을 만든다", track: "토로이달 방향 · 큰 둘레", info: "D자형 코일이 만드는 주 자기장은 도넛의 큰 둘레를 따라갑니다. 전하를 띤 이온과 전자는 자기력선 주위를 감아 돌면서 대체로 그 선을 따라 움직입니다.", note: "자석이 입자를 중앙으로 끌어당기는 것이 아닙니다. 전하의 움직임을 휘게 해 자기장을 가로지르는 이동을 어렵게 만듭니다.", refs: ["tokamak"] },
  { id: "helical", short: "꼬인 자기장", title: "두 방향이 합쳐져 자기력선이 꼬인다", track: "토로이달 + 폴로이달 · 나선형", info: "플라스마 전류가 단면을 감는 폴로이달 성분을 만들고, 외부 PF 코일은 위치와 모양을 조절합니다. 두 방향을 합친 자기력선은 큰 둘레와 작은 단면을 함께 감으며 겹겹의 자기면을 이룹니다.", note: "꼬임은 장의 세기와 곡률 차이에서 오는 입자의 쏠림이 한쪽에 누적되는 것을 줄입니다. 그래도 난류와 불안정성에 의한 손실은 남습니다.", refs: ["tokamak"] },
  { id: "control", short: "가열과 제어", title: "열을 보충하고 모양이 흐트러지면 바로잡는다", track: "외부 가열 · 측정과 보정", info: "중성입자빔과 전자 사이클로트론 가열은 플라스마에 에너지를 전달합니다. 진단 신호를 받은 제어기는 코일 등을 조절해 위치와 모양을 유지합니다.", note: "KSTAR는 고가둠 상태로 들어서는 순간을 기계학습으로 감지하고, 그 신호로 가장자리 불안정성을 줄이는 코일을 작동시키는 실험도 했습니다.", refs: ["magnets", "feedback"] },
  { id: "exhaust", short: "열과 입자 배출", title: "가장자리의 열과 입자를 디버터로 보낸다", track: "경계 바깥 · 디버터 방향", info: "플라스마 중심부는 닫힌 자기면 안에 있지만, 경계 바깥의 일부 힘선은 아래쪽 디버터 표적에 닿습니다. 그곳에서 열은 냉각 계통으로, 빠져나온 입자는 배기 계통으로 보냅니다.", note: "장시간 운전에서는 열이 누적되고, 벽에서 나온 텅스텐이 플라스마 안으로 들어가 복사 손실을 키우는지도 살펴야 합니다.", refs: ["divertor", "east", "tungsten"] },
];

export const records = [
  { year: 2018, seconds: 2 },
  { year: 2019, seconds: 8 },
  { year: 2020, seconds: 20 },
  { year: 2021, seconds: 30 },
  { year: 2024, seconds: 48 },
  { year: "목표", seconds: 300, goal: true },
];
export const hMode = 102;

export const peers = [
  { name: "KSTAR", site: "한국 · KFE", stat: "48초", metric: "중심 이온온도 1억 °C · 2024", note: "초전도 자석, 고온 플라스마 운전과 제어, 텅스텐 디버터를 한 장치에서 시험합니다. 별도의 고가둠(H-모드) 기록은 102초입니다.", refs: ["record", "nature"] },
  { name: "EAST", site: "중국 · ASIPP", stat: "1,066초", metric: "H-모드 · 2025", note: "KSTAR와 같은 초전도 토카막입니다. ITER가 전한 이 방전의 온도는 약 7천만 °C입니다. 이온온도 1억 °C 유지 기록과 같은 조건이 아닙니다.", refs: ["east"] },
  { name: "WEST", site: "프랑스 · CEA", stat: "1,337초", metric: "수소 플라스마 방전 · 2025", note: "텅스텐 환경에서 장시간 벽·열 관리를 시험합니다. CEA는 약 5천만 도라고 설명하며, 발표는 1억 °C 이온온도나 H-모드 1,337초를 주장하지 않습니다.", refs: ["west"] },
  { name: "JET", site: "영국 · UKAEA", stat: "69 MJ", metric: "D–T 핵융합 에너지 · 2024 발표", note: "중수소·삼중수소의 실제 핵융합 에너지를 약 5초에 걸쳐 측정했습니다. KSTAR가 기록한 이온온도 유지 시간과는 단위도 질문도 다릅니다.", refs: ["jet"] },
  { name: "ITER", site: "프랑스 · 국제 공동사업", stat: "Q ≥ 10", metric: "플라스마 핵융합 이득 · 설계 목표", note: "외부 플라스마 가열 50 MW로 핵융합 출력 500 MW를 내는 설계 목표입니다. 실측 기록이나 발전소 순전력 수치가 아닙니다.", refs: ["iter"] },
];
