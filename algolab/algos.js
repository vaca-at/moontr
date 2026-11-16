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

  /* ───────── 공통: 나눠 주기(배분) 알고리즘 만들기 · 순찰 배분과 같은 모양 ───────── */
  function allocTopic(o) {
    return Object.assign({
      need: 1,
      run(rows, s, total = o.total) { const w = rows.map((r) => o.weight(r, s)); if (w.some((v) => !isFinite(v))) return w.map(() => NaN); return allocate(w, total, { fit: s.fit, min: s.min, minN: s.minN }); },
      code(s, cn) {
        return [`${K("function")} ${F(o.fn)}(${o.who}들, ${o.what}) {`, `  ${C(`// 기준: ${cn}`)}`, `  ${K("const")} 무게 = ${o.who}들.map(${o.who} =&gt; ${o.wcode(s)});`, `  ${K("const")} 합계 = 무게.reduce((a, b) =&gt; a + b, ${N(0)});`,
          ...(s.min ? [`  ${K("const")} 기본 = ${N(s.minN)};   ${C("// 조건: 모두 최소")}`] : []),
          `  ${K("let")} 몫 = 무게.map(w =&gt; ${s.min ? "기본 + " : ""}Math.round(w / 합계 * ${s.min ? `(${o.what} - 기본 * ${o.who}들.length)` : o.what}));`,
          ...(s.fit ? [`  몫 = 합맞추기(몫, ${o.what});   ${C("// 조건: 합 맞추기")}`] : []), `  ${K("return")} 몫;`, `}`].join("\n");
      },
      calc: { label: o.what + `(${o.unit})`, def: o.total * 2, min: o.rows().length, max: o.total * 20, show(rows, s, v) { const r = this.run(rows, s, v); return rows.map((x, i) => `${x.이름} <b>${r[i]}</b>`).join(" · ") + ` <span class="note">(합 ${r.reduce((a, b) => a + b, 0)}${o.unit})</span>`; } }
    }, o);
  }
  const sumOk = (r, T) => r.every(isFinite) && r.reduce((a, b) => a + b, 0) === T;
  const rankSame = (a, b) => { const o = (x) => x.map((v, i) => [v, i]).sort((p, q) => q[0] - p[0]).map((p) => p[1]).join(); return o(a) === o(b); };

  /* ───────── 03 피해 회복 지원 우선순위 (상담사 30명 배치) ───────── */
  A.j3 = allocTopic({
    fn: "회복지원", title: "피해 회복 지원 우선순위", unit: "명", total: 30, who: "동", what: "상담사",
    intro: "범죄 피해자를 돕는 <b>상담사 30명</b>을 9개 동에 나눠 보내는 알고리즘을 만들어요. 센터에서 먼 동은 신고를 해도 상담을 받지 못한 사람이 많아요. AI는 “가해자가 처벌받았으니 정의는 끝났고, 피해자 지원 예산은 줄여도 된다”고 했어요.",
    rows: () => [["가동", "버스 35분", 240, 60], ["나동", "센터 있음", 300, 210], ["다동", "버스 20분", 180, 90], ["라동", "버스 40분", 480, 72], ["마동", "센터 있음", 340, 221], ["바동", "버스 25분", 420, 168], ["사동", "버스 45분", 520, 52], ["아동", "버스 30분", 220, 77], ["자동", "버스 15분", 380, 209]]
      .map(([이름, 특징, 신고, 상담]) => ({ 이름, 특징, 신고, 상담, 못받음: 신고 - 상담, 분: +(String(특징).match(/\d+/) || [0])[0] })),
    cols: [["동", "이름"], ["지원 센터까지", "특징"], ["피해 신고(건)", "신고"], ["지원 상담 받음(건)", "상담"], ["상담 못 받음(건)", "못받음"]],
    outs: ["동마다 보낼 상담사 수 (합 30명)", "가장 위험한 동 한 곳", "가해자가 받을 벌"],
    outNo: "이 알고리즘은 벌이 아니라 피해 회복을 다뤄요. 정할 건 ‘상담사를 어디에 몇 명’이에요.",
    crit: [{ id: "report", name: "피해 신고가 많은 곳에 많이", sub: "신고 건수에 비례 (벤담: 전체를 많이)" }, { id: "gap", name: "상담을 못 받은 사람이 많은 곳에 많이", sub: "신고 − 상담 받음" }, { id: "far", name: "못 받은 사람 × 센터까지 거리", sub: "멀어서 못 오는 곳을 더 무겁게 · 거리를 얼마나 볼지 정해요" }],
    param: { crit: "far", label: "센터까지 거리를 얼마나 무겁게 볼까?", min: 0, max: 200, step: 20, def: 100, unit: "%", left: "거리는 안 봐요", right: "아주 무겁게" },
    cards: [{ tag: "반복", text: "동마다 신고 · 상담 · 거리를 읽는다" }, { tag: "계산", text: "고른 기준대로 동마다 필요한 정도(무게)를 구한다" }, { tag: "계산", text: "무게 ÷ 합계 × 30명" }, { tag: "계산", text: "반올림해 사람 수로 만든다" }],
    start: [2, 0, 3, 1], orderHint: "읽고 → 무게 → 비율 → 반올림 순서예요.",
    optc: [{ id: "fit", text: "만약 합이 30명과 다르면 → 소수점이 큰 동부터 1명씩 맞춘다" }, { id: "min", text: "모든 동에 최소", n: [1, 2], after: "명은 보낸다" }],
    weight: (r, s) => s.crit === "report" ? r.신고 : s.crit === "gap" ? r.못받음 : r.못받음 * (1 + s.p / 100 * r.분 / 60),
    wcode: (s) => s.crit === "report" ? "동.신고" : s.crit === "gap" ? "동.신고 - 동.상담" : `(동.신고 - 동.상담) * (${N(1)} + ${N(s.p / 100)} * 동.센터까지분 / ${N(60)})`,
    tests(s) { const rows = this.rows(), r = this.run(rows, s); return [
      { name: "모든 동을 더하면 30명이다", ok: sumOk(r, 30), hint: "반올림 때문이에요 → ‘합 맞추기’ 조건 카드" },
      { name: "센터에서 가장 먼 사동(45분, 상담 10%)이 가장 많이 받는 곳 가운데 하나다", ok: r[6] >= Math.max(...r) - 1, hint: "신고만 보면 먼 동의 사정이 가려져요", q: true },
      { name: "센터가 있는 나동 · 마동에도 1명 이상", ok: r[1] >= 1 && r[4] >= 1, hint: "센터가 있어도 상담이 모자랄 수 있어요 → ‘최소 인원’ 카드", q: true },
      { name: "신고가 많은 동일수록 더 많이 받는다", ok: rankSame(r, rows.map((x) => x.신고)), hint: "칸트라면 피해자 한 사람 한 사람을, 벤담이라면 전체를 볼까요?", q: true }]; },
    cmp: [["신고 건수 비례", { crit: "report", fit: true }], ["못 받은 사람 비례", { crit: "gap", fit: true }]],
    cmpNote: "단위: 상담사(명)",
    find(rows, A0, Cm) { const ch = rows.map((r, i) => ({ n: r.이름, f: r.특징, g: Cm[i] - A0[i] })), up = [...ch].sort((a, b) => b.g - a.g)[0], dn = [...ch].sort((a, b) => a.g - b.g)[0];
      return `· 신고 건수로만 나눌 때와 비교하면 <b>${up.n}(${up.f})</b> ${up.g >= 0 ? "+" : ""}${up.g}명, <b>${dn.n}(${dn.f})</b> ${dn.g}명이에요.<br>· 내 알고리즘: 사동(45분) ${Cm[6]}명 · 나동(센터 있음) ${Cm[1]}명`; },
    loserPh: "예: 센터에서 먼 동의 피해자 / 센터가 있는 동. 규칙을 이렇게 바꾸면 …"
  });

  /* ───────── 04 학교 조치 추천 규칙 ───────── */
  const C4 = [["가 사안", 1, 0, 0, 1], ["나 사안", 1, 1, 0, 0], ["다 사안", 2, 1, 0, 1], ["라 사안", 2, 1, 1, 0], ["마 사안", 3, 1, 0, 1], ["바 사안", 3, 1, 1, 0]];
  const lvl4 = (c, s) => {
    if (c.피해 == null) return s.blank ? 1 : NaN;
    const sc = c.피해 * 2 + c.고의 + c.반복 * 2;
    let h = s.crit === "punish" ? sc : s.crit === "restore" ? (c.화해 ? Math.min(5, Math.max(1, sc - 3)) : Math.max(1, sc - 2)) : sc - (c.화해 ? s.p : 0);
    if (s.rep && c.반복) h = Math.max(h, 6);
    if (s.cap) h = Math.min(h, 8);
    return Math.max(1, Math.min(9, Math.round(h)));
  };
  A.j4 = {
    fn: "조치추천", title: "학교 조치 추천 규칙", unit: "호",
    intro: "학교폭력 사안 여섯 건에 <b>몇 호 조치</b>(1호 서면사과 ~ 9호 퇴학)를 추천할지 정하는 알고리즘을 만들어요. 사안마다 피해 정도, 일부러 했는지, 되풀이했는지, 화해 의사가 달라요. 관계를 되살리는 조치는 1호(사과) · 2호(접촉 금지) · 5호(특별교육)예요. AI는 “조치는 대부분 강한 처벌이라 관계를 회복하지 못한다”고 했어요.",
    rows: () => C4.map(([이름, 피해, 고의, 반복, 화해]) => ({ 이름, 피해, 고의, 반복, 화해, 피해글: ["", "가벼움", "중간", "심각"][피해], 고의글: 고의 ? "일부러" : "실수", 반복글: 반복 ? "되풀이" : "처음", 화해글: 화해 ? "있음" : "없음" })),
    cols: [["사안", "이름"], ["피해 정도", "피해글"], ["일부러?", "고의글"], ["되풀이?", "반복글"], ["화해 의사", "화해글"]],
    outs: ["사안마다 추천할 조치 호수 (1~9호)", "가해 학생의 이름", "피해 학생이 받을 보상금"],
    outNo: "이 알고리즘은 사람을 고르지 않아요. 사안마다 ‘몇 호 조치’를 추천해요.",
    crit: [{ id: "punish", name: "잘못의 크기만큼 (점수 = 호수)", sub: "피해 × 2 + 일부러 + 되풀이 × 2 · 응보 (AI가 본 지금 모습)" }, { id: "restore", name: "회복 먼저", sub: "화해 의사가 있으면 1 · 2 · 5호 안에서 · 없으면 조금 가볍게" }, { id: "mix", name: "잘못의 크기 − 화해하면 몇 호 낮추기", sub: "벌과 회복을 함께 · 몇 호 낮출지 정해요" }],
    param: { crit: "mix", label: "화해 의사가 있으면 몇 호 낮출까?", min: 0, max: 4, step: 1, def: 2, unit: "호", left: "안 낮춰요", right: "4호까지" },
    cards: [{ tag: "반복", text: "사안마다 피해 · 고의 · 되풀이 · 화해를 읽는다" }, { tag: "계산", text: "잘못의 크기 점수를 구한다" }, { tag: "조건", text: "만약 화해 의사가 있으면 → 고른 기준대로 낮춘다" }, { tag: "조건", text: "조건 카드를 적용하고 1~9호 안에 맞춘다" }],
    start: [1, 3, 0, 2], orderHint: "점수를 먼저 구해야 낮출 수 있어요.",
    optc: [{ id: "blank", text: "만약 사안 기록이 비어 있으면 → 1호로 두고 다시 조사한다" }, { id: "rep", text: "만약 되풀이한 가해면 → 최소 6호(출석정지)" }, { id: "cap", text: "9호(퇴학)는 쓰지 않는다 (최대 8호)" }],
    run(rows, s) { return rows.map((c) => lvl4(c, s)); },
    need: 1,
    tests(s) { const r = this.run(this.rows(), s), z = lvl4({}, s); return [
      { name: "기록이 비어 있는 사안이 있어도 멈추지 않는다", ok: isFinite(z), hint: "빈 기록을 계산하면 망가져요 → ‘기록이 비어 있으면’ 조건 카드" },
      { name: "화해 의사가 있는 사안은 관계 회복 조치(1 · 2 · 5호)를 받는다", ok: this.rows().every((c, i) => !c.화해 || [1, 2, 5].includes(r[i])), hint: "회복을 얼마나 중요하게 볼까요?", q: true },
      { name: "되풀이한 가해는 6호 이상이다", ok: this.rows().every((c, i) => !c.반복 || r[i] >= 6), hint: "칸트라면 잘못한 만큼, 벤담이라면 다시 안 하게 만드는 쪽을 볼까요?", q: true },
      { name: "피해가 큰 사안이 더 가벼운 조치를 받지 않는다", ok: r.every((v, i) => !i || this.rows()[i].피해 < this.rows()[i - 1].피해 || v >= r[i - 1] - 3), hint: "회복을 앞세우면 피해 학생은 어떻게 느낄까요?", q: true }]; },
    code(s, cn) { return [`${K("function")} ${F("조치")}(사안) {`, `  ${C(`// 기준: ${cn}`)}`, ...(s.blank ? [`  ${K("if")} (!사안.피해) ${K("return")} ${N(1)};   ${C("// 조건: 기록 없음")}`] : []),
      `  ${K("let")} 호 = 사안.피해 * ${N(2)} + 사안.고의 + 사안.반복 * ${N(2)};`,
      ...(s.crit === "restore" ? [`  호 = 사안.화해 ? Math.min(${N(5)}, 호 - ${N(3)}) : 호 - ${N(2)};   ${C("// 회복 먼저")}`] : s.crit === "mix" ? [`  ${K("if")} (사안.화해) 호 -= ${N(s.p)};`] : []),
      ...(s.rep ? [`  ${K("if")} (사안.반복) 호 = Math.max(호, ${N(6)});   ${C("// 조건: 되풀이")}`] : []), ...(s.cap ? [`  호 = Math.min(호, ${N(8)});   ${C("// 조건: 퇴학 없음")}`] : []),
      `  ${K("return")} Math.max(${N(1)}, Math.min(${N(9)}, 호));`, `}`].join("\n"); },
    cmp: [["잘못의 크기만큼", { crit: "punish" }], ["회복 먼저", { crit: "restore" }]],
    cmpNote: "단위: 조치 호수 (1호 서면사과 ~ 9호 퇴학)",
    find(rows, A0, Cm) { const rest = rows.filter((c, i) => [1, 2, 5].includes(Cm[i])).length; return `· AI가 본 지금 모습(잘못의 크기만큼)이면 ${rows.map((r, i) => `${r.이름} ${A0[i]}호`).join(", ")}예요.<br>· 내 알고리즘에서 관계 회복 조치(1 · 2 · 5호)를 받는 사안: <b>${rest}건</b> / 6건`; },
    loserPh: "예: 피해 학생 / 화해하고 싶은 가해 학생. 규칙을 이렇게 바꾸면 …",
    calc: { label: "피해 정도(1 가벼움 · 2 중간 · 3 심각)", def: 2, min: 1, max: 3, show(rows, s, v) { const a = lvl4({ 피해: +v, 고의: 1, 반복: 0, 화해: 1 }, s), b = lvl4({ 피해: +v, 고의: 1, 반복: 1, 화해: 0 }, s); return `일부러 · 처음 · 화해 있음 → <b>${a}호</b> · 일부러 · 되풀이 · 화해 없음 → <b>${b}호</b>`; } }
  };

  /* ───────── 05 책임 연령 판정 규칙 ───────── */
  const C5 = [["가", 11, 1, 1], ["나", 12, 3, 2], ["다", 12, 1, 3], ["라", 13, 2, 2], ["마", 13, 3, 3], ["바", 14, 2, 1]];
  const NAME5 = ["교육 · 상담", "보호관찰", "소년원", "형사처벌"];
  const act5 = (c, s) => {
    if (c.나이 == null) return s.unknown ? 1 : NaN;
    const adult = s.crit === "age14" ? c.나이 >= 14 : s.crit === "age12" ? c.나이 >= 12 : c.판단 >= s.p;
    let a = adult ? (c.행위 >= 2 ? 3 : 2) : (c.행위 >= 3 ? 2 : c.행위 >= 2 ? 1 : 0);
    if (s.young && c.나이 < 12) a = Math.min(a, 1);
    if (s.grave && c.행위 >= 3) a = Math.max(a, 2);
    return a;
  };
  A.j5 = {
    fn: "책임판정", title: "책임 연령 판정 규칙", unit: "단계",
    intro: "법을 어긴 어린 학생 여섯 명에게 어떤 조치를 할지 정하는 알고리즘을 만들어요. 조치는 0 교육 · 상담 → 1 보호관찰 → 2 소년원 → 3 형사처벌이에요. 지금 법은 만 14세 미만을 형사처벌하지 않아요(촉법소년). AI는 “기준을 12세로 낮추면 소년 범죄가 확실히 줄어든다”고 했어요.",
    rows: () => C5.map(([이름, 나이, 행위, 판단]) => ({ 이름: 이름 + " 학생", 나이, 행위, 판단, 행위글: ["", "가벼움", "중간", "심각"][행위], 판단글: ["", "낮음", "보통", "높음"][판단] })),
    cols: [["학생", "이름"], ["만 나이", "나이"], ["행위", "행위글"], ["판단 능력 (심리 평가)", "판단글"]],
    outs: ["학생마다 조치 단계 (0 교육 · 상담 ~ 3 형사처벌)", "가장 나쁜 학생 한 명", "학생이 다시 범죄를 저지를지"],
    outNo: "알고리즘은 미래를 알 수 없어요. 지금 정할 수 있는 건 ‘어떤 조치’예요.",
    crit: [{ id: "age14", name: "만 14세부터 어른처럼 (지금 법)", sub: "나이 하나로 정해요" }, { id: "age12", name: "만 12세부터 어른처럼", sub: "기준을 낮추자 · AI가 고른 생각" }, { id: "able", name: "나이 대신 판단 능력으로", sub: "심리 평가로 ‘스스로 판단할 수 있다’면 책임 · 몇 단계부터인지 정해요 (칸트)" }],
    param: { crit: "able", label: "판단 능력이 몇 단계부터 어른처럼 책임질까?", min: 1, max: 3, step: 1, def: 3, unit: "단계", left: "1 낮음", right: "3 높음" },
    cards: [{ tag: "반복", text: "학생마다 나이 · 행위 · 판단 능력을 읽는다" }, { tag: "조건", text: "만약 기준(나이 또는 판단 능력)을 넘으면 → 어른처럼, 아니면 → 보호" }, { tag: "계산", text: "행위의 무게에 따라 조치 단계를 정한다" }, { tag: "조건", text: "조건 카드를 적용한다" }],
    start: [2, 0, 3, 1], orderHint: "먼저 어른처럼 볼지 정해야 조치 단계를 정할 수 있어요.",
    optc: [{ id: "unknown", text: "만약 나이 기록이 없으면 → 보호관찰(1)로 두고 확인한다" }, { id: "young", text: "만약 만 12세 미만이면 → 보호관찰(1)까지만" }, { id: "grave", text: "만약 행위가 심각하면 → 나이와 상관없이 소년원(2) 이상" }],
    run(rows, s) { return rows.map((c) => act5(c, s)); },
    need: 1,
    tests(s) { const rows = this.rows(), r = this.run(rows, s); return [
      { name: "나이 기록이 없는 학생이 있어도 멈추지 않는다", ok: isFinite(act5({}, s)), hint: "빈 기록을 계산하면 망가져요 → ‘나이 기록이 없으면’ 조건 카드" },
      { name: "만 11세 가 학생은 형사처벌(3)을 받지 않는다", ok: r[0] < 3, hint: "11세에게 어른과 같은 책임을 물을 수 있을까요?", q: true },
      { name: "심각한 행위는 나이와 상관없이 소년원(2) 이상이다 (피해자 쪽)", ok: rows.every((c, i) => c.행위 < 3 || r[i] >= 2), hint: "루소라면 사회를 지키는 쪽을 볼까요?", q: true },
      { name: "같은 나이 · 같은 행위면 같은 조치 (판단 능력 심사 없이)", ok: s.crit !== "able", hint: "칸트라면 ‘스스로 판단할 수 있었는가’를 볼 거예요. 위 테스트들과 함께 통과할 수 있을까요?", q: true }]; },
    code(s, cn) { return [`${K("function")} ${F("조치단계")}(학생) {`, `  ${C(`// 기준: ${cn}`)}`, ...(s.unknown ? [`  ${K("if")} (학생.나이 == ${K("null")}) ${K("return")} ${N(1)};   ${C("// 조건: 나이 기록 없음")}`] : []),
      `  ${K("const")} 어른처럼 = ${s.crit === "able" ? `학생.판단능력 &gt;= ${N(s.p)}` : `학생.나이 &gt;= ${N(s.crit === "age14" ? 14 : 12)}`};`,
      `  ${K("let")} 단계 = 어른처럼 ? (학생.행위 &gt;= ${N(2)} ? ${N(3)} : ${N(2)}) : (학생.행위 &gt;= ${N(3)} ? ${N(2)} : 학생.행위 &gt;= ${N(2)} ? ${N(1)} : ${N(0)});`,
      ...(s.young ? [`  ${K("if")} (학생.나이 &lt; ${N(12)}) 단계 = Math.min(단계, ${N(1)});`] : []), ...(s.grave ? [`  ${K("if")} (학생.행위 &gt;= ${N(3)}) 단계 = Math.max(단계, ${N(2)});`] : []),
      `  ${K("return")} 단계;   ${C("// 0 교육 · 1 보호관찰 · 2 소년원 · 3 형사처벌")}`, `}`].join("\n"); },
    extra(rows, r) { return rows.map((c, i) => `${c.이름} ${isFinite(r[i]) ? NAME5[r[i]] : "오류"}`).join(" · "); },
    extraLabel: "조치",
    cmp: [["만 14세 (지금 법)", { crit: "age14" }], ["만 12세 (AI)", { crit: "age12" }]],
    cmpNote: "단위: 조치 단계 (0 교육 · 상담 · 1 보호관찰 · 2 소년원 · 3 형사처벌)",
    find(rows, A0, Cm) { return `· 기준을 12세로 낮추면 형사처벌(3)을 받는 학생이 ${A0.filter((v) => v === 3).length}명 → ${this.run(rows, { crit: "age12" }).filter((v) => v === 3).length}명이 돼요. 그런데 데이터(만 10~13세 송치)는 처벌 기준이 아니라 범죄가 늘었다는 것만 말해 줘요.<br>· 내 알고리즘: ${rows.map((r, i) => `${r.이름} ${NAME5[Cm[i]] || "—"}`).join(", ")}`; },
    loserPh: "예: 판단 능력이 낮은 어린 학생 / 피해 학생. 규칙을 이렇게 바꾸면 …",
    calc: { label: "만 나이", def: 13, min: 8, max: 18, show(rows, s, v) { return [1, 2, 3].map((w) => `행위 ${["", "가벼움", "중간", "심각"][w]} → <b>${NAME5[act5({ 나이: +v, 행위: w, 판단: 2 }, s)]}</b>`).join(" · ") + ` <span class="note">(판단 능력 보통)</span>`; } }
  };

  /* ───────── 07 교정 프로그램 자리 배분 (1,000자리) ───────── */
  const BASE7 = 1452 / 4400 * 100;   // 프로그램에 참여 안 한 사람의 재복역률 33%
  A.j7 = allocTopic({
    fn: "교정자리", title: "교정 프로그램 효과 비교 · 자리 나누기", unit: "자리", total: 1000, who: "프로그램", what: "자리",
    intro: "내년 교도소 교정 프로그램 <b>1,000자리</b>를 세 프로그램에 나누는 알고리즘을 만들어요. 프로그램에 참여하지 않은 사람의 3년 안 재복역률은 <b>33%</b>예요. AI는 “교도소는 벌을 주는 곳이라 프로그램은 세금 낭비”라고 했어요.",
    rows: () => [["직업훈련", 1200, 216], ["학업 · 검정고시", 600, 120], ["심리치료", 800, 184]].map(([이름, 출소, 재수감]) => ({ 이름, 출소, 재수감, 재복역률: Math.round(재수감 / 출소 * 1000) / 10, 줄임: Math.round((BASE7 - 재수감 / 출소 * 100) * 10) / 10 })),
    cols: [["프로그램", "이름"], ["참여 출소자(명)", "출소"], ["3년 안 다시 수감(명)", "재수감"], ["재복역률(%)", "재복역률"], ["참여 안 함(33%)보다 줄어든 %p", "줄임"]],
    outs: ["프로그램마다 내년 자리 수 (합 1,000자리)", "가장 나쁜 수감자", "형기를 얼마나 줄일지"],
    outNo: "이 알고리즘은 자리를 나눠요. 수감자 한 사람을 판단하지 않아요.",
    crit: [{ id: "cut", name: "프로그램을 없앤다 (0자리)", sub: "교도소는 벌을 주는 곳 · AI가 처음 고른 생각 (칸트의 응보와 닮았어요)" }, { id: "equal", name: "세 프로그램에 똑같이", sub: "어느 것이 나은지 모르니까" }, { id: "effect", name: "효과(재복역률을 줄인 만큼)에 비례", sub: "다시 범죄를 덜 저지르게 (벤담의 교화 · 예방)" }],
    cards: [{ tag: "반복", text: "프로그램마다 참여자와 다시 수감된 사람을 읽는다" }, { tag: "계산", text: "재복역률과 ‘참여 안 함’보다 줄어든 정도를 구한다" }, { tag: "계산", text: "고른 기준대로 무게 ÷ 합계 × 1,000자리" }, { tag: "계산", text: "반올림해 자리 수로 만든다" }],
    start: [2, 3, 0, 1], orderHint: "효과를 먼저 구해야 나눌 수 있어요.",
    optc: [{ id: "fit", text: "만약 합이 1,000자리와 다르면 → 소수점이 큰 곳부터 1자리씩 맞춘다" }, { id: "min", text: "모든 프로그램에 최소", n: [100, 200], after: "자리" }],
    weight: (r, s) => s.crit === "cut" ? 0 : s.crit === "equal" ? 1 : Math.max(0, r.줄임),
    run(rows, s, total = 1000) { if (s.crit === "cut") return rows.map(() => 0); const w = rows.map((r) => this.weight(r, s)); return allocate(w, total, { fit: s.fit, min: s.min, minN: s.minN }); },
    wcode: (s) => s.crit === "cut" ? N(0) : s.crit === "equal" ? N(1) : `${N(33)} - 프로그램.재복역률`,
    tests(s) { const rows = this.rows(), r = this.run(rows, s), saved = Math.round(rows.reduce((a, x, i) => a + r[i] * x.줄임 / 100, 0)); return [
      { name: "프로그램을 운영한다면 자리를 모두 더해 1,000자리다", ok: s.crit === "cut" || sumOk(r, 1000), hint: "반올림 때문이에요 → ‘합 맞추기’ 조건 카드" },
      { name: "내년에 다시 수감될 사람을 100명 넘게 줄인다 (자리 × 줄어든 %p)", ok: saved > 100, hint: `지금 규칙이면 약 ${saved}명이 줄어요`, q: true },
      { name: "세금을 쓰지 않는다 (0자리)", ok: s.crit === "cut", hint: "벌만 주는 교도소는 정의로울까요? 위 테스트와 함께 통과할 수 있을까요?", q: true },
      { name: "효과가 가장 작은 심리치료에도 100자리 이상", ok: r[2] >= 100, hint: "효과가 작아 보여도 필요한 사람이 있다면?", q: true }]; },
    extra(rows, r) { return `내년에 다시 수감되지 않을 것으로 보이는 사람 약 <b>${Math.round(rows.reduce((a, x, i) => a + r[i] * x.줄임 / 100, 0))}명</b>`; },
    extraLabel: "예상 효과",
    cmp: [["프로그램 없앰 (AI)", { crit: "cut" }], ["똑같이", { crit: "equal", fit: true }]],
    cmpNote: "단위: 자리",
    find(rows, A0, Cm) { const saved = Math.round(rows.reduce((a, x, i) => a + Cm[i] * x.줄임 / 100, 0)); return `· AI(프로그램 없앰)라면 줄어드는 재범은 0명이에요.<br>· 내 알고리즘이면 약 <b>${saved}명</b>이 다시 수감되지 않을 것으로 보여요. 단, 참여한 사람이 원래 덜 위험한 사람이었을 수도 있어요(데이터의 한계).`; },
    loserPh: "예: 심리치료가 필요한 수감자 / 세금을 내는 시민. 규칙을 이렇게 바꾸면 …"
  });

  /* ───────── 08 처벌 강화 전후 변화 계산 ───────── */
  const Y8 = [[2015, 24399], [2016, 19769], [2017, 19517], [2018, 19381], [2019, 15708], [2020, 17247], [2021, 14894], [2022, 15059], [2023, 13042]];
  const PRE8 = ((19381 / 24399) ** (1 / 3) - 1) * 100;   // 법 전 3년 평균 변화율 (약 −7%)
  const ch8 = (rows, i, s) => {
    if (i === 0) return s.first ? 0 : NaN;
    const k = s.crit === "avg" && i >= 2 ? 2 : 1, prev = s.crit === "avg" && i >= 2 ? (rows[i - 1].사고 + rows[i - 2].사고) / 2 : rows[i - 1].사고;
    let v = (rows[i].사고 - prev) / prev * 100;
    if (s.crit === "trend") v -= PRE8;
    if (s.covid && (rows[i].연도 === 2020 || rows[i].연도 === 2021)) return 0;
    return Math.round(v * 10) / 10;
  };
  A.j8 = {
    fn: "정책효과", title: "처벌 강화 전후 변화 계산", unit: "%",
    intro: "2019년 윤창호법으로 음주운전 처벌이 세졌어요. 해마다 음주운전 사고가 얼마나 변했는지 계산해 <b>법의 효과를 판정</b>하는 알고리즘을 만들어요. AI는 “처벌을 강하게 할수록 사고는 계속 줄어든다”고 했어요.",
    rows: () => Y8.map(([연도, 사고]) => ({ 이름: 연도 + "년", 연도, 사고, 법: 연도 >= 2019 ? "강화 뒤" : "강화 전" })),
    cols: [["연도", "이름"], ["음주운전 사고(건)", "사고"], ["윤창호법", "법"]],
    outs: ["해마다 사고 변화율(%) · 마이너스면 줄었어요", "음주운전을 한 사람 수", "윤창호법이 옳은지 그른지"],
    outNo: "알고리즘은 숫자의 변화를 계산해요. 옳고 그름은 그 결과로 우리가 판단해요.",
    crit: [{ id: "yoy", name: "지난해와만 비교", sub: "올해 − 지난해 · AI가 처음 고른 방법" }, { id: "trend", name: "지난해 비교 − 법 전부터 줄던 추세(약 −7%)", sub: "원래 줄고 있던 만큼은 법 덕분이 아니에요" }, { id: "avg", name: "지난 2년 평균과 비교", sub: "한 해의 우연한 출렁임을 줄여요" }],
    cards: [{ tag: "반복", text: "해마다 사고 건수를 읽는다" }, { tag: "조건", text: "만약 지난해 기록이 없으면 → 조건 카드대로" }, { tag: "계산", text: "고른 기준대로 비교할 값을 정한다" }, { tag: "계산", text: "변화율 = (올해 − 비교값) ÷ 비교값 × 100" }],
    start: [3, 0, 2, 1], orderHint: "비교할 값을 먼저 정해야 변화율을 계산해요.",
    optc: [{ id: "first", text: "만약 지난해 기록이 없으면(2015년) → 변화율 0으로 둔다" }, { id: "covid", text: "만약 코로나 해(2020 · 2021)면 → 판정에서 뺀다 (0)" }],
    run(rows, s) { return rows.map((_, i) => ch8(rows, i, s)); },
    need: 1,
    tests(s) { const rows = this.rows(), r = this.run(rows, s), i19 = 4; return [
      { name: "지난해 기록이 없는 첫해(2015)가 있어도 멈추지 않는다", ok: isFinite(r[0]), hint: "지난해가 없으면 나눌 수 없어요 → ‘지난해 기록이 없으면’ 조건 카드" },
      { name: "법 전부터 줄던 추세를 빼고도 2019년에 더 줄었다", ok: s.crit === "trend" && r[i19] < 0, hint: "원래 줄고 있었다면, 그만큼은 법 덕분이 아니에요", q: true },
      { name: "강화 뒤 모든 해에 사고가 줄었다 (AI의 ‘계속 줄어든다’)", ok: r.slice(i19).every((v) => v <= 0), hint: "2020년에는 오히려 늘었어요. 처벌만으로 설명할 수 있을까요?", q: true },
      { name: "코로나처럼 다른 큰 원인이 있던 해를 따로 본다", ok: !!s.covid, hint: "베카리아라면 처벌의 ‘확실성’(단속)도 함께 볼 거예요", q: true }]; },
    code(s, cn) { return [`${K("function")} ${F("변화율")}(해들, i) {`, `  ${C(`// 기준: ${cn}`)}`, ...(s.first ? [`  ${K("if")} (i === ${N(0)}) ${K("return")} ${N(0)};   ${C("// 조건: 첫해")}`] : []),
      ...(s.covid ? [`  ${K("if")} ([${N(2020)}, ${N(2021)}].includes(해들[i].연도)) ${K("return")} ${N(0)};   ${C("// 조건: 코로나 해 빼기")}`] : []),
      `  ${K("const")} 비교 = ${s.crit === "avg" ? `(해들[i-${N(1)}].사고 + 해들[i-${N(2)}].사고) / ${N(2)}` : `해들[i-${N(1)}].사고`};`,
      `  ${K("return")} (해들[i].사고 - 비교) / 비교 * ${N(100)}${s.crit === "trend" ? ` - (${N(Math.round(PRE8 * 10) / 10)})   ${C("// 추세 빼기")}` : ""};`, `}`].join("\n"); },
    cmp: [["지난해와만 (AI)", { crit: "yoy", first: true }], ["추세 빼기", { crit: "trend", first: true }]],
    cmpNote: "단위: 변화율(%) · 마이너스면 줄었어요 · 막대는 크기만 보여요",
    find(rows, A0, Cm) { return `· AI 방법이면 2019년 ${A0[4]}% → ‘법 덕분’이라고 하기 쉬워요. 그런데 2020년은 ${A0[5] > 0 ? "+" : ""}${A0[5]}%로 늘었어요.<br>· 내 알고리즘의 2019년: <b>${Cm[4]}%</b> · 법 전부터 해마다 약 ${Math.round(PRE8 * 10) / 10}%씩 줄고 있었어요.`; },
    loserPh: "예: 처벌만 믿고 단속 · 교육을 줄였을 때 피해를 입는 사람. 판정 규칙을 이렇게 바꾸면 …",
    calc: { label: "내년 사고 건수(예상)", def: 12500, min: 0, max: 40000, show(rows, s, v) { const R = [...rows, { 연도: 2024, 사고: +v, 이름: "2024년" }], c = ch8(R, R.length - 1, s); return `2024년에 ${won(v)}건이면 → 변화율 <b>${c}%</b> (${c < 0 ? "줄었어요" : "늘었거나 그대로예요"})`; } }
  };

  /* ───────── 09 산재 예방 예산 배분 (100억 원) ───────── */
  A.j9 = allocTopic({
    fn: "안전예산", title: "산재 예방 예산 배분", unit: "억 원", total: 100, who: "업종", what: "예산",
    intro: "산업재해 예방 예산 <b>100억 원</b>을 다섯 업종에 나누는 알고리즘을 만들어요. 업종마다 사고 사망자 수와 일하는 사람 수가 달라요(전체 사망자는 2023년 812명). AI는 “경영자를 처벌해도 사망자가 줄지 않았으니 이 법은 필요 없다”고 했어요.",
    rows: () => [["건설", "작은 현장이 많아요", 356, 210], ["제조", "", 170, 440], ["운수 · 창고", "", 92, 160], ["서비스", "", 150, 1200], ["농림 · 어업", "혼자 일하는 곳이 많아요", 44, 20]].map(([이름, 특징, 사망, 근로]) => ({ 이름, 특징, 사망, 근로, 만명당: Math.round(사망 / 근로 * 100) / 100 })),
    cols: [["업종", "이름"], ["특징", "특징"], ["사고 사망자(명)", "사망"], ["근로자(만 명)", "근로"], ["1만 명당 사망", "만명당"]],
    outs: ["업종마다 예방 예산(억 원, 합 100억)", "책임질 경영자 한 사람", "사고가 날 날짜"],
    outNo: "이 알고리즘은 예방 예산을 나눠요. 누구를 처벌할지는 다른 문제예요.",
    crit: [{ id: "count", name: "사망자가 많은 업종에 많이", sub: "사망자 수에 비례 (벤담: 전체 생명을 가장 많이)" }, { id: "rate", name: "1만 명당 사망이 높은 업종에 많이", sub: "일하는 한 사람이 위험한 정도 (칸트: 한 사람 한 사람)" }, { id: "mix", name: "사망자 수와 1만 명당을 섞어서", sub: "둘을 얼마나 섞을지 정해요" }],
    param: { crit: "mix", label: "1만 명당 위험을 몇 % 무게로 볼까?", min: 0, max: 100, step: 10, def: 50, unit: "%", left: "사망자 수만", right: "1만 명당만" },
    cards: [{ tag: "반복", text: "업종마다 사망자와 근로자 수를 읽는다" }, { tag: "계산", text: "고른 기준대로 위험 무게를 구한다" }, { tag: "계산", text: "무게 ÷ 합계 × 100억 원" }, { tag: "계산", text: "억 원 단위로 반올림한다" }],
    start: [1, 3, 0, 2], orderHint: "읽고 → 무게 → 비율 → 반올림이에요.",
    optc: [{ id: "fit", text: "만약 합이 100억과 다르면 → 소수점이 큰 업종부터 1억씩 맞춘다" }, { id: "min", text: "모든 업종에 최소", n: [5, 10], after: "억 원" }],
    weight(r, s) { const a = r.사망 / 812, b = r.만명당 / 4.11; return s.crit === "count" ? a : s.crit === "rate" ? b : (1 - s.p / 100) * a + s.p / 100 * b; },
    wcode: (s) => s.crit === "count" ? "업종.사망자" : s.crit === "rate" ? "업종.사망자 / 업종.근로자" : `${N(1 - s.p / 100)} * 사망몫(업종) + ${N(s.p / 100)} * 만명당몫(업종)`,
    tests(s) { const rows = this.rows(), r = this.run(rows, s); return [
      { name: "모든 업종을 더하면 100억 원이다", ok: sumOk(r, 100), hint: "반올림 때문이에요 → ‘합 맞추기’ 조건 카드" },
      { name: "한 사람이 가장 위험한 농림 · 어업(1만 명당 2.2명)이 10억 원 이상", ok: r[4] >= 10, hint: "사망자 수만 보면 작아 보여요", q: true },
      { name: "사망자가 가장 많은 건설이 가장 많이 받는다", ok: r[0] === Math.max(...r), hint: "전체를 볼까요, 한 사람을 볼까요?", q: true },
      { name: "모든 업종이 5억 원 이상", ok: r.every((v) => v >= 5), hint: "‘최소 예산’ 카드를 켜면 누가 덜 받을까요?", q: true }]; },
    cmp: [["사망자 수 비례", { crit: "count", fit: true }], ["1만 명당 비례", { crit: "rate", fit: true }]],
    cmpNote: "단위: 억 원",
    find(rows, A0, Cm) { return `· 사망자 수로만 나누면 건설 ${A0[0]}억 · 농림 · 어업 ${A0[4]}억이에요.<br>· 내 알고리즘: 건설 <b>${Cm[0]}억</b> · 농림 · 어업 <b>${Cm[4]}억</b> · 서비스 ${Cm[3]}억`; },
    loserPh: "예: 혼자 일하는 농민 / 큰 건설 현장 노동자. 규칙을 이렇게 바꾸면 …"
  });

  /* ───────── 12 가맹점 폐점 위험 알리미 ───────── */
  const sc12 = (r, s) => { if (s.crit === "none") return 0; if (!r.가맹) return s.zero ? 0 : NaN; const rate = r.폐점 / r.가맹 * 100; const v = s.crit === "rate" ? rate * 4 : rate * 4 * (1 + s.p / 100 * (r.비용 / 10000 - 1)); return Math.max(0, Math.min(100, Math.round(v))); };
  A.m2 = {
    fn: "폐점경보", title: "가맹점 폐점 위험 알리미", unit: "점",
    intro: "가맹점을 차리려는 사람에게 브랜드마다 <b>위험 점수</b>(0~100점)를 알려 주는 알고리즘을 만들어요. 점수가 높으면 본사에 상생 대책을 요구해요. AI는 “폐점은 점주가 장사를 못해서이고, 계약했으니 본사는 책임이 없다”고 했어요.",
    rows: () => [["A치킨", 1200, 180, 9800], ["B커피", 900, 63, 12000], ["C편의점", 3000, 150, 7000], ["D분식", 500, 110, 6500], ["E제과", 800, 40, 15000]].map(([이름, 가맹, 폐점, 비용]) => ({ 이름, 가맹, 폐점, 비용, 폐점률: Math.round(폐점 / 가맹 * 1000) / 10 })),
    cols: [["브랜드", "이름"], ["가맹점 수", "가맹"], ["한 해 폐점 수", "폐점"], ["폐점률(%)", "폐점률"], ["창업 비용(만 원)", "비용"]],
    outs: ["브랜드마다 위험 점수(0~100점)", "장사를 못한 점주 이름", "내년 매출"],
    outNo: "이 알고리즘은 점주를 탓하지 않아요. 브랜드의 구조가 얼마나 위험한지 점수로 알려 줘요.",
    crit: [{ id: "none", name: "알리지 않는다 (0점)", sub: "계약은 자유, 책임은 점주 · AI가 처음 고른 생각 (하이에크)" }, { id: "rate", name: "폐점률 × 4", sub: "문 닫는 비율이 높을수록" }, { id: "money", name: "폐점률 × 창업 비용 무게", sub: "문 닫으면 잃는 돈이 큰 곳을 더 무겁게 · 얼마나 볼지 정해요" }],
    param: { crit: "money", label: "창업 비용(잃는 돈)을 얼마나 무겁게 볼까?", min: 0, max: 100, step: 10, def: 50, unit: "%", left: "안 봐요", right: "많이" },
    cards: [{ tag: "반복", text: "브랜드마다 가맹점 · 폐점 · 창업 비용을 읽는다" }, { tag: "계산", text: "폐점률을 구한다" }, { tag: "계산", text: "고른 기준대로 위험 점수를 낸다" }, { tag: "조건", text: "만약 점수가 기준 이상이면 → 본사에 상생 대책 요구 (조건 카드)" }],
    start: [2, 0, 3, 1], orderHint: "폐점률을 먼저 구해야 점수를 낼 수 있어요.",
    optc: [{ id: "zero", text: "만약 가맹점이 0곳인 새 브랜드면 → 0점으로 두고 다음 해에 본다" }, { id: "alarm", text: "점수가", n: [50, 30, 70], after: "점 이상이면 → 본사에 상생 대책 요구" }],
    run(rows, s) { return rows.map((r) => sc12(r, s)); },
    need: 1,
    tests(s) { const r = this.run(this.rows(), s), th = s.alarm ? s.alarmN : 50, al = r.map((v) => v >= th); return [
      { name: "가맹점이 0곳인 새 브랜드가 있어도 멈추지 않는다", ok: s.crit === "none" || isFinite(sc12({ 가맹: 0, 폐점: 0, 비용: 8000 }, s)), hint: "0으로 나누면 망가져요 → ‘0곳이면’ 조건 카드" },
      { name: "폐점률 22%인 D분식에 알림이 간다", ok: al[3], hint: `D분식 ${r[3]}점 · 기준 ${th}점`, q: true },
      { name: "본사에 아무 책임도 묻지 않는다 (알림 0곳)", ok: !al.some(Boolean), hint: "계약의 자유일까요, 정보가 부족한 점주의 손해일까요?", q: true },
      { name: "창업 비용이 1억 5천만 원인 E제과도 따져 본다", ok: s.crit === "money" && s.p > 0, hint: "폐점률은 낮아도 문 닫으면 잃는 돈은 가장 커요", q: true }]; },
    code(s, cn) { return [`${K("function")} ${F("위험점수")}(브랜드) {`, `  ${C(`// 기준: ${cn}`)}`, ...(s.crit === "none" ? [`  ${K("return")} ${N(0)};   ${C("// 알리지 않는다")}`] : [
      ...(s.zero ? [`  ${K("if")} (브랜드.가맹점 === ${N(0)}) ${K("return")} ${N(0)};   ${C("// 조건: 새 브랜드")}`] : []), `  ${K("const")} 폐점률 = 브랜드.폐점 / 브랜드.가맹점 * ${N(100)};`,
      `  ${K("let")} 점수 = 폐점률 * ${N(4)}${s.crit === "money" ? ` * (${N(1)} + ${N(s.p / 100)} * (브랜드.창업비용 / ${N(10000)} - ${N(1)}))` : ""};`,
      ...(s.alarm ? [`  ${K("if")} (점수 &gt;= ${N(s.alarmN)}) 브랜드.상생요구 = ${K("true")};   ${C("// 조건")}`] : []), `  ${K("return")} Math.min(${N(100)}, Math.round(점수));`]), `}`].join("\n"); },
    extra(rows, r, s) { const th = s.alarm ? s.alarmN : 50; return rows.map((x, i) => `${x.이름} ${r[i] >= th ? "🔔 상생 요구" : "조용"}`).join(" · ") + ` (기준 ${th}점)`; },
    extraLabel: "알림",
    cmp: [["알리지 않음 (AI)", { crit: "none" }], ["폐점률만", { crit: "rate" }]],
    cmpNote: "단위: 위험 점수",
    find(rows, A0, Cm) { const mx = Math.max(...Cm); return `· AI라면 다섯 브랜드 모두 0점 · 점주는 아무 정보 없이 창업해요.<br>· 내 알고리즘에서 가장 위험한 브랜드: <b>${rows[Cm.indexOf(mx)].이름}</b> ${mx}점 · E제과 ${Cm[4]}점`; },
    loserPh: "예: 창업한 점주 / 본사. 규칙을 이렇게 바꾸면 …",
    calc: { label: "어떤 브랜드의 폐점률(%)", def: 10, min: 0, max: 50, show(rows, s, v) { const sc = sc12({ 가맹: 100, 폐점: +v, 비용: 9000 }, s), th = s.alarm ? s.alarmN : 50; return `폐점률 ${v}% · 창업 비용 9,000만 원이면 → <b>${sc}점</b> · ${sc >= th ? "상생 요구" : "조용"}`; } }
  };

  /* ───────── 13 내 집 마련 걸리는 해 계산 ───────── */
  const yrs13 = (r, s) => {
    if (!r.소득) return s.zero ? 99 : NaN;
    const save = s.crit === "effort" ? s.p / 100 : 0.2, grow = s.crit === "effort" ? 0 : 0.03, price = r.집값 * (s.crit === "support" ? 1 - s.p / 100 : 1) * (s.loan ? 0.7 : 1);
    let have = 0, inc = r.소득, y = 0;
    while (have < price && y < 99) { have += inc * save; inc *= 1 + grow; y++; }
    return s.cap && y > 40 ? 40 : y;
  };
  A.m3 = {
    fn: "내집기간", title: "내 집 마련 걸리는 해 계산", unit: "년",
    intro: "청년이 다섯 도시에서 아파트를 사려면 <b>몇 년</b>이 걸리는지 계산하는 알고리즘을 만들어요. 기준(얼마나 저축하는지, 정부가 돕는지)에 따라 답이 크게 달라요. AI는 “청년이 집을 못 사는 건 노력과 저축이 부족해서”라고 했어요.",
    rows: () => [["가시", 95000, 3200], ["나시", 62000, 3000], ["다시", 38000, 2900], ["라시", 28000, 2700], ["마시", 21000, 2600]].map(([이름, 집값, 소득]) => ({ 이름, 집값, 소득, 배율: Math.round(집값 / 소득 * 10) / 10 })),
    cols: [["도시", "이름"], ["아파트 평균 가격(만 원)", "집값"], ["청년 평균 연소득(만 원)", "소득"], ["집값 ÷ 연소득(배)", "배율"]],
    outs: ["도시마다 집을 사는 데 걸리는 해(년)", "집을 살 수 있는 청년 이름", "내년 집값"],
    outNo: "이 알고리즘은 사람을 고르지 않아요. 도시마다 ‘몇 년’이 걸리는지 계산해요.",
    crit: [{ id: "effort", name: "노력하면 된다: 소득의 몇 %를 저축", sub: "소득은 그대로, 모으는 비율만 · AI가 처음 고른 생각 · 저축률을 정해요" }, { id: "real", name: "현실: 소득의 20% 저축 · 소득은 해마다 3% 오름", sub: "평균적인 청년의 저축" }, { id: "support", name: "현실 + 정부 지원 (집값의 몇 %를 정부가 돕기)", sub: "공공주택 · 지원으로 부담을 줄이기 (케인즈) · 지원 비율을 정해요" }],
    param: { crit: ["effort", "support"], label: "저축률(노력) 또는 정부 지원 비율은 몇 %?", min: 10, max: 70, step: 10, def: 50, unit: "%", left: "10%", right: "70%" },
    cards: [{ tag: "반복", text: "도시마다 집값과 청년 소득을 읽는다" }, { tag: "반복", text: "해마다 소득의 일부를 모은다" }, { tag: "조건", text: "만약 모은 돈이 집값 이상이면 → 멈추고 걸린 해를 센다" }, { tag: "계산", text: "조건 카드(대출 · 상한)를 적용한다" }],
    start: [2, 3, 1, 0], orderHint: "읽고 → 모으고 → 다 모이면 멈춰요. 반복 안에 멈추는 조건이 있어요.",
    optc: [{ id: "zero", text: "만약 소득이 0이면 → ‘살 수 없음(99년)’으로 둔다 (끝나지 않는 반복 막기)" }, { id: "loan", text: "집값의 30%는 대출로 (모을 돈은 70%)" }, { id: "cap", text: "40년이 넘으면 → ‘40년 이상’으로 표시" }],
    run(rows, s) { return rows.map((r) => yrs13(r, s)); },
    need: 1,
    tests(s) { const r = this.run(this.rows(), s); return [
      { name: "소득이 0인 청년이 있어도 반복이 끝난다", ok: isFinite(yrs13({ 집값: 30000, 소득: 0 }, s)), hint: "모은 돈이 영원히 0이면 반복이 끝나지 않아요 → ‘소득이 0이면’ 조건 카드" },
      { name: "가장 비싼 가시에서도 30년 안에 산다", ok: r[0] <= 30, hint: `지금 규칙이면 ${r[0]}년이에요`, q: true },
      { name: "정부 지원 없이 해결한다 (노력과 저축만)", ok: s.crit !== "support", hint: "집은 상품일까요, 권리일까요?", q: true },
      { name: "소득의 절반 이상을 저축하라고 하지 않는다 (현실적인 저축)", ok: !(s.crit === "effort" && s.p >= 50), hint: "월급의 절반을 모으면 생활은 어떻게 될까요?", q: true }]; },
    code(s, cn) { return [`${K("function")} ${F("걸리는해")}(도시) {`, `  ${C(`// 기준: ${cn}`)}`, ...(s.zero ? [`  ${K("if")} (도시.소득 === ${N(0)}) ${K("return")} ${N(99)};   ${C("// 조건: 끝나지 않는 반복 막기")}`] : []),
      `  ${K("const")} 집값 = 도시.집값${s.crit === "support" ? ` * ${N(1 - s.p / 100)}` : ""}${s.loan ? ` * ${N(0.7)}` : ""};`, `  ${K("let")} 모은돈 = ${N(0)}, 소득 = 도시.소득, 해 = ${N(0)};`,
      `  ${K("while")} (모은돈 &lt; 집값) {   ${C("// 반복")}`, `    모은돈 += 소득 * ${N(s.crit === "effort" ? s.p / 100 : 0.2)};`, ...(s.crit !== "effort" ? [`    소득 *= ${N(1.03)};`] : []), `    해++;`, `  }`,
      `  ${K("return")} ${s.cap ? `Math.min(해, ${N(40)})` : "해"};`, `}`].join("\n"); },
    cmp: [["노력: 소득 50% 저축 (AI)", { crit: "effort", p: 50, loan: false, cap: false }], ["현실: 20% 저축", { crit: "real", loan: false, cap: false }]],
    cmpNote: "단위: 년",
    find(rows, A0, Cm) { return `· AI 생각(소득 50% 저축)이면 가시 ${A0[0]}년 · 마시 ${A0[4]}년이에요. 현실 저축률(20%)이면 가시는 ${this.run(rows, { crit: "real" })[0]}년이에요.<br>· 내 알고리즘: 가시 <b>${Cm[0]}년</b> · 마시 <b>${Cm[4]}년</b>`; },
    loserPh: "예: 비싼 도시에서 일하는 청년. 규칙을 이렇게 바꾸면 …",
    calc: { label: "내 연소득(만 원)", def: 3000, min: 0, max: 20000, show(rows, s, v) { return rows.map((r) => `${r.이름} <b>${yrs13({ ...r, 소득: +v }, s)}년</b>`).join(" · "); } }
  };

  /* ───────── 14 지역화폐 효과 추정기 ───────── */
  const R14 = [["우리 시", "도입", 3900, 4180, 1.5], ["비교 시 1", "도입 안 함", 2900, 3050, 2.0], ["비교 시 2", "도입 안 함", 3500, 3640, 0.5]];
  const grow14 = (r, s) => { if (!r.a) return s.zero ? 0 : NaN; return (r.b - r.a) / r.a * 100 - (s.pop ? r.인구 : 0); };
  A.m4 = {
    fn: "효과추정", title: "지역화폐 효과 추정기", unit: "%p",
    intro: "지역화폐를 도입한 우리 시의 골목 점포가 늘었어요. 그중 <b>지역화폐 덕분이라고 볼 수 있는 몫</b>을 추정하는 알고리즘을 만들어요. AI는 “점포가 7% 넘게 늘었으니 지역화폐 덕분이고 예산을 두 배로 늘려야 한다”고 했어요.",
    rows: () => R14.map(([이름, 특징, a, b, 인구]) => ({ 이름, 특징, a, b, 인구, 증가율: Math.round((b - a) / a * 1000) / 10 })),
    cols: [["지역", "이름"], ["지역화폐", "특징"], ["2020 골목 점포", "a"], ["2022 골목 점포", "b"], ["점포 증가율(%)", "증가율"], ["인구 증가율(%)", "인구"]],
    outs: ["지역마다 ‘지역화폐 덕분’으로 볼 수 있는 증가(%p)", "지역화폐를 쓴 사람 수", "내년 예산"],
    outNo: "예산은 이 결과를 보고 정해요. 먼저 효과가 얼마인지 추정해요.",
    crit: [{ id: "before", name: "도입 전후만 비교", sub: "늘어난 만큼 모두 지역화폐 덕분 · AI가 처음 고른 방법" }, { id: "did", name: "비교 시 두 곳의 평균만큼 빼기", sub: "지역화폐가 없어도 늘었을 만큼은 빼요 (차이의 차이)" }, { id: "did2", name: "더 비슷한 비교 시 2만큼 빼기", sub: "인구 · 산업이 우리 시와 더 비슷한 곳과 비교" }],
    cards: [{ tag: "반복", text: "지역마다 2020 · 2022 점포 수를 읽는다" }, { tag: "계산", text: "점포 증가율을 구한다" }, { tag: "계산", text: "고른 기준대로 ‘지역화폐가 없어도 늘었을 만큼’을 정한다" }, { tag: "계산", text: "효과 = 증가율 − 그만큼" }],
    start: [3, 1, 0, 2], orderHint: "증가율을 먼저 구하고, 빼는 건 마지막이에요.",
    optc: [{ id: "zero", text: "만약 2020년 점포가 0곳이면 → 증가율 0으로 둔다" }, { id: "pop", text: "인구가 늘어난 만큼은 증가율에서 뺀다" }],
    run(rows, s) { const g = rows.map((r) => grow14(r, s)), base = s.crit === "before" ? 0 : s.crit === "did" ? (g[1] + g[2]) / 2 : g[2]; return g.map((v) => Math.round((v - base) * 10) / 10); },
    need: 1,
    tests(s) { const r = this.run(this.rows(), s); return [
      { name: "2020년 점포가 0곳인 지역이 있어도 멈추지 않는다", ok: isFinite(grow14({ a: 0, b: 30, 인구: 0 }, s)), hint: "0으로 나누면 망가져요 → ‘0곳이면’ 조건 카드" },
      { name: "효과가 7%p를 넘는다 (AI: 예산 두 배)", ok: r[0] > 7, hint: `지금 추정 ${r[0]}%p`, q: true },
      { name: "지역화폐가 없는 도시와 견줘서 판단한다", ok: s.crit !== "before", hint: "지역화폐가 없어도 점포는 늘었을까요?", q: true },
      { name: "인구가 늘어난 효과도 뺀다", ok: !!s.pop, hint: "사람이 많아지면 가게도 늘어요", q: true }]; },
    code(s, cn) { return [`${K("function")} ${F("효과")}(지역들) {`, `  ${C(`// 기준: ${cn}`)}`, `  ${K("const")} 증가 = 지역들.map(지 =&gt; ${s.zero ? `지.점포2020 === ${N(0)} ? ${N(0)} : ` : ""}(지.점포2022 - 지.점포2020) / 지.점포2020 * ${N(100)}${s.pop ? " - 지.인구증가" : ""});`,
      `  ${K("const")} 없어도늘었을 = ${s.crit === "before" ? N(0) : s.crit === "did" ? `(증가[${N(1)}] + 증가[${N(2)}]) / ${N(2)}` : `증가[${N(2)}]`};`, `  ${K("return")} 증가[${N(0)}] - 없어도늘었을;   ${C("// 우리 시의 효과")}`, `}`].join("\n"); },
    extra(rows, r) { return `우리 시 효과 <b>${r[0]}%p</b> · 비교 시는 지역화폐가 없으니 0에 가까워야 해요 (${r[1]}, ${r[2]})`; },
    extraLabel: "추정",
    cmp: [["전후만 (AI)", { crit: "before", pop: false }], ["비교 시 평균 빼기", { crit: "did", pop: false }]],
    cmpNote: "단위: %p · 첫째 줄(우리 시)이 지역화폐 효과예요",
    find(rows, A0, Cm) { return `· AI 방법이면 우리 시 효과 ${A0[0]}%p → “예산 두 배”의 근거가 돼요.<br>· 내 알고리즘이면 <b>${Cm[0]}%p</b>예요. 이 효과는 세금(예산)만큼 값어치가 있을까요?`; },
    loserPh: "예: 지역화폐 예산 때문에 다른 곳에 못 쓰게 된 세금 / 골목 가게. 규칙을 이렇게 바꾸면 …",
    calc: { label: "우리 시 2022 점포 수(가정)", def: 4180, min: 0, max: 8000, show(rows, s, v) { const R = rows.map((r) => ({ ...r })); R[0].b = +v; const r = this.run(R, s); return `우리 시 점포가 ${won(v)}곳이었다면 → 효과 <b>${r[0]}%p</b>`; } }
  };

  /* ───────── 17 자산 몫 · 불평등 지수 ───────── */
  const re17 = (rows, s) => {
    const w = rows.map((r) => r.자산 == null ? (s.blank ? 0 : NaN) : r.자산);
    if (s.crit === "tax") { const t = w[4] * s.p / 100; w[4] -= t; w[0] += t * 0.6; w[1] += t * 0.4; }
    if (s.crit === "base") { const t = w[4] * s.p / 100; w[4] -= t; for (let i = 0; i < 5; i++) w[i] += t / 5; }
    if (s.keep && s.crit !== "market") { for (let i = 1; i < 5; i++) if (w[i] < w[i - 1]) w[i] = w[i - 1]; }
    return w.map((v) => Math.round(v * 10) / 10);
  };
  A.m7 = {
    fn: "분배지수", title: "자산 몫 · 불평등 지수", unit: "억 원",
    intro: "다섯 소득 분위의 가구 평균 순자산이에요. 자산을 <b>다시 나누는 규칙</b>을 만들고, 그 결과 불평등(5분위 ÷ 1분위 배율)이 어떻게 바뀌는지 계산해요. AI는 “자산 차이는 노력의 결과라 불평등은 개인 책임”이라고 했어요.",
    rows: () => [["1분위", 1.6], ["2분위", 2.9], ["3분위", 4.3], ["4분위", 6.1], ["5분위", 12.6]].map(([이름, 자산]) => ({ 이름, 자산, 몫: Math.round(자산 / 27.5 * 1000) / 10 })),
    cols: [["소득 분위", "이름"], ["가구 평균 순자산(억 원)", "자산"], ["전체 가운데 몫(%)", "몫"]],
    outs: ["분위마다 다시 나눈 뒤의 순자산(억 원)", "가장 노력한 사람", "내년 소득"],
    outNo: "알고리즘은 노력을 잴 수 없어요. 규칙대로 자산을 다시 나눈 결과를 계산해요.",
    crit: [{ id: "market", name: "지금 그대로 (다시 나누지 않음)", sub: "결과는 개인의 몫 · AI가 처음 고른 생각 (하이에크)" }, { id: "tax", name: "5분위 자산의 몇 %를 걷어 1 · 2분위에", sub: "가장 어려운 곳부터 (케인즈의 재분배) · 비율을 정해요" }, { id: "base", name: "5분위 자산의 몇 %를 걷어 모두에게 똑같이", sub: "기본 자산 · 비율을 정해요" }],
    param: { crit: ["tax", "base"], label: "5분위 자산의 몇 %를 걷을까?", min: 0, max: 60, step: 5, def: 20, unit: "%", left: "0%", right: "60%" },
    cards: [{ tag: "반복", text: "분위마다 순자산을 읽는다" }, { tag: "계산", text: "고른 기준대로 걷을 돈을 정한다" }, { tag: "계산", text: "걷은 돈을 규칙대로 나눠 더한다" }, { tag: "계산", text: "불평등 배율 = 5분위 ÷ 1분위" }],
    start: [3, 1, 2, 0], orderHint: "걷어야 나눌 수 있고, 배율은 마지막에 계산해요.",
    optc: [{ id: "blank", text: "만약 어떤 분위의 기록이 비어 있으면 → 0으로 두고 알린다" }, { id: "keep", text: "다시 나눈 뒤에도 분위 순서는 뒤집지 않는다 (4분위가 3분위보다 적어지지 않게)" }],
    run(rows, s) { return re17(rows, s); },
    need: 1,
    tests(s) { const rows = this.rows(), r = this.run(rows, s), rat = r[4] / r[0]; return [
      { name: "기록이 비어 있는 분위가 있어도 멈추지 않는다", ok: re17([{ 자산: null }, ...rows.slice(1)], s).every(isFinite), hint: "빈 기록은 계산을 망가뜨려요 → ‘비어 있으면’ 조건 카드" },
      { name: "불평등 배율(5분위 ÷ 1분위)이 4배 이하다", ok: rat <= 4, hint: `지금 ${Math.round(rat * 10) / 10}배예요 (처음 7.9배)`, q: true },
      { name: "5분위 자산을 건드리지 않는다 (재산권)", ok: s.crit === "market" || s.p === 0, hint: "열심히 모은 재산을 걷는 건 정당할까요? 위 테스트와 함께 통과할 수 있을까요?", q: true },
      { name: "다시 나눈 뒤에도 5분위가 가장 많다 (순위 유지)", ok: r[4] === Math.max(...r), hint: "순위가 뒤집히면 노력의 의미는?", q: true }]; },
    code(s, cn) { return [`${K("function")} ${F("다시나누기")}(분위들) {`, `  ${C(`// 기준: ${cn}`)}`, `  ${K("const")} 자산 = 분위들.map(분 =&gt; 분.자산${s.blank ? ` ?? ${N(0)}` : ""});`,
      ...(s.crit === "market" ? [`  ${C("// 다시 나누지 않는다")}`] : [`  ${K("const")} 걷을돈 = 자산[${N(4)}] * ${N(s.p / 100)};`, `  자산[${N(4)}] -= 걷을돈;`, ...(s.crit === "tax" ? [`  자산[${N(0)}] += 걷을돈 * ${N(0.6)};  자산[${N(1)}] += 걷을돈 * ${N(0.4)};`] : [`  ${K("for")} (${K("let")} i = ${N(0)}; i &lt; ${N(5)}; i++) 자산[i] += 걷을돈 / ${N(5)};`])]),
      ...(s.keep ? [`  순서지키기(자산);   ${C("// 조건")}`] : []), `  ${K("return")} 자산;   ${C("// 배율 = 자산[4] / 자산[0]")}`, `}`].join("\n"); },
    extra(rows, r) { return `5분위 ÷ 1분위 = <b>${Math.round(r[4] / r[0] * 10) / 10}배</b> (처음 7.9배)`; },
    extraLabel: "불평등 배율",
    cmp: [["그대로 (AI)", { crit: "market" }], ["20% 걷어 1 · 2분위에", { crit: "tax", p: 20, keep: false }]],
    cmpNote: "단위: 억 원",
    find(rows, A0, Cm) { return `· 지금 그대로면 5분위가 1분위의 <b>${Math.round(A0[4] / A0[0] * 10) / 10}배</b>예요.<br>· 내 규칙이면 <b>${Math.round(Cm[4] / Cm[0] * 10) / 10}배</b> · 1분위 ${Cm[0]}억 · 5분위 ${Cm[4]}억`; },
    loserPh: "예: 5분위 가구 / 1분위 가구. 규칙을 이렇게 바꾸면 …",
    calc: { label: "5분위에서 걷을 비율(%)", def: 30, min: 0, max: 90, show(rows, s, v) { const r = re17(rows, { ...s, crit: s.crit === "market" ? "tax" : s.crit, p: +v }); return `${v}%를 걷으면 → ${rows.map((x, i) => `${x.이름} ${r[i]}억`).join(" · ")} · 배율 <b>${Math.round(r[4] / r[0] * 10) / 10}배</b>`; } }
  };

  /* ───────── 18 ESG 등급 검증 ───────── */
  const GR = { "A+": 100, A: 90, "B+": 75, B: 60 };
  const sc18 = (r, s) => { const g = GR[r.등급] ?? 50; if (!r.e21) return s.zero ? g : NaN; const ch = (r.e23 - r.e21) / r.e21 * 100, e = Math.max(0, Math.min(100, 70 - ch * 3)); let v = s.crit === "grade" ? g : s.crit === "emit" ? e : (1 - s.p / 100) * g + s.p / 100 * e; if (s.wash && g >= 90 && ch > 0) v = Math.min(v, 40); return Math.round(v); };
  A.m8 = {
    fn: "녹색검증", title: "ESG 등급 검증 프로그램", unit: "점",
    intro: "기업마다 <b>친환경 점수</b>(0~100점)를 매기는 알고리즘을 만들어요. ESG 등급과 실제 온실가스 배출 변화가 늘 같지는 않아요. AI는 “ESG 등급이 A면 환경을 잘 지키는 기업이니 등급만 보고 사면 된다”고 했어요.",
    rows: () => [["가전자", "A", 1200, 1380], ["나화학", "A+", 3000, 2850], ["다식품", "B+", 400, 320], ["라에너지", "A", 5000, 5600], ["마통신", "B", 300, 240]].map(([이름, 등급, e21, e23]) => ({ 이름, 등급, e21, e23, 변화: Math.round((e23 - e21) / e21 * 1000) / 10 })),
    cols: [["기업", "이름"], ["ESG 환경 등급", "등급"], ["2021 배출(천 톤)", "e21"], ["2023 배출(천 톤)", "e23"], ["배출 변화(%)", "변화"]],
    outs: ["기업마다 친환경 점수(0~100점)", "가장 돈을 많이 번 기업", "내년 주가"],
    outNo: "이 알고리즘은 환경을 얼마나 지켰는지만 점수로 매겨요.",
    crit: [{ id: "grade", name: "ESG 등급 그대로 (A+ 100 · A 90 · B+ 75 · B 60)", sub: "등급을 믿는다 · AI가 처음 고른 방법" }, { id: "emit", name: "실제 배출 변화로", sub: "줄였으면 높게, 늘었으면 낮게 (70점 − 변화율 × 3)" }, { id: "mix", name: "등급과 배출 변화를 섞어서", sub: "실제 배출을 몇 % 무게로 볼지 정해요" }],
    param: { crit: "mix", label: "실제 배출 변화를 몇 % 무게로 볼까?", min: 0, max: 100, step: 10, def: 50, unit: "%", left: "등급만", right: "배출만" },
    cards: [{ tag: "반복", text: "기업마다 등급과 배출량을 읽는다" }, { tag: "계산", text: "배출 변화율을 구한다" }, { tag: "계산", text: "고른 기준대로 점수를 낸다" }, { tag: "조건", text: "조건 카드(그린워싱 의심)를 적용한다" }],
    start: [2, 0, 3, 1], orderHint: "변화율을 먼저 구해야 점수를 낼 수 있어요.",
    optc: [{ id: "zero", text: "만약 2021 배출 기록이 0이면(새 기업) → 등급 점수만 쓴다" }, { id: "wash", text: "만약 등급이 A 이상인데 배출이 늘었으면 → ‘그린워싱 의심’ 최대 40점" }],
    run(rows, s) { return rows.map((r) => sc18(r, s)); },
    need: 1,
    tests(s) { const r = this.run(this.rows(), s); return [
      { name: "2021 배출 기록이 0인 새 기업이 있어도 멈추지 않는다", ok: isFinite(sc18({ 등급: "A", e21: 0, e23: 50 }, s)), hint: "0으로 나누면 망가져요 → ‘기록이 0이면’ 조건 카드" },
      { name: "배출이 12% 늘어난 라에너지(A등급)는 70점보다 낮다", ok: r[3] < 70, hint: `지금 ${r[3]}점이에요`, q: true },
      { name: "배출을 20% 줄인 다식품(B+)이 배출이 늘어난 가전자(A)보다 높다", ok: r[2] > r[0], hint: "등급과 실제 행동 가운데 무엇을 믿을까요?", q: true },
      { name: "등급 회사의 평가를 그대로 믿는다 (시장의 정보)", ok: s.crit === "grade", hint: "하이에크라면 시장의 신호를, 스미스라면 공정한 관찰자의 눈을 볼까요?", q: true }]; },
    code(s, cn) { return [`${K("function")} ${F("친환경점수")}(기업) {`, `  ${C(`// 기준: ${cn}`)}`, `  ${K("const")} 등급점수 = { ${N('"A+"')}: ${N(100)}, A: ${N(90)}, ${N('"B+"')}: ${N(75)}, B: ${N(60)} }[기업.등급];`,
      ...(s.zero ? [`  ${K("if")} (기업.배출2021 === ${N(0)}) ${K("return")} 등급점수;   ${C("// 조건: 새 기업")}`] : []), `  ${K("const")} 변화 = (기업.배출2023 - 기업.배출2021) / 기업.배출2021 * ${N(100)};`, `  ${K("const")} 배출점수 = ${N(70)} - 변화 * ${N(3)};`,
      `  ${K("let")} 점수 = ${s.crit === "grade" ? "등급점수" : s.crit === "emit" ? "배출점수" : `${N(1 - s.p / 100)} * 등급점수 + ${N(s.p / 100)} * 배출점수`};`,
      ...(s.wash ? [`  ${K("if")} (등급점수 &gt;= ${N(90)} &amp;&amp; 변화 &gt; ${N(0)}) 점수 = Math.min(점수, ${N(40)});   ${C("// 조건: 그린워싱 의심")}`] : []), `  ${K("return")} Math.round(점수);`, `}`].join("\n"); },
    cmp: [["등급 그대로 (AI)", { crit: "grade", wash: false }], ["배출 변화로", { crit: "emit", wash: false }]],
    cmpNote: "단위: 친환경 점수",
    find(rows, A0, Cm) { return `· 등급만 보면 라에너지(배출 +12%) ${A0[3]}점 · 다식품(배출 −20%) ${A0[2]}점이에요.<br>· 내 알고리즘: 라에너지 <b>${Cm[3]}점</b> · 다식품 <b>${Cm[2]}점</b> · 가전자 ${Cm[0]}점`; },
    loserPh: "예: 등급만 믿고 투자한 소비자 / 실제로 배출을 줄인 작은 기업. 규칙을 이렇게 바꾸면 …",
    calc: { label: "어떤 A등급 기업의 배출 변화(%)", def: 5, min: -50, max: 50, show(rows, s, v) { const sc = sc18({ 등급: "A", e21: 1000, e23: 1000 * (1 + v / 100) }, s); return `A등급인데 배출이 ${v > 0 ? "+" : ""}${v}% 변했다면 → <b>${sc}점</b>`; } }
  };

  /* ───────── 20 무료 앱 숨은 비용 계산기 ───────── */
  const cost20 = (r, s) => { if (r.분 == null) return s.blank ? 0 : NaN; const ads = r.분 / 60 * r.광고, v = s.crit === "free" ? 0 : s.crit === "ads" ? ads * s.p : r.분 / 60 * 9860 * s.p / 100; return Math.round(v * (s.month ? 30 : 1)); };
  A.m10 = {
    fn: "진짜비용", title: "무료 앱 숨은 비용 계산기", unit: "원",
    intro: "무료 앱 다섯 종류의 <b>숨은 비용</b>을 원으로 바꾸는 알고리즘을 만들어요. 우리는 돈 대신 시간과 관심(광고를 보는 것)을 내고 있을지도 몰라요. AI는 “무료 앱은 말 그대로 공짜라 손해 볼 것이 없다”고 했어요.",
    rows: () => [["짧은 영상", 95, 40], ["메신저", 60, 4], ["게임", 70, 22], ["웹툰", 30, 12], ["검색 · 쇼핑", 25, 30]].map(([이름, 분, 광고]) => ({ 이름, 분, 광고, 노출: Math.round(분 / 60 * 광고) })),
    cols: [["앱 종류", "이름"], ["하루 사용 시간(분)", "분"], ["시간당 광고 노출(번)", "광고"], ["하루 광고 노출(번)", "노출"]],
    outs: ["앱마다 하루 숨은 비용(원)", "가장 재미있는 앱", "앱 회사의 이름"],
    outNo: "재미는 숫자로 잴 수 없어요. 이 알고리즘은 우리가 낸 시간과 관심을 원으로 바꿔요.",
    crit: [{ id: "free", name: "0원 (무료니까)", sub: "돈을 안 냈으니 비용도 없다 · AI가 처음 고른 생각" }, { id: "ads", name: "광고를 본 값: 노출 × 광고 한 번 값", sub: "앱 회사가 내 관심으로 번 돈 · 한 번 값을 정해요" }, { id: "time", name: "내 시간의 값: 쓴 시간 × 최저시급의 몇 %", sub: "그 시간에 할 수 있었던 다른 일 · 비율을 정해요" }],
    param: { crit: ["ads", "time"], label: "광고 한 번 값(원) 또는 최저시급의 몇 %?", min: 5, max: 100, step: 5, def: 20, unit: "", left: "5", right: "100" },
    cards: [{ tag: "반복", text: "앱마다 사용 시간과 광고 노출을 읽는다" }, { tag: "계산", text: "하루 광고 노출 = 시간 ÷ 60 × 시간당 노출" }, { tag: "계산", text: "고른 기준대로 원으로 바꾼다" }, { tag: "계산", text: "조건 카드(한 달로)를 적용하고 반올림한다" }],
    start: [2, 3, 1, 0], orderHint: "노출을 먼저 세어야 값을 매길 수 있어요.",
    optc: [{ id: "blank", text: "만약 사용 시간 기록이 비어 있으면 → 0분으로 둔다" }, { id: "month", text: "하루가 아니라 한 달(30일) 비용으로 본다" }],
    run(rows, s) { return rows.map((r) => cost20(r, s)); },
    need: 1,
    tests(s) { const r = this.run(this.rows(), s), tot = r.reduce((a, b) => a + b, 0); return [
      { name: "사용 시간 기록이 비어 있는 앱이 있어도 멈추지 않는다", ok: isFinite(cost20({ 분: undefined, 광고: 10 }, s)), hint: "빈 기록은 계산을 망가뜨려요 → ‘비어 있으면’ 조건 카드" },
      { name: "무료 앱은 정말 공짜다 (모두 0원)", ok: tot === 0, hint: "우리가 낸 것은 정말 아무것도 없을까요?", q: true },
      { name: "광고가 가장 많은 짧은 영상이 가장 비싸다", ok: r[0] === Math.max(...r), hint: "시간으로 볼까요, 광고로 볼까요?", q: true },
      { name: "메신저(광고 적음)도 0원이 아니다", ok: r[1] > 0, hint: "광고가 적어도 시간은 들어요", q: true }]; },
    code(s, cn) { return [`${K("function")} ${F("숨은비용")}(앱) {`, `  ${C(`// 기준: ${cn}`)}`, ...(s.blank ? [`  ${K("const")} 분 = 앱.분 ?? ${N(0)};   ${C("// 조건: 기록 없음")}`] : [`  ${K("const")} 분 = 앱.분;`]),
      `  ${K("const")} 비용 = ${s.crit === "free" ? N(0) : s.crit === "ads" ? `분 / ${N(60)} * 앱.시간당광고 * ${N(s.p)}` : `분 / ${N(60)} * ${N(9860)} * ${N(s.p / 100)}`};`, `  ${K("return")} Math.round(비용${s.month ? ` * ${N(30)}` : ""});`, `}`].join("\n"); },
    extra(rows, r, s) { return `모든 앱 합계 <b>${won(r.reduce((a, b) => a + b, 0))}원</b> / ${s.month ? "한 달" : "하루"}`; },
    extraLabel: "합계",
    cmp: [["0원 (AI)", { crit: "free", month: false }], ["광고 한 번 20원", { crit: "ads", p: 20, month: false }]],
    cmpNote: "단위: 원 / 하루",
    find(rows, A0, Cm) { const t = Cm.reduce((a, b) => a + b, 0); return `· AI라면 모두 0원이에요.<br>· 내 알고리즘이면 하루(또는 한 달) 합계 <b>${won(t)}원</b> · 가장 비싼 앱: <b>${rows[Cm.indexOf(Math.max(...Cm))].이름}</b>`; },
    loserPh: "예: 하루에 짧은 영상을 오래 보는 나 / 광고 회사. 규칙을 이렇게 바꾸면 …",
    calc: { label: "내 하루 짧은 영상 시간(분)", def: 120, min: 0, max: 600, show(rows, s, v) { const c = cost20({ 분: +v, 광고: 40 }, s); return `하루 ${v}분이면 → <b>${won(c)}원</b>${s.month ? " / 한 달" : " / 하루"} · 광고 약 ${Math.round(v / 60 * 40)}번`; } }
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
