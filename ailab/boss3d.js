// 사장님 3D 모형 (맥 앱 'AI 연구소 책상' ~/Documents/ailab-desk/web/crew.js 를 그대로 옮긴 것, 2026-11-18)
// 연구소 방 · 마을의 사장님(8번 베이지 재킷, 여자)이 맥 앱과 같은 모습이 되게 chars3d.js 의 makeChar 가 이 파일을 써요.
// 맥 앱에서 생김새를 고치면 crew.js 를 이 파일 아래쪽에 다시 붙여 넣어요 (맨 위 import 두 줄만 다름).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { BoxGeometry, Vector3 } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// ── three.js RoundedBoxGeometry (MIT, three@0.160.0 examples/jsm/geometries) ──

const _tempNormal = new Vector3();

function getUv( faceDirVector, normal, uvAxis, projectionAxis, radius, sideLength ) {

	const totArcLength = 2 * Math.PI * radius / 4;

	// length of the planes between the arcs on each axis
	const centerLength = Math.max( sideLength - 2 * radius, 0 );
	const halfArc = Math.PI / 4;

	// Get the vector projected onto the Y plane
	_tempNormal.copy( normal );
	_tempNormal[ projectionAxis ] = 0;
	_tempNormal.normalize();

	// total amount of UV space alloted to a single arc
	const arcUvRatio = 0.5 * totArcLength / ( totArcLength + centerLength );

	// the distance along one arc the point is at
	const arcAngleRatio = 1.0 - ( _tempNormal.angleTo( faceDirVector ) / halfArc );

	if ( Math.sign( _tempNormal[ uvAxis ] ) === 1 ) {

		return arcAngleRatio * arcUvRatio;

	} else {

		// total amount of UV space alloted to the plane between the arcs
		const lenUv = centerLength / ( totArcLength + centerLength );
		return lenUv + arcUvRatio + arcUvRatio * ( 1.0 - arcAngleRatio );

	}

}

class RoundedBoxGeometry extends BoxGeometry {

	constructor( width = 1, height = 1, depth = 1, segments = 2, radius = 0.1 ) {

		// ensure segments is odd so we have a plane connecting the rounded corners
		segments = segments * 2 + 1;

		// ensure radius isn't bigger than shortest side
		radius = Math.min( width / 2, height / 2, depth / 2, radius );

		super( 1, 1, 1, segments, segments, segments );

		// if we just have one segment we're the same as a regular box
		if ( segments === 1 ) return;

		const geometry2 = this.toNonIndexed();

		this.index = null;
		this.attributes.position = geometry2.attributes.position;
		this.attributes.normal = geometry2.attributes.normal;
		this.attributes.uv = geometry2.attributes.uv;

		//

		const position = new Vector3();
		const normal = new Vector3();

		const box = new Vector3( width, height, depth ).divideScalar( 2 ).subScalar( radius );

		const positions = this.attributes.position.array;
		const normals = this.attributes.normal.array;
		const uvs = this.attributes.uv.array;

		const faceTris = positions.length / 6;
		const faceDirVector = new Vector3();
		const halfSegmentSize = 0.5 / segments;

		for ( let i = 0, j = 0; i < positions.length; i += 3, j += 2 ) {

			position.fromArray( positions, i );
			normal.copy( position );
			normal.x -= Math.sign( normal.x ) * halfSegmentSize;
			normal.y -= Math.sign( normal.y ) * halfSegmentSize;
			normal.z -= Math.sign( normal.z ) * halfSegmentSize;
			normal.normalize();

			positions[ i + 0 ] = box.x * Math.sign( position.x ) + normal.x * radius;
			positions[ i + 1 ] = box.y * Math.sign( position.y ) + normal.y * radius;
			positions[ i + 2 ] = box.z * Math.sign( position.z ) + normal.z * radius;

			normals[ i + 0 ] = normal.x;
			normals[ i + 1 ] = normal.y;
			normals[ i + 2 ] = normal.z;

			const side = Math.floor( i / faceTris );

			switch ( side ) {

				case 0: // right

					// generate UVs along Z then Y
					faceDirVector.set( 1, 0, 0 );
					uvs[ j + 0 ] = getUv( faceDirVector, normal, 'z', 'y', radius, depth );
					uvs[ j + 1 ] = 1.0 - getUv( faceDirVector, normal, 'y', 'z', radius, height );
					break;

				case 1: // left

					// generate UVs along Z then Y
					faceDirVector.set( - 1, 0, 0 );
					uvs[ j + 0 ] = 1.0 - getUv( faceDirVector, normal, 'z', 'y', radius, depth );
					uvs[ j + 1 ] = 1.0 - getUv( faceDirVector, normal, 'y', 'z', radius, height );
					break;

				case 2: // top

					// generate UVs along X then Z
					faceDirVector.set( 0, 1, 0 );
					uvs[ j + 0 ] = 1.0 - getUv( faceDirVector, normal, 'x', 'z', radius, width );
					uvs[ j + 1 ] = getUv( faceDirVector, normal, 'z', 'x', radius, depth );
					break;

				case 3: // bottom

					// generate UVs along X then Z
					faceDirVector.set( 0, - 1, 0 );
					uvs[ j + 0 ] = 1.0 - getUv( faceDirVector, normal, 'x', 'z', radius, width );
					uvs[ j + 1 ] = 1.0 - getUv( faceDirVector, normal, 'z', 'x', radius, depth );
					break;

				case 4: // front

					// generate UVs along X then Y
					faceDirVector.set( 0, 0, 1 );
					uvs[ j + 0 ] = 1.0 - getUv( faceDirVector, normal, 'x', 'y', radius, width );
					uvs[ j + 1 ] = 1.0 - getUv( faceDirVector, normal, 'y', 'x', radius, height );
					break;

				case 5: // back

					// generate UVs along X then Y
					faceDirVector.set( 0, 0, - 1 );
					uvs[ j + 0 ] = getUv( faceDirVector, normal, 'x', 'y', radius, width );
					uvs[ j + 1 ] = 1.0 - getUv( faceDirVector, normal, 'y', 'x', radius, height );
					break;

			}

		}

	}

}


