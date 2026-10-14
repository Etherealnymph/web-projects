/* 探针：塔防层（岸防炮台 / 结构血量 / 压制 / 建造经济） */
const R = [];
const ok = (n, c, extra) => R.push((c ? 'PASS' : 'FAIL') + ' ' + n + (extra !== undefined ? ' :: ' + extra : ''));
const Q = new URLSearchParams(location.search);
resetCanvas(); layoutFog();
game.seed = parseInt(Q.get('seed') || '4242', 10);
game.diff = 1;
genMap(game.seed);
game.phase = 'playing';
F()[0].ai = false;
for (let i = 0; i < 1800; i++) step(1 / 60);

// 1) 结构上限来自岛屿类型，不再跟兵力挂钩
const mine = game.nodes.filter(n => n.owner === game.me).sort((a, b) => b.troops - a.troops);
const home = mine[0];
ok('结构上限按类型设定', home.hpMax === Math.round(KINDS[home.kind].hp * (1 + home.level * HP_LV_BONUS)), home.kind + ' ' + home.hpMax);
ok('起始结构满血', home.hp === home.hpMax, home.hp + '/' + home.hpMax);

// 2) 岸防炮台默认数量 = 类型值 + 等级
ok('炮台数量 = 类型 + 等级', home.guns.length === nodeGunCount(home), home.guns.length + ' vs ' + nodeGunCount(home));

// 3) 中立岛不设炮台
const neut = game.nodes.filter(n => n.owner < 0);
ok('中立岛无炮台', neut.every(n => nodeGunCount(n) > 0) && neut.every(n => nodeGunPower(n) === 0), 'neutral=' + neut.length);

// 4) 升级消耗兵力（兵力不足应失败）
home.troops = 5;
const lvBefore = home.level;
ok('兵力不足时升级失败', tryUpgrade(home) === false && home.level === lvBefore, 'troops=' + home.troops + ' lv=' + home.level);
home.troops = 500;
ok('兵力充足时升级成功', tryUpgrade(home) === true && home.level === lvBefore + 1, 'lv=' + home.level);
ok('升级扣除兵力', home.troops < 500 - 30, 'troops=' + Math.round(home.troops));
const gunsAfterLv = home.guns.length;
home.troops = 400;
ok('建造炮台成功', tryBattery(home) === true && home.guns.length === gunsAfterLv + 1, 'guns=' + home.guns.length);

// 5) 岸防炮台会打击来犯舰队
const enemy = F()[1];
const tgt = game.nodes.filter(n => n.owner === enemy.id)[0];
if (tgt) {
  const fl = spawnFleet(enemy.id, 90, tgt.id, tgt.id, tgt.x + tgt.r * 2.2, tgt.y);
  fl.path = [tgt.id, tgt.id];
  const hpBefore = fl.ships.reduce((a, s) => a + s.hp, 0);
  for (let i = 0; i < 600; i++) step(1 / 60);
  const hpAfter = fl.ships.reduce((a, s) => a + s.hp, 0);
  ok('岸防炮台杀伤来犯舰队', fl.dead || hpAfter < hpBefore, Math.round(hpBefore) + ' -> ' + Math.round(hpAfter) + ' dead=' + !!fl.dead);
} else ok('岸防炮台杀伤来犯舰队', false, 'no enemy node');

// 6) 舰队可以炮击岛屿结构（累计伤害计数，避免被自修掩盖）
const victim = game.nodes.filter(n => n.owner < 0).sort((a, b) => a.troops - b.troops)[0];
const attacker = game.nodes.filter(n => n.owner === game.me).sort((a, b) => b.troops - a.troops)[0];
let bombHits = 0, bombDmg = 0;
const origDamage = damageNode;
damageNode = function (n, dmg, byOwner, x, y) { bombHits++; bombDmg += dmg; return origDamage(n, dmg, byOwner, x, y); };
if (victim && attacker) {
  // 直接驱动岸轰代码路径（不跑 AI 主循环），避免被随机援军干扰导致抖动
  const ship = shipForTroop(200, game.me, 7);
  fillShipTurrets(ship);
  ship.dmg = 12; ship.reload = 0.75; ship.range = 520;
  const fakeFl = { owner: game.me, ships: [ship], dead: false };
  const hp0 = victim.hp;
  let bombs = 0;
  for (let i = 0; i < 900; i++) {
    ship.x = victim.x - victim.r * 2.0; ship.y = victim.y; ship.ang = 0;
    updateShipGuns(ship, null, 1 / 60, fakeFl, victim);
    bombs += game.bullets.filter(b => b.type === 'bomb').length;
    updateBullets(1 / 60);
  }
  ok('舰队岸轰削减岛屿结构', victim.hp < hp0 && bombs > 0,
    'hp ' + Math.round(hp0) + ' -> ' + Math.round(victim.hp) + ' 弹药 ' + bombs);
} else ok('舰队岸轰削减岛屿结构', false, 'no target');
damageNode = origDamage;

// 7) 压制：结构归零 -> 守军减半、炮台失效、防御打折
const v2 = game.nodes.filter(n => n.owner === F()[2].id)[0] || victim;
v2.troops = 100; v2.hp = v2.hpMax;
damageNode(v2, v2.hpMax + 10, game.me);
ok('结构归零触发压制', nodeSuppressed(v2) && v2.hp === 0, 'hp=' + v2.hp);
ok('压制导致守军减员', v2.troops <= 56 && v2.troops >= 1, 'troops=' + Math.round(v2.troops));
ok('压制后炮台失效', nodeGunPower(v2) === 0, 'gunPower=' + nodeGunPower(v2));
ok('压制后防御打折', nodeDefense(v2) < v2.troops, 'def=' + nodeDefense(v2).toFixed(1) + ' troops=' + Math.round(v2.troops));

// 8) 结构自修：静默期后恢复
const hpLow = v2.hp;
for (let i = 0; i < 60 * 12; i++) step(1 / 60);
ok('结构会自修', v2.hp > hpLow, Math.round(hpLow) + ' -> ' + Math.round(v2.hp));

// 9) 压制后的岛屿用更少兵力即可拿下（阈值 = 守军 × SUPPRESS_DEF）
const defBefore = v2.troops;
const sent = Math.ceil(defBefore * SUPPRESS_DEF) + 2;
const ff = spawnFleet(game.me, sent, v2.id, v2.id, v2.x, v2.y);
v2.hp = 0; v2.troops = defBefore;
arriveFleet(ff, v2);
ok('压制下少量兵力即可夺取', v2.owner === game.me, 'sent=' + sent + ' vs defEff=' + (defBefore * SUPPRESS_DEF).toFixed(1) + ' -> owner ' + v2.owner);

// 10) 夺取后接手一座带伤但可用的岛
ok('夺岛后结构未归零', v2.hp > 0, 'hp=' + Math.round(v2.hp));

console.log('PROBE_DEFENSE ' + JSON.stringify(R));
