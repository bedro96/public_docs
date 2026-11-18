// Educational content. Every string is bilingual {kr, en}.
// Facts are simplified for middle-school level and use commonly quoted adult averages.
// Pin coordinates are in BODY space (y up, x toward the viewer's right = patient's left).

export const GROUPS = [
  { id: 'tract', kr: '소화관', en: 'Digestive tract' },
  { id: 'helper', kr: '소화를 돕는 기관', en: 'Accessory organs' },
  { id: 'other', kr: '그 밖의 기관', en: 'Other organs' },
];

export const ORGANS = [
  {
    id: 'mouth', group: 'tract', kr: '입', krSub: '구강', en: 'Mouth', enSub: 'oral cavity',
    color: '#c9695f', trayCol: 'L', traySlot: 0,
    role: {
      kr: '이로 음식을 잘게 씹고 침과 섞어 삼키기 좋은 덩어리로 만듭니다.',
      en: 'Teeth chew food into small pieces. Saliva mixes in and makes a soft ball that is easy to swallow.',
    },
    digest: {
      kr: '침 속의 아밀레이스가 녹말을 엿당으로 분해하기 시작합니다.',
      en: 'Amylase in saliva starts to break starch down into the sugar maltose.',
    },
    facts: [
      { kr: '어른의 이는 사랑니를 포함해 최대 32개입니다.', en: 'An adult has up to 32 teeth, including wisdom teeth.' },
      { kr: '침샘은 하루에 약 0.5~1.5 L의 침을 만듭니다.', en: 'Salivary glands make about 0.5–1.5 L of saliva a day.' },
    ],
    pins: [
      { kr: '치아', en: 'Teeth', p: [0.0, 7.12, 0.96] },
      { kr: '혀', en: 'Tongue', p: [0.0, 6.95, 0.55] },
      { kr: '침샘', en: 'Salivary gland', p: [-0.86, 7.0, -0.1] },
    ],
  },
  {
    id: 'esophagus', group: 'tract', kr: '식도', en: 'Esophagus',
    color: '#c97a68', trayCol: 'R', traySlot: 0,
    role: {
      kr: '입과 위를 잇는 길이 약 25 cm의 근육 관입니다.',
      en: 'A muscular tube about 25 cm long that joins the mouth to the stomach.',
    },
    digest: {
      kr: '근육이 물결처럼 오므라들며 음식을 아래로 밀어 보냅니다. 이를 연동 운동이라고 합니다. 거꾸로 서 있어도 음식이 위로 내려갑니다.',
      en: 'Waves of squeezing muscle, called peristalsis, push food down. It works even when you stand on your head.',
    },
    facts: [
      { kr: '음식이 식도를 지나는 데 약 5~8초가 걸립니다.', en: 'Food needs about 5–8 seconds to pass through.' },
      { kr: '식도 아래쪽의 근육 고리가 위의 내용물이 올라오지 못하게 막습니다.', en: 'A ring of muscle at the bottom keeps stomach contents from rising back up.' },
    ],
    pins: [
      { kr: '인두', en: 'Pharynx', p: [0.0, 6.7, 0.12] },
      { kr: '식도 벽', en: 'Muscular wall', p: [0.0, 4.9, 0.02] },
      { kr: '식도 아래 조임근', en: 'Lower sphincter', p: [0.38, 2.95, 0.18] },
    ],
  },
  {
    id: 'stomach', group: 'tract', kr: '위', en: 'Stomach',
    color: '#e0a07f', trayCol: 'R', traySlot: 2,
    role: {
      kr: '음식을 저장하고 휘저어 죽처럼 만드는 주머니 모양의 근육 기관입니다.',
      en: 'A stretchy muscular bag that stores food and churns it into a thick liquid.',
    },
    digest: {
      kr: '위액(염산과 펩신)이 단백질 소화를 시작하고 세균을 죽입니다. 음식은 유미즙이 되어 조금씩 소장으로 내려갑니다.',
      en: 'Gastric juice (hydrochloric acid and pepsin) starts protein digestion and kills many germs. The food becomes chyme and leaves in small squirts.',
    },
    facts: [
      { kr: '비어 있을 때는 주먹만 하지만 약 1~1.5 L까지 늘어납니다.', en: 'Empty, it is fist-sized, but it can stretch to hold about 1–1.5 L.' },
      { kr: '위산은 pH 1.5~3.5 정도로 매우 강하며, 두꺼운 점액이 위벽을 지켜 줍니다.', en: 'Stomach acid is very strong (pH about 1.5–3.5). A thick layer of mucus protects the wall.' },
    ],
    pins: [
      { kr: '분문', en: 'Cardia', p: [0.5, 2.85, 0.45] },
      { kr: '위저부', en: 'Fundus', p: [0.75, 3.1, 0.35] },
      { kr: '위체부', en: 'Body', p: [1.1, 2.15, 0.4] },
      { kr: '유문', en: 'Pylorus', p: [-0.22, 1.72, 0.45] },
    ],
  },
  {
    id: 'smallint', group: 'tract', kr: '소장', krSub: '작은창자', en: 'Small intestine',
    color: '#e8aa9c', trayCol: 'R', traySlot: 5,
    role: {
      kr: '십이지장, 공장, 회장으로 이루어진 길이 약 6 m의 가는 관입니다. 소화와 흡수의 대부분이 여기서 일어납니다.',
      en: 'A thin tube about 6 m long made of the duodenum, jejunum and ileum. Most digestion and absorption happens here.',
    },
    digest: {
      kr: '십이지장에서 쓸개즙과 이자액이 음식과 섞여 탄수화물, 단백질, 지방이 가장 작은 영양소로 분해됩니다. 영양소는 장 안쪽의 융털로 흡수됩니다.',
      en: 'Bile and pancreatic juice join the food in the duodenum. Carbohydrates, proteins and fats break into the smallest nutrients, which villi absorb.',
    },
    facts: [
      { kr: '안쪽 주름과 융털 덕분에 흡수 면적이 약 30 m²나 됩니다.', en: 'Folds and villi give it an absorbing surface of about 30 m².' },
      { kr: '음식물은 소장에서 대략 3~5시간 머뭅니다.', en: 'Food stays in the small intestine for roughly 3–5 hours.' },
    ],
    pins: [
      { kr: '십이지장', en: 'Duodenum', p: [-0.72, 1.35, 0.2] },
      { kr: '공장', en: 'Jejunum', p: [0.6, 0.52, 0.34] },
      { kr: '회장', en: 'Ileum', p: [-0.55, -0.08, 0.3] },
    ],
    note: {
      kr: '모형은 보기 쉽도록 짧게 줄여 그렸습니다.',
      en: 'The model is drawn shorter than real life so it is easier to see.',
    },
  },
  {
    id: 'colon', group: 'tract', kr: '대장', krSub: '큰창자', en: 'Large intestine',
    color: '#c98d78', trayCol: 'L', traySlot: 4,
    role: {
      kr: '맹장, 결장, 직장으로 이루어진 길이 약 1.5 m의 굵은 관입니다.',
      en: 'A wide tube about 1.5 m long made of the cecum, colon and rectum.',
    },
    digest: {
      kr: '소화되고 남은 찌꺼기에서 물과 무기염류를 흡수합니다. 장내 세균이 섬유질 일부를 분해하고, 남은 것은 대변이 됩니다.',
      en: 'It absorbs water and salts from what is left. Gut bacteria ferment some fibre, and the rest becomes stool.',
    },
    facts: [
      { kr: '찌꺼기가 대장을 지나는 데 대개 12~48시간이 걸립니다.', en: 'Leftovers usually spend 12–48 hours in the large intestine.' },
      { kr: '충수(맹장꼬리)는 대장이 시작되는 맹장에 붙어 있습니다.', en: 'The appendix hangs from the cecum, where the large intestine begins.' },
    ],
    pins: [
      { kr: '맹장 · 충수', en: 'Cecum · Appendix', p: [-1.0, -0.4, 0.4] },
      { kr: '상행결장', en: 'Ascending colon', p: [-1.1, 0.5, 0.5] },
      { kr: '횡행결장', en: 'Transverse colon', p: [0.0, 0.95, 0.65] },
      { kr: '하행결장', en: 'Descending colon', p: [1.15, 0.4, 0.3] },
      { kr: '직장', en: 'Rectum', p: [0.0, -0.8, 0.0] },
    ],
  },
  {
    id: 'liver', group: 'helper', kr: '간', en: 'Liver',
    color: '#8a4636', trayCol: 'L', traySlot: 2,
    role: {
      kr: '몸속에서 가장 큰 기관(약 1.5 kg)으로 오른쪽 윗배에 있습니다.',
      en: 'The largest organ inside the body (about 1.5 kg), in the upper right belly.',
    },
    digest: {
      kr: '지방의 소화를 돕는 쓸개즙을 만듭니다. 소장에서 흡수한 영양소를 저장하고 가공하며, 해로운 물질을 해독합니다.',
      en: 'It makes bile, which helps digest fat. It stores and processes absorbed nutrients and removes harmful substances.',
    },
    facts: [
      { kr: '간은 하루에 약 0.5~1 L의 쓸개즙을 만듭니다.', en: 'The liver makes about 0.5–1 L of bile a day.' },
      { kr: '일부를 잃어도 다시 자라는 재생 능력이 큽니다.', en: 'It can regrow after part of it is lost.' },
    ],
    pins: [
      { kr: '오른엽', en: 'Right lobe', p: [-1.3, 2.75, 0.55] },
      { kr: '왼엽', en: 'Left lobe', p: [0.35, 2.8, 0.55] },
    ],
  },
  {
    id: 'gallbladder', group: 'helper', kr: '쓸개', krSub: '담낭', en: 'Gallbladder',
    color: '#5f9467', trayCol: 'L', traySlot: 3,
    role: {
      kr: '간 아래에 붙은 작은 주머니로 간이 만든 쓸개즙을 모아 둡니다.',
      en: 'A small pouch under the liver that stores the bile the liver makes.',
    },
    digest: {
      kr: '기름진 음식이 들어오면 수축해서 쓸개즙을 십이지장으로 내보냅니다. 쓸개즙은 효소는 아니지만 지방을 작은 알갱이로 나눠 줍니다.',
      en: 'When fatty food arrives it squeezes bile into the duodenum. Bile is not an enzyme, but it breaks fat into tiny droplets.',
    },
    facts: [
      { kr: '쓸개의 용량은 약 30~50 mL로 작은 달걀 정도입니다.', en: 'It holds about 30–50 mL, about a small egg.' },
      { kr: '쓸개 없이도 살 수 있습니다. 쓸개즙이 간에서 바로 장으로 흐릅니다.', en: 'People can live without it; bile then flows straight from the liver to the gut.' },
    ],
    pins: [
      { kr: '쓸개 몸통', en: 'Body', p: [-1.18, 1.95, 0.6] },
      { kr: '쓸개관', en: 'Cystic duct', p: [-0.85, 1.55, 0.42] },
    ],
  },
  {
    id: 'pancreas', group: 'helper', kr: '췌장', krSub: '이자', en: 'Pancreas',
    color: '#d9b25a', trayCol: 'R', traySlot: 3,
    role: {
      kr: '위 뒤쪽에 가로로 놓인 길이 약 15 cm의 기관입니다.',
      en: 'A gland about 15 cm long that lies across the back of the stomach.',
    },
    digest: {
      kr: '탄수화물, 단백질, 지방을 모두 분해하는 효소가 든 이자액을 십이지장으로 보내고, 위에서 온 산을 중화합니다.',
      en: 'It sends pancreatic juice, with enzymes for carbohydrates, proteins and fats, into the duodenum and neutralises stomach acid.',
    },
    facts: [
      { kr: '이자액은 하루에 약 1~1.5 L 만들어집니다.', en: 'About 1–1.5 L of pancreatic juice is made a day.' },
      { kr: '혈당을 조절하는 호르몬인 인슐린도 만듭니다.', en: 'It also makes insulin, the hormone that controls blood sugar.' },
    ],
    pins: [
      { kr: '머리', en: 'Head', p: [-0.5, 1.2, 0.2] },
      { kr: '몸통', en: 'Body', p: [0.45, 1.58, 0.05] },
      { kr: '꼬리', en: 'Tail', p: [1.15, 2.15, -0.05] },
    ],
  },
  {
    id: 'spleen', group: 'other', kr: '비장', krSub: '지라', en: 'Spleen',
    color: '#774a69', trayCol: 'R', traySlot: 4,
    role: {
      kr: '위 왼쪽 뒤에 있는 주먹만 한 기관으로 낡은 적혈구를 걸러내고 면역에 참여합니다.',
      en: 'A fist-sized organ behind the left of the stomach. It filters old red blood cells and helps immunity.',
    },
    digest: {
      kr: '소화관이 아니어서 음식을 직접 소화하지 않습니다. 소화 기관 곁에서 혈액을 거르는 일을 합니다.',
      en: 'It is not part of the digestive tract and does not digest food. It sits beside the stomach and filters blood.',
    },
    facts: [
      { kr: '길이는 약 12 cm 안팎입니다.', en: 'It is about 12 cm long.' },
      { kr: '비장 없이도 살 수 있지만 감염에 더 약해질 수 있습니다.', en: 'People can live without it, but infections may become more likely.' },
    ],
    pins: [],
  },
  {
    id: 'heart', group: 'other', kr: '심장', en: 'Heart',
    color: '#b8433a', trayCol: 'R', traySlot: 1,
    role: {
      kr: '주먹만 한 근육 펌프로 가슴 가운데에서 약간 왼쪽에 있습니다.',
      en: 'A fist-sized muscular pump, in the middle of the chest and leaning a little to the left.',
    },
    digest: {
      kr: '소장이 흡수한 영양소를 실은 혈액을 간을 거쳐 온몸으로 보냅니다. 소화 기관도 심장이 보낸 혈액으로 일합니다.',
      en: 'It pumps blood carrying absorbed nutrients, after the liver, around the body. Digestive organs also run on blood from the heart.',
    },
    facts: [
      { kr: '쉬는 동안에도 1분에 약 5 L의 혈액을 내보냅니다.', en: 'Even at rest it pumps about 5 L of blood every minute.' },
      { kr: '하루에 약 10만 번 뜁니다.', en: 'It beats about 100,000 times a day.' },
    ],
    pins: [
      { kr: '대동맥', en: 'Aorta', p: [0.42, 4.66, 0.18] },
      { kr: '상대정맥', en: 'Superior vena cava', p: [-0.22, 4.7, 0.2] },
      { kr: '폐동맥', en: 'Pulmonary artery', p: [0.48, 4.3, 0.5] },
      { kr: '좌심실', en: 'Left ventricle', p: [0.55, 3.3, 0.55] },
    ],
  },
  {
    id: 'lungs', group: 'other', kr: '폐', krSub: '허파', en: 'Lungs',
    color: '#d7a5a0', trayCol: 'L', traySlot: 1,
    role: {
      kr: '가슴 양쪽에 있는 스펀지 같은 기관으로 숨을 쉴 때 산소를 받아들이고 이산화탄소를 내보냅니다.',
      en: 'Sponge-like organs on both sides of the chest. They take in oxygen and release carbon dioxide.',
    },
    digest: {
      kr: '소화 기관은 아니지만, 소화된 영양소로 에너지를 얻는 데 필요한 산소를 공급합니다.',
      en: 'They are not digestive organs, but they supply the oxygen the body needs to turn digested nutrients into energy.',
    },
    facts: [
      { kr: '오른쪽 폐는 3개, 왼쪽 폐는 2개의 엽이라서 왼쪽이 심장 자리를 비켜 줍니다.', en: 'The right lung has 3 lobes and the left has 2, leaving room for the heart.' },
      { kr: '폐 속에는 약 3억~5억 개의 폐포가 있습니다.', en: 'Each pair holds roughly 300–500 million air sacs (alveoli).' },
    ],
    pins: [
      { kr: '기관', en: 'Trachea', p: [0.0, 5.3, 0.28] },
      { kr: '기관지', en: 'Bronchus', p: [0.55, 4.5, 0.3] },
      { kr: '오른쪽 폐', en: 'Right lung', p: [-1.1, 4.1, 0.65] },
      { kr: '왼쪽 폐', en: 'Left lung', p: [1.2, 4.1, 0.65] },
    ],
  },
];