// ── crew.js ──
// AI 연구소 책상 · 맥 앱 전용 캐릭터 두 명 (2026-11-18, 문쌤이 보낸 캡처 생김새를 3D 로 다시 만듦)
//  - 사장님: 큰 네모 머리 · 각진 면이 보이는 풍성한 갈색 웨이브 머리(허리까지) · 큰 까만 눈
//            옷 두 벌: work = 베이지 재킷 + 검은 상의 + 통 넓은 검은 바지 + 굽 신발 / pj = 미색 잠옷(작은 무늬)
//  - 클로드: 둥근 모서리 주황 큐브 · 세로로 긴 눈 두 개 · 작은 입 · 짧은 팔 둘 · 다리 넷
// 표정은 얼굴 그림(캔버스)을 바꿔 끼워요: 사장님 open · closed · annoyed · happy / 클로드 normal · happy · sorry
// 모양을 고치려면 이 파일의 숫자(크기 · 색)만 고치면 돼요

const COL = { skin: '#f3dccb', hair: ['#4b2e20', '#5a3826', '#6a432d', '#3f271b'], jacket: '#d9c7ad', jacketD: '#bfa98b', black: '#1f1d20', pants: '#232126', shoe: '#2c2420',
  pj: '#f1ebdf', pjD: '#ddd2c0', pjDot: '#9fb3c9', claude: '#FF9A62', claudeD: '#FF8448' };
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0, ...o });
const flat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true });
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const rbox = (w, h, d, r, m) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// ───────── 얼굴 그림 ─────────
const bossFace = {};
for (const k of ['open', 'closed', 'annoyed', 'happy']) bossFace[k] = canvasTex(256, 240, (g, W, H) => {
  g.fillStyle = COL.skin; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(242,150,150,.35)'; g.beginPath(); g.ellipse(58, 168, 22, 11, 0, 0, 7); g.ellipse(198, 168, 22, 11, 0, 0, 7); g.fill();
  g.fillStyle = '#141212'; g.strokeStyle = '#141212'; g.lineCap = 'round';
  const eye = (x) => {
    if (k === 'open') { g.beginPath(); g.ellipse(x, 134, 22, 25, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 7, 124, 6, 0, 7); g.fill(); g.fillStyle = '#141212'; }
    if (k === 'closed') { g.lineWidth = 7; g.beginPath(); g.arc(x, 128, 22, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
    if (k === 'annoyed') { g.beginPath(); g.ellipse(x, 142, 22, 19, 0, 0, Math.PI); g.fill(); g.lineWidth = 8; g.beginPath(); g.moveTo(x - 28, 140); g.lineTo(x + 28, 140); g.stroke(); }
    if (k === 'happy') { g.lineWidth = 8; g.beginPath(); g.arc(x, 150, 22, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); }
  };
  eye(78); eye(178);
  g.lineWidth = 4; g.beginPath();
  if (k === 'happy') { g.arc(128, 172, 14, 0.1 * Math.PI, 0.9 * Math.PI); } else { g.moveTo(118, 184); g.lineTo(138, 184); }
  g.strokeStyle = '#8a4a3c'; g.stroke();
});
const claudeFace = {};
for (const k of ['normal', 'happy', 'sorry']) claudeFace[k] = canvasTex(256, 208, (g, W, H) => {
  g.fillStyle = COL.claude; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1b1514'; g.strokeStyle = '#1b1514'; g.lineCap = 'round';
  const rr = (x, y, w, h) => { g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, w / 2); g.fill(); };
  if (k === 'normal') { rr(84, 88, 32, 84); rr(172, 88, 32, 84); g.lineWidth = 10; g.beginPath(); g.moveTo(106, 162); g.lineTo(150, 162); g.stroke(); }
  if (k === 'happy') { rr(84, 78, 30, 64); rr(172, 78, 30, 64); g.fillStyle = '#4a1d16'; g.beginPath(); g.moveTo(98, 132); g.quadraticCurveTo(128, 182, 158, 132); g.closePath(); g.fill(); g.fillStyle = '#e8907a'; g.beginPath(); g.ellipse(128, 156, 13, 7, 0, 0, 7); g.fill(); }
  if (k === 'sorry') { g.lineWidth = 12; g.beginPath(); g.moveTo(62, 80); g.lineTo(104, 98); g.moveTo(194, 80); g.lineTo(152, 98); g.stroke(); g.lineWidth = 9; g.beginPath(); g.arc(128, 172, 18, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); }
});

// 잠옷 천 (미색에 작은 하늘색 무늬)
const pjTex = canvasTex(128, 128, (g, W, H) => { g.fillStyle = COL.pj; g.fillRect(0, 0, W, H); g.fillStyle = COL.pjDot; for (let y = 10; y < H; y += 26) for (let x = (y / 26) % 2 ? 22 : 9; x < W; x += 26) { g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); } });
pjTex.wrapS = pjTex.wrapT = THREE.RepeatWrapping; pjTex.repeat.set(1.5, 1.5);

