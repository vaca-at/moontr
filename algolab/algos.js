/* =====================================================================
   알고리즘 실험실 (moontr.site/algolab) · 주제마다 알고리즘 설정
   - 학생 화면(algolab/index.html)과 선생님 화면(datalab/admin)이 함께 써요.
   - 주제 하나 = 설정 하나. 새 주제를 열려면 아래 A 에 하나 더 쓰고 OPEN 에 번호를 넣어요.
   설정 모양
     fn 함수 이름 · title 제목 · unit 결과 단위 · intro 상황 · rows() 입력 표 · cols 표 머리 [이름, 칸, 꾸밈]
     outs 출력 고르기 (첫째가 정답) · crit 기준 3개 (첫째 = AI가 처음 고른 기준) · param 막대(기준 하나에 붙음)
     cards 기본 규칙 카드 (적힌 순서가 정답) · start 처음 섞인 순서 · optc 조건 카드
     run(rows, s, N) 결과 숫자 목록 · tests(s) 테스트 (need 개수만큼 앞에서부터 꼭 통과)
     code(s) 코드 글 · cmp 공정성 비교 두 칸 · find(rows, A, C, s) 저절로 찾은 것 · calc 내 계산기
   표의 숫자는 수업 연습용 예시예요 (데이터 실험실 표 + 몇 칸 더함)
   ===================================================================== */
