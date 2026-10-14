/* 探针：输入层（鼠标拖拽派兵 / 滚轮缩放 / 键盘 U B F / 触屏拖拽·双指缩放·点击） */
const R = [];
const ok = (n, c, extra) => R.push((c ? 'PASS' : 'FAIL') + ' ' + n + (extra !== undefined ? ' :: ' + extra : ''));
const Q = new URLSearchParams(location.search);
resetCanvas(); layoutFog();
game.seed = parseInt(Q.get('seed') || '4242', 10);
game.diff = 1;
genMap(game.seed); game.phase = 'playing'; F()[0].ai = false;
for (let i = 0; i < 1800; i++) step(1 / 60);

const S = (wx, wy) => ({ clientX: w2sx(wx), clientY: w2sy(wy) });
const mine = game.nodes.filter(n => n.owner === game.me).sort((a, b) => b.troops - a.troops);
const src = mine[0];
const dst = game.nodes[src.nb[0]].owner !== game.me ? game.nodes[src.nb[0]] : game.nodes.filter(n => n.owner !== game.me).sort((a, b) => dist(src.x, src.y, a.x, a.y) - dist(src.x, src.y, b.x, b.y))[0];

// 1) 鼠标拖拽派兵
let fleets0 = game.fleets.length;
let a = S(src.x, src.y), b = S(dst.x, dst.y);
__fire('stage', 'mousedown', Object.assign({ button: 0 }, a));
ok('mousedown 选中己方岛并进入拖拽', !!game.drag && game.drag.active === true && game.sel === src);
__fire('stage', 'mousemove', b);
__fire('window', 'mouseup', Object.assign({ button: 0 }, b));
ok('拖拽到敌岛触发派兵', game.fleets.length > fleets0, 'fleets ' + fleets0 + ' -> ' + game.fleets.length);

// 2) 滚轮缩放
const z0 = cam.tz;
__fire('stage', 'wheel', { deltaY: -400, clientX: 640, clientY: 400 });
ok('滚轮改变缩放', cam.tz > z0, z0.toFixed(2) + ' -> ' + cam.tz.toFixed(2));

// 3) 键盘：U 升级 / B 建炮台 / F 旗舰
const home = mine[0];
home.troops = 500;
const lv0 = home.level;
game.sel = home;
__fire('window', 'keydown', { key: 'u' });
ok('按 U 升级（键位 + 消耗兵力）', home.level === lv0 + 1 && home.troops < 500, 'lv ' + lv0 + '->' + home.level + ' troops ' + Math.round(home.troops));
const guns0 = home.guns.length;
home.troops = 400;
__fire('window', 'keydown', { key: 'b' });
ok('按 B 建岸防炮台', home.guns.length === guns0 + 1, 'guns ' + guns0 + '->' + home.guns.length);
__fire('window', 'keydown', { key: 'f' });
ok('按 F 旗舰出海', !!game.flagship && !game.flagship.dead);
__fire('window', 'keydown', { key: 'f' });
ok('再按 F 旗舰归港', game.flagship === null);

// 4) 触屏拖拽派兵
fleets0 = game.fleets.length;
a = S(src.x, src.y); b = S(dst.x, dst.y);
__fire('stage', 'touchstart', { touches: [a] });
__fire('stage', 'touchmove', { touches: [b] });
ok('触屏拖拽时显示目标高亮', game.drag && game.drag.active === true && game.hover === dst);
__fire('stage', 'touchend', { touches: [] });
ok('触屏拖拽结束触发派兵', game.fleets.length > fleets0, 'fleets ' + fleets0 + ' -> ' + game.fleets.length);

// 5) 触屏点击（不移动）只选中，不派兵
fleets0 = game.fleets.length;
__fire('stage', 'touchstart', { touches: [S(src.x, src.y)] });
__fire('stage', 'touchend', { touches: [] });
ok('触屏轻点不误派兵', game.fleets.length === fleets0 && game.sel === src, 'fleets ' + game.fleets.length);

// 6) 双指缩放 + 平移
const z1 = cam.tz, cx1 = cam.x, cy1 = cam.y;
__fire('stage', 'touchstart', { touches: [{ clientX: 500, clientY: 400 }, { clientX: 700, clientY: 400 }] });
__fire('stage', 'touchmove', { touches: [{ clientX: 400, clientY: 400 }, { clientX: 900, clientY: 400 }] });
ok('双指张开放大', cam.tz > z1, z1.toFixed(2) + ' -> ' + cam.tz.toFixed(2));
__fire('stage', 'touchend', { touches: [] });
ok('双指结束后清理状态', game.drag !== null);

// 7) 触屏操舵旗舰 + 轻点发射鱼雷
game.flagship = null;
__fire('window', 'keydown', { key: 'f' });
const fx0 = game.flagship.x, fy0 = game.flagship.y;
game.flagship.torpCt = 0;
__fire('stage', 'touchstart', { touches: [S(game.flagship.x + 260, game.flagship.y)] });
ok('触屏按住设置航行目标', !!game.touchMove);
const bullets0 = game.bullets.length;
for (let i = 0; i < 60; i++) step(1 / 60);
ok('旗舰朝触屏方向移动', Math.hypot(game.flagship.x - fx0, game.flagship.y - fy0) > 5,
  Math.round(Math.hypot(game.flagship.x - fx0, game.flagship.y - fy0)));
__fire('stage', 'touchend', { touches: [] });
ok('轻点发射鱼雷', game.bullets.length > bullets0 && game.bullets.some(bb => bb.type === 'torp'), 'bullets ' + bullets0 + ' -> ' + game.bullets.length);

console.log('PROBE_INPUT ' + JSON.stringify(R));
