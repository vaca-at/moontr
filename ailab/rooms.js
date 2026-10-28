// AI 클래스의 층과 방 — 이 파일 하나가 건물 설계도입니다.
//
// 방을 추가하려면
//   1) ROOMS에 한 칸 넣고 (ai: true 이면 사진을 읽은 AI가 자료를 그 방으로 보냅니다)
//   2) FLOORS의 원하는 층 rooms 목록에 그 key를 넣은 뒤
//   3) 이 파일을 GitHub에 다시 올리고, firebase 폴더에서 firebase deploy --only functions 를 하세요.
//      (functions 쪽 사본은 배포할 때 자동으로 맞춰집니다)
//
// view: 방 안에서 카드를 보여주는 모양
//   event  — 날짜·장소·교시표 카드 (연수, 과제)
//   link   — 즐겨찾기 타일 (홈페이지)
//   lesson — 날짜순 수업 목록 (수업 공개)
//   plan   — 수업 흐름 카드, 활동 방식별 묶음 (지도안)

// 화면에 보이는 이름 (주소는 그대로 moontr.site/ailab)
export const APP_NAME = '문쌤의 AI 연구소';

export const ROOMS = {
  boss: { name: '사장실', role: '비서', system: true },

  train: {
    name: '연수 기록실', role: '기록 담당', ai: true, view: 'event',
    desc: '내가 듣는(들은) 연수의 안내 공문, 연수 참여 대상자 공문, 연수 일정표',
    fields: ['연수명', '차시', '일시', '장소', '대상자 여부', '준비물', '이수 시간', '주관 기관'],
  },
  links: {
    name: '링크 서재', role: '사서', ai: true, view: 'link',
    desc: '연수에서 알려준 홈페이지의 화면 캡쳐. 과제·마감·자료 위치 같은 중요한 안내',
    fields: ['사이트 이름', '어느 연수에서', '중요 안내', '마감일'],
  },
  moral: {
    name: '도덕실', role: '관람 안내', ai: true, view: 'lesson',
    desc: '수업 공개(공개수업) 공문에 나온 수업 가운데 도덕 교과 수업',
    fields: ['수업 제목', '학교', '장소', '학년', '교시', '수업자'],
  },
  others: {
    name: '타교과실', role: '관람 안내', ai: true, view: 'lesson',
    desc: '수업 공개(공개수업) 공문에 나온 수업 가운데 도덕이 아닌 다른 교과 수업',
    fields: ['교과', '수업 제목', '학교', '장소', '학년', '교시'],
  },
  plans: {
    name: '지도안 연구실', role: '연구원', ai: true, view: 'plan',
    desc: '연수 사이트 등에 올라온 다른 선생님의 수업 지도안(교수·학습 과정안) 캡쳐',
    fields: ['수업 주제', '교과·학년', '단원', '차시', '성취기준', '활동 방식', 'AI·디지털 도구'],
  },
  task: {
    name: '과제 작업실', role: '조교', ai: true, view: 'event', task: true,
    desc: '연수에서 나에게 낸 과제 안내(수업 사례 연구·실행 등)와 내 수업 실행 기록',
    fields: ['과제명', '제출 기한', '제출 방법', '분량·양식'],
  },

  lobby: { name: '접수처', role: '접수', system: true },
  archive: { name: '원본 보관실', role: '창고지기', system: true },
};

export const FLOORS = [
  { floor: '5F', name: '사장실', rooms: ['boss'] },
  { floor: '4F', name: '연수 층', rooms: ['train', 'links'] },
  { floor: '3F', name: '수업 공개 층', rooms: ['moral', 'others'] },
  { floor: '2F', name: '연구 층', rooms: ['plans', 'task'] },
  { floor: '1F', name: '접수처', rooms: ['lobby'] },
  { floor: 'B1', name: '원본 보관실', rooms: ['archive'] },
];