// ───────── 사장님 ─────────
// 옷 무늬 (줄무늬 · 체크)
const stripeTex = canvasTex(128, 128, (g, W, H) => { g.fillStyle = '#eef4fb'; g.fillRect(0, 0, W, H); g.fillStyle = '#7fa6d6'; for (let x = 0; x < W; x += 22) g.fillRect(x, 0, 7, H); });
stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping; stripeTex.repeat.set(1.4, 1.4);
const checkTex = canvasTex(128, 128, (g, W, H) => { g.fillStyle = '#f6eeee'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(200,60,70,.55)'; for (let x = 0; x < W; x += 32) { g.fillRect(x, 0, 14, H); g.fillRect(0, x, W, 14); } });
checkTex.wrapS = checkTex.wrapT = THREE.RepeatWrapping; checkTex.repeat.set(1.3, 1.3);

// 한교동 느낌 잠옷 천: 연한 아쿠아에 작은 물고기 무늬 / 아쿠아 · 흰 줄무늬
const fishTex = canvasTex(128, 128, (g, W, H) => { g.fillStyle = '#cfeef3'; g.fillRect(0, 0, W, H); g.fillStyle = '#5fb3c6';
  for (let y = 16; y < H; y += 40) for (let x = (y / 40) % 2 ? 36 : 12; x < W; x += 48) { g.beginPath(); g.ellipse(x, y, 9, 5.5, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(x + 7, y); g.lineTo(x + 15, y - 6); g.lineTo(x + 15, y + 6); g.closePath(); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 4, y - 1, 1.6, 0, 7); g.fill(); g.fillStyle = '#5fb3c6'; } });
fishTex.wrapS = fishTex.wrapT = THREE.RepeatWrapping; fishTex.repeat.set(1.3, 1.3);
const aquaStripeTex = canvasTex(128, 128, (g, W, H) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.fillStyle = '#7cc9d8'; for (let y = 0; y < H; y += 24) g.fillRect(0, y, W, 11); });
aquaStripeTex.wrapS = aquaStripeTex.wrapT = THREE.RepeatWrapping; aquaStripeTex.repeat.set(1, 1.6);

// 🐟 잠옷 무늬: 이 앱만의 물고기 친구 (둥근 몸 · 작은 점 눈 · 웃는 입 · 꼬리) — 기본 그림
//    ~/Pictures/AI 연구소 잠옷 무늬 폴더에 그림(png)을 넣으면 그 그림을 대신 써요 (setPrint)
let PRINT = null;   // 사용자 그림 (Image)
function drawFish(g, cx, cy, r) {
  if (PRINT) { const k = (r * 2.3) / Math.max(PRINT.width, PRINT.height); g.drawImage(PRINT, cx - PRINT.width * k / 2, cy - PRINT.height * k / 2, PRINT.width * k, PRINT.height * k); return; }
  g.save(); g.translate(cx, cy);
  g.fillStyle = '#ffb36b'; g.beginPath(); g.moveTo(r * 0.85, 0); g.lineTo(r * 1.45, -r * 0.55); g.lineTo(r * 1.45, r * 0.55); g.closePath(); g.fill();   // 꼬리
  g.fillStyle = '#ffd08a'; g.beginPath(); g.ellipse(0, 0, r, r * 0.82, 0, 0, 7); g.fill();
  g.fillStyle = '#ffb36b'; g.beginPath(); g.moveTo(-r * 0.2, -r * 0.78); g.quadraticCurveTo(r * 0.15, -r * 1.2, r * 0.45, -r * 0.7); g.closePath(); g.fill();   // 등지느러미
  g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(-r * 0.45, -r * 0.12, r * 0.12, 0, 7); g.fill();
  g.fillStyle = 'rgba(240,120,120,.55)'; g.beginPath(); g.ellipse(-r * 0.4, r * 0.28, r * 0.16, r * 0.09, 0, 0, 7); g.fill();
  g.strokeStyle = '#2a2a2a'; g.lineWidth = r * 0.08; g.lineCap = 'round'; g.beginPath(); g.arc(-r * 0.72, r * 0.08, r * 0.14, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  g.restore();
}
const patTex = (bg, accent, bubbles) => canvasTex(160, 160, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H);
  drawFish(g, 40, 44, 17); drawFish(g, 120, 118, 17);
  if (bubbles) { g.strokeStyle = accent; g.lineWidth = 2; [[118, 30, 6], [132, 46, 4], [30, 120, 5], [46, 136, 3.5], [80, 80, 3]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); }); }
  else { g.fillStyle = accent; [[118, 36], [36, 118], [80, 80]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }); } });
