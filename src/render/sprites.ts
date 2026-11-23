import { mirror, shade, spriteFromRows, type Pal } from './pixels';

/*
 * Alle sprites zijn zelf getekend als tekst-arrays (10×16 voor poppetjes).
 * Legenda poppetje: h haar, s huid, e ogen, S shirt (afdelingskleur), A accent (kraag),
 * P broek, B schoenen, c kopje, d koffie, w wit (envelop), H pet, Y petrand.
 */

const FRONT = [
  '...hhhh...',
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hssssssh.',
  '.sesssses.',
  '.ssssssss.',
  '..ssssss..',
  '...ssss...',
  '.SSSAASSS.',
  'SSSSAASSSS',
  'SSSSSSSSSS',
  'sSSSSSSSSs',
  '.PPPPPPPP.',
  '.PPP..PPP.',
  '.PPP..PPP.',
  '.BBB..BBB.',
];

const BACK = [
  '...hhhh...',
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hhhhhhhh.',
  '.hhhhhhhh.',
  '.shhhhhhs.',
  '..hhhhhh..',
  '...ssss...',
  '.SSSSSSSS.',
  'SSSSSSSSSS',
  'SSSSSSSSSS',
  'sSSSSSSSSs',
  '.PPPPPPPP.',
  '.PPP..PPP.',
  '.PPP..PPP.',
  '.BBB..BBB.',
];

const SIDE = [
  '...hhhh...',
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.sssshhhh.',
  '.sesshhhh.',
  '.sssssshh.',
  '..ssssss..',
  '...ssss...',
  '..SSSSSS..',
  '..SSSSSS..',
  '..SSSSSS..',
  '..SsSSSS..',
  '..PPPPPP..',
  '...PPPP...',
  '...PPPP...',
  '..BBBB....',
];

const LEGS_A = ['.PPP..PPP.', '.PPP..BBB.', '.BBB......'];
const LEGS_B = ['.PPP..PPP.', '.BBB..PPP.', '......BBB.'];
const LEGS_SIDE = ['..PP..PP..', '.PP....PP.', '.BB....BB.'];

type Patch = [number, number, string][];

function patch(rows: string[], pts: Patch): string[] {
  const grid = rows.map((r) => r.split(''));
  for (const [x, y, ch] of pts) if (grid[y] && x >= 0 && x < grid[y].length) grid[y][x] = ch;
  return grid.map((r) => r.join(''));
}
const legs = (rows: string[], l: string[]): string[] => [...rows.slice(0, 13), ...l];
const col = (x: number, y0: number, y1: number, ch: string): Patch => {
  const p: Patch = [];
  for (let y = y0; y <= y1; y++) p.push([x, y, ch]);
  return p;
};

export interface Look {
  skin: string;
  hair: string;
  shirt: string;
  accent: string;
  pants: string;
  longHair: boolean;
  cap?: string;
  capBand?: string;
  envelope?: boolean;
}

export type Frames = Record<string, HTMLCanvasElement>;