// Stage descriptions for "follow the meal". `helpers` light up in indigo.
export const STAGES = [
  {
    id: 'mouth', organ: 'mouth', helpers: [], dur: 5.5,
    kr: '입', en: 'Mouth', time: { kr: '약 10~30초', en: 'about 10–30 seconds' },
    say: {
      kr: '이가 음식을 잘게 부수고(물리적 소화), 침 속 아밀레이스가 녹말을 엿당으로 바꾸기 시작합니다(화학적 소화).',
      en: 'Teeth crush the food (mechanical digestion) and amylase in saliva starts turning starch into maltose (chemical digestion).',
    },
    bolus: '#d9a85a', size: 0.17,
  },
  {
    id: 'esophagus', organ: 'esophagus', helpers: [], dur: 5.5,
    kr: '식도', en: 'Esophagus', time: { kr: '약 5~8초', en: 'about 5–8 seconds' },
    say: {
      kr: '연동 운동이 음식 덩어리를 위로 밀어 내립니다. 식도에서는 소화액이 나오지 않습니다.',
      en: 'Peristalsis squeezes the food ball down. No digestive juice is added in the esophagus.',
    },
    bolus: '#d9a85a', size: 0.14,
  },
  {
    id: 'stomach', organ: 'stomach', helpers: [], dur: 8,
    kr: '위', en: 'Stomach', time: { kr: '약 2~4시간', en: 'about 2–4 hours' },
    say: {
      kr: '위벽 근육이 음식을 휘젓고 위액의 염산과 펩신이 단백질 소화를 시작합니다. 음식은 걸쭉한 유미즙이 됩니다.',
      en: 'Stomach muscles churn the food while acid and pepsin start on proteins. The food turns into thick chyme.',
    },
    bolus: '#e3b98a', size: 0.2,
  },
  {
    id: 'smallint', organ: 'smallint', helpers: ['liver', 'gallbladder', 'pancreas'], dur: 12,
    kr: '소장', en: 'Small intestine', time: { kr: '약 3~5시간', en: 'about 3–5 hours' },
    say: {
      kr: '간·쓸개의 쓸개즙은 지방을 잘게 나누고, 췌장의 이자액이 탄수화물·단백질·지방을 분해합니다. 영양소는 융털을 통해 혈액으로 흡수됩니다.',
      en: 'Bile from the liver and gallbladder breaks up fat, and pancreatic juice digests carbohydrates, proteins and fat. Villi absorb the nutrients into the blood.',
    },
    bolus: '#efd49a', size: 0.12,
  },
  {
    id: 'colon', organ: 'colon', helpers: [], dur: 10,
    kr: '대장', en: 'Large intestine', time: { kr: '약 12~48시간', en: 'about 12–48 hours' },
    say: {
      kr: '남은 찌꺼기에서 물과 무기염류를 흡수합니다. 장내 세균이 일부를 분해하고 나머지는 단단해져 대변이 됩니다.',
      en: 'Water and salts are absorbed from the leftovers. Gut bacteria break down some, and the rest hardens into stool.',
    },
    bolus: '#a98562', size: 0.14,
  },
  {
    id: 'rectum', organ: 'colon', helpers: [], dur: 5,
    kr: '직장 · 항문', en: 'Rectum · Anus', time: { kr: '배변 때까지', en: 'until the toilet' },
    say: {
      kr: '직장에 대변이 차면 배변 신호가 오고, 항문을 통해 몸 밖으로 나갑니다. 입에서 항문까지 전체 여행은 보통 1~3일입니다.',
      en: 'When the rectum fills, you feel the urge, and stool leaves through the anus. The whole trip from mouth to anus usually takes 1–3 days.',
    },
    bolus: '#8a6a4c', size: 0.14,
  },
];