const chestTex = () => canvasTex(200, 200, (g, W, H) => { g.clearRect(0, 0, W, H); drawFish(g, 100, 104, 62); });
const PJT = {};
function makePJTextures() {
  for (const k in PJT) PJT[k].dispose?.();
  PJT.mint = patTex('#bfe9df', '#ffffff', false); PJT.navy = patTex('#2c3b63', '#9fc8ea', true); PJT.chest = chestTex();
  for (const k of ['mint', 'navy']) { PJT[k].wrapS = PJT[k].wrapT = THREE.RepeatWrapping; PJT[k].repeat.set(1.1, 1.1); }
}
makePJTextures();
export function setPrint(img) { PRINT = img; makePJTextures(); }

// 옷 시안: 재킷 1 오버핏 블레이저 · 2 크롭 재킷 + 하이웨이스트 · 3 롱 트렌치 코트 / 잠옷 1 미색 도트 · 2 하늘 줄무늬 셔츠 · 3 회색 맨투맨 + 체크 바지
export const OUTFITS = { work: ['잠근 블레이저', '잠근 크롭 재킷 + 하이웨이스트', '롱 트렌치 코트'], pj: ['민트 셔츠 파자마', '화이트 티 + 민트 하프 팬츠', '네이비 긴팔 파자마'] };