/** Bouwt alle frames voor één poppetje. Namen: down_0..2, up_0..2, left/right_0..1, sit_*, wave_*, stretch_*, cup, sip. */
export function buildFrames(look: Look): Frames {
  const pal: Pal = {
    h: look.hair,
    s: look.skin,
    e: '#2b2420',
    S: look.shirt,
    A: look.accent,
    P: look.pants,
    B: '#2a211c',
    c: '#f6f3ec',
    d: '#6b3e1f',
    w: '#fbfbf7',
    H: look.cap ?? look.hair,
    Y: look.capBand ?? look.accent,
  };
  let front = FRONT;
  let back = BACK;
  let side = SIDE;
  if (look.longHair) {
    front = patch(front, [...col(1, 4, 7, 'h'), ...col(8, 4, 7, 'h')]);
    back = patch(back, [[1, 6, 'h'], [8, 6, 'h'], ...col(2, 7, 7, 'h'), ...col(7, 7, 7, 'h')]);
    side = patch(side, [...col(6, 5, 7, 'h'), ...col(7, 5, 7, 'h'), ...col(8, 5, 6, 'h')]);
  }
  if (look.cap) {
    front = ['...HHHH...', '..HHHHHH..', '.YYYYYYYY.', ...front.slice(3)];
    back = ['...HHHH...', '..HHHHHH..', '.HYYYYYYH.', ...back.slice(3)];
    side = ['...HHHH...', '..HHHHHH..', 'YYYYHHHH..', ...side.slice(3)];
  }

  const f: Frames = {};
  const add = (name: string, rows: string[]) => (f[name] = spriteFromRows(rows, pal));

  const envFront = (r: string[]) => (look.envelope ? patch(r, [[6, 10, 'w'], [7, 10, 'w'], [8, 10, 'w'], [6, 11, 'w'], [7, 11, 'w'], [8, 11, 'w']]) : r);
  const envSide = (r: string[]) => (look.envelope ? patch(r, [[0, 10, 'w'], [1, 10, 'w'], [2, 10, 'w'], [0, 11, 'w'], [1, 11, 'w'], [2, 11, 'w']]) : r);

  add('down_0', envFront(front));
  add('down_1', envFront(legs(front, LEGS_A)));
  add('down_2', envFront(legs(front, LEGS_B)));
  add('up_0', back);
  add('up_1', legs(back, LEGS_A));
  add('up_2', legs(back, LEGS_B));
  add('left_0', envSide(side));
  add('left_1', envSide(legs(side, LEGS_SIDE)));
  f.right_0 = mirror(f.left_0);
  f.right_1 = mirror(f.left_1);

  // Zittend, van achteren gezien (alleen bovenlijf; de stoel bedekt de rest).
  const upper = back.slice(0, 13);
  add('sit_0', patch(upper, [[9, 11, '.'], [9, 10, 's']]));
  add('sit_1', patch(upper, [[0, 11, '.'], [0, 10, 's']]));
  add('sit_idle', upper);
  add('sit_sip', patch(upper, [...col(9, 8, 9, 'S'), [9, 7, 's'], [9, 6, 'c'], [9, 5, 'c'], [9, 10, '.'], [9, 11, '.']]));
  const armsUp = (y: number): Patch => [
    [0, y, 's'], ...col(0, y + 1, 9, 'S'), [9, y, 's'], ...col(9, y + 1, 9, 'S'),
    [0, 10, '.'], [0, 11, '.'], [9, 10, '.'], [9, 11, '.'],
  ];
  add('sit_err_0', patch(upper, armsUp(6)));
  add('sit_err_1', patch(upper, armsUp(4)));

  // Staand, van voren.
  add('wave_0', patch(front, [[9, 1, 's'], [9, 2, 's'], ...col(9, 3, 9, 'S'), [9, 10, '.'], [9, 11, '.']]));
  add('wave_1', patch(front, [[8, 1, 's'], [9, 2, 's'], ...col(9, 3, 9, 'S'), [9, 10, '.'], [9, 11, '.']]));
  const stretch = (y: number): Patch => [
    ...col(0, y, y + 1, 's'), ...col(0, y + 2, 9, 'S'), ...col(9, y, y + 1, 's'), ...col(9, y + 2, 9, 'S'),
    [0, 10, '.'], [0, 11, '.'], [9, 10, '.'], [9, 11, '.'],
  ];
  add('stretch_0', patch(front, stretch(0)));
  add('stretch_1', patch(front, stretch(3)));
  add('cup', patch(front, [[7, 9, 'd'], [8, 9, 'd'], [7, 10, 'c'], [8, 10, 'c'], [7, 11, 'c'], [8, 11, 'c']]));
  add('sip', patch(front, [[6, 6, 'c'], [7, 6, 'c'], [6, 7, 'c'], [7, 7, 'c'], [8, 8, 's'], [9, 10, '.'], [9, 11, '.']]));
  return f;
}

/* ---------- Rol-iconen (8×8) op een klein bordje ---------- */

const ICON_PAL: Pal = {
  k: '#3a2e28', w: '#ffffff', r: '#d9534f', g: '#6d7a85', b: '#4a7fb5', c: '#cfe3f3',
  y: '#f4c430', o: '#b8741a', G: '#4caf50', B: '#5b8def', p: '#e9e2d0',
};

const ICONS: Record<string, string[]> = {
  planning: ['.k....k.', 'krrrrrrk', 'krrrrrrk', 'kwwwwwwk', 'kwkwkwwk', 'kwwwwwwk', 'kwkwkwwk', 'kkkkkkkk'],
  ads: ['........', '......r.', '......r.', '...B..r.', '...B..r.', 'G..B..r.', 'G..B..r.', 'kkkkkkkk'],
  weer: ['........', '...bb...', '..bccb..', '.bccccbb', 'bccccccb', 'bccccccb', '.bbbbbb.', '........'],
  content: ['......kk', '.....kyk', '....kyk.', '...kyk..', '..kyk...', '.kpk....', '.kk.....', 'k.......'],
  seo: ['.kkkk...', 'kcwcck..', 'kwccck..', 'kcccck..', 'kcccck..', '.kkkko..', '.....oo.', '......oo'],
  reviews: ['...yy...', '...yy...', 'yyyyyyyy', '.yyyyyy.', '..yyyy..', '.yyyyyy.', '.yy..yy.', 'y......y'],
  opvolging: ['........', '.kkkkkk.', 'kkk..kkk', 'kk....kk', '..kkkk..', '.kkrrkk.', '.krrrrk.', '.kkkkkk.'],
  briefing: ['........', 'kkkkkkkk', 'kwkwwkwk', 'kwwkkwwk', 'kwwwwwwk', 'kwwwwwwk', 'kkkkkkkk', '........'],
  realtime: ['...gg...', '.g.gg.g.', '..gggg..', 'gggkkggg', 'gggkkggg', '..gggg..', '.g.gg.g.', '...gg...'],
};

