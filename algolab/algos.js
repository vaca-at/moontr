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