// ───────── 사장님 ─────────
export function makeBoss(style = { work: 1, pj: 1 }) {
  const root = new THREE.Group(), lift = new THREE.Group(); root.add(lift);
  const rb = (w, h, d, m, r = 0.07) => rbox(w, h, d, Math.min(r, Math.min(w, h, d) / 2 - 0.005), m);   // 클로드처럼 둥근 모서리
  const LEG = 0.62, M = { jacket: std(COL.jacket), jacketD: std(COL.jacketD), black: std(COL.black), pants: std(COL.pants), shoe: std(COL.shoe), skin: std(COL.skin),
    pj: std('#ffffff', { map: pjTex }), pjD: std(COL.pjD), stripe: std('#ffffff', { map: stripeTex }), navy: std('#3b5b8a'), grey: std('#b9bcc2'), greyD: std('#9da1a8'), check: std('#ffffff', { map: checkTex }),
    belt: std('#5a3f2c'), gold: std('#c9a24b'), pinkS: std('#e9b8b5'), whiteS: std('#f4f1ec'),
    fish: std('#ffffff', { map: fishTex }), hgMint: std('#ffffff', { map: PJT.mint }), hgNavy: std('#ffffff', { map: PJT.navy }), mint: std('#9fdccd'), mintD: std('#6cc2ad'), white2: std('#fbfbf8'), navyL: std('#9fc8ea'), aqua: std('#7fc9d9'), aquaL: std('#d6f1f5'), aquaD: std('#4fa6ba'), aquaS: std('#ffffff', { map: aquaStripeTex }), lips: std('#e86a7a') };
  const parts = { work: [], pj: [] };
  const add = (to, mesh, x, y, z, outfit, rz = 0) => { mesh.position.set(x, y, z); mesh.rotation.z = rz; to.add(mesh); if (outfit) parts[outfit].push(mesh); return mesh; };
  const legs = {}, arms = {};
  for (const [k, x] of [['legL', -0.15], ['legR', 0.15]]) { const g = new THREE.Group(); g.position.set(x, LEG, 0); lift.add(g); legs[k] = g; }
  const body = new THREE.Group(); body.position.y = LEG; lift.add(body);
  for (const [k, s] of [['armL', -1], ['armR', 1]]) { const g = new THREE.Group(); g.position.set(s * 0.42, LEG + 0.58, 0); lift.add(g); arms[k] = g; add(g, rb(0.17, 0.15, 0.19, M.skin, 0.06), 0, -0.56, 0); }
  const L = Object.values(legs), A = Object.values(arms);
  // 공통 조각
  const pants = (o, m, w = 0.28, d = 0.33) => L.forEach((g) => add(g, rb(w, LEG - 0.1, d, m), 0, -(LEG - 0.1) / 2, 0, o));
  const shoes = (o, m, h = 0.12, d = 0.42) => L.forEach((g) => add(g, rb(0.3, h, d, m, 0.05), 0, -LEG + h / 2, 0.05, o));
  const sleeves = (o, m, cuff) => A.forEach((g) => { add(g, rb(0.21, 0.52, 0.25, m), 0, -0.26, 0, o); if (cuff) add(g, rb(0.22, 0.07, 0.26, cuff, 0.03), 0, -0.48, 0, o); });
  // 깃: 앞판 안쪽 가장자리에 넓게 눕고, 위로 갈수록 바깥(어깨) 쪽으로 벌어져요 (가운데로 모이지 않게)
  const lapels = (o, m, y = 0.45, x = 0.15) => [-1, 1].forEach((s) => { add(body, rb(0.12, 0.3, 0.035, m, 0.015), s * x, y, 0.218, o, s * -0.28); add(body, rb(0.1, 0.07, 0.035, m, 0.015), s * (x + 0.07), y + 0.11, 0.218, o, s * 0.35); });
  const collarBack = (o, m) => add(body, rb(0.46, 0.08, 0.16, m, 0.03), 0, 0.62, -0.08, o);   // 뒷목 깃
  // 재킷: 뒤판 + 앞판 둘(가운데가 열려 검은 상의가 보여요)
  // 재킷: 뒤판 + 앞판 둘. gap = 가운데 열린 폭 (넓게 열려 안의 검은 상의가 '면'으로 보여요 · 0 이면 여민 코트)
  const jacket = (o, len, gap = 0.3, top = 0.62, mat = M.jacket) => {
    const cy = top - len / 2, w = (0.66 - gap) / 2;
    add(body, rb(0.66, len, 0.2, mat, 0.08), 0, cy, -0.1, o);
    [-1, 1].forEach((s) => add(body, rb(w, len, 0.21, mat, 0.07), s * (gap / 2 + w / 2), cy, 0.1, o));
  };
  // 잠근 재킷 (문쌤 사진처럼): 앞이 닫히고 목 아래 작은 V 로만 검은 상의 · 깃은 V 로 모여 단추에서 만나요 · 단추 둘 · 여밈선
  const closedFront = (o, len, top = 0.62) => {
    add(body, rb(0.24, 0.2, 0.02, M.black, 0.02), 0, top - 0.11, 0.212, o);   // 목 아래 V 안쪽 검은 상의
    [-1, 1].forEach((s) => add(body, rb(0.075, 0.3, 0.035, M.jacketD, 0.015), s * 0.095, top - 0.16, 0.222, o, -s * 0.36));   // V 가장자리를 따라 눕는 깃 (위는 어깨 쪽, 아래는 가운데 단추 쪽)
    [-1, 1].forEach((s) => { const c = add(body, rb(0.24, 0.17, 0.03, M.jacket, 0.02), s * 0.17, top - 0.09, 0.215, o, -s * 0.36); c.renderOrder = 1; });   // V 바깥은 재킷 앞판으로 덮어 V 모양을 또렷하게
    add(body, rb(0.018, len - 0.32, 0.02, M.jacketD, 0.008), 0.02, top - 0.3 - (len - 0.32) / 2, 0.214, o);   // 여밈선
    [0.3, 0.15].filter((y) => y > top - len + 0.06).forEach((y) => add(body, rb(0.05, 0.05, 0.025, M.belt, 0.015), 0.045, y, 0.225, o));   // 단추
  };
  const inner = (o, h = 0.6, y = 0.31) => add(body, rb(0.6, h, 0.36, M.black, 0.07), 0, y, 0, o);   // 안에 입은 검은 상의 (넓게)
  // ── 출근 옷 ──
  if (style.work === 1) {   // 오버핏 블레이저: 엉덩이를 덮는 길이 · 통 넓은 슬랙스 · 로퍼
    // 잠근 블레이저 · 목 부분은 3번 트렌치와 같게: 넓은 깃 사이 검은 상의 + 겹쳐 여민 앞자락
    inner('work', 0.3, 0.47); jacket('work', 0.8, 0.12); lapels('work', M.jacketD, 0.47, 0.12); collarBack('work', M.jacketD); sleeves('work', M.jacket, M.jacketD);
    add(body, rb(0.2, 0.47, 0.02, M.jacket, 0.02), 0.04, 0.115, 0.215, 'work');   // 여민 앞자락 (밑단은 재킷 밑단보다 조금 위에서 끝나 가운데가 튀어나오지 않게)
    add(body, rb(0.66, 0.035, 0.215, M.jacketD, 0.012), 0, -0.165, 0.1, 'work');   // 밑단 한 줄로 나란히
    [0.28, 0.1].forEach((y) => add(body, rb(0.045, 0.045, 0.02, M.belt, 0.012), 0.08, y, 0.228, 'work'));   // 단추
    [-1, 1].forEach((s) => add(body, rb(0.14, 0.035, 0.03, M.jacketD, 0.012), s * 0.2, 0.03, 0.215, 'work'));   // 주머니 덮개
    pants('work', M.pants, 0.29, 0.35); shoes('work', M.shoe, 0.1, 0.42);
  } else if (style.work === 2) {   // 크롭 재킷 + 하이웨이스트 바지 + 벨트 + 앵클부츠
    jacket('work', 0.48, 0); closedFront('work', 0.48); collarBack('work', M.jacketD); sleeves('work', M.jacket);   // 잠근 크롭 재킷
    add(body, rb(0.6, 0.22, 0.36, M.pants, 0.07), 0, 0.07, 0, 'work'); add(body, rb(0.62, 0.05, 0.37, M.belt, 0.02), 0, 0.16, 0, 'work'); add(body, rb(0.07, 0.05, 0.02, M.gold, 0.01), 0, 0.16, 0.19, 'work');
    pants('work', M.pants, 0.29, 0.34); shoes('work', M.black, 0.2, 0.4);
  } else {   // 롱 트렌치 코트: 무릎까지 · 허리띠 · 단추 두 줄 · 슬림 바지 · 앵클부츠
    inner('work', 0.3, 0.47); jacket('work', 1.02, 0.12); lapels('work', M.jacketD, 0.47, 0.12); collarBack('work', M.jacketD); sleeves('work', M.jacket, M.jacketD);
    add(body, rb(0.2, 0.75, 0.02, M.jacket, 0.02), 0.04, 0.0, 0.215, 'work');   // 여민 앞자락 (가운데가 비어 보이지 않게)
    add(body, rb(0.7, 0.07, 0.44, M.jacketD, 0.03), 0, 0.14, 0, 'work');
    [[-0.04, 0.3], [0.12, 0.3], [-0.04, 0.0], [0.12, 0.0]].forEach(([x, y]) => add(body, rb(0.045, 0.045, 0.02, M.belt, 0.012), x, y, 0.228, 'work'));
    pants('work', M.pants, 0.24, 0.3); shoes('work', M.black, 0.18, 0.4);
  }
  // ── 잠옷: 실제 판매 캐릭터 파자마 모양을 바탕으로 (민트 셔츠 · 화이트 티 + 민트 하프 팬츠 · 네이비 긴팔), 무늬 그림은 setPrint 로 바꿀 수 있어요 ──
  const shirtPJ = (mat, pipe, slip) => {   // 깃 · 단추 · 테두리가 있는 긴팔 셔츠 파자마 + 긴바지
    add(body, rb(0.64, 0.62, 0.38, mat, 0.09), 0, 0.31, 0, 'pj');
    [-1, 1].forEach((s) => add(body, rb(0.18, 0.09, 0.03, pipe, 0.025), s * 0.09, 0.575, 0.2, 'pj', s * -0.45));   // 셔츠 깃
    add(body, rb(0.03, 0.56, 0.02, pipe, 0.01), 0.04, 0.29, 0.2, 'pj');   // 앞섶 테두리
    for (let i = 0; i < 3; i++) add(body, rb(0.045, 0.045, 0.02, M.white2, 0.012), -0.03, 0.46 - i * 0.15, 0.21, 'pj');
    add(body, rb(0.14, 0.12, 0.02, pipe, 0.02), -0.17, 0.42, 0.205, 'pj');   // 가슴 주머니 테두리
    add(body, rb(0.12, 0.1, 0.02, mat, 0.02), -0.17, 0.42, 0.212, 'pj');
    sleeves('pj', mat, pipe); pants('pj', mat, 0.28, 0.33); finSlippers(slip, pipe);
  };
  const finSlippers = (m, fin) => L.forEach((g) => { add(g, rb(0.3, 0.12, 0.42, m, 0.05), 0, -LEG + 0.06, 0.05, 'pj'); });
  if (style.pj === 1) shirtPJ(M.hgMint, M.mintD, M.mint);   // 민트 바탕에 작은 무늬 그림 · 진민트 테두리
  else if (style.pj === 2) {   // 화이트 반팔 티(가슴에 큰 그림) + 민트 하프 팬츠 (반팔 · 반바지라 팔다리가 보여요)
    add(body, rb(0.64, 0.62, 0.38, M.white2, 0.09), 0, 0.31, 0, 'pj'); add(body, rb(0.28, 0.05, 0.03, M.mint, 0.02), 0, 0.6, 0.19, 'pj');
    const chest = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshStandardMaterial({ map: PJT.chest, transparent: true, roughness: 0.8 })); add(body, chest, 0, 0.3, 0.192, 'pj');
    A.forEach((g) => { add(g, rb(0.22, 0.2, 0.26, M.white2), 0, -0.1, 0, 'pj'); add(g, rb(0.22, 0.04, 0.27, M.mint, 0.015), 0, -0.2, 0, 'pj'); add(g, rb(0.15, 0.34, 0.17, M.skin, 0.06), 0, -0.36, 0, 'pj'); });
    L.forEach((g) => { add(g, rb(0.29, 0.26, 0.34, M.mint), 0, -0.13, 0, 'pj'); add(g, rb(0.18, LEG - 0.36, 0.2, M.skin, 0.06), 0, -0.26 - (LEG - 0.36) / 2, 0, 'pj'); add(g, rb(0.29, 0.1, 0.4, M.white2, 0.05), 0, -LEG + 0.05, 0.05, 'pj'); });
  } else shirtPJ(M.hgNavy, M.navyL, M.navyL);   // 네이비 바탕에 무늬 그림 · 물방울 · 하늘색 테두리
  // 머리 (목에서 돌아요): 큰 네모 얼굴 + 각진 웨이브 머리
  const head = new THREE.Group(); head.position.y = LEG + 0.62; lift.add(head);
  const faceMat = new THREE.MeshStandardMaterial({ map: bossFace.open, roughness: 0.8 });
  const skull = rb(0.86, 0.8, 0.78, M.skin, 0.12); skull.position.y = 0.42; head.add(skull);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.69), faceMat); face.position.set(0, 0.42, 0.391); head.add(face);
  const hair = new THREE.Group(); head.add(hair);
  const lump = (r, x, y, z, i, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), flat(COL.hair[i % COL.hair.length])); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(i * 0.7, i * 1.3, i * 0.4); hair.add(m); };
  // 정수리 · 가르마 앞머리
  [[0, 0.86, -0.02, 0.36, 1.3, 0.55, 1.15], [-0.26, 0.82, 0.18, 0.2, 1, 0.8, 1], [0.27, 0.8, 0.16, 0.2, 1, 0.8, 1], [-0.12, 0.83, 0.32, 0.13, 1.3, 0.6, 0.8], [0.14, 0.82, 0.32, 0.12, 1.2, 0.6, 0.8]]
    .forEach(([x, y, z, r, a, b, c], i) => lump(r, x, y, z, i, a, b, c));
  // 앞머리: 이마 위 머리선 띠 + 가운데 가르마에서 양쪽으로 비스듬히 내려오는 커튼 앞머리 (얼굴 앞 판보다 앞에)
  const HM = flat(COL.hair[1]), HM2 = flat(COL.hair[2]);
  const band = rb(0.9, 0.16, 0.12, HM, 0.05); band.position.set(0, 0.8, 0.36); hair.add(band);
  const cap = rb(0.92, 0.18, 0.84, HM, 0.08); cap.position.set(0, 0.86, -0.02); hair.add(cap);   // 정수리 (파여 보이지 않게)
  for (const s of [-1, 1]) {
    const c1 = rb(0.36, 0.13, 0.1, s < 0 ? HM : HM2, 0.05); c1.position.set(s * 0.2, 0.73, 0.4); c1.rotation.z = s * 0.42; hair.add(c1);   // 가르마에서 내려오는 결
    const c2 = rb(0.2, 0.26, 0.11, s < 0 ? HM2 : HM, 0.05); c2.position.set(s * 0.37, 0.6, 0.38); c2.rotation.z = s * 0.15; hair.add(c2);   // 관자놀이를 덮는 끝
    lump(0.11, s * 0.31, 0.76, 0.38, s > 0 ? 3 : 4, 1.3, 0.8, 0.7);
  }
  // 옆머리 속(빈 곳이 없게): 얼굴 옆 · 귀 높이 · 볼 아래를 두 겹으로 메워요
  for (const s2 of [-1, 1]) for (let i = 0; i < 5; i++) for (const z of [0.16, -0.08, -0.28]) lump(0.17, s2 * 0.46, 0.84 - i * 0.17, z, i * 3 + (z > 0 ? 1 : 2) + (s2 > 0 ? 5 : 0), 1, 1.1, 1);
  for (const s2 of [-1, 1]) { const slab = rb(0.12, 0.72, 0.62, flat(COL.hair[0]), 0.05); slab.position.set(s2 * 0.44, 0.5, -0.05); hair.add(slab); }
  // 옆머리: 얼굴 양옆으로 어깨 아래까지 물결
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) lump(0.2 - i * 0.008, s * (0.48 + (i % 2) * 0.05), 0.68 - i * 0.2, 0.06 - i * 0.02, i + (s > 0 ? 2 : 0), 1, 1.15, 1);
  // 뒷머리: 등을 덮고 허리까지
  for (let row = 0; row < 7; row++) for (let col = -2; col <= 2; col++) lump(0.21, col * 0.19 + (row % 2) * 0.06, 0.8 - row * 0.21, -0.36 - Math.abs(col) * 0.03, row * 5 + col + 7, 1, 1.1, 0.9);
  hair.children.forEach((m) => { m.castShadow = false; });
  function setOutfit(o) { for (const k in parts) parts[k].forEach((m) => (m.visible = k === o)); }
  function setFace(f) { faceMat.map = bossFace[f] || bossFace.open; faceMat.needsUpdate = true; }
  setOutfit('work');
  return { root, lift, body, head, ...legs, ...arms, setOutfit, setFace, height: LEG + 0.62 + 1.05, legLen: LEG };
}