const iconCache = new Map<string, HTMLCanvasElement>();
export function roleIcon(role: string): HTMLCanvasElement {
  const key = ICONS[role] ? role : 'content';
  let c = iconCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = 10;
    c.height = 10;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#6b5444';
    ctx.fillRect(0, 0, 10, 10);
    ctx.fillStyle = '#fff4dc';
    ctx.fillRect(1, 1, 8, 8);
    ctx.drawImage(spriteFromRows(ICONS[key], ICON_PAL), 1, 1);
    iconCache.set(key, c);
  }
  return c;
}

/* ---------- Wolkjes boven de poppetjes (11×10) ---------- */

const BUBBLES: Record<string, { rows: string[]; pal: Pal }> = {
  waiting: {
    rows: ['.kkkkkkkkk.', 'kyyyykyyyyk', 'kyyyykyyyyk', 'kyyyykyyyyk', 'kyyyykyyyyk', 'kyyyyyyyyyk', 'kyyyykyyyyk', '.kkkkkkkkk.', '....kyk....', '.....k.....'],
    pal: { k: '#4a3200', y: '#ffd23f' },
  },
  done: {
    rows: ['.kkkkkkkkk.', 'kgggggggggk', 'kgggggggwgk', 'kggggggwwgk', 'kgwwggwwggk', 'kggwwwwgggk', 'kgggwwggggk', '.kkkkkkkkk.', '....kgk....', '.....k.....'],
    pal: { k: '#1d4d22', g: '#4cc15a', w: '#ffffff' },
  },
  error: {
    rows: ['.kkkkkkkkk.', 'krrrrwrrrrk', 'krrrrwrrrrk', 'krrrrwrrrrk', 'krrrrwrrrrk', 'krrrrrrrrrk', 'krrrrwrrrrk', '.kkkkkkkkk.', '....krk....', '.....k.....'],
    pal: { k: '#4d0f0f', r: '#e5413b', w: '#ffffff' },
  },
  chat: {
    rows: ['.kkkkk.', 'kwwwwwk', 'kwkwkwk', 'kwwwwwk', '.kkkkk.', '..k....'],
    pal: { k: '#55463c', w: '#ffffff' },
  },
};
const bubbleCache = new Map<string, HTMLCanvasElement>();
export function bubble(kind: 'waiting' | 'done' | 'error' | 'chat'): HTMLCanvasElement {
  let c = bubbleCache.get(kind);
  if (!c) {
    c = spriteFromRows(BUBBLES[kind].rows, BUBBLES[kind].pal);
    bubbleCache.set(kind, c);
  }
  return c;
}

/* ---------- Plant (12×15) ---------- */
let plantSprite: HTMLCanvasElement | null = null;
export function plant(): HTMLCanvasElement {
  plantSprite ??= spriteFromRows(
    [
      '....GG..G...',
      '..G.GGgGG.G.',
      '.GGgGGGgGGG.',
      'GGGGgGGGGgGG',
      '.GgGGGGGGGG.',
      'GGGGGgGGgGGG',
      '.GGGGGGGGGG.',
      '..GGgGGGGG..',
      '...GGGGGG...',
      '..oooooooo..',
      '..OOOOOOOO..',
      '...oooooo...',
      '...oooooo...',
      '...oooooo...',
      '....oooo....',
    ],
    { G: '#3f8f3a', g: '#6cbf4f', o: '#c2683a', O: '#a5532c' },
  );
  return plantSprite;
}

/** Huidskleuren en haarkleuren; per agent wordt er (vast) één gekozen. */
export const SKINS = ['#f2c9a0', '#e0ac7e', '#c68b59', '#8d5a3b', '#f5d6b8', '#a86b45'];
export const HAIRS = ['#2b1d14', '#5a3a22', '#a0522d', '#d9b36c', '#1a1a1a', '#7b4a2e', '#b8b8b8', '#8c2f1c'];

/** Broek: donkere variant van de afdelingskleur. */
export const pantsFor = (main: string): string => shade(main, -0.55);