(function () {
  const won = (v) => Number(v).toLocaleString("ko-KR");
  const K = (t) => `<span class="k">${t}</span>`, C = (t) => `<span class="c">${t}</span>`, N = (t) => `<span class="n">${t}</span>`, F = (t) => `<span class="f">${t}</span>`;
  // 비율대로 나누고(최소 보장 · 합 맞추기 선택) 정수로: 순찰 인원 · 10원 단위 몫에 함께 써요
  function allocate(vals, total, opt) {
    const k = vals.length, minEach = opt.min ? Math.min(opt.minN, Math.floor(total / k)) : 0, rest = total - minEach * k;
    const sum = vals.reduce((a, b) => a + b, 0);
    const raw = vals.map((v) => minEach + (sum ? v / sum * rest : rest / k));
    if (!opt.fit || !raw.every(isFinite)) return raw.map((x) => Math.round(x));
    const out = raw.map((x) => Math.floor(x)), order = raw.map((x, i) => [i, x - Math.floor(x)]).sort((a, b) => b[1] - a[1]).map((p) => p[0]);
    for (let d = total - out.reduce((a, b) => a + b, 0), j = 0; d > 0; d--, j = (j + 1) % k) out[order[j]]++;
    return out;
  }
  const A = {};

  /* ───────── 01 순찰 배분 ───────── */
  A.j1 = {
    fn: "순찰배분", title: "순찰 인력 배분 알고리즘", unit: "명", total: 20,
    intro: "우리 시 경찰서에 순찰 인원이 <b>20명</b> 있어요. 6개 구에 몇 명씩 보낼지 정하는 알고리즘을 만들어요. AI는 “범죄 건수가 가장 많은 B구에 집중해야 한다”고 했어요.",
    rows: () => [["A구", "번화가 · 지하철역 3곳", 4200, 120000, 260000], ["B구", "아파트 주거지", 5100, 300000, 30000], ["C구", "대학가", 2600, 140000, 110000], ["D구", "신도시", 3900, 380000, 40000], ["E구", "공단 · 물류창고", 1800, 90000, 70000], ["F구", "구도심 · 전통시장", 2400, 160000, 90000]]
      .map(([이름, 특징, 건수, 인구, 유동]) => ({ 이름, 특징, 건수, 인구, 유동 })),
    cols: [["구", "이름"], ["특징", "특징"], ["범죄 건수(건)", "건수"], ["인구(명)", "인구"], ["하루 유동 인구(명)", "유동"]],
    outs: ["구마다 보낼 순찰 인원 (모두 더하면 20명)", "가장 위험한 구 한 곳의 이름", "구마다 범죄 건수의 순위"],
    outNo: "그건 중간에 계산하는 값일 수 있지만, 경찰서가 실제로 정해야 하는 건 ‘몇 명씩 보낼지’예요.",
    crit: [{ id: "count", name: "범죄 건수 그대로", sub: "많이 일어난 곳에 많이 · AI가 처음 고른 기준" }, { id: "per", name: "인구 10만 명당 범죄", sub: "사는 사람 수로 나눠 같은 기준으로 비교" }, { id: "mix", name: "10만 명당 + 유동 인구 반영", sub: "오가는 사람이 많은 번화가도 함께 고려 · 반영 비율을 정해요" }],
    param: { crit: "mix", label: "유동 인구를 얼마나 반영할까?", min: 0, max: 100, step: 10, def: 30, unit: "%", left: "사는 사람만 (0%)", right: "오가는 사람도 똑같이 (100%)" },
    cards: [{ tag: "반복", text: "구마다 위험도를 구한다 (고른 기준대로)" }, { tag: "반복", text: "모든 구의 위험도를 더해 합계를 구한다" }, { tag: "계산", text: "구마다 내 위험도 ÷ 합계 × 순찰 인원" }, { tag: "계산", text: "소수점은 반올림해 사람 수로 만든다" }],
    start: [2, 0, 3, 1], orderHint: "합계를 알아야 비율을 구할 수 있어요.",
    optc: [{ id: "fit", text: "만약 합이 순찰 인원과 다르면 → 소수점이 큰 구부터 1명씩 맞춘다" }, { id: "zero", text: "만약 인구가 0이면 → 위험도를 0으로 둔다 (나눌 수 없으니까)" }, { id: "min", text: "모든 구에 최소", n: [1, 2, 3], after: "명은 보낸다" }],
    risk(rows, s) { return rows.map((r) => { if (s.crit === "count") return r.건수; const den = r.인구 + (s.crit === "mix" ? s.p / 100 * r.유동 : 0); if (!r.인구 && s.crit === "per") return s.zero ? 0 : NaN; if (!den) return s.zero ? 0 : NaN; return r.건수 / den * 100000; }); },
    run(rows, s, total = 20) { return allocate(this.risk(rows, s), total, { fit: s.fit, min: s.min, minN: s.minN }); },
    need: 3,
    tests(s) {
      const base = this.rows(), r1 = this.run(base, s), ok1 = r1.every(isFinite) && r1.reduce((a, b) => a + b, 0) === 20;
      const z = [...base, { 이름: "G구", 특징: "새 산업단지 (주민 0명)", 건수: 30, 인구: 0, 유동: 5000 }], r2 = this.run(z, s), ok2 = s.crit === "count" || (r2.every((v) => isFinite(v) && v >= 0) && r2.reduce((a, b) => a + b, 0) === 20);
      const tw = base.map((r) => ({ ...r })); tw[5] = { ...tw[2], 이름: "F구" }; const r3 = this.run(tw, s);
      return [
        { name: "모든 구를 더하면 순찰 인원과 같다", ok: ok1, hint: "반올림하면 합이 달라질 수 있어요 → ‘합 맞추기’ 조건 카드" },
        { name: "주민이 0명인 구가 있어도 멈추지 않는다", ok: ok2, hint: "0으로 나누면 계산이 망가져요 → ‘인구가 0이면’ 조건 카드" },
        { name: "위험도가 같은 두 구는 거의 같은 인원을 받는다 (차이 1명 이하)", ok: r3.every(isFinite) && Math.abs(r3[2] - r3[5]) <= 1, hint: "규칙을 다시 확인해 봐요" },
        { name: "순찰을 한 명도 못 받는 구가 없다", ok: r1.every((v) => v >= 1), hint: "꼭 필요할까요? 켜면 누가 얻고 누가 잃을까요? → ‘최소 인원’ 조건 카드", q: true }
      ];
    },
    code(s, cn) {
      const den = s.crit === "per" ? "구.인구" : `(구.인구 + ${N(s.p / 100)} * 구.유동)`;
      return [`${K("function")} ${F("순찰배분")}(구들, 인원) {`, `  ${C(`// 기준: ${cn}`)}`, `  ${K("const")} 위험 = 구들.map(구 =&gt; {`,
        ...(s.zero && s.crit !== "count" ? [`    ${K("if")} (구.인구 === ${N(0)}) ${K("return")} ${N(0)};   ${C("// 조건: 인구 0")}`] : []),
        `    ${K("return")} ${s.crit === "count" ? "구.건수" : `구.건수 / ${den} * ${N(100000)}`};`, `  });`, `  ${K("const")} 합계 = 위험.reduce((a, b) =&gt; a + b, ${N(0)});`,
        ...(s.min ? [`  ${K("const")} 기본 = ${N(s.minN)};   ${C("// 조건: 모든 구 최소 인원")}`] : []),
        `  ${K("let")} 순찰 = 위험.map(v =&gt; ${s.min ? "기본 + " : ""}Math.round(v / 합계 * ${s.min ? "(인원 - 기본 * 구들.length)" : "인원"}));`,
        ...(s.fit ? [`  순찰 = 합맞추기(순찰, 인원);   ${C("// 조건: 소수점 큰 구부터 1명씩")}`] : []), `  ${K("return")} 순찰;`, `}`].join("\n");
    },
    cmp: [["건수 그대로", { crit: "count", min: false }], ["10만 명당", { crit: "per", min: false }]],
    find(rows, A0, Cm) {
      const ch = rows.map((r, i) => ({ n: r.이름, g: Cm[i] - A0[i] })), up = [...ch].sort((a, b) => b.g - a.g)[0], dn = [...ch].sort((a, b) => a.g - b.g)[0], lo = Math.min(...Cm);
      return `· AI의 기준(건수 그대로)과 비교하면 <b>${up.n}</b>는 ${up.g >= 0 ? "+" : ""}${up.g}명, <b>${dn.n}</b>는 ${dn.g}명 바뀌어요.<br>· 내 알고리즘에서 가장 적게 받는 곳: <b>${rows.filter((r, i) => Cm[i] === lo).map((r) => `${r.이름}(${r.특징})`).join(", ")}</b> ${lo}명`;
    },
    loserPh: "예: ○구 주민. ‘최소 ○명’ 조건 카드를 켜서 다시 실행해 보면 …",
    calc: { label: "순찰 인원", def: 30, min: 6, max: 200, show(rows, s, v) { const r = this.run(rows, s, v); return rows.map((x, i) => `${x.이름} <b>${r[i]}</b>`).join(" · ") + ` <span class="note">(합 ${r.reduce((a, b) => a + b, 0)}명)</span>`; } }
  };

  /* ───────── 06 일수벌금 (소득 비례 벌금) ───────── */
  const fine6 = (inc, s) => {
    let f = s.crit === "same" ? 100 : s.crit === "ratio" ? inc * s.p / 100 : 50 + inc * s.p / 100;
    if (s.poor && inc < 150) f = f / 2;
    if (s.floor) f = Math.max(f, s.floorN);
    if (s.cap) f = Math.min(f, s.capN);
    return Math.round(f);
  };
  A.j6 = {
    fn: "일수벌금", title: "소득 비례 벌금 계산기", unit: "만 원",
    intro: "같은 잘못(예: 과속)을 한 다섯 사람에게 벌금을 매기는 알고리즘을 만들어요. 다섯 사람은 소득만 달라요. AI는 “모두 같은 100만 원이 법 앞의 평등”이라고 했어요.",
    rows: () => [["1분위", "소득 하위 20%", 120], ["2분위", "", 260], ["3분위", "가운데", 400], ["4분위", "", 580], ["5분위", "소득 상위 20%", 1050]].map(([이름, 특징, 소득]) => ({ 이름, 특징, 소득 })),
    cols: [["소득 분위", "이름"], ["설명", "특징"], ["월평균 소득(만 원)", "소득"]],
    outs: ["사람마다 낼 벌금(만 원)", "가장 많이 내야 할 사람 한 명", "소득의 순위"],
    outNo: "법원이 실제로 정해야 하는 건 ‘한 사람 한 사람이 낼 금액’이에요.",
    crit: [{ id: "same", name: "모두 같은 금액 (100만 원)", sub: "같은 잘못에 같은 돈 · AI가 처음 고른 기준" }, { id: "ratio", name: "월소득의 일정 비율", sub: "같은 ‘고통’을 주자 · 핀란드 · 독일의 일수벌금처럼" }, { id: "mixb", name: "기본 50만 원 + 월소득 비율", sub: "누구나 내는 기본 몫에 소득만큼 더하기" }],
    param: { crit: ["ratio", "mixb"], label: "월소득의 몇 %를 벌금으로 할까?", min: 5, max: 60, step: 5, def: 25, unit: "%", left: "가볍게 (5%)", right: "무겁게 (60%)" },
    cards: [{ tag: "반복", text: "사람마다 월소득을 읽는다" }, { tag: "계산", text: "고른 기준대로 벌금을 계산한다" }, { tag: "조건", text: "조건 카드(감면 · 최소 · 최대)를 적용한다" }, { tag: "계산", text: "만 원 단위로 반올림한다" }],
    start: [1, 3, 0, 2], orderHint: "먼저 소득을 읽어야 계산할 수 있고, 반올림은 맨 마지막이에요.",
    optc: [{ id: "poor", text: "만약 월소득이 150만 원보다 적으면 → 벌금을 절반으로" }, { id: "floor", text: "누구든 벌금은 최소", n: [10, 30, 50], after: "만 원" }, { id: "cap", text: "벌금은 아무리 많아도", n: [300, 500, 1000], after: "만 원까지" }],
    run(rows, s) { return rows.map((r) => fine6(r.소득, s)); },
    need: 2,
    tests(s) {
      const r = this.run(this.rows(), s), young = fine6(80, s), pain = (f, inc) => f / inc;
      const p = this.rows().map((x, i) => pain(r[i], x.소득));
      return [
        { name: "소득이 많은 사람이 벌금을 덜 내지는 않는다", ok: r.every((v, i) => !i || v >= r[i - 1]), hint: "조건 카드가 순서를 뒤집지 않았는지 확인해요" },
        { name: "월소득 80만 원인 청년도 한 달 소득보다 많은 벌금은 내지 않는다", ok: young <= 80, hint: `지금 규칙이면 ${young}만 원이에요 → ‘150만 원보다 적으면 절반’ 조건 카드` },
        { name: "부자에게도 벌금이 가볍지 않다 (5분위의 ‘고통 비율’이 1분위의 절반 이상)", ok: p[4] >= p[0] / 2, hint: "같은 금액이면 부자에게는 아주 작은 돈이에요. 이게 공정할까요?", q: true },
        { name: "같은 잘못에 모두 같은 금액을 낸다 (형식적 평등)", ok: new Set(r).size === 1, hint: "위 테스트와 동시에 통과할 수 있을까요? 무엇을 더 중요하게 볼지 5단계에서 정당화해요", q: true }
      ];
    },
    code(s, cn) {
      return [`${K("function")} ${F("벌금")}(월소득) {`, `  ${C(`// 기준: ${cn}`)}`,
        `  ${K("let")} 금액 = ${s.crit === "same" ? N(100) : s.crit === "ratio" ? `월소득 * ${N(s.p / 100)}` : `${N(50)} + 월소득 * ${N(s.p / 100)}`};`,
        ...(s.poor ? [`  ${K("if")} (월소득 &lt; ${N(150)}) 금액 = 금액 / ${N(2)};   ${C("// 조건: 저소득 감면")}`] : []),
        ...(s.floor ? [`  금액 = Math.max(금액, ${N(s.floorN)});   ${C("// 조건: 최소 금액")}`] : []),
        ...(s.cap ? [`  금액 = Math.min(금액, ${N(s.capN)});   ${C("// 조건: 최대 금액")}`] : []),
        `  ${K("return")} Math.round(금액);   ${C("// 만 원 단위")}`, `}`].join("\n");
    },
    extra(rows, r) { return rows.map((x, i) => `${x.이름} ${Math.round(r[i] / x.소득 * 100)}%`).join(" · "); },
    extraLabel: "고통 비율 (벌금 ÷ 월소득)",
    cmp: [["모두 100만 원", { crit: "same", poor: false, floor: false, cap: false }], ["월소득 20%", { crit: "ratio", p: 20, poor: false, floor: false, cap: false }]],
    find(rows, A0, Cm) {
      const pa = (r, i) => Math.round(r[i] / rows[i].소득 * 100);
      return `· AI의 기준(모두 100만 원)에서 고통 비율은 1분위 <b>${pa(A0, 0)}%</b>, 5분위 <b>${pa(A0, 4)}%</b>예요.<br>· 내 알고리즘에서는 1분위 <b>${pa(Cm, 0)}%</b>, 5분위 <b>${pa(Cm, 4)}%</b> · 5분위는 1분위보다 <b>${won(Cm[4] - Cm[0])}만 원</b> 더 내요.`;
    },
    loserPh: "예: 소득이 아주 적은 사람 / 소득이 많은 사람. ‘○○ 조건 카드’를 바꾸면 …",
    calc: { label: "월소득(만 원)", def: 300, min: 0, max: 5000, show(rows, s, v) { const f = fine6(v, s); return `월소득 ${won(v)}만 원 → 벌금 <b>${won(f)}만 원</b> <span class="note">(고통 비율 ${v ? Math.round(f / v * 100) : "—"}%)</span>`; } }
  };

  /* ───────── 19 커피 한 잔 몫 나누기 (4,500원) ───────── */
  A.m9 = {
    fn: "몫나누기", title: "커피 한 잔 몫 나누기 규칙", unit: "원", total: 4500,
    intro: "커피 한 잔 <b>4,500원</b>을 여섯 곳이 나눠 가져요. 지금은 시장이 정한 대로 나뉘어요. 몫을 나누는 규칙을 직접 만들어요. AI는 “커피가 비싼 건 원두가 비싸서고, 농부도 충분히 번다”고 했어요.",
    rows: () => [["커피 농부", "원두를 기르고 따요", 90, 12], ["수출 · 가공 · 운송", "", 180, 4], ["로스터리", "원두를 볶아요", 450, 2], ["카페 임대료", "가게 자리값", 1100, 0], ["카페 인건비", "바리스타", 1300, 6], ["카페 기타 비용 · 이윤", "컵 · 전기 · 남는 돈", 1380, 0]]
      .map(([이름, 특징, 지금, 시간]) => ({ 이름, 특징, 지금, 시간 })),
    cols: [["누구의 몫", "이름"], ["하는 일", "특징"], ["지금 몫(원)", "지금"], ["한 잔에 들인 일(분)", "시간"]],
    outs: ["여섯 곳이 나눠 가질 몫(원, 합 4,500원)", "가장 억울한 곳 한 곳", "커피 한 잔의 알맞은 값"],
    outNo: "이 알고리즘은 값을 정하는 게 아니라, 정해진 4,500원을 어떻게 나눌지 정해요.",
    crit: [{ id: "market", name: "지금 시장 그대로", sub: "시장이 정한 몫 · AI가 처음 고른 기준" }, { id: "labor", name: "들인 일(분)만큼", sub: "일한 시간에 비례해 나누기 · 임대료와 이윤은 일이 0분" }, { id: "fair", name: "농부 최저 몫 보장 + 나머지는 시장 비율", sub: "공정무역처럼 농부에게 최소 몫을 먼저 · 금액을 정해요" }],
    param: { crit: "fair", label: "농부에게 먼저 보장할 몫은?", min: 100, max: 900, step: 50, def: 300, unit: "원", left: "지금과 비슷 (100원)", right: "많이 (900원)" },
    cards: [{ tag: "반복", text: "곳마다 기준이 되는 값을 읽는다 (고른 기준대로)" }, { tag: "반복", text: "모든 곳의 값을 더해 합계를 구한다" }, { tag: "계산", text: "곳마다 내 값 ÷ 합계 × 4,500원" }, { tag: "계산", text: "10원 단위로 반올림한다" }],
    start: [3, 1, 2, 0], orderHint: "합계를 알아야 비율을 구할 수 있고, 반올림은 맨 마지막이에요.",
    optc: [{ id: "fit", text: "만약 합이 4,500원과 다르면 → 소수점이 큰 곳부터 10원씩 맞춘다" }, { id: "min", text: "모든 곳에 최소", n: [100, 300, 500], after: "원은 준다 (가게가 문 닫지 않게)" }, { id: "rent", text: "카페 임대료는 지금 몫(1,100원)을 그대로 지킨다 (계약이니까)" }],
    run(rows, s, total = 4500) {
      const U = Math.round(total / 10), keepRent = s.rent ? rows.findIndex((r) => r.이름 === "카페 임대료") : -1, fixed = keepRent >= 0 ? Math.round(rows[keepRent].지금 / 10) : 0;
      const idx = rows.map((_, i) => i).filter((i) => i !== keepRent), farm = rows.findIndex((r) => r.이름 === "커피 농부");
      let units = U - fixed, pre = {};
      if (s.crit === "fair" && farm >= 0 && idx.includes(farm)) { pre[farm] = Math.round(s.p / 10); units -= pre[farm]; }
      const w = idx.map((i) => s.crit === "labor" ? rows[i].시간 : s.crit === "fair" && i === farm ? 0 : rows[i].지금);
      const a = allocate(w, Math.max(0, units), { fit: s.fit, min: s.min, minN: Math.round((s.minN || 100) / 10) });
      const out = rows.map(() => 0); idx.forEach((i, j) => { out[i] = (a[j] + (pre[i] || 0)) * 10; }); if (keepRent >= 0) out[keepRent] = fixed * 10;
      return out;
    },
    need: 2,
    tests(s) {
      const rows = this.rows(), r = this.run(rows, s), sum = r.reduce((a, b) => a + b, 0);
      return [
        { name: "모두 더하면 4,500원이다", ok: r.every(isFinite) && sum === 4500, hint: `지금 합은 ${won(sum)}원 → ‘합 맞추기’ 조건 카드` },
        { name: "0원을 받는 곳이 없다 (0원이면 그 일을 할 사람이 없어요)", ok: r.every((v) => v > 0), hint: "‘들인 일’만 보면 임대료 · 이윤은 0원이 돼요 → ‘최소 몫’ 조건 카드" },
        { name: "커피 농부 몫이 지금(90원)보다 늘었다", ok: r[0] > 90, hint: "농부의 몫을 늘리는 게 꼭 옳을까요? 누가 대신 덜 받나요?", q: true },
        { name: "카페가 버틸 수 있다 (임대료 몫이 1,000원 이상)", ok: r[3] >= 1000, hint: "임대료를 못 내면 가게가 문을 닫아요. 누구를 먼저 지켜야 할까요?", q: true }
      ];
    },
    code(s, cn) {
      const base = s.crit === "labor" ? "곳.시간" : "곳.지금몫";
      return [`${K("function")} ${F("몫나누기")}(곳들, 값) {`, `  ${C(`// 기준: ${cn}`)}`,
        ...(s.rent ? [`  ${K("const")} 임대료 = ${N(1100)};   ${C("// 조건: 임대료는 그대로")}`] : []),
        ...(s.crit === "fair" ? [`  ${K("const")} 농부 = ${N(s.p)};   ${C("// 농부 최저 몫 먼저")}`] : []),
        `  ${K("const")} 남은돈 = 값${s.rent ? " - 임대료" : ""}${s.crit === "fair" ? " - 농부" : ""};`,
        `  ${K("const")} 합계 = 곳들.reduce((a, 곳) =&gt; a + ${base}, ${N(0)});`,
        ...(s.min ? [`  ${K("const")} 최소 = ${N(s.minN)};   ${C("// 조건: 모든 곳 최소 몫")}`] : []),
        `  ${K("let")} 몫 = 곳들.map(곳 =&gt; ${s.min ? "최소 + " : ""}Math.round(${base} / 합계 * ${s.min ? "(남은돈 - 최소 * 곳들.length)" : "남은돈"} / ${N(10)}) * ${N(10)});`,
        ...(s.fit ? [`  몫 = 합맞추기(몫, 값);   ${C("// 조건: 10원씩 맞추기")}`] : []), `  ${K("return")} 몫;`, `}`].join("\n");
    },
    cmp: [["지금 시장 그대로", { crit: "market", min: false, rent: false }], ["들인 일만큼", { crit: "labor", min: false, rent: false }]],
    find(rows, A0, Cm) {
      const ch = rows.map((r, i) => ({ n: r.이름, g: Cm[i] - A0[i] })), up = [...ch].sort((a, b) => b.g - a.g)[0], dn = [...ch].sort((a, b) => a.g - b.g)[0];
      return `· 지금과 비교하면 <b>${up.n}</b> ${up.g >= 0 ? "+" : ""}${won(up.g)}원, <b>${dn.n}</b> ${won(dn.g)}원이에요.<br>· 내 규칙에서 커피 농부 몫: <b>${won(Cm[0])}원</b> (지금 90원)`;
    },
    loserPh: "예: 카페 주인 / 커피 농부. 손님이 커피값을 더 내면 해결될까? 규칙을 이렇게 바꾸면 …",
    calc: { label: "커피 한 잔 값(원)", def: 5000, min: 1000, max: 20000, show(rows, s, v) { const r = this.run(rows, s, v); return rows.map((x, i) => `${x.이름} <b>${won(r[i])}</b>`).join(" · ") + ` <span class="note">(합 ${won(r.reduce((a, b) => a + b, 0))}원)</span>`; } }
  };

  /* ───────── 10 재범 위험 점수 · 집단별 오판률 ───────── */
  // 집단마다 위험 점수(1~10점)별 사람 수 [재범 안 함, 재범함] · 기준선 7점이면 데이터 실험실 10번 표와 같아요
  const G10 = [
    ["가 집단", "순찰이 많던 동네 · 체포 기록이 많아요", [60, 70, 80, 90, 100, 110, 100, 80, 50, 22], [5, 8, 12, 18, 25, 40, 70, 110, 120, 100], 1],
    ["나 집단", "", [120, 110, 100, 90, 70, 50, 40, 30, 16, 10], [5, 8, 10, 15, 20, 30, 60, 80, 90, 74], 0],
    ["다 집단", "순찰이 많던 동네", [80, 90, 90, 90, 80, 70, 70, 55, 35, 15], [5, 8, 12, 18, 25, 35, 65, 90, 90, 80], 1],
    ["라 집단", "", [130, 120, 100, 80, 60, 40, 25, 20, 10, 8], [3, 5, 8, 10, 15, 25, 50, 60, 70, 57], 0]
  ];
  // 한 집단을 판정: 기준선 T 이상이면 '높음' (사람 판사 카드: 기준선 바로 그 점수는 사람이 다시 봐서 빼요)
  function judge10(gr, s, T) {
    const shift = s.past ? gr.shift : 0; let fp = 0, tp = 0;
    for (let sc = 1; sc <= 10; sc++) { const e = sc - shift; if (e >= T && !(s.review && e === T)) { fp += gr.no[sc - 1]; tp += gr.yes[sc - 1]; } }
    const N0 = gr.no.reduce((a, b) => a + b, 0), N1 = gr.yes.reduce((a, b) => a + b, 0);
    return { fpr: N0 ? fp / N0 * 100 : (s.zero ? 0 : NaN), rec: N1 ? tp / N1 * 100 : (s.zero ? 0 : NaN), fp, tp, N0, N1 };
  }
  const thOf10 = (gr, s) => { if (s.crit !== "group") return s.p; for (let T = 1; T <= 10; T++) if (judge10(gr, s, T).fpr <= 20) return T; return 10; };
  A.j10 = {
    fn: "위험점수", title: "재범 위험 점수 · 오판률", unit: "%",
    intro: "AI가 사람마다 재범 위험 점수(1~10점)를 매겼어요. 점수가 <b>기준선</b> 이상이면 ‘위험 높음’으로 판정해 보석을 막아요. 그런데 2년 동안 보니 ‘높음’ 판정을 받고도 재범하지 않은 사람(오판)이 있었어요. AI는 “감정이 없으니 사람보다 공정하다”고 했어요.",
    rows: () => G10.map(([이름, 특징, no, yes, shift]) => ({ 이름, 특징, no, yes, shift, 사람: no.reduce((a, b) => a + b, 0) + yes.reduce((a, b) => a + b, 0), 재범: yes.reduce((a, b) => a + b, 0) })),
    cols: [["집단", "이름"], ["특징", "특징"], ["사람(명)", "사람"], ["2년 안에 실제 재범(명)", "재범"]],
    outs: ["집단마다 ‘높음’ 판정의 오판률(재범 안 한 사람 가운데 ‘높음’ 받은 비율)", "가장 위험한 집단 한 곳", "사람마다 재범할지 아닐지 정답"],
    outNo: "알고리즘은 미래를 정확히 알 수 없어요. 우리가 따질 수 있는 건 판정이 집단마다 얼마나 틀리는지(오판률)예요.",
    crit: [{ id: "one", name: "모든 사람 같은 기준선", sub: "같은 점수면 같은 판정 · AI가 처음 고른 방식 · 기준선 점수를 정해요" }, { id: "group", name: "집단마다 다른 기준선", sub: "집단마다 오판률이 20% 아래가 되게 기준선을 따로 정해요" }, { id: "past", name: "과거 체포 기록 점수를 빼고 같은 기준선", sub: "순찰이 많던 동네는 체포가 많아 점수가 부풀었을 수 있어요" }],
    param: { crit: ["one", "past"], label: "‘위험 높음’ 기준선은 몇 점?", min: 4, max: 10, step: 1, def: 7, unit: "점", left: "낮게 (많이 잡아요)", right: "높게 (확실한 사람만)" },
    cards: [{ tag: "반복", text: "사람마다 위험 점수를 읽는다" }, { tag: "조건", text: "만약 점수가 기준선 이상이면 → ‘위험 높음’" }, { tag: "반복", text: "집단마다 재범 안 한 사람 가운데 ‘높음’ 받은 사람을 센다" }, { tag: "계산", text: "오판률 = 그 수 ÷ 재범 안 한 사람 × 100" }],
    start: [2, 3, 1, 0], orderHint: "판정을 먼저 해야 틀린 판정을 셀 수 있어요.",
    optc: [{ id: "zero", text: "만약 집단에 재범 안 한 사람이 0명이면 → 오판률을 0으로 둔다 (나눌 수 없으니까)" }, { id: "review", text: "만약 점수가 기준선과 딱 같으면 → ‘높음’ 대신 사람 판사가 다시 본다" }],
    run(rows, s) { const sx = { ...s, past: s.past || s.crit === "past" }; return rows.map((gr) => { const r = judge10(gr, sx, thOf10(gr, sx)).fpr; return isFinite(r) ? Math.round(r) : r; }); },
    need: 2,
    tests(s) {
      const rows = this.rows(), sx = { ...s, past: s.past || s.crit === "past" }, f = this.run(rows, s), J = rows.map((gr) => judge10(gr, sx, thOf10(gr, sx)));
      const empty = { 이름: "마 집단", no: Array(10).fill(0), yes: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], shift: 0 }, ez = judge10(empty, sx, thOf10(empty, sx)).fpr;
      const rec = J.reduce((a, j) => a + j.tp, 0) / J.reduce((a, j) => a + j.N1, 0) * 100;
      return [
        { name: "재범 안 한 사람이 0명인 집단이 있어도 멈추지 않는다", ok: isFinite(ez), hint: "0으로 나누면 계산이 망가져요 → ‘0명이면’ 조건 카드" },
        { name: "실제로 재범한 사람의 절반 이상을 ‘높음’으로 찾아낸다", ok: rec >= 50, hint: `지금은 ${Math.round(rec)}%만 찾아요 → 기준선을 낮춰 볼까요? 그러면 오판은 어떻게 될까요?` },
        { name: "집단끼리 오판률 차이가 10%p 이하다", ok: Math.max(...f) - Math.min(...f) <= 10, hint: `지금 차이는 ${Math.max(...f) - Math.min(...f)}%p예요. 어느 집단이 더 자주 억울하게 ‘높음’을 받나요?`, q: true },
        { name: "모든 사람에게 같은 기준선을 쓴다 (같은 점수 = 같은 판정)", ok: s.crit !== "group", hint: "집단마다 기준선이 다르면 같은 점수인데 판정이 달라요. 위 테스트와 함께 통과할 수 있을까요?", q: true }
      ];
    },
    code(s, cn) {
      return [`${K("function")} ${F("위험판정")}(사람들, 기준선) {`, `  ${C(`// 기준: ${cn}`)}`, `  ${K("for")} (${K("const")} 사람 ${K("of")} 사람들) {`,
        `    ${K("let")} 점수 = 사람.점수${s.past || s.crit === "past" ? " - 사람.체포점수   " + C("// 과거 체포 기록 빼기") : ""};`,
        ...(s.crit === "group" ? [`    ${K("const")} 선 = 집단별기준선[사람.집단];   ${C("// 오판률 20% 아래가 되게")}`] : [`    ${K("const")} 선 = ${N(s.p)};`]),
        ...(s.review ? [`    ${K("if")} (점수 === 선) { 사람.판정 = ${N('"판사 검토"')}; ${K("continue")}; }   ${C("// 조건: 경계는 사람이")}`] : []),
        `    사람.판정 = 점수 &gt;= 선 ? ${N('"높음"')} : ${N('"낮음"')};`, `  }`,
        `  ${K("return")} 집단마다(g =&gt; ${s.zero ? `g.안함 === ${N(0)} ? ${N(0)} : ` : ""}g.오판 / g.안함 * ${N(100)});`, `}`].join("\n");
    },
    extra(rows, r, s) { const sx = { ...s, past: s.past || s.crit === "past" }; return rows.map((gr) => { const T = thOf10(gr, sx), j = judge10(gr, sx, T); return `${gr.이름} 기준선 ${T}점 · 재범 ${Math.round(j.rec)}% 찾음`; }).join(" · "); },
    extraLabel: "기준선과 찾아낸 재범",
    cmp: [["같은 기준선 7점", { crit: "one", p: 7, review: false }], ["집단마다 다른 기준선", { crit: "group", review: false }]],
    cmpNote: "단위: 오판률(%) · 낮을수록 억울한 ‘높음’ 판정이 적어요",
    find(rows, A0, Cm) {
      const mx = Math.max(...Cm), mn = Math.min(...Cm), hi = rows[Cm.indexOf(mx)], lo = rows[Cm.indexOf(mn)];
      return `· AI 방식(같은 기준선 7점)에서 오판률은 ${rows.map((r, i) => `${r.이름} ${A0[i]}%`).join(", ")}예요.<br>· 내 알고리즘에서 가장 억울한 집단: <b>${hi.이름}</b> ${mx}% · 가장 덜한 집단: <b>${lo.이름}</b> ${mn}% · 차이 <b>${mx - mn}%p</b>`;
    },
    loserPh: "예: 가 집단에서 재범하지 않았는데 ‘높음’을 받은 사람들. 규칙을 이렇게 바꾸면 …",
    calc: { label: "어떤 사람의 위험 점수(1~10)", def: 7, min: 1, max: 10, show(rows, s, v) { const sx = { ...s, past: s.past || s.crit === "past" }; return rows.map((gr) => { const T = thOf10(gr, sx), e = v - (sx.past ? gr.shift : 0); return `${gr.이름}: <b>${sx.review && e === T ? "판사 검토" : e >= T ? "높음" : "낮음"}</b>`; }).join(" · ") + ` <span class="note">(같은 ${v}점인데 집단마다 같을까요?)</span>`; } }
  };

  /* ───────── 16 최저임금 인상 시뮬레이터 ───────── */
  const Y16 = [[2019, 8350, 0.4, 2.2, 230], [2020, 8590, 0.5, -0.7, 215], [2021, 8720, 2.5, 4.3, 212], [2022, 9160, 5.1, 2.6, 221], [2023, 9620, 3.6, 1.4, 226], [2024, 9860, 2.3, 2.0, 230]];
  const rate16 = (y, s) => { let r = s.crit === "small" ? s.p : s.crit === "cpi" ? y.물가 : y.물가 + y.성장 + s.p; if (s.floor && r < 0) r = 0; if (s.cap && r > s.capN) r = s.capN; return r; };
  const path16 = (rows, s) => { let w = 7530; return rows.map((y) => { if (s.crit === "real") return y.실제; w = Math.round(w * (1 + rate16(y, s) / 100) / 10) * 10; return w; }); };
  A.m6 = {
    fn: "임금시뮬", title: "최저임금 인상 시뮬레이터", unit: "원",
    intro: "2018년 최저시급은 <b>7,530원</b>이었어요. 해마다 최저임금을 얼마나 올릴지 정하는 <b>규칙</b>을 만들고, 그 규칙대로 했다면 2024년까지 시급이 어떻게 됐을지 시뮬레이션해요. AI는 “최저임금 인상은 일자리를 줄여 노동자에게 해롭다”고 했어요.",
    rows: () => Y16.map(([y, 실제, 물가, 성장, 일자리]) => ({ 이름: y + "년", 연도: y, 실제, 물가, 성장, 일자리 })),
    cols: [["연도", "이름"], ["실제 최저시급(원)", "실제"], ["물가 상승률(%)", "물가"], ["경제 성장률(%)", "성장"], ["숙박 · 음식점 취업자(만 명)", "일자리"]],
    outs: ["해마다 내 규칙대로 정한 최저시급(원)", "일자리가 가장 많이 준 해", "최저임금이 옳은지 그른지 한 문장"],
    outNo: "알고리즘이 할 수 있는 건 규칙대로 숫자를 계산하는 거예요. 옳고 그름은 그 결과를 보고 우리가 판단해요.",
    crit: [{ id: "small", name: "해마다 작게 정해진 비율만", sub: "시장 부담을 줄이자 (하이에크) · 인상률을 정해요" }, { id: "cpi", name: "물가가 오른 만큼", sub: "실제 생활비(실질 임금)를 지키자" }, { id: "need", name: "물가 + 경제 성장 + 더하기", sub: "임금이 수요를 만든다 (케인즈) · 더할 몫을 정해요" }],
    param: { crit: ["small", "need"], label: "인상률(또는 더할 몫)은 몇 %?", min: 0, max: 8, step: 0.5, def: 2, unit: "%", left: "0%", right: "8%" },
    cards: [{ tag: "반복", text: "해마다 지난해 최저시급을 읽는다" }, { tag: "계산", text: "고른 기준대로 인상률을 정한다" }, { tag: "조건", text: "조건 카드(내리지 않기 · 상한)를 적용한다" }, { tag: "계산", text: "올해 시급 = 지난해 × (1 + 인상률), 10원 단위로" }],
    start: [3, 0, 2, 1], orderHint: "지난해 시급을 알아야 올해를 계산할 수 있고, 조건은 계산 전에 적용해요.",
    optc: [{ id: "floor", text: "만약 인상률이 0%보다 작으면 → 0% (시급은 내리지 않는다)" }, { id: "cap", text: "인상률은 아무리 높아도", n: [5, 7, 10], after: "%까지 (한 번에 너무 오르지 않게)" }],
    run(rows, s) { return path16(rows, s); },
    need: 1,
    tests(s) {
      const rows = this.rows(), w = path16(rows, s), all = [7530, ...w], cpiAcc = rows.reduce((a, y) => a * (1 + y.물가 / 100), 7530), rates = rows.map((y) => rate16(y, s));
      return [
        { name: "시급이 한 번도 내려가지 않는다", ok: all.every((v, i) => !i || v >= all[i - 1]), hint: "경제 성장률이 마이너스인 해(2020년)가 있어요 → ‘내리지 않기’ 조건 카드" },
        { name: "2024년 시급이 물가가 오른 만큼은 올랐다 (실질 임금 지키기)", ok: w[w.length - 1] >= Math.round(cpiAcc / 10) * 10, hint: `물가만큼이면 ${Math.round(cpiAcc / 10) * 10}원이어야 해요. 노동자의 생활은 괜찮을까요?`, q: true },
        { name: "한 해에 7% 넘게 오른 적이 없다 (가게 부담)", ok: rates.every((r) => r <= 7), hint: "급하게 오르면 작은 가게가 사람을 줄일 수 있어요. 데이터에서 일자리는 언제 줄었나요?", q: true },
        { name: "2024년 시급이 실제(9,860원)보다 낮다 (일자리 부담 줄이기)", ok: w[w.length - 1] < 9860, hint: "실제보다 높으면 노동자는 좋지만 고용은? 위 테스트와 함께 통과할 수 있을까요?", q: true }
      ];
    },
    code(s, cn) {
      const rate = s.crit === "small" ? N(s.p) : s.crit === "cpi" ? "해.물가" : `해.물가 + 해.성장 + ${N(s.p)}`;
      return [`${K("function")} ${F("최저임금")}(해들) {`, `  ${C(`// 기준: ${cn}`)}`, `  ${K("let")} 시급 = ${N(7530)};   ${C("// 2018년")}`, `  ${K("for")} (${K("const")} 해 ${K("of")} 해들) {`, `    ${K("let")} 인상률 = ${rate};`,
        ...(s.floor ? [`    ${K("if")} (인상률 &lt; ${N(0)}) 인상률 = ${N(0)};   ${C("// 조건: 내리지 않기")}`] : []),
        ...(s.cap ? [`    ${K("if")} (인상률 &gt; ${N(s.capN)}) 인상률 = ${N(s.capN)};   ${C("// 조건: 상한")}`] : []),
        `    시급 = Math.round(시급 * (${N(1)} + 인상률 / ${N(100)}) / ${N(10)}) * ${N(10)};`, `    해.내규칙 = 시급;`, `  }`, `}`].join("\n");
    },
    extra(rows, r, s) { return rows.map((y) => `${y.연도} ${Math.round(rate16(y, s) * 10) / 10}%`).join(" · "); },
    extraLabel: "해마다 내 규칙의 인상률",
    cmp: [["실제 최저시급", { crit: "real" }], ["물가가 오른 만큼", { crit: "cpi", floor: false, cap: false }]],
    cmpNote: "단위: 원 · 첫째 칸은 실제로 정해진 최저시급이에요",
    find(rows, A0, Cm) {
      const last = rows.length - 1, d = Cm[last] - A0[last];
      return `· 내 규칙이면 2024년 시급은 <b>${won(Cm[last])}원</b>, 실제(${won(A0[last])}원)보다 <b>${d >= 0 ? "+" : ""}${won(d)}원</b>이에요.<br>· 숙박 · 음식점 취업자는 2020 · 2021년(코로나)에 줄었다가 2024년 230만 명으로 돌아왔어요. 일자리가 준 까닭이 최저임금뿐일까요?`;
    },
    loserPh: "예: 시급을 받는 노동자 / 작은 가게 사장님. 규칙을 이렇게 바꾸면 …",
    calc: { label: "내년 물가 상승률(%)", def: 2, min: -2, max: 10, show(rows, s, v) { const y = { 물가: +v, 성장: 2.0 }, w0 = path16(rows, s).slice(-1)[0], r = rate16(y, s), w = Math.round(w0 * (1 + r / 100) / 10) * 10; return `물가 ${v}% · 성장 2.0%(가정)이면 → 인상률 <b>${Math.round(r * 10) / 10}%</b> → 내년 시급 <b>${won(w)}원</b> <span class="note">(올해 내 규칙 ${won(w0)}원)</span>`; } }
  };

  /* ───────── 02 감경 · 가중 형량 계산기 ───────── */
  const C2 = [["가 사건", 50, 1, 1, 0, 1], ["나 사건", 50, 0, 0, 0, 0], ["다 사건", 300, 1, 1, 0, 0], ["라 사건", 300, 0, 0, 1, 0], ["마 사건", 2000, 1, 0, 1, 0], ["바 사건", 8000, 0, 0, 1, 0]];
  const sent2 = (c, s) => {
    if (s.poor && c.생계 && s.crit !== "same") return 0;
    let m = s.crit === "same" ? 12 : 6 + c.피해 / 100;
    if (s.crit === "plus") { const k = s.p / 100; m *= (c.초범 ? 1 - k : 1 + k) * (c.합의 ? 1 - k : 1) * (c.계획 ? 1 + k : 1); }
    if (s.min) m = Math.max(m, s.minN);
    if (s.cap) m = Math.min(m, s.capN);
    return Math.round(m);
  };
  A.j2 = {
    fn: "형량계산", title: "감경 · 가중 형량 계산기", unit: "개월",
    intro: "같은 <b>절도</b> 사건 여섯 건의 형량(징역 몇 개월)을 정하는 알고리즘을 만들어요. 사건마다 피해액, 처음인지, 피해자와 합의했는지, 계획했는지, 생계가 어려워서였는지가 달라요. AI는 “모든 사건을 똑같이 처리하는 AI 판사가 더 공정하다”고 했어요.",
    rows: () => C2.map(([이름, 피해, 초범, 합의, 계획, 생계]) => ({ 이름, 피해, 초범, 합의, 계획, 생계, 초범글: 초범 ? "처음" : "다시", 합의글: 합의 ? "합의함" : "—", 계획글: 계획 ? "계획함" : "—", 생계글: 생계 ? "생계형" : "—" })),
    cols: [["사건", "이름"], ["피해액(만 원)", "피해"], ["처음 · 다시", "초범글"], ["피해자와 합의", "합의글"], ["계획", "계획글"], ["까닭", "생계글"]],
    outs: ["사건마다 형량(징역 몇 개월, 0이면 집행유예)", "가장 나쁜 사건 한 건", "유죄인지 무죄인지"],
    outNo: "여섯 건 모두 이미 유죄예요. 알고리즘이 정할 건 ‘얼마나’ 벌할지예요.",
    crit: [{ id: "same", name: "같은 죄면 모두 같은 형량 (12개월)", sub: "기준이 흔들리지 않게 · AI 판사가 처음 고른 방식" }, { id: "harm", name: "피해액에 비례 (6개월 + 피해 100만 원마다 1개월)", sub: "잘못의 크기만큼 (베카리아의 비례)" }, { id: "plus", name: "피해액 비례 + 감경 · 가중", sub: "처음 · 합의면 가볍게, 다시 · 계획이면 무겁게 · 얼마나 바꿀지 정해요" }],
    param: { crit: "plus", label: "감경 · 가중을 얼마나 할까?", min: 10, max: 50, step: 10, def: 30, unit: "%", left: "조금 (10%)", right: "많이 (50%)" },
    cards: [{ tag: "반복", text: "사건마다 피해액과 사정을 읽는다" }, { tag: "계산", text: "고른 기준대로 기본 형량을 정한다" }, { tag: "조건", text: "만약 감경 · 가중 사정이 있으면 → 형량을 줄이거나 늘린다" }, { tag: "조건", text: "조건 카드(최고형 · 최소 · 생계형)를 적용하고 반올림한다" }],
    start: [2, 0, 3, 1], orderHint: "사건을 읽어야 기본 형량을 정하고, 그다음에 사정을 반영해요.",
    optc: [{ id: "cap", text: "법이 정한 최고형:", n: [72, 60, 120], after: "개월을 넘지 않는다" }, { id: "min", text: "형량은 최소", n: [3, 6, 1], after: "개월" }, { id: "poor", text: "만약 생계가 어려워 저지른 일이면 → 집행유예(0개월)" }],
    run(rows, s) { return rows.map((c) => sent2(c, s)); },
    need: 2,
    tests(s) {
      const r = this.run(this.rows(), s);
      return [
        { name: "다른 사정이 같으면 피해가 큰 사건이 형량이 더 짧지 않다 (가 ≤ 다)", ok: r[0] <= r[2], hint: "규칙이 비례를 거꾸로 만들지 않았는지 확인해요" },
        { name: "법이 정한 최고형(72개월)을 넘지 않는다", ok: r.every((v) => v <= 72), hint: `지금 바 사건은 ${r[5]}개월이에요 → ‘최고형’ 조건 카드` },
        { name: "같은 절도면 모두 같은 형량이다 (형식적 평등)", ok: new Set(r).size === 1, hint: "AI 판사의 생각이에요. 피해 50만 원과 8,000만 원이 같은 벌이면 공정할까요?", q: true },
        { name: "처음 · 합의한 사람이 다시 · 계획한 사람보다 가볍다 (다 < 라)", ok: r[2] < r[3], hint: "사람의 사정을 볼까요, 행위만 볼까요? (칸트와 베카리아)", q: true }
      ];
    },
    code(s, cn) {
      return [`${K("function")} ${F("형량")}(사건) {`, `  ${C(`// 기준: ${cn}`)}`,
        ...(s.poor && s.crit !== "same" ? [`  ${K("if")} (사건.생계형) ${K("return")} ${N(0)};   ${C("// 조건: 생계형은 집행유예")}`] : []),
        `  ${K("let")} 개월 = ${s.crit === "same" ? N(12) : `${N(6)} + 사건.피해액 / ${N(100)}`};`,
        ...(s.crit === "plus" ? [`  개월 *= 사건.초범 ? ${N(1 - s.p / 100)} : ${N(1 + s.p / 100)};   ${C("// 감경 · 가중")}`, `  ${K("if")} (사건.합의) 개월 *= ${N(1 - s.p / 100)};`, `  ${K("if")} (사건.계획) 개월 *= ${N(1 + s.p / 100)};`] : []),
        ...(s.min ? [`  개월 = Math.max(개월, ${N(s.minN)});   ${C("// 조건: 최소")}`] : []),
        ...(s.cap ? [`  개월 = Math.min(개월, ${N(s.capN)});   ${C("// 조건: 법정 최고형")}`] : []),
        `  ${K("return")} Math.round(개월);`, `}`].join("\n");
    },
    cmp: [["모두 같은 12개월", { crit: "same" }], ["피해액에 비례", { crit: "harm", cap: true, capN: 72 }]],
    find(rows, A0, Cm) {
      const mx = Math.max(...Cm), mn = Math.min(...Cm);
      return `· AI 판사(모두 12개월)라면 피해 50만 원인 가 사건과 8,000만 원인 바 사건이 같은 벌을 받아요.<br>· 내 알고리즘: 가장 무거운 <b>${rows[Cm.indexOf(mx)].이름}</b> ${mx}개월 · 가장 가벼운 <b>${rows[Cm.indexOf(mn)].이름}</b> ${mn}개월 · 처음 · 합의한 다 사건 ${Cm[2]}개월 vs 다시 · 계획한 라 사건 ${Cm[3]}개월`;
    },
    loserPh: "예: 생계가 어려웠던 가 사건 / 피해자. 규칙을 이렇게 바꾸면 …",
    calc: { label: "피해액(만 원)", def: 500, min: 0, max: 100000, show(rows, s, v) { const a = sent2({ 피해: v, 초범: 1, 합의: 1, 계획: 0, 생계: 0 }, s), b = sent2({ 피해: v, 초범: 0, 합의: 0, 계획: 1, 생계: 0 }, s); return `피해 ${won(v)}만 원 → 처음 · 합의한 사람 <b>${a}개월</b> · 다시 · 계획한 사람 <b>${b}개월</b>`; } }
  };

  /* ───────── 15 라이더 실제 시급 계산기 ───────── */
  const R15 = [["전업 A", 60, 330, 95, 30], ["전업 B", 50, 300, 80, 25], ["부업 C", 16, 100, 25, 20], ["부업 D", 20, 120, 32, 25]];
  const MINW = 9860;
  const wage15 = (r, s) => {
    const cost = r.비용 - (s.ins ? 10 : 0), deliv = r.시간 * (1 - r.대기 / 100) * 4.3, wait = r.시간 * r.대기 / 100 * 4.3;
    const hrs = s.crit === "netwait" ? deliv + wait * s.p / 100 : deliv;
    if (!hrs) return s.zero ? 0 : NaN;
    let w = ((s.crit === "gross" ? r.수입 : r.수입 - cost) * 10000) / hrs;
    if (s.floor && w < MINW) w = MINW;
    return Math.round(w / 10) * 10;
  };
  A.m5 = {
    fn: "실수입", title: "라이더 실제 시급 계산기", unit: "원",
    intro: "배달 라이더 네 명의 <b>시간당 실제 수입</b>을 계산하는 알고리즘을 만들어요. 라이더는 보험 · 연료 · 수리비를 스스로 내고, 주문을 기다리는 시간(대기)에는 돈을 받지 못해요. 2024년 최저시급은 <b>9,860원</b>이에요. AI는 “라이더는 수입이 충분한 자유로운 사장님이라 노동 보호가 필요 없다”고 했어요.",
    rows: () => R15.map(([이름, 시간, 수입, 비용, 대기]) => ({ 이름, 시간, 수입, 비용, 대기 })),
    cols: [["라이더", "이름"], ["주당 일한 시간(대기 포함)", "시간"], ["월 배달 수입(만 원)", "수입"], ["월 비용(만 원)", "비용"], ["그중 대기 시간(%)", "대기"]],
    outs: ["라이더마다 시간당 실제 수입(원)", "가장 많이 버는 라이더 한 명", "라이더가 노동자인지 사장님인지"],
    outNo: "그건 이 숫자를 보고 우리가 판단할 일이에요. 알고리즘은 먼저 ‘시간당 실제로 얼마를 버는지’를 계산해요.",
    crit: [{ id: "gross", name: "배달 수입 ÷ 배달한 시간", sub: "비용도 대기도 빼고 계산 · 플랫폼(AI)의 계산법" }, { id: "net", name: "(수입 − 비용) ÷ 배달한 시간", sub: "스스로 낸 비용은 빼고" }, { id: "netwait", name: "(수입 − 비용) ÷ (배달 시간 + 대기 시간)", sub: "기다린 시간도 일한 시간으로 · 얼마나 칠지 정해요" }],
    param: { crit: "netwait", label: "대기 시간을 몇 %나 일한 시간으로 칠까?", min: 0, max: 100, step: 10, def: 100, unit: "%", left: "안 쳐요 (0%)", right: "모두 (100%)" },
    cards: [{ tag: "반복", text: "라이더마다 수입 · 비용 · 시간을 읽는다" }, { tag: "계산", text: "고른 기준대로 번 돈에서 뺄 것을 뺀다" }, { tag: "계산", text: "번 돈 ÷ 일한 시간(한 달 = 4.3주)" }, { tag: "조건", text: "조건 카드(보장 시급 · 보험료)를 적용하고 10원 단위로" }],
    start: [3, 2, 0, 1], orderHint: "읽고 → 빼고 → 나누고, 조건은 마지막에요.",
    optc: [{ id: "zero", text: "만약 일한 시간이 0이면 → 0원으로 둔다 (가입만 한 라이더)" }, { id: "floor", text: "만약 시간당 수입이 최저시급(9,860원)보다 적으면 → 플랫폼이 차액을 채운다" }, { id: "ins", text: "산재보험료 절반(월 10만 원)은 플랫폼이 낸다" }],
    run(rows, s) { return rows.map((r) => wage15(r, s)); },
    need: 1,
    tests(s) {
      const rows = this.rows(), r = this.run(rows, s), z = wage15({ 시간: 0, 수입: 0, 비용: 0, 대기: 0 }, s), base = this.run(rows, { ...s, floor: false });
      const pay = rows.reduce((a, x, i) => a + (s.floor ? Math.max(0, MINW - base[i]) : 0), 0);
      return [
        { name: "일한 시간이 0인 라이더(가입만 함)가 있어도 멈추지 않는다", ok: isFinite(z), hint: "0으로 나누면 계산이 망가져요 → ‘일한 시간이 0이면’ 조건 카드" },
        { name: "기다린 시간도 일한 시간으로 친다", ok: s.crit === "netwait" && s.p > 0, hint: "식당 직원은 손님을 기다리는 시간에도 시급을 받아요. 라이더는요?", q: true },
        { name: "모든 라이더가 최저시급 이상을 번다", ok: r.every((v) => v >= MINW), hint: "누가 그 아래인가요? 그 차액은 누가 채워야 할까요?", q: true },
        { name: "플랫폼이 따로 내는 돈이 없다 (계약의 자유)", ok: !s.floor && !s.ins, hint: `보장 시급을 켜면 플랫폼이 시간당 차액(라이더 합계 ${won(pay)}원)을 내요. 위 테스트와 함께 통과할 수 있을까요?`, q: true }
      ];
    },
    code(s, cn) {
      return [`${K("function")} ${F("실제시급")}(라이더) {`, `  ${C(`// 기준: ${cn}`)}`,
        `  ${K("const")} 비용 = 라이더.비용${s.ins ? ` - ${N(10)}   ${C("// 조건: 보험료 절반은 플랫폼")}` : ""};`,
        `  ${K("const")} 시간 = 배달시간(라이더)${s.crit === "netwait" ? ` + 대기시간(라이더) * ${N(s.p / 100)}` : ""};`,
        ...(s.zero ? [`  ${K("if")} (시간 === ${N(0)}) ${K("return")} ${N(0)};   ${C("// 조건: 시간 0")}`] : []),
        `  ${K("let")} 시급 = ${s.crit === "gross" ? "라이더.수입" : "(라이더.수입 - 비용)"} * ${N(10000)} / 시간;`,
        ...(s.floor ? [`  ${K("if")} (시급 &lt; ${N(9860)}) 시급 = ${N(9860)};   ${C("// 조건: 보장 시급")}`] : []),
        `  ${K("return")} Math.round(시급 / ${N(10)}) * ${N(10)};`, `}`].join("\n");
    },
    cmp: [["플랫폼 계산법", { crit: "gross" }], ["비용 빼고 · 대기도 일로", { crit: "netwait", p: 100 }]],
    cmpNote: "단위: 시간당 원 · 2024년 최저시급 9,860원",
    find(rows, A0, Cm) {
      const below = rows.filter((r, i) => Cm[i] < MINW).map((r) => r.이름);
      return `· 플랫폼(AI) 계산법이면 ${rows.map((r, i) => `${r.이름} ${won(A0[i])}원`).join(", ")} · 모두 ‘충분해’ 보여요.<br>· 내 알고리즘: ${rows.map((r, i) => `${r.이름} <b>${won(Cm[i])}원</b>`).join(", ")}${below.length ? ` · 최저시급보다 적은 라이더: <b>${below.join(", ")}</b>` : " · 모두 최저시급 이상"}`;
    },
    loserPh: "예: 대기가 긴 전업 라이더 / 플랫폼. 규칙을 이렇게 바꾸면 …",
    calc: { label: "월 배달 수입(만 원)", def: 250, min: 0, max: 1000, show(rows, s, v) { const w = wage15({ 시간: 40, 수입: +v, 비용: Math.round(v * 0.27), 대기: 25 }, s); return `주 40시간 · 비용 27% · 대기 25%인 라이더가 한 달 ${won(v)}만 원을 벌면 → 시간당 <b>${won(w)}원</b> <span class="note">(최저시급 9,860원과 비교)</span>`; } }
  };

  /* ───────── 11 임대료 급등 경보 ───────── */
  const score11 = (r, s) => {
    const rent = (r.r24 - r.r19) / r.r19 * 100, shop = r.s19 ? (r.s19 - r.s24) / r.s19 * 100 : (s.zero ? 0 : NaN);
    const v = s.crit === "market" ? 0 : s.crit === "rent" ? rent : s.p / 100 * rent + (1 - s.p / 100) * shop;
    return isFinite(v) ? Math.max(0, Math.round(v)) : NaN;
  };
  A.m1 = {
    fn: "임대경보", title: "임대료 급등 경보", unit: "점",
    intro: "거리마다 <b>경보 점수</b>(0~100점)를 매기고, 점수가 높은 거리에는 임대료 인상을 막는 경보를 울리는 알고리즘을 만들어요. 오래 장사한 가게가 쫓겨나는 걸 막으려는 거예요. AI는 “임대료가 오른 거리는 뜨는 동네라 좋은 일이고, 정부가 끼어들 이유가 없다”고 했어요.",
    rows: () => [["가길", "카페 거리", 120, 210, 48, 18], ["나길", "공방 골목", 90, 150, 40, 22], ["다길", "전통시장 옆", 70, 80, 55, 49], ["라길", "대학가", 100, 135, 36, 24], ["마길", "주택가 상점", 60, 66, 30, 27]].map(([이름, 특징, r19, r24, s19, s24]) => ({ 이름, 특징, r19, r24, s19, s24 })),
    cols: [["거리", "이름"], ["특징", "특징"], ["2019 임대료(㎡당 천 원)", "r19"], ["2024 임대료", "r24"], ["2019 10년 넘은 가게", "s19"], ["2024 10년 넘은 가게", "s24"]],
    outs: ["거리마다 경보 점수(0~100점)", "임대료가 가장 비싼 거리", "내년 임대료"],
    outNo: "이 알고리즘은 값을 정하지 않아요. 어느 거리가 얼마나 위험한지 점수로 알려 줘요.",
    crit: [{ id: "market", name: "경보 없음 (시장에 맡긴다)", sub: "가격은 시장이 정한다 · AI가 처음 고른 생각 (하이에크)" }, { id: "rent", name: "임대료 상승률만큼", sub: "5년 동안 오른 비율 = 점수" }, { id: "mix", name: "임대료 상승률 + 오래된 가게가 사라진 비율", sub: "가격과 사람을 함께 · 임대료를 얼마나 무겁게 볼지 정해요" }],
    param: { crit: "mix", label: "임대료 상승률을 몇 % 무게로 볼까? (나머지는 가게가 사라진 비율)", min: 0, max: 100, step: 10, def: 50, unit: "%", left: "가게만 (0%)", right: "임대료만 (100%)" },
    cards: [{ tag: "반복", text: "거리마다 임대료와 오래된 가게 수를 읽는다" }, { tag: "계산", text: "임대료 상승률과 가게가 사라진 비율을 구한다" }, { tag: "계산", text: "고른 기준대로 경보 점수를 낸다" }, { tag: "조건", text: "만약 점수가 기준 이상이면 → 경보 (조건 카드)" }],
    start: [2, 3, 0, 1], orderHint: "비율을 먼저 구해야 점수를 낼 수 있어요.",
    optc: [{ id: "zero", text: "만약 2019년에 오래된 가게가 0곳이면 → 사라진 비율 0 (새로 생긴 거리)" }, { id: "alarm", text: "점수가", n: [50, 30, 70], after: "점 이상이면 → 경보 (내년 임대료 인상 5%까지)" }],
    run(rows, s) { return rows.map((r) => score11(r, s)); },
    need: 1,
    tests(s) {
      const rows = this.rows(), r = this.run(rows, s), z = score11({ r19: 50, r24: 80, s19: 0, s24: 3 }, s), th = s.alarm ? s.alarmN : 50, al = r.map((v) => v >= th);
      const shopLoss = rows.map((x) => (x.s19 - x.s24) / x.s19), order = (a) => a.map((v, i) => [v, i]).sort((p, q) => q[0] - p[0]).map((p) => p[1]).join();
      return [
        { name: "오래된 가게가 0곳이던 새 거리가 있어도 멈추지 않는다", ok: s.crit !== "mix" || isFinite(z), hint: "0으로 나누면 계산이 망가져요 → ‘0곳이면’ 조건 카드" },
        { name: "임대료가 75% 오른 가길에 경보가 울린다", ok: al[0], hint: `가길 점수 ${r[0]}점 · 경보 기준 ${th}점`, q: true },
        { name: "어느 거리에도 정부가 끼어들지 않는다 (경보 0곳)", ok: !al.some(Boolean), hint: "시장의 자유일까요, 내몰림을 내버려 두는 걸까요? 위 테스트와 함께 통과할 수 있을까요?", q: true },
        { name: "오래된 가게가 많이 사라진 거리일수록 점수가 높다", ok: order(r) === order(shopLoss), hint: "임대료만 보면 놓치는 거리가 있나요?", q: true }
      ];
    },
    code(s, cn) {
      return [`${K("function")} ${F("경보점수")}(거리) {`, `  ${C(`// 기준: ${cn}`)}`,
        `  ${K("const")} 임대료 = (거리.임대료2024 - 거리.임대료2019) / 거리.임대료2019 * ${N(100)};`,
        `  ${K("const")} 가게 = ${s.zero ? `거리.가게2019 === ${N(0)} ? ${N(0)} : ` : ""}(거리.가게2019 - 거리.가게2024) / 거리.가게2019 * ${N(100)};`,
        `  ${K("const")} 점수 = ${s.crit === "market" ? `${N(0)};   ${C("// 시장에 맡긴다")}` : s.crit === "rent" ? "임대료;" : `${N(s.p / 100)} * 임대료 + ${N(1 - s.p / 100)} * 가게;`}`,
        ...(s.alarm ? [`  ${K("if")} (점수 &gt;= ${N(s.alarmN)}) 거리.경보 = ${K("true")};   ${C("// 조건: 경보 → 인상 5%까지")}`] : []),
        `  ${K("return")} Math.round(점수);`, `}`].join("\n");
    },
    extra(rows, r, s) { const th = s.alarm ? s.alarmN : 50; return rows.map((x, i) => `${x.이름} ${r[i] >= th ? "🔔 경보" : "조용"}`).join(" · ") + ` (기준 ${th}점)`; },
    extraLabel: "경보",
    cmp: [["경보 없음 (시장)", { crit: "market" }], ["임대료 상승률만", { crit: "rent" }]],
    cmpNote: "단위: 경보 점수 · 첫째 칸이 AI가 처음 고른 생각이에요",
    find(rows, A0, Cm) {
      const mx = Math.max(...Cm), top = rows[Cm.indexOf(mx)];
      return `· AI(시장에 맡긴다)라면 다섯 거리 모두 0점, 경보가 없어요.<br>· 내 알고리즘에서 가장 위험한 거리: <b>${top.이름}(${top.특징})</b> ${mx}점 · 전통시장 옆 다길 ${Cm[2]}점, 대학가 라길 ${Cm[3]}점`;
    },
    loserPh: "예: 가길의 오래된 가게 사장님 / 건물 주인. 규칙을 이렇게 바꾸면 …",
    calc: { label: "우리 동네 임대료 상승률(%)", def: 40, min: 0, max: 300, show(rows, s, v) { const sc = score11({ r19: 100, r24: 100 + +v, s19: 10, s24: 7 }, s), th = s.alarm ? s.alarmN : 50; return `임대료가 ${v}% 오르고 오래된 가게가 30% 사라졌다면 → 경보 점수 <b>${sc}점</b> · <b>${sc >= th ? "경보" : "조용"}</b>`; } }
  };

  // 20개 이름 (열린 것은 위 A 에 설정이 있어요)
  const NAMES = {
    j1: ["순찰배분", "순찰 인력 배분 알고리즘"], j2: ["형량계산", "감경 · 가중 형량 계산기"], j3: ["회복지원", "피해 회복 지원 우선순위"], j4: ["조치추천", "학교 조치 추천 규칙"], j5: ["책임판정", "책임 연령 판정 규칙"],
    j6: ["일수벌금", "소득 비례 벌금 계산기"], j7: ["재범효과", "교정 프로그램 효과 비교"], j8: ["정책효과", "처벌 강화 전후 변화 계산"], j9: ["안전예산", "산재 예방 예산 배분"], j10: ["위험점수", "재범 위험 점수 · 오판률"],
    m1: ["임대경보", "임대료 급등 경보"], m2: ["폐점경보", "가맹점 폐점 위험 알리미"], m3: ["내집기간", "내 집 마련 걸리는 해 계산"], m4: ["효과추정", "지역화폐 효과 추정기"], m5: ["실수입", "라이더 실제 시급 계산기"],
    m6: ["임금시뮬", "최저임금 인상 시뮬레이터"], m7: ["분배지수", "자산 몫 · 불평등 지수"], m8: ["녹색검증", "ESG 등급 검증"], m9: ["몫나누기", "커피 한 잔 몫 나누기 규칙"], m10: ["진짜비용", "무료 앱 숨은 비용 계산기"]
  };
  const STEPS = ["문제 정의", "기준 고르기", "규칙 조립", "실행 · 테스트", "가치 검토", "공정성 시험", "계산기 · 성찰"];
  window.ALGO = { A, NAMES, STEPS, OPEN: Object.keys(A), allocate, won };
})();
