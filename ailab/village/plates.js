// 방 문패: 방마다 색 · 그림 · 이름이 다른 정사각형 문패를 캔버스로 그려요.
// 마을 건물 앞 · 방 화면 제목 옆에 쓰고, plates.html 에서 PNG 로 저장할 수도 있어요.
export const PLATES = {
  boss:     { name: '사장실',        en: 'CEO OFFICE',   bg: '#f2c94c', ink: '#3a2a10', pic: 'crown' },
  lobby:    { name: '접수처',        en: 'RECEPTION',    bg: '#d9483b', ink: '#ffffff', pic: 'mail' },
  train:    { name: '연수 기록실',    en: 'TRAINING',     bg: '#4f6a8f', ink: '#ffffff', pic: 'pin' },
  links:    { name: '링크 서재',      en: 'LINK LIBRARY', bg: '#3f7a4f', ink: '#ffffff', pic: 'book' },
  task:     { name: '과제 작업실',    en: 'WORKSHOP',     bg: '#e2873a', ink: '#ffffff', pic: 'check' },
  aiedu:    { name: 'AI 교육 연구실', en: 'AI LAB',       bg: '#2f9c8f', ink: '#ffffff', pic: 'spark' },
  moral:    { name: '도덕교과실',     en: 'ETHICS',       bg: '#9a5a7a', ink: '#ffffff', pic: 'frame' },
  others:   { name: '타교과실',       en: 'SUBJECTS',     bg: '#6b5a9a', ink: '#ffffff', pic: 'shelf' },
  plans:    { name: '지도안 연구실',   en: 'LESSON PLANS', bg: '#b4523a', ink: '#ffffff', pic: 'drawer' },
  security: { name: '정보 보안실',     en: 'SECURITY',     bg: '#3a3f45', ink: '#ffd166', pic: 'lock' },
  archive:  { name: '원본 보관실',     en: 'ARCHIVE',      bg: '#8a6a46', ink: '#ffffff', pic: 'box' },
  store2:   { name: '빈 터',          en: 'COMING SOON',  bg: '#c9c2b0', ink: '#3a3530', pic: 'plus' },
};

// 그림: 가운데 큰 원 안에 굵은 선 그림 (S = 한 변 길이)
function pic(g, kind, x, y, s, col) {
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  const P = (d) => g.stroke(new Path2D(d)), F = (d) => g.fill(new Path2D(d));
  switch (kind) {
    case 'crown': P('M18 70 L24 32 L40 50 L50 26 L60 50 L76 32 L82 70 Z'); P('M18 80 H82'); break;
    case 'mail': P('M16 30 H84 V74 H16 Z'); P('M16 32 L50 56 L84 32'); break;
    case 'pin': P('M22 22 H78 V72 H22 Z'); F('M50 34 a8 8 0 1 1 0.1 0'); P('M50 42 V60'); P('M32 82 H68'); break;
    case 'book': P('M20 24 H46 a6 6 0 0 1 6 6 V80 a6 6 0 0 0 -6 -6 H20 Z'); P('M80 24 H58 a6 6 0 0 0 -6 6 V80 a6 6 0 0 1 6 -6 H80 Z'); break;
    case 'check': P('M20 20 H80 V80 H20 Z'); P('M32 50 L45 63 L68 37'); break;
    case 'spark': P('M50 16 L58 42 L84 50 L58 58 L50 84 L42 58 L16 50 L42 42 Z'); break;
    case 'frame': P('M18 20 H82 V80 H18 Z'); P('M18 66 L40 46 L56 60 L66 52 L82 66'); F('M64 36 a6 6 0 1 1 0.1 0'); break;
    case 'shelf': P('M18 18 H82 V82 H18 Z M18 50 H82'); P('M30 22 V46 M40 22 V46 M58 54 V78 M68 54 V78'); break;
    case 'drawer': P('M22 16 H78 V84 H22 Z M22 39 H78 M22 61 H78'); P('M44 28 H56 M44 50 H56 M44 72 H56'); break;
    case 'lock': P('M28 46 H72 V82 H28 Z'); P('M36 46 V34 a14 14 0 0 1 28 0 V46'); F('M50 58 a5 5 0 1 1 0.1 0'); P('M50 62 V70'); break;
    case 'box': P('M16 34 L50 18 L84 34 V68 L50 84 L16 68 Z'); P('M16 34 L50 50 L84 34 M50 50 V84'); break;
    case 'plus': g.setLineDash([8, 8]); P('M20 20 H80 V80 H20 Z'); g.setLineDash([]); P('M50 34 V66 M34 50 H66'); break;
  }
  g.restore();
}

// 문패 하나를 캔버스에 그려요 (size 픽셀 정사각형)
export function drawPlate(key, size = 512, canvas = document.createElement('canvas')) {
  const p = PLATES[key] || PLATES.store2, S = size, g = canvas.getContext('2d');
  canvas.width = canvas.height = S;
  const r = S * 0.12, m = S * 0.04;
  // 바탕: 나무 테두리 + 색 판 + 위쪽 못 두 개
  g.fillStyle = '#6e4c30'; g.beginPath(); g.roundRect(m, m, S - m * 2, S - m * 2, r); g.fill();
  g.fillStyle = p.bg; g.beginPath(); g.roundRect(m * 2.2, m * 2.2, S - m * 4.4, S - m * 4.4, r * 0.8); g.fill();
  g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(m * 2.2, m * 2.2, S - m * 4.4, (S - m * 4.4) * 0.45, [r * 0.8, r * 0.8, 0, 0]); g.fill();
  for (const x of [S * 0.2, S * 0.8]) { g.fillStyle = '#c9a86a'; g.beginPath(); g.arc(x, S * 0.13, S * 0.022, 0, 7); g.fill(); }
  // 그림 원
  g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(S / 2, S * 0.4, S * 0.2, 0, 7); g.fill();
  pic(g, p.pic, S / 2 - S * 0.14, S * 0.4 - S * 0.14, S * 0.28, p.ink);
  // 이름 · 영문
  g.fillStyle = p.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = S * 0.15; g.font = `${fs}px "Ownglyph_UNZ-Rg", sans-serif`;
  while (g.measureText(p.name).width > S * 0.78 && fs > S * 0.07) { fs -= 2; g.font = `${fs}px "Ownglyph_UNZ-Rg", sans-serif`; }
  g.fillText(p.name, S / 2, S * 0.72);
  g.globalAlpha = 0.75; g.font = `600 ${S * 0.045}px "IBM Plex Sans KR", sans-serif`; g.fillText(p.en.split('').join(' '), S / 2, S * 0.83); g.globalAlpha = 1;
  return canvas;
}