// ───────── 클로드 ─────────
export function makeClaude() {
  const root = new THREE.Group(), lift = new THREE.Group(); root.add(lift);
  const M = std(COL.claude, { emissive: '#ff7a3d', emissiveIntensity: 0.12, roughness: 0.55 }), MD = std(COL.claudeD, { emissive: '#ff6a2a', emissiveIntensity: 0.1, roughness: 0.55 });   // 밝고 맑은 주황
  const faceMat = new THREE.MeshStandardMaterial({ map: claudeFace.normal, roughness: 0.55, emissive: '#ff7a3d', emissiveIntensity: 0.12 });
  const BODY = { w: 0.96, h: 0.78, d: 0.74, y: 0.2 + 0.39 };
  const b = rbox(BODY.w, BODY.h, BODY.d, 0.09, M); b.position.y = BODY.y; lift.add(b);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BODY.w * 0.86, BODY.h * 0.8), faceMat); face.position.set(0, BODY.y, BODY.d / 2 + 0.002); lift.add(face);
  const legs = {};
  [[-0.3, 0.2, 'legL'], [0.3, 0.2, 'legR'], [-0.3, -0.2, 'legL2'], [0.3, -0.2, 'legR2']].forEach(([x, z, k]) => {
    const g = new THREE.Group(); g.position.set(x, 0.22, z); lift.add(g); legs[k] = g;
    const l = rbox(0.16, 0.24, 0.16, 0.04, MD); l.position.y = -0.11; g.add(l);
  });
  const arms = {};
  for (const [k, s] of [['armL', -1], ['armR', 1]]) {
    const g = new THREE.Group(); g.position.set(s * (BODY.w / 2 + 0.02), BODY.y + 0.02, 0); lift.add(g); arms[k] = g;
    const a = rbox(0.14, 0.24, 0.18, 0.05, MD); a.position.set(s * 0.06, -0.08, 0); g.add(a);
  }
  function setFace(f) { faceMat.map = claudeFace[f] || claudeFace.normal; faceMat.needsUpdate = true; }
  return { root, lift, ...legs, ...arms, setFace, setOutfit() {}, height: BODY.y + BODY.h / 2 };
}
