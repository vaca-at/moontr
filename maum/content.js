/* 마음한편 웹판 내용 모음 (아이폰 앱 Maum/*.swift 에서 그대로 옮김, 2026-11-25)
   - 글은 앱과 똑같이 둡니다. 고칠 때는 앱 쪽 글도 함께 고쳐 주세요.
   - 화면(DOM)은 만지지 않아요. 글 · 숫자 · 작은 계산 함수만 있어요.
   - 쓰는 법: <script src="content.js"></script> 다음에 window.MaumContent.dex.matchDex("...") 처럼 */
(function () {
  'use strict';

  // ── 작은 도움 함수 ──────────────────────────────
  // 날짜 → 'YYYY-MM-DD' (이 기기 시간 기준)
  function ymd(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  // 올해 몇째 날인지 (1월 1일 = 1, 앱의 ordinality(of: .day, in: .year) 와 같게)
  function dayOfYear(d) {
    d = d || new Date();
    var start = new Date(d.getFullYear(), 0, 1);
    var today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((today - start) / 86400000) + 1;
  }
  // 번호를 세 자리로 (No.001)
  function no3(n) { n = String(n); while (n.length < 3) n = '0' + n; return n; }
  // 섞기 (앱의 shuffled())
  function shuffled(arr, rnd) {
    rnd = rnd || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // 겹치는 것 빼고 순서 지키기 (Set 처럼)
  function uniq(arr) { var o = []; arr.forEach(function (s) { if (o.indexOf(s) < 0) o.push(s); }); return o; }

  // 최근 n일 기록 (오래된 것부터, 빈 날은 null) — 앱의 Stats.lastDays
  // checkins: [{ day:'YYYY-MM-DD', mood:1~5, reasons:[], at?:숫자 }] — 같은 날이 여럿이면 at 이 늦은 것(없으면 뒤의 것)
  function lastDays(checkins, n, now) {
    now = now || new Date();
    var by = {};
    (checkins || []).forEach(function (c) {
      if (!c || !c.day) return;
      var old = by[c.day];
      if (!old || (old.at == null || c.at == null ? true : old.at < c.at)) by[c.day] = c;
    });
    var out = [];
    for (var k = n - 1; k >= 0; k--) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - k);
      out.push(by[ymd(d)] || null);
    }
    return out;
  }
  // 날짜 기록(밀리초 숫자 목록) 중 최근 days 일 안에 든 수 — 앱의 Safety.riskCount
  function countWithin(list, days, now) {
    var from = (now ? now.getTime() : Date.now()) - days * 86400000;
    return (list || []).filter(function (t) { return t >= from; }).length;
  }

  // ── 6. 모드 (Rings.swift Mode) ──────────────────
  var MODE_ORDER = ['all', 'student', 'parent', 'worker', 'teacher'];
  var MODES = {
    all:     { title: '전체',   icon: 'circle.grid.2x2',               chip: '전체 보기',   who: ['나', '가족', '친구', '동료'],         ringPrompt: '요즘 마음에 걸리는 사람이 있나요?' },
    student: { title: '학생',   icon: 'backpack',                      chip: '학생 모드',   who: ['나', '친구', '가족', '선생님'],       ringPrompt: '친구가 왜 그랬는지 궁금했던 적 있나요?' },
    parent:  { title: '부모',   icon: 'figure.and.child.holdinghands', chip: '부모 모드',   who: ['아이', '나', '배우자', '부모님'],     ringPrompt: '아이가 요즘 말이 짧아졌나요?' },
    worker:  { title: '직장인', icon: 'briefcase',                     chip: '직장인 모드', who: ['나', '동료', '상사', '가족'],         ringPrompt: '그 동료, 왜 그렇게 말할까요?' },
    teacher: { title: '교사',   icon: 'graduationcap',                 chip: '교사 모드',   who: ['학생', '동료 교사', '학부모', '나'],   ringPrompt: '자꾸 마음이 쓰이는 학생이 있나요?' }
  };
  function modeOf(m) { return MODES[m] ? m : 'all'; }

  // ── 1. 숨은 마음 도감 (Rings.swift RingDex · DexView.swift) ──
  var DEX_TOTAL = 100;   // 100칸, 지금은 12칸만 내용이 있어요
  var DEX_TYPES = [
    { no: 1,  hint: '겨울 고슴도치',   name: '가시 갑옷형',     line: '약한 마음을 들킬까 봐 먼저 가시를 세워요.',
      clue: "겉으로는 차갑거나 세게 말하는데, 혼자 있을 땐 상처받는 것 같은 사람이 있나요?",
      keys: ['여린', '여리', '세 보', '세보', '센 척', '강한 척', '강해 보', '차갑', '퉁명', '까칠', '날카', '가시', '겉으로', '무뚝뚝'] },
    { no: 2,  hint: '깊은 굴 토끼',    name: '깊은 몰입 피난형', line: '힘들면 좋아하는 일에 푹 빠져 충전해요. 회피가 아니라 나만의 충전 방식이에요.',
      clue: '힘든 일이 생기면 게임 · 영상 · 취미에 푹 빠져 버리는 사람이 떠오르나요?',
      keys: ['게임', '몰입', '빠져', '폰만', '휴대폰', '유튜브', '방에만', '숨어', '취미'] },
    { no: 3,  hint: '돋보기 선장',     name: '현실 점검형',     line: '사실부터 따지고, 고칠 점을 먼저 말해요.',
      clue: "이야기하면 위로보다 '그건 이렇게 해야지'가 먼저 나오는 사람은요?",
      keys: ['따지', '지적', '사실만', '논리', '팩트', '고칠 점', '비판', '잔소리', '단점'] },
    { no: 4,  hint: '마르지 않는 샘',  name: '다 퍼주는 형',    line: '남을 먼저 챙기느라 내 마음은 뒤로 미뤄요.',
      clue: '부탁을 거절하지 못하고 늘 남을 먼저 챙기는 사람이 있나요?',
      keys: ['챙기', '챙겨', '퍼주', '희생', '거절 못', '거절을 못', '부탁', '착한', '남 먼저', '양보'] },
    { no: 5,  hint: '등대지기',        name: '혼자 버티는 형',  line: '도와 달라고 하기보다 혼자 지키는 게 편해요.',
      clue: "힘들어도 '괜찮아'라며 끝까지 혼자 해내려는 사람은요?",
      keys: ['혼자', '도움을 안', '도와 달라', '버티', '괜찮다고', '티를 안', '티 안', '기대지'] },
    { no: 6,  hint: '소나기 구름',     name: '순간 폭발형',     line: '화가 확 올라왔다가 금방 개요.',
      clue: '화가 확 났다가 금방 아무 일 없던 듯 풀리는 사람이 떠오르나요?',
      keys: ['화를', '화가', '버럭', '폭발', '욱', '소리를', '짜증', '흥분'] },
    { no: 7,  hint: '조용한 피아노',   name: '속으로 삭이는 형', line: '말보다 속으로 오래 곱씹어요.',
      clue: '서운해도 말하지 않고, 한참 뒤에야 속마음을 꺼내는 사람은요?',
      keys: ['참아', '참는', '삭이', '곱씹', '말을 안', '말이 없', '조용', '속으로', '서운'] },
    { no: 8,  hint: '나침반 고양이',   name: '내 길 가는 형',   line: '남의 눈보다 내 방향이 더 중요해요.',
      clue: '남이 뭐라 해도 자기 방식대로 가는 사람이 있나요?',
      keys: ['마이웨이', '고집', '자기 방식', '자기 식대로', '신경 안', '신경을 안', '독립', '제멋대로', '자기 길'] },
    { no: 9,  hint: '새벽 우체부',     name: '미리 걱정형',     line: '걱정이 많아 미리미리 준비해요.',
      clue: '아직 일어나지 않은 일까지 미리 걱정하고 준비하는 사람은요?',
      keys: ['걱정', '불안', '미리', '준비', '확인', '초조', '조마조마'] },
    { no: 10, hint: '무대 위 조명',    name: '인정 충전형',     line: '칭찬과 관심을 받으면 힘이 나요.',
      clue: '칭찬 한마디에 힘이 번쩍 나고, 관심을 받고 싶어 하는 사람이 떠오르나요?',
      keys: ['칭찬', '관심', '인정', '자랑', '주목', '나서', '알아주'] },
    { no: 11, hint: '두 갈래 길',      name: '결정 망설임형',   line: '고르기 전에 오래, 깊이 고민해요.',
      clue: '메뉴 하나 고를 때도 오래 고민하는 사람은요?',
      keys: ['망설', '결정', '고민', '우유부단', '못 고르', '미루', '선택'] },
    { no: 12, hint: '빈 의자',         name: '거리 두기형',     line: '가까워지면 한 발 물러서서 숨을 골라요.',
      clue: '친해질 만하면 한 발 물러서는 사람이 있나요?',
      keys: ['거리', '멀어', '벽을', '친해지', '연락', '선을 긋', '선을 그', '다가가면'] }
  ];
  var CRISIS_DEX = '많이 힘든 이야기 같아요. 혼자 견디지 말고 109(24시간) · 1388(청소년)에 꼭 이야기해 주세요.';

  function dexType(no) {
    for (var i = 0; i < DEX_TYPES.length; i++) if (DEX_TYPES[i].no === Number(no)) return DEX_TYPES[i];
    return null;
  }
  // 못 찾은 칸을 누르면 나오는 힌트
  function dexClue(no) { var t = dexType(no); return t ? t.clue : '아직 열리지 않은 칸이에요.'; }
  // 글 속 낱말로 숨은 마음 고르기: 많이 맞는 순서로 (하나도 안 맞으면 빈 목록) — RingDex.match
  function matchDex(text) {
    var t = String(text || '').split('  ').join(' ');
    var scored = DEX_TYPES.map(function (r, i) {
      return { r: r, i: i, n: r.keys.filter(function (k) { return t.indexOf(k) >= 0; }).length };
    }).filter(function (x) { return x.n > 0; });
    scored.sort(function (a, b) { return b.n - a.n || a.i - b.i; });
    return scored.map(function (x) { return x.r; });
  }
  // 못 찾은 칸 알림 창 제목 · 글
  function clueTitle(no) { var t = dexType(no); return t ? 'No.' + no3(t.no) + ' 「' + t.hint + '」' : 'No.' + no3(no || 0); }
  function clueText(no) {
    if (!dexType(no)) return '아직 열리지 않은 칸이에요. 업데이트로 하나씩 채워져요.';
    return '아직 찾지 못했어요.\n' + dexClue(no) + '\n\n떠오르는 사람이 있으면 위 칸에 그 사람의 말이나 행동을 적고 [도감 찾기]를 눌러 봐요.';
  }
  // 칸 하나에 쓸 글: 찾은 칸 = 이름 · 비유, 못 찾은 칸 = 자물쇠 + 「비유」(내용 없는 칸은 ?)
  function dexCell(no, found) {
    var t = dexType(no);
    if (found && t) return { no: no, label: 'No.' + no3(no), top: t.name, bottom: t.hint, on: true, locked: false };
    return { no: no, label: 'No.' + no3(no), top: t ? '「' + t.hint + '」' : '?', bottom: null, on: false, locked: true };
  }
  // 찾은 곳 줄 (RingDetail): finds = [{who}]
  function foundLine(finds) {
    var whos = uniq((finds || []).map(function (f) { return f.who; }));
    return '찾은 곳 · ' + whos.join(' · ') + ' · ' + (finds || []).length + '번';
  }

  var dex = {
    total: DEX_TOTAL,
    known: DEX_TYPES.length,
    types: DEX_TYPES,
    type: dexType,
    clue: dexClue,
    matchDex: matchDex,
    match: matchDex,
    clueTitle: clueTitle,
    clueText: clueText,
    cell: dexCell,
    foundLine: foundLine,
    minAsk: 6,          // 도감 위 묻기: 6글자부터 단추가 켜져요
    minStory: 10,       // 도감 찾기 화면: 10글자부터 (누구도 골라야 해요)
    whoMax: 10,         // '누구' 칩 이름은 10글자까지
    // 찾은 뒤 보고서 여섯 칸 (AI 가 채워요): [제목, 비어 있을 때 보이는 설명]
    report: [
      ['그 사람은 왜 그럴까?', '이해 안 됐던 행동 속 마음'],
      ['그때 나는 이렇게 반응했어요', '불편할 때 나의 반응'],
      ['이렇게 대응해 보세요', '그 순간에 쓸 말과 행동'],
      ['기대와 다를 때 마음 편해지기', '바란 모습과 실제 모습이 다를 때'],
      ['앞으로 이런 사람을 만나면', '관계 맺는 팁'],
      ['나에게 해 주는 한마디', '위로 문장']
    ],
    text: {
      title: '숨은 마음 도감',
      count: function (n) { return n + ' / ' + DEX_TOTAL + ' 마음을 찾았어요'; },
      askTitle: '어떤 사람이 궁금해요?',
      askPlaceholder: '예) 내 주변엔 마음은 여리지만 겉으로는 되게 세 보이는 사람이 있어',
      askButton: '도감 찾기',
      askLoading: 'AI 마음 티쳐가 찾는 중…',
      askNote: '이름은 쓰지 않아도 돼요. 적은 글은 저장하지 않고 도감을 찾는 데만 써요.',
      clueGo: '이 사람 이야기 쓰러 가기',
      clueOk: '알겠어요',
      hitNew: '새로운 마음을 발견했어요!',
      hitOld: '이미 찾은 마음이에요',
      hitHead: function (t) { return 'No.' + no3(t.no) + ' · 「' + t.hint + '」'; },
      hitReport: '보고서 보기',
      miss: '아직 딱 맞는 마음을 못 찾았어요. 그 사람이 한 말이나 행동을 조금 더 적어 줄래요?',
      crisis: CRISIS_DEX,
      crisisFind: CRISIS_DEX + " 오늘 탭 '힘들 때 도움'에서 바로 걸 수 있어요.",
      memoTitle: '내 메모 (원할 때)',
      memoPlaceholder: '예) 회의 때 동료 · 숙제할 때 우리 아이',
      reportNoteAI: "AI 마음 티쳐가 이야기를 보고 쓴 보고서예요. '진단'이 아니라 마음 패턴이에요.",
      reportNoteEmpty: "도감 위 '어떤 사람이 궁금해요?'에 이야기를 적으면 AI 마음 티쳐가 보고서를 채워 줘요. '진단'이 아니라 마음 패턴이에요.",
      // 도감 찾기 화면 (FindRingView)
      findTitle: '도감 찾기',
      findWho: '누구 이야기인가요?',
      findWhat: '어떤 일이 있었나요?',
      findPlaceholder: '요즘 마음에 걸린 일을 편하게 적어요. 이름은 쓰지 않아도 돼요.',
      findHelps: ['그 사람이 한 말이나 행동은?', '그때 내 마음은 어땠나요?', '그 사람이 원래 바라던 건 뭘까요?', '비슷한 일이 또 있었나요?'],
      findKeep: '이야기 글도 보관함에 남기기',
      findKeepNote: "남기지 않으면 찾은 유형과 '누구'만 저장해요. 이야기는 도감을 찾는 데만 써요.",
      foundSheetTitle: '새로운 마음을 발견했어요!',
      foundSheetButton: '도감에서 보기',
      whoDefault: '주변 사람',   // '누구'를 안 고르면
      // '누구' 칩
      whoAdd: '추가', whoEdit: '고치기', whoDone: '다 했어요',
      whoEditNote: '칩을 누르면 이름을 고치고, ✕ 를 누르면 지워요',
      whoAddTitle: '누구를 더할까요?', whoAddPlaceholder: '예) 짝꿍, 팀장님, 둘째', whoAddOk: '더하기',
      whoRenameTitle: '이름 고치기', whoRenamePlaceholder: '이름', whoRenameOk: '고치기', cancel: '그만'
    }
  };

  // ── 3. 마음 출석 (Theme.swift Mood · CheckinSheet.swift) ──
  var MOODS = {
    1: { value: 1, name: '많이 힘들어', weatherName: '소나기',      color: '#3B5A85', symbol: 'cloud.bolt.rain.fill' },
    2: { value: 2, name: '힘들어',      weatherName: '비',          color: '#6F8FB3', symbol: 'cloud.rain.fill' },
    3: { value: 3, name: '그저 그래',   weatherName: '흐림',        color: '#9C978E', symbol: 'cloud.fill' },
    4: { value: 4, name: '좋아',        weatherName: '구름 사이 해', color: '#D9A28C', symbol: 'cloud.sun.fill' },
    5: { value: 5, name: '아주 좋아',   weatherName: '맑음',        color: '#C9765E', symbol: 'sun.max.fill' }
  };
  var REASONS = {
    student: ['친구', '가족', '공부', '시험', '운동', '몸', '잠', '선생님', '게임', '날씨'],
    parent:  ['아이', '남편 · 아내', '가족', '집안일', '일', '몸', '잠', '돈', '날씨'],
    worker:  ['일', '동료', '상사', '출퇴근', '가족', '몸', '잠', '돈', '날씨'],
    teacher: ['수업', '학생', '업무', '동료', '학부모', '가족', '몸', '잠', '날씨'],
    all:     ['친구', '가족', '일 · 공부', '운동', '몸', '잠', '돈', '쉼', '날씨']
  };
  var checkin = {
    moods: MOODS,
    mood: function (v) { return MOODS[v] || MOODS[4]; },
    reasons: REASONS,
    reasonList: function (mode) { return REASONS[modeOf(mode)].slice(); },
    // 내가 더한 까닭까지 합친 목록 (기본 + 겹치지 않는 내 것)
    allTags: function (mode, mine) { var base = REASONS[modeOf(mode)]; return base.concat((mine || []).filter(function (t) { return base.indexOf(t) < 0; })); },
    tagMax: 8,                      // 직접 더한 까닭은 8글자까지
    defaultMood: 4,
    // 힘든 날(1~2)엔 '위로하는 한 줄'을 먼저 골라 줘요 (직접 고르면 그대로)
    comfortFirst: function (mood) { return mood <= 2; },
    lineKinds: { good: '오늘 좋은 점', comfort: '나를 위로하는 한 줄' },
    placeholders: {
      good: '오늘 좋은 점 한 줄 (내가 한 일 · 고마운 일)',
      comfort: '힘든 나에게 한마디 (예: 오늘도 버틴 나, 수고했어)'
    },
    text: {
      title: '오늘 마음',
      weather: function (v) { return '마음 날씨: ' + checkin.mood(v).weatherName; },
      sliderLow: '많이 힘들어', sliderHigh: '아주 좋아',
      why: '무엇 때문에?',
      addTag: '직접 더하기',
      addTitle: '무엇 때문에?',
      addPlaceholder: '예) 동아리, 회사, 육아, 연애',
      addOk: '더하기', addCancel: '그만',
      addNote: '더한 까닭은 다음에도 보여요. 꾹 누르면 지울 수 있어요.',
      removeTag: '이 까닭 지우기',
      pickerTitle: '한 줄 쓰기'
    }
  };

  // ── 2. 홈: 오늘의 문장 (HomeShapes.swift Hanpyeon.today) ──
  // weekMoods: 최근 7일 기분 (0 = 기록 없음, 1~5), moves: 이번 주 몸 활동 횟수, breaths: 이번 주 숨 고르기 횟수
  // seed: 새로고침 번호(lineSeed) + 올해 몇째 날
  function todayFallback(o) {
    o = o || {};
    var week = (o.weekMoods || []).filter(function (m) { return m > 0; });
    var avg = week.length ? week.reduce(function (a, b) { return a + b; }, 0) / week.length : 0;
    var seed = Number(o.seed) || 0;
    var pick = function (a) { return a[Math.abs(seed) % a.length]; };
    var m = Number(o.moves) || 0, b = Number(o.breaths) || 0;
    var weather;
    if (avg === 0) weather = pick(['첫 장을\n펼쳐 볼까요?', '오늘이\n첫 쪽이에요', '반가워요,\n천천히 시작해요']);
    else if (avg >= 4.3) weather = pick(['맑고 따뜻한\n하루예요', '햇살이\n오래 머무는 날', '마음이\n가볍게 걷는 날']);
    else if (avg >= 3.5) weather = pick(['구름 사이로\n해가 비쳐요', '바람이\n선선한 날이에요', '조금씩\n개어 가는 중']);
    else if (avg >= 2.7) weather = pick(['조금 흐리지만,\n저녁엔 갤 거예요', '흐린 날도\n지나가요', '천천히 가도\n괜찮은 날']);
    else if (avg >= 1.8) weather = pick(['비가 오지만,\n우산은 여기 있어요', '젖어도 괜찮아요,\n곧 말라요', '비 오는 날엔\n쉬어 가요']);
    else weather = pick(['오늘은 쉬어 가도\n괜찮은 날이에요', '아무것도 안 해도\n괜찮은 날', '나를 먼저\n안아 주는 날']);
    var body;
    if (!week.length) body = '하루 한 번, 마음 출석으로 오늘 쪽을 시작해요.';
    else if (m > 0) body = pick(['이번 주 몸 풀기를 ' + m + '번 했어요. 오늘도 어깨 힘을 한 번 툭 빼 봐요.', '몸을 ' + m + '번 돌본 한 주예요. 오늘은 발바닥이 땅에 닿은 느낌부터.', '이번 주 ' + m + '번 몸을 풀었어요. 그만큼 마음도 말랑해졌을 거예요.']);
    else if (b > 0) body = pick(['이번 주 숨 고르기를 ' + b + '번 했어요. 오늘은 얼굴 힘도 한 번 풀어 봐요.', '숨을 ' + b + '번 골랐어요. 오늘은 목 · 어깨도 한 번 풀어 줘요.']);
    else body = pick(['남의 하루를 챙긴 만큼, 오늘은 그 마음을 나에게도 조금 나눠 줘요.', '오늘은 1분만 나에게 내어 줘요. 숨 한 번이면 충분해요.', '바빴던 만큼, 오늘은 어깨를 한 번 툭 내려놓아요.']);
    return { weather: weather, body: body };
  }
  var home = {
    todayFallback: todayFallback,
    // seed 만들기: lineSeed + 올해 몇째 날
    seed: function (lineSeed, date) { return (Number(lineSeed) || 0) + dayOfYear(date); },
    dayOfYear: dayOfYear,
    // AI 문장을 다시 쓸 수 있는 열쇠: 'YYYY-MM-DD#새로고침번호' (Hanpyeon.aiKey)
    aiKey: function (lineSeed, date) { return ymd(date) + '#' + (Number(lineSeed) || 0); },
    text: {
      weatherTitle: '오늘의 마음 날씨',
      picked: 'AI 마음 티쳐가 최근 기록을 보고 골랐어요',
      checkinNew: '오늘 마음 기록하기',
      checkinEdit: '오늘 기록 고치기',
      checkinSub: '마음 날씨 고르고, 좋은 점이나 나를 위로하는 한 줄 쓰기',
      dexLink: function (n) { return '숨은 마음 도감 ' + n + ' · 찾으러 가기'; },
      page: function (n) { return n + '쪽'; },
      planPersonal: '내 테스트 결과에 맞춰 골랐어요',
      planBase: '테스트를 하면 나에게 맞는 것으로 골라 줘요',
      planShuffle: '다른 세 개로 바꾸기',
      todoTitle: '오늘 해 볼 것',
      letgoTitle: '내려놓을 것'
    }
  };

  // ── 4. 오늘 해 볼 것 · 내려놓을 것 (TestBank.swift · Plan.swift) ──
  var PLAN = {
    baseTodo: [
      '물 다섯 잔 마시기', '10분 걷기', '하늘 한 번 보기', '고마운 일 하나 적기',
      '깊게 숨 세 번', '스트레칭 5분', '좋아하는 노래 듣기', '일찍 잠자리 들기',
      '책 한 쪽 읽기', '한 곳만 정리하기', '안부 문자 보내기', '나에게 칭찬 한마디',
      '햇볕 쬐기', '제때 밥 먹기'
    ],
    baseLetgo: [
      '자기 전 휴대폰', '남과 비교하기', '지난 실수 곱씹기', '완벽하려는 마음',
      '늦은 밤 군것질', '혼자 다 하기', '괜히 미안해하기', '남 눈치 보기',
      '할 일 미루기', "'나는 안 돼' 생각", '화난 채로 말하기', '끝없는 걱정',
      '쉬는 날 일 생각', '무리한 약속'
    ],
    // 마음 결 (0 활발함 · 1 너그러움 · 2 섬세함 · 3 꼼꼼함 · 4 솔직함 · 5 호기심) × 5
    mindTodo: [
      ['혼자 조용히 10분', '할 일 목록 적기', '"싫어" 한 번 말하기', '끝까지 들어 주기', '하나만 끝내기'],
      ['내 기분 먼저 묻기', '섭섭한 것 말하기', '나를 위한 선물', '거절 한 번 하기', '내 몫 챙기기'],
      ['내 마음에 이름 붙이기', '"나는 어떻게?" 묻기', '좋았던 말 적기', '조용한 곳에서 쉬기', '따뜻한 차 한 잔'],
      ['80%에서 멈추기', '쉬는 시간 정하기', '시작한 나 칭찬', '일부러 빈 시간', '도움 청하기'],
      ['부드럽게 말하기', '사정 먼저 묻기', '좋은 점 먼저 말하기', '한 번 넘어가 주기', '고맙다고 말하기'],
      ['궁금한 것 메모', '하나 끝까지 파기', '새 길로 걸어 보기', '배운 것 나누기', '한 가지에 집중']
    ],
    mindLetgo: [
      ["모든 부탁에 '응'", '쉬지 않고 놀기', '말 끊고 끼어들기', '벌여 놓은 일', '힘든데 괜찮은 척'],
      ['무조건 양보', '다 괜찮다는 말', '내 마음 미루기', '남 기분 책임지기', '참고 넘기기'],
      ['작은 말 곱씹기', '눈치 보기', '남의 기분 떠안기', '괜찮은 척', '밤늦은 걱정'],
      ['100점 욕심', '실수 곱씹기', '다 내가 하기', '쉬면 불안한 마음', '남의 실수 고치기'],
      ['날 선 말투', '이기려는 마음', '남의 잘못 세기', '한 번에 다 말하기', '옳고 그름 다툼'],
      ['벌여 놓은 일들', '끝없는 검색', '지루함 피하기', '생각만 하기', '한꺼번에 여러 개']
    ],
    // 기질 (0 새로움 찾기 · 1 조심성 · 2 마음 나눔 · 3 끈기) × 5
    temperTodo: [
      ['시작한 일 마무리', '오늘 할 일 3개', '한 가지에 30분', '익숙한 길 즐기기', '몸 움직이기'],
      ['작은 도전 하나', '걱정 종이에 적기', '"괜찮아" 말하기', '잘된 일 떠올리기', '믿는 사람과 대화'],
      ['고마운 사람에게 연락', '혼자만의 쉼', '내 마음 먼저 듣기', '따뜻한 말 건네기', '부탁 하나 거절'],
      ['쉬는 시간 넣기', '작은 성취 적기', '도움 청하기', '노는 시간 갖기', '"오늘은 여기까지"']
    ],
    temperLetgo: [
      ['충동구매', '새 일 또 벌이기', '지루함 탓하기', '급한 결정', '약속 바꾸기'],
      ['최악 상상하기', '미리 하는 걱정', '확인 또 확인', '실수 곱씹기', '모든 대비'],
      ['답장 기다리기', '남 기분 떠안기', '서운함 쌓기', '인정받으려는 마음', '혼자 서운해하기'],
      ['무작정 버티기', '쉬면 불안한 마음', '안 맞는 일 붙잡기', '혼자 짊어지기', '결과 조급함']
    ],
    // 9가지 유형 (0..8 = 1번~9번) × 4
    nineTodo: [
      ['"충분해" 말하기', '쉬는 시간 갖기', '잘한 점 찾기', '웃긴 영상 보기'],
      ['나를 위한 시간', '내 부탁 하나 하기', '"아니" 말해 보기', '내 마음 적기'],
      ['아무것도 안 하기', '과정 칭찬하기', '내 감정 살피기', '가까운 사람과 쉬기'],
      ['지금 좋은 것 적기', '몸 움직이기', '작은 일 끝내기', '고마운 일 찾기'],
      ['아는 것 나누기', '사람 만나기', '몸 쓰는 일 하기', '생각 말고 해 보기'],
      ['확실한 것 떠올리기', '내 판단 믿기', '걱정 적고 덮기', '편한 사람과 웃기'],
      ['하나만 깊이 하기', '조용히 앉아 있기', '힘든 마음 보기', '끝까지 마무리'],
      ['부드럽게 말하기', '여린 마음 나누기', '도움 받아 보기', '천천히 쉬기'],
      ['내 의견 말하기', '미룬 일 하나 하기', '오늘 할 일 정하기', '좋아하는 것 고르기']
    ],
    nineLetgo: [
      ['남의 실수 고치기', '100점 욕심', '스스로 꾸짖기', '화 꾹 참기'],
      ['모두 챙기기', '인정 기다리기', '무리한 도움', '서운함 쌓기'],
      ['쉬지 않고 달리기', '남과 비교하기', '보여 주기 걱정', '결과만 보기'],
      ['남과 비교하기', '부족한 것 세기', '슬픔에 오래 머물기', '나만 다르다는 생각'],
      ['혼자 숨기', '다 알아야 시작', '아끼기만 하기', '머릿속 생각만'],
      ['끝없는 걱정', '최악 상상하기', '의심 또 의심', '허락 기다리기'],
      ['바쁘게 피하기', '새 계획 또 세우기', '지루함 피하기', '힘든 마음 덮기'],
      ['다 혼자 하기', '날 선 말투', '약한 척 숨기기', '이기려는 마음'],
      ['그냥 넘어가기', '할 일 미루기', '내 생각 숨기기', '다툼 피하기']
    ]
  };
  function has(arr, i) { return i != null && i >= 0 && i < arr.length && Math.floor(i) === i; }
  // 새로 고르기 (PlanStore.make): 내 결과에 맞는 것 두 개 + 누구에게나 좋은 것 하나, 지난번 것은 되도록 빼고
  // who = { mind, temper, nine } (없으면 null), previous = 지난 계획 { todo, letgo } (섞기 때 다른 것으로)
  function makePlan(who, previous, rnd) {
    who = who || {}; previous = previous || {};
    var pTodo = [], pLetgo = [];
    if (has(PLAN.mindTodo, who.mind)) { pTodo = pTodo.concat(PLAN.mindTodo[who.mind]); pLetgo = pLetgo.concat(PLAN.mindLetgo[who.mind]); }
    if (has(PLAN.temperTodo, who.temper)) { pTodo = pTodo.concat(PLAN.temperTodo[who.temper]); pLetgo = pLetgo.concat(PLAN.temperLetgo[who.temper]); }
    if (has(PLAN.nineTodo, who.nine)) { pTodo = pTodo.concat(PLAN.nineTodo[who.nine]); pLetgo = pLetgo.concat(PLAN.nineLetgo[who.nine]); }
    function pick(mine, base, old) {
      old = old || [];
      var out = [];
      shuffled(uniq(mine).filter(function (s) { return old.indexOf(s) < 0; }), rnd).forEach(function (s) { if (out.length < 2) out.push(s); });
      shuffled(uniq(base).filter(function (s) { return old.indexOf(s) < 0 && out.indexOf(s) < 0; }), rnd).forEach(function (s) { if (out.length < 3) out.push(s); });
      shuffled(mine.concat(base), rnd).forEach(function (s) { if (out.length < 3 && out.indexOf(s) < 0) out.push(s); });   // 모자라면 지난 것도
      return out;
    }
    return {
      day: ymd(),
      todo: pick(pTodo, PLAN.baseTodo, previous.todo),
      letgo: pick(pLetgo, PLAN.baseLetgo, previous.letgo),
      done: [],
      personal: pTodo.length > 0
    };
  }
  // 홈이 열릴 때 새로 골라야 하는지 (PlanStore.ensure): 오늘 것이 없거나, 결과가 새로 생겼는데 아직 아무것도 체크 안 했을 때
  function needsNewPlan(plan, who, lastWho) {
    who = who || {}; lastWho = lastWho || {};
    var n = function (v) { return v == null ? null : v; };
    var changed = n(lastWho.mind) !== n(who.mind) || n(lastWho.temper) !== n(who.temper) || n(lastWho.nine) !== n(who.nine);
    var hasPersonal = who.mind != null || who.temper != null || who.nine != null;
    if (!plan) return true;
    return plan.day !== ymd() || !(plan.todo && plan.todo.length) || (changed && hasPersonal && !plan.personal && !(plan.done && plan.done.length));
  }
  var plan = {
    pools: PLAN,
    makePlan: makePlan,
    needsNewPlan: needsNewPlan,
    // 체크 · 체크 풀기
    toggle: function (p, s) { var d = (p.done || []).slice(), i = d.indexOf(s); if (i >= 0) d.splice(i, 1); else d.push(s); return Object.assign({}, p, { done: d }); }
  };

  // ── 5. 마음 지킴 (Safety.swift) ──────────────────
  // 띄어쓰기를 빼고 찾아요 ("죽고 싶" · "죽고싶" 둘 다)
  var WORDS = ['죽고싶', '죽어버리', '죽을래', '죽고말', '죽는게나', '죽으면편', '자살', '자해', '사라지고싶', '없어지고싶', '살기싫', '살고싶지않',
               '끝내고싶', '끝내버리', '그만살', '뛰어내리', '목매', '손목', '약을모아', '약먹고', '유서', '다포기하고싶', '태어나지말'];
  var HURT_WORDS = ['때려', '때렸', '때리', '맞았', '맞고', '괴롭혀', '괴롭힘', '괴롭히', '왕따', '따돌림', '따돌리', '셔틀', '돈뺏', '돈을뺏', '뺏겼',
                    '협박', '몰카', '몰래찍', '성추행', '성폭', '학대', '폭력', '일진', '저격글', '단톡방에서욕', '패드립'];
  var SOFT_WORDS = ['놀려', '놀림', '무시당', '따로놀', '끼워주지', '단톡', '욕했', '욕을', '뒷담'];
  function flat(t) { return String(t || '').split(' ').join('').split('\n').join(''); }
  function anyIn(t, list) { return list.some(function (w) { return t.indexOf(w) >= 0; }); }
  function risky(text) { return anyIn(flat(text), WORDS); }
  function hurt(text) { return anyIn(flat(text), HURT_WORDS); }
  function soft(text) { return anyIn(flat(text), SOFT_WORDS); }
  // 'life' = 마음 지킴 화면 · 'hurt' = 폭력 도움 화면 · null = 괜찮음 (life 나 hurt 면 AI 에 보내지 말고 멈춰요)
  // 앱은 이때 날짜를 riskDays · hurtDays 에 적고, 가벼운 신호(soft)는 softDays 에만 적어요 (글은 남기지 않음)
  function check(text) {
    if (risky(text)) return 'life';
    if (hurt(text)) return 'hurt';
    return null;
  }
  // 마음 지킴 규칙: 최근 7일 '많이 힘들어' 3번 이상, 또는 3일 연속 (Stats.needsHelp)
  function needsHelp(checkins, now) {
    var week = lastDays(checkins, 7, now);
    if (week.filter(function (c) { return c && c.mood === 1; }).length >= 3) return true;
    var last3 = week.slice(-3);
    return last3.length === 3 && last3.every(function (c) { return c && c.mood === 1; });
  }
  // 요즘 많이 힘든지 (홈 카드 · AI 말투): 위험한 말 7일 2번 이상 · 힘든 날 5일 이상 · 많이 힘든 날 규칙
  // days = { riskDays:[밀리초], hurtDays:[…], softDays:[…] } (이 기기에 적어 둔 날짜, 없으면 빈 것)
  function needsCare(checkins, days, now) {
    days = days || {};
    var week = lastDays(checkins, 7, now).filter(Boolean);
    return countWithin(days.riskDays, 7, now) >= 2 || week.filter(function (c) { return c.mood <= 2; }).length >= 5 || needsHelp(checkins, now);
  }
  // 폭력 · 괴롭힘이 걱정될 때 (홈 카드): 폭력 말 2주 안 · 가벼운 신호 일주일 2번 · '친구' 때문에 힘든 날 일주일 3번
  function needsHurtCare(checkins, days, now) {
    days = days || {};
    var week = lastDays(checkins, 7, now).filter(Boolean);
    var friendBad = week.filter(function (c) { return c.mood <= 2 && (c.reasons || []).indexOf('친구') >= 0; }).length;
    return countWithin(days.hurtDays, 14, now) >= 1 || countWithin(days.softDays, 7, now) >= 2 || friendBad >= 3;
  }

  // 도움 기관 (모드별): name · detail · tel · sms · web
  var HELP = {
    student: [
      { name: '청소년상담 1388', detail: '전화 · 문자(#1388) · 카카오톡 · 누리집, 24시간. 가까운 청소년상담복지센터로도 이어 줘요', tel: '1388', sms: '#1388', web: 'https://www.cyber1388.kr' },
      { name: '자살예방상담 109', detail: '죽고 싶은 마음이 들 때 · 24시간', tel: '109' },
      { name: 'Wee클래스', detail: '우리 학교 상담실 · 상담 선생님께 바로' },
      { name: 'Wee센터', detail: '교육지원청이 운영하는 상담 센터 · 지역마다 있어요', web: 'https://www.wee.go.kr' },
      { name: '청소년상담복지센터', detail: '시 · 군 · 구마다 있는 상담 기관 (전국 240곳) · 1388로 걸면 가까운 곳으로 이어 줘요', web: 'https://www.mogef.go.kr/cc/ccy/cc_ccy_f003.do' }
    ],
    teacher: [
      { name: '교권 · 마음 상담 1395', detail: '선생님을 위한 직통 번호 · 교육활동 침해 상담 · 심리 상담 · 법률 지원', tel: '1395' },
      { name: '교육활동보호센터', detail: '소속 시 · 도교육청에서 운영 · 개인 상담 · 치유 프로그램 (교원치유지원센터라고도 불러요)' },
      { name: '자살예방상담 109', detail: '마음이 아주 힘들 때 · 24시간', tel: '109' },
      { name: '정신건강 위기상담 1577-0199', detail: '지역 정신건강복지센터로 이어 줘요 · 24시간', tel: '15770199' }
    ],
    // 전체 · 부모 · 직장인 (앱의 default)
    adult: [
      { name: '자살예방상담 109', detail: '마음이 아주 힘들 때 · 24시간', tel: '109' },
      { name: '정신건강 위기상담 1577-0199', detail: '지역 정신건강복지센터로 이어 줘요 · 24시간', tel: '15770199' },
      { name: '정신건강복지센터', detail: '시 · 군 · 구마다 있는 무료 상담 기관' }
    ]
  };
  function helpLines(mode) { mode = modeOf(mode); return (HELP[mode] || HELP.adult).slice(); }
  // 문자 주소: '#' 은 %23 으로
  function smsHref(s) { return 'sms:' + String(s).split('#').join('%23'); }

  // 🚨 폭력 · 괴롭힘 도움 화면 (HurtView): 모드에 따라 보이는 것만 골라 돌려줘요
  function hurtView(mode) {
    var m = modeOf(mode), rows = [];
    var showReport = m === 'student' || m === 'parent' || m === 'teacher' || m === 'all';
    if (showReport) {
      rows.push({ name: '문자로 신고 #0117', detail: '전화가 어려우면 문자로 보내요', sms: '#0117' });
      rows.push({ name: '안전Dream 온라인 신고', detail: '경찰청 누리집에서 글로 신고 · 상담', web: 'https://www.safe182.go.kr' });
    }
    if (m === 'student') {
      rows.push({ name: '학교에 알리기', detail: 'Wee클래스 상담 선생님 · 학교폭력 담당 선생님 · 믿을 수 있는 어른(보호자)' });
      rows.push({ name: '청소년상담 1388', detail: '마음이 힘들 때 이야기 · 전화 · 문자(#1388)', tel: '1388', sms: '#1388' });
    }
    if (m === 'teacher') {
      rows.push({ name: '학교 절차', detail: '학교폭력 책임교사 · 관리자에게 바로 알리고, 피해 학생의 안전부터 지켜요. 교육지원청과 함께 처리해요.' });
      rows.push({ name: '교권 · 마음 상담 1395', detail: '선생님이 폭력 · 위협을 겪었을 때', tel: '1395' });
    }
    if (m === 'worker' || m === 'all' || m === 'parent') {
      rows.push({ name: '여성긴급전화 1366', detail: '가정폭력 · 성폭력 · 24시간', tel: '1366' });
    }
    return {
      title: m === 'student' ? '학교폭력 도움' : '폭력 · 괴롭힘 도움',
      heading: m === 'student' ? '네 잘못이 아니야.' : m === 'teacher' ? '혼자 떠안지 않아도 돼요.' : '혼자 참지 않아도 돼요.',
      body: m === 'student' ? '누군가 때리거나, 괴롭히거나, 따돌리거나, 돈을 뺏거나, 단톡방에서 괴롭히는 건 모두 학교폭력이에요. 혼자 참지 말고 알려 줘요. 알리는 건 고자질이 아니라 나를 지키는 일이에요.'
        : m === 'parent' ? '아이가 맞거나 괴롭힘을 당했다면 아이 말을 끝까지 들어 주고, 아이 잘못이 아니라고 먼저 말해 주세요. 그리고 학교와 117에 함께 알려요.'
        : m === 'teacher' ? '학생의 학교폭력이 의심되면 학교 절차대로 바로 알리고, 선생님 자신이 폭력이나 위협을 겪었다면 1395와 함께 이야기해요.'
        : '폭력이나 위협을 겪고 있다면 혼자 견디지 말고 바로 알려요.',
      // 증거와 함께 (직장인 모드에서는 안 보여요)
      evidence: m === 'worker' ? null : {
        title: '신고할 때는 증거와 함께',
        body: "양쪽 말이 서로 다르면 '증거 불충분'으로 인정되지 않을 수 있어요. 피해 사실을 육하원칙에 따라 구체적으로 기록하고, 메시지 캡처 · 사진 · 진단서 같은 증거자료를 확보해서 신고하는 것이 좋아요.",
        buttons: ['피해 기록장', '절차 · 조치 알아보기']
      },
      // 117 큰 단추 (직장인 모드 빼고)
      big117: showReport ? { tel: '117', title: '117 학교폭력 신고', sub: '24시간 · 상담도 함께 해요' } : null,
      rows: rows,
      call112: '지금 위험하면 112',
      tipsTitle: m === 'student' ? '알릴 때 도움이 되는 것' : '기록해 두면 좋은 것',
      tips: ['언제 · 어디서 · 누가 · 무엇을 했는지 날짜와 함께 적어 두기',
             '단톡방 · 메시지 · SNS 는 지우지 말고 화면 캡처',
             '다친 곳은 사진, 병원에 갔다면 진료 기록',
             '본 친구가 있다면 누구였는지'],
      tipsNote: '신고했다고 보복하는 것은 법으로 금지돼 있어요. 보복이 걱정되면 그것도 함께 말해요.',
      helpLink: '마음이 많이 힘들면 · 도움 받을 곳',
      close: '닫기'
    };
  }

  var safety = {
    words: WORDS,
    hurtWords: HURT_WORDS,
    softWords: SOFT_WORDS,
    risky: risky, hurt: hurt, soft: soft,
    check: check,
    needsHelp: needsHelp,
    needsCare: needsCare,
    needsHurtCare: needsHurtCare,
    countWithin: countWithin,
    keepDays: 60,                 // 날짜 기록은 마지막 60개만
    helpLines: helpLines,
    helpByMode: HELP,
    smsHref: smsHref,
    hurtView: hurtView,
    // 🛟 마음 지킴 화면 (위험한 말이 보였을 때 바로)
    safetyView: {
      title: '마음 지킴',
      heading: '말해 줘서 고마워요.',
      body: '지금 많이 힘든 마음이 느껴져요. 이 마음을 혼자 안고 있지 않았으면 해요. 지금 바로 이야기할 수 있는 곳이 있어요.',
      big109: { tel: '109', title: '109에 전화하기', sub: '자살예방상담 · 24시간 · 무료' },
      // 그 아래에는 helpLines(mode) 중 109 아닌 것
      emergency: [{ tel: '112', label: '112 경찰' }, { tel: '119', label: '119 구급' }],
      emergencyNote: '지금 바로 위험하다면 망설이지 말고 112 · 119에 전화해요.',
      trustSms: '나 지금 좀 힘들어. 잠깐 이야기할 수 있어?',
      rows: [
        { key: 'trust', icon: 'message.fill', title: '믿는 사람에게 연락하기', sub: '"나 지금 좀 힘들어. 잠깐 이야기할 수 있어?"를 보내요' },
        { key: 'plan', icon: 'list.bullet.clipboard', title: '나의 안전 계획 꺼내 보기', sub: '미리 적어 둔 연락할 사람 · 진정되는 것' },
        { key: 'breath', icon: 'wind', title: '지금 1분만 숨 고르기', sub: '숨을 길게 내쉬면 몸의 경보가 조금 줄어요' },
        { key: 'senses', icon: 'ear', title: '5 · 4 · 3 · 2 · 1 감각 찾기', sub: '지금 여기로 돌아오기' }
      ],
      footNote: '쓴 글은 그대로 남아 있어요. 이 화면은 언제든 ☰ 메뉴 › 힘들 때에서 다시 열 수 있어요.',
      close: '조금 괜찮아요'
    },
    // 힘들 때 (모드별 도움 기관)
    helpView: {
      title: '힘들 때',
      heading: '말해 줘서 고마워요.\n혼자 버티지 않아도 돼요.',
      planButton: '나의 안전 계획 보기 · 적기',
      note: '지금 바로 위험하면 112 · 119. 마음한편은 진단하거나 상담을 대신하지 않아요.'
    },
    // 🗒 나의 안전 계획
    planView: {
      title: '나의 안전 계획',
      intro: '마음이 괜찮을 때 미리 적어 두면, 힘든 순간에 무엇을 할지 바로 꺼내 볼 수 있어요. 자살 예방에서 널리 쓰는 방법이에요.',
      parts: [
        { key: 'signs',  title: '1. 나의 위험 신호',          hint: "예) 잠이 안 온다, 방에서 안 나간다, '다 귀찮다'는 생각이 계속 든다" },
        { key: 'calm',   title: '2. 나를 진정시키는 것',      hint: '예) 발바닥 느끼기, 샤워, 좋아하는 노래, 산책' },
        { key: 'place',  title: '3. 마음이 편해지는 곳 · 사람', hint: '예) 도서관, 할머니 집, 친구와 통화' },
        { key: 'people', title: '4. 연락할 사람과 번호',      hint: '예) 언니 010-…, 상담 선생님 …' },
        { key: 'pro',    title: '5. 전문 기관',               hint: '예) 109, 1388, 동네 상담센터 번호' },
        { key: 'safe',   title: '6. 위험한 물건 멀리 두기',    hint: '예) 약은 가족에게 맡기기' },
        { key: 'reason', title: '7. 내가 살아갈 이유',         hint: '예) 우리 강아지, 하고 싶은 일, 소중한 사람' }
      ],
      note: '이 계획은 내 계정에만 저장돼요.'
    },
    // 홈 맨 위 '마음 지킴' 카드
    careBanner: { icon: 'heart.text.square.fill', title: '요즘 많이 힘들었구나', sub: '혼자 버티지 않아도 돼요 · 도움 받을 곳 · 안전 계획' },
    // 홈 카드: 폭력 · 괴롭힘
    hurtBanner: function (mode) {
      var st = modeOf(mode) === 'student';
      return { icon: 'hand.raised.fill', title: st ? '혹시 친구 때문에 많이 힘드니?' : '폭력 · 괴롭힘이 걱정된다면', sub: st ? '괴롭힘이라면 혼자 참지 말고 알려요 · 117' : '도움 받을 곳 · 117 · 112' };
    }
  };

  // ── 7. 숨 고르기 · 몸 활동 (TrainView.swift) ──────
  // 숨 고르기: 준비 3초 → 4초 들이쉬고 6초 내쉬기 × 6번 = 60초
  var breath = {
    ready: 3,
    inhale: 4,
    exhale: 6,
    cycle: 10,
    total: 60,
    steps: 6,
    // 지금 상태 (t0 = 화면이 열린 뒤 지난 초): 앱 BreathView 의 계산 그대로
    at: function (t0) {
      t0 = Math.max(0, t0);
      var preparing = t0 < 3, t = Math.max(0, t0 - 3), cyc = t % 10, inhale = cyc < 4;
      var raw = preparing ? 0 : (inhale ? cyc / 4 : 1 - (cyc - 4) / 6);   // 0 = 다 내쉰 · 1 = 다 들이쉰
      var done = t >= 60;
      return {
        preparing: preparing, inhale: inhale, done: done, t: t,
        raw: raw, k: (1 - Math.cos(raw * Math.PI)) / 2,                     // 원 크기는 부드럽게
        left: preparing ? Math.ceil(3 - t0) : Math.ceil(inhale ? 4 - cyc : 10 - cyc),
        step: done ? null : Math.min(5, Math.floor(t / 10)),
        title: done ? breath.text.doneTitle : preparing ? breath.text.readyTitle : (inhale ? breath.text.inTitle : breath.text.outTitle),
        sub: done ? breath.text.doneSub : preparing ? breath.text.readySub : (inhale ? breath.text.inSub : breath.text.outSub)
      };
    },
    text: {
      title: '호흡',
      rowSub: '1분 동안 숨을 천천히 들이쉬고 내쉬어요',
      readyTitle: '준비해요', readySub: '편하게 앉아 숨을 한 번 내쉬어요',
      inTitle: '들이쉬어요', inSub: '코로 천천히 · 4초 동안 원이 커져요',
      outTitle: '내쉬어요', outSub: '입으로 길게 · 6초 동안 원이 작아져요',
      doneTitle: '잘했어요', doneSub: '1분 숨 고르기를 마쳤어요',
      stop: '그만하기', finish: '끝내기',
      stepOf: function (i, n) { return (i + 1) + ' / ' + n + ' 단계'; },
      allDone: '다 했어요',
      next: function (name) { return '다음 · ' + name; },
      week: function (n) { return '이번 주 ' + n + '번'; }
    }
  };

  // 몸으로 하는 마음근력 (Move): 단계 [이름, 그림, 초, 안내]
  var MOVES = [
    { key: 'ground', title: '발바닥 느끼기', icon: 'shoeprints.fill', sub: '발이 땅에 닿은 느낌에 마음 두기 (1분)', steps: [
      ['발 붙이기', 'shoeprints.fill', 20, '의자에 앉아 두 발을 바닥에 붙여요. 발가락을 꼼지락거려 봐요.'],
      ['무게 느끼기', 'arrow.down.to.line', 20, '몸무게가 발바닥으로 내려가는 느낌을 느껴요. 뒤꿈치 → 발가락 → 발 옆면.'],
      ['발바닥에 마음 두기', 'wind', 20, '발바닥 느낌에 마음을 둔 채 천천히 숨을 쉬어요. 생각이 떠오르면 다시 발바닥으로.']] },
    { key: 'face', title: '얼굴 풀기', icon: 'face.smiling', sub: '미간 · 눈 · 턱 · 볼 힘 빼기 (1분)', steps: [
      ['이마 · 미간 펴기', 'face.smiling', 15, '눈썹을 위로 올렸다가 툭 내려놓아요. 미간에 들어간 힘을 풀어요.'],
      ['눈 꼭 감았다 풀기', 'eye', 15, '눈을 꼭 감았다가 천천히 풀어요. 세 번 해요.'],
      ['턱 풀기', 'mouth', 15, "어금니를 살짝 떼고, 입을 '아' 하고 크게 벌렸다 닫아요. 혀는 입천장에서 내려놓아요."],
      ['볼 · 입꼬리', 'hand.raised', 15, '손바닥으로 볼을 둥글게 문질러요. 마지막에 입꼬리를 살짝 올려요.']] },
    { key: 'neck', title: '목 · 어깨 풀기', icon: 'figure.arms.open', sub: '승모근 · 목 옆 늘이기 (1분 20초)', steps: [
      ['어깨 올렸다 툭', 'arrow.up.and.down', 20, '숨을 들이쉬며 어깨를 귀 쪽으로 끌어올렸다가, 내쉬며 툭 떨어뜨려요. 세 번.'],
      ['어깨 뒤로 돌리기', 'arrow.triangle.2.circlepath', 20, '어깨를 천천히 뒤로 크게 다섯 번 돌려요.'],
      ['목 오른쪽', 'arrow.right', 20, '오른쪽 귀를 오른쪽 어깨 쪽으로 천천히 기울여요. 왼쪽 어깨는 아래로 내려요.'],
      ['목 왼쪽', 'arrow.left', 20, '이번엔 왼쪽 귀를 왼쪽 어깨 쪽으로. 아프면 조금만 기울여요.']] },
    { key: 'stretch', title: '앉아서 기지개', icon: 'figure.flexibility', sub: '깍지 끼고 위로 · 옆구리 · 가슴 펴기 (1분)', steps: [
      ['위로 쭉', 'arrow.up', 20, '두 손을 깍지 끼고 손바닥이 하늘을 보게 위로 쭉 뻗어요.'],
      ['옆구리 늘이기', 'arrow.left.and.right', 20, '깍지 낀 채로 오른쪽으로 10초, 왼쪽으로 10초 몸을 기울여요.'],
      ['가슴 펴기', 'figure.arms.open', 20, '두 손을 등 뒤에서 깍지 끼고 가슴을 활짝 펴요. 숨을 크게 들이쉬어요.']] },
    { key: 'hands', title: '손 풀기', icon: 'hand.raised', sub: '손 털기 · 손바닥 꾹꾹 · 손가락 쭉 (1분)', steps: [
      ['손 털기', 'hand.raised', 20, '두 손에 힘을 빼고 털털 털어요. 물기를 털듯 가볍게.'],
      ['손바닥 꾹꾹', 'hand.point.up.left', 20, '엄지로 다른 손바닥 가운데를 천천히 꾹꾹 눌러요. 10초씩 양손.'],
      ['손가락 쭉', 'hand.wave', 20, '손가락을 하나씩 살짝 당겼다 놓아요. 마지막에 주먹 쥐었다 활짝.']] },
    { key: 'eyes', title: '눈 쉬기', icon: 'eye', sub: '먼 곳 보기 · 눈 굴리기 · 손바닥 덮기 (1분)', steps: [
      ['먼 곳 보기', 'binoculars', 20, '창밖이나 방 끝, 가장 먼 곳을 바라봐요. 화면은 잠깐 쉬어요.'],
      ['눈 굴리기', 'arrow.clockwise', 20, '고개는 그대로, 눈만 천천히 위 · 오른쪽 · 아래 · 왼쪽으로 크게 돌려요.'],
      ['손바닥 덮기', 'hand.raised', 20, '두 손바닥을 비벼 따뜻하게 한 뒤 눈 위에 살며시 얹어요.']] },
    { key: 'senses', title: '5 · 4 · 3 · 2 · 1 감각 찾기', icon: 'ear', sub: '보이는 것 · 들리는 것으로 지금 여기 (1분 10초)', steps: [
      ['보이는 것 5개', 'eye', 20, '주변에서 보이는 것 다섯 개를 마음속으로 하나씩 이름 불러요.'],
      ['만져지는 것 4개', 'hand.raised', 15, '옷, 의자, 책상처럼 몸에 닿는 것 네 개를 느껴요.'],
      ['들리는 것 3개', 'ear', 15, '가까운 소리, 먼 소리 세 개를 찾아 귀를 기울여요.'],
      ['냄새 2개 · 맛 1개', 'nose', 20, '나는 냄새 두 개, 입안의 맛 하나를 느껴요. 지금 여기로 돌아왔어요.']] },
    { key: 'heart', title: '손 얹고 숨 쉬기', icon: 'heart.circle', sub: '가슴에 손 얹고 나에게 다정하게 (1분)', steps: [
      ['손 얹기', 'heart', 20, '한 손은 가슴에, 한 손은 배에 살며시 얹어요. 손의 따뜻함을 느껴요.'],
      ['손 아래 숨', 'wind', 20, '숨 쉴 때 손 아래가 오르내리는 걸 느껴요. 천천히, 길게 내쉬어요.'],
      ['나에게 한마디', 'quote.bubble', 20, '마음속으로 말해요. "오늘도 애썼어. 괜찮아."']] },
    { key: 'body', title: '몸 알아차리기', icon: 'figure.stand', sub: '발바닥 · 얼굴 · 어깨 한 번에 (1분 40초)', steps: [
      ['발바닥 느끼기', 'shoeprints.fill', 40, '두 발을 바닥에 붙이고, 발바닥이 땅에 닿아 있는 느낌에만 마음을 두어요. 뒤꿈치 · 발가락 · 발 옆면을 차례로 느껴 봐요.'],
      ['얼굴 풀기', 'face.smiling', 30, '이마와 미간을 펴요. 어금니를 살짝 떼고, 혀를 입천장에서 내려놓아요. 눈 주변 힘도 스르르 빼요.'],
      ['어깨 풀기', 'figure.arms.open', 30, '숨을 들이쉬며 어깨를 귀 쪽으로 끌어올렸다가, 내쉬며 툭 떨어뜨려요. 천천히 세 번 해요.']] }
  ].map(function (m) {
    m.steps = m.steps.map(function (s) { return { title: s[0], icon: s[1], sec: s[2], guide: s[3] }; });
    m.total = m.steps.reduce(function (a, s) { return a + s.sec; }, 0);
    return m;
  });
  breath.moves = MOVES;
  breath.move = function (key) { for (var i = 0; i < MOVES.length; i++) if (MOVES[i].key === key) return MOVES[i]; return null; };
  // 오늘의 몸 활동: 날마다 하나씩 돌아가며 (올해 몇째 날 % 9)
  breath.moveToday = function (date) { return MOVES[dayOfYear(date) % MOVES.length]; };
  breath.moveText = {
    doneTitle: '잘했어요',
    doneSub: '몸이 조금 가벼워졌나요? 이 느낌을 기억해 둬요.',
    careNote: '\n아프면 멈추고, 할 수 있는 만큼만 해요.',   // 목 · 어깨 · 기지개 첫 단계에 붙여요
    careKeys: ['neck', 'stretch']
  };
  // 마음근력 탭 글
  breath.train = {
    title: '마음근력',
    thanks: { title: '감사 한 줄 쓰기', sub: '오늘 고마웠던 일 하나', ask: '오늘 고마웠던 일 하나는?', example: '예) 급식에 좋아하는 반찬이 나왔다' },
    selfKind: { title: '나에게 다정하게 한 줄 쓰기', sub: '친한 친구에게 하듯 나에게 한마디', ask: '힘들었던 나에게, 친한 친구에게 하듯 한마디', example: '예) 오늘 많이 애썼어. 실수해도 괜찮아' },
    save: '남기기',
    recent: '최근에 쓴 마음',
    about: '마음근력은 마음을 다스리고(자기 조절), 사람과 잘 지내고(대인 관계), 스스로 힘을 내는(자기 동기) 힘이에요. 몸 근육처럼 매일 조금씩 하면 자라요.'
  };

  // ── 8. AI 마음 티쳐 화면 글 (HomeShapes.swift · AI.swift · AILog.swift) ──
  var AI_KINDS = { translate: '내 마음 번역', other: '그 사람 이해하기', ask: '물어보기', talk: '이야기' };
  var aiNames = {
    teacher: 'AI 마음 티쳐',
    kinds: AI_KINDS,
    kindName: function (t) { return AI_KINDS[t] || 'AI 마음 티쳐'; },
    maxChars: 500,
    // 처음 글을 보낼 때 한 번 묻는 창
    consent: {
      title: 'AI 마음 티쳐에게 보낼까요?',
      message: '적은 글은 답을 만들기 위해 Anthropic(Claude)의 AI로 보내져요. 마음한편 서버에는 저장하지 않아요. 이름 · 연락처 같은 개인 정보는 쓰지 말아 주세요.',
      ok: '보내기',
      cancel: '그만두기'
    },
    // 답 카드 (생각 중 · 위험할 때)
    card: {
      loading: 'AI 마음 티쳐가 생각하고 있어요…',
      crisisTitle: '많이 힘든 이야기 같아요. 혼자 견디지 않아도 돼요.',
      crisisBody: '지금 바로 이야기할 수 있는 곳이 있어요: 109(24시간) · 1388(청소년) · 위험하면 112',
      crisisButton: '도움 받을 곳 보기'
    },
    // 6 마음 번역
    translate: {
      segMine: '내 마음 풀어 보기',
      segOther: '그 사람 이해하기',
      captionMine: '지금 마음을 그대로 적어 보세요',
      captionOther: '궁금한 사람의 말투 · 행동을 적어 보세요 (이름은 빼고) · 숨은 마음 도감에서도 찾아 줘요',
      count: function (n) { return n + ' / 500'; },
      draftSaved: '· 임시 저장됨',
      clear: '글 비우기',
      button: '풀어 보기',
      minChars: 4,
      titleMine: 'AI 마음 티쳐의 마음 번역 · 내 마음',
      titleOther: 'AI 마음 티쳐의 마음 번역 · 그 사람의 마음',
      whyLabel: '왜 그럴까요',
      tryLabel: '해 볼 것',
      fallback: '쓴 글은 아래 지난 기록에 남겼어요. AI 마음 티쳐와 연결되지 않아 지금은 풀이를 만들지 못했어요. 인터넷과 로그인을 확인해 주세요.',
      ringNew: '숨은 마음 도감 · 새로 찾았어요!',
      ringOld: '숨은 마음 도감 · 이미 찾은 마음',
      ringLine: function (t) { return 'No.' + no3(t.no) + ' 「' + t.hint + '」 ' + t.name; },
      ringSub: '보고서 보기 · 이렇게 대응해 보세요',
      ringWho: '그 사람',
      historyMine: '지난 마음 번역',
      historyOther: "지난 '그 사람 이해하기'"
    },
    // 7 물어보기
    ask: {
      placeholder: '마음에 대해 무엇이든 물어보세요',
      suggestions: ['왜 자꾸 비교하게 될까', '잠이 안 올 때', '거절하는 법'],
      title: 'AI 마음 티쳐의 답',
      fallback: '물어본 것은 오늘 페이지에 담아 두었어요. 지금은 AI 마음 티쳐와 연결되지 않아요. 그동안 아래 활동을 해 볼까요?',
      history: '지난 물음',
      helpCard: { title: '힘들 때 도움', sub: '상담 전화 · 기관' }
    },
    // 8 이야기
    talk: {
      heading: '무엇이 마음에 걸려요?',
      sub: function (pages) { return 'AI 마음 티쳐가 들을게요 · ' + pages + '쪽째 함께하는 중'; },
      placeholder: '마음을 털어놓아 보세요',
      send: 'AI 마음 티쳐에게 보내기',
      sendShort: '보내기',
      tiles: [
        { key: 'checkin', title: '오늘 있었던 일', sub: '한 편으로 정리하기' },
        { key: 'body', title: '몸 알아차리기', sub: '발바닥 · 얼굴 · 어깨' },
        { key: 'breath', title: '잠들기 전', sub: '1분 숨 고르기' },
        { key: 'face', title: '얼굴 풀기', sub: '미간 · 턱 힘 빼기' }
      ],
      history: '지난 이야기',
      todayChat: '오늘 나눈 이야기',
      newChat: '새 이야기',
      continuePlaceholder: '이어서 이야기해 보세요',
      listening: 'AI 마음 티쳐가 듣고 있어요…',
      fallback: '들려줘서 고마워요. 쓴 글은 지난 이야기에 남겼어요. 지금은 AI 마음 티쳐와 연결되지 않아서, 대신 1분 숨 고르기를 해 볼까요?',
      historySend: 6     // 앞의 대화는 6개까지 함께 보내요
    },
    // 지난 기록 목록
    history: {
      count: function (n) { return n + '개'; },
      noAnswer: '답을 받지 못했어요 · 쓴 글은 남아 있어요',
      edit: '고치기',
      reuse: '이 글로 다시',
      remove: '지우기',
      removeLong: '이 기록 지우기',
      removeTitle: '이 기록을 지울까요?',
      removeNote: '다른 기기에서도 함께 지워져요.',
      ringLink: function (t) { return '숨은 마음 도감 · No.' + no3(t.no) + ' ' + t.name; },
      editTitle: '고치기',
      editLabel: '내가 쓴 글',
      editNote: '글만 고쳐요. AI 마음 티쳐의 답은 그대로 남아요.',
      editSave: '저장',
      editCancel: '그만'
    }
  };

  window.MaumContent = {
    version: '2026-11-25',
    util: { ymd: ymd, dayOfYear: dayOfYear, lastDays: lastDays, no3: no3 },
    modes: { order: MODE_ORDER, list: MODES, get: function (m) { return MODES[modeOf(m)]; } },
    dex: dex,
    home: home,
    checkin: checkin,
    plan: plan,
    safety: safety,
    breath: breath,
    aiNames: aiNames
  };
})();
