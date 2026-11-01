// ================= 2.17: the car seen from above, drawn once and used everywhere =================
// A Le Mans prototype seen from above, in a 200 × 400 box, nose up. Only the left half is drawn: the right half is
// the same shape mirrored on x = 100, so the car is always perfectly symmetric.
// Wheel centres (for whoever places data on the wheels): front (35,113) / (165,113), rear (35,319) / (165,319).
const CAR_HALF='M100.5 10 L80 11 C71 12 66 19 64 30 L61 58 C50 60 43 69 41 82 L40 142 C41 151 48 157 58 159 L62 174 C55 182 51 194 51 210 L51 266 C51 276 47 283 43 289 L42 348 C43 357 50 362 60 364 L70 377 L100.5 379 Z';
const CAR_WHEELS=[['FL',35,113],['FR',165,113],['RL',35,319],['RR',165,319]];
let carTopN=0;
// the drawing as SVG elements in the 200 × 400 box; wheel colours by position (front, rear) or by data
function carTopG({wheels=true,wheelFill=null,front='#2BE38A',rear='#FFC53D'}={}){const id='ctg'+(++carTopN);
  const half=`<path d="${CAR_HALF}"/>`;
  const wh=wheels?CAR_WHEELS.map(([k,x,y])=>{const f=k[0]==='F';const w=f?22:26,h=f?54:60;
    return `<rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="6" fill="${wheelFill?wheelFill(k):'#0A0A0C'}" stroke="${f?front:rear}" stroke-width="2.2"/>`;}).join(''):'';
  return `<defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#16161A"/><stop offset=".5" stop-color="#2E2E35"/><stop offset="1" stop-color="#16161A"/></linearGradient></defs>
    ${wh}
    <g fill="url(#${id})" stroke="rgba(226,230,236,.55)" stroke-width="1.3" stroke-linejoin="round">${half}<g transform="matrix(-1 0 0 1 200 0)">${half}</g></g>
    <rect x="33" y="5" width="134" height="7" rx="2" fill="#24242A" stroke="rgba(226,230,236,.45)"/>
    <rect x="30" y="378" width="140" height="13" rx="2" fill="#24242A" stroke="rgba(226,230,236,.45)"/><rect x="27" y="370" width="5" height="26" rx="1.5" fill="#24242A" stroke="rgba(226,230,236,.45)"/><rect x="168" y="370" width="5" height="26" rx="1.5" fill="#24242A" stroke="rgba(226,230,236,.45)"/>
    <rect x="98.5" y="14" width="3" height="356" fill="var(--pacc,#C9A54C)" opacity=".55"/>
    <ellipse cx="100" cy="182" rx="17" ry="34" fill="#0B0B0E" stroke="rgba(226,230,236,.35)"/><ellipse cx="96" cy="172" rx="6" ry="14" fill="rgba(255,255,255,.06)"/>
    <path d="M100 218 L100 362" stroke="rgba(226,230,236,.18)" stroke-width="5" stroke-linecap="round"/>
    <rect x="68" y="24" width="12" height="4" rx="1" fill="var(--pacc2,#E6C877)" transform="rotate(-8 74 26)"/><rect x="120" y="24" width="12" height="4" rx="1" fill="var(--pacc2,#E6C877)" transform="rotate(8 126 26)"/>`;}
function carTopSVG(o={}){return `<svg viewBox="0 0 200 400" class="${o.cls||'pcarv'}" role="img" aria-label="${esc(tr('Auto vista dall\'alto'))}">${carTopG(o)}</svg>`;}
