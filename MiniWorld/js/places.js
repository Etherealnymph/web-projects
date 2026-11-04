/* Hand-authored destinations sit inside procedural regions. Every discovery is
 * a reachable place with a short description, saved once per world. */
(function () {
  'use strict';
  const MW = window.MW;
  function mark(builder, result, id, name, x, z, y, text) {
    result.discoveries = result.discoveries || [];
    result.discoveries.push({ id, name, x, z, y, r: 9, text });
    result.destinations = result.destinations || [];
    result.destinations.push({ name, x, z, description: text });
    result.labels = result.labels || [];
    result.labels.push({ text: name, x, y: y + 7, z, color: 0xc0e5ce, width: 11 });
  }
  function bench(builder, x, z, y, c = 0x9b7754) {
    builder.fill(x - 2, y, z, x + 2, y, z, c, { jitter: 0 });
    builder.fill(x - 2, y + 1, z - 1, x + 2, y + 1, z - 1, c, { jitter: 0 });
  }
  function promenade(builder, x, z, y, length, accent) {
    builder.fill(x - 4, y - 1, z - length, x + 4, y - 1, z + length, 0xb5b8ab, { jitter: 0.015 });
    for (let dz = -length + 8; dz <= length - 8; dz += 16)
      for (const side of [-1, 1]) {
        builder.lamp(x + side * 7, z + dz, y, accent, 4);
        if (dz % 32 === 0) bench(builder, x + side * 13, z + dz, y);
      }
  }
  function market(builder, result, kind, x, z, y) {
    const colors =
      kind === 'tokyo' ? [0x628b99, 0xe998a0, 0x689a9a] : [0xad664d, 0xc59b55, 0x829267];
    builder.fill(x - 38, y - 1, z - 45, x + 38, y - 1, z + 45, 0xc1b7a0, { jitter: 0.02 });
    promenade(builder, x, z, y, 48, 0xffd894);
    for (let i = 0; i < 3; i++)
      for (const side of [-1, 1]) {
        const shopX = x + side * 23,
          shopZ = z - 28 + i * 27;
        builder.gableHouse(
          shopX,
          shopZ,
          14,
          12,
          y - 1,
          4,
          kind === 'tokyo' ? 0xa4b0ae : 0xbdad8c,
          colors[i],
        );
        builder.fill(shopX - 7, y + 3, shopZ + 8, shopX + 7, y + 3, shopZ + 11, colors[i], {
          jitter: 0.01,
        });
        for (const dx of [-4, 3]) {
          builder.fill(shopX + dx, y, shopZ + 8, shopX + dx + 2, y, shopZ + 9, 0x91704f, {
            jitter: 0.01,
          });
          builder.set(shopX + dx + 1, y + 1, shopZ + 8, i % 2 ? 0xddb355 : 0x829f61);
        }
        // Leave the doorway axis open; side benches and stock make interiors useful cover.
        bench(builder, shopX - 3, shopZ - 3, y);
        builder.set(shopX + 4, y, shopZ - 3, 0x897b61);
      }
    builder.lanternString(x - 16, z - 42, x + 16, z - 42, y + 6);
    result.pickups.push(
      { item: 'medkit', x: x - 23, z: z + 27, y: y + 0.8 },
      { item: 'ammo_light', x: x + 23, z: z - 27, y: y + 0.8 },
    );
    mark(
      builder,
      result,
      kind + '-market',
      kind === 'tokyo' ? '灯笼商店街' : '胡同百味市集',
      x,
      z + 36,
      y,
      '沿灯笼步道进入六间小店，寻找店后的补给，再走向城市公园。',
    );
  }
  function garden(builder, result, id, name, x, z, y, style) {
    builder.fill(x - 39, y - 1, z - 32, x + 39, y - 1, z + 32, 0x82966b, { jitter: 0.02 });
    builder.fill(x - 3, y - 1, z - 34, x + 3, y - 1, z + 34, 0xd0c3a7, { jitter: 0 });
    builder.fill(x - 38, y - 1, z - 2, x + 38, y - 1, z + 2, 0xd0c3a7, { jitter: 0 });
    // Sunken reflecting pools stay decorative and leave a broad cross-shaped route.
    for (const side of [-1, 1]) {
      builder.fill(x + side * 19 - 9, y - 1, z - 18, x + side * 19 + 9, y - 1, z - 7, 0x6b9fa5, {
        jitter: 0.025,
      });
      for (const dz of [-25, 24]) {
        if (style === 'sakura') builder.sakura(x + side * 27, z + dz, 5, y);
        else builder.tree(x + side * 27, z + dz, 6, style === 'civic' ? 0x81a86b : 0x637c55, { y });
      }
      bench(builder, x + side * 19, z + 10, y);
    }
    builder.pavilion(x, z - 24, y - 1, 12, { roof: style === 'sakura' ? 0x778b82 : 0x968265 });
    mark(
      builder,
      result,
      id,
      name,
      x,
      z + 20,
      y,
      '十字步道连接树荫座椅、镜池和开放亭台；在园中记录本地风景。',
    );
  }
  function civic(builder, result, x, z, y) {
    builder.fill(x - 40, y - 1, z - 37, x + 40, y - 1, z + 37, 0xc4c8bb, { jitter: 0.01 });
    // Open-air sculpture rooms and exhibition walls: routes, sightlines and cover.
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const shopX = x + side * 24,
          shopZ = z - 23 + i * 23;
        builder.fill(shopX - 6, y, shopZ - 5, shopX + 6, y + 3, shopZ - 5, 0x9aaeb1, {
          jitter: 0.01,
        });
        builder.fill(
          shopX - 5,
          y + 1,
          shopZ - 4,
          shopX - 1,
          y + 2,
          shopZ - 4,
          [0xbb8a67, 0x6a9f93, 0x9e83aa][i],
          {
            jitter: 0,
          },
        );
        builder.fill(shopX + 3, y, shopZ - 1, shopX + 5, y + 2 + i, shopZ + 1, 0xd6d5c6, {
          jitter: 0.01,
        });
        bench(builder, shopX, shopZ + 5, y);
      }
    builder.modern(x, z - 57, 28, 20, y - 1, 12, {
      rooms: false,
      desk: false,
      wall: 0xd5d9cf,
      name: '公共展览馆',
    });
    result.pickups.push({ item: 'armor', x: x + 22, z: z + 23, y: y + 0.8 });
    mark(
      builder,
      result,
      'washington-gallery',
      '开放雕塑广场',
      x,
      z + 19,
      y,
      '穿过六组户外展台，进入展览馆；楼梯与观景电梯通往屋顶。',
    );
  }
  function city(builder, meta, result) {
    const y = 3;
    if (meta.id === 'beijing') {
      market(builder, result, 'beijing', 100, 320, y);
      garden(builder, result, 'beijing-garden', '书院镜池花园', -100, 320, y, 'courtyard');
      builder.modern(350, -72, 36, 28, 2, 16, {
        rooms: false,
        desk: false,
        wall: 0xacb6ac,
        name: '运河探索馆',
      });
      promenade(builder, 350, 10, y, 52, 0xf0d898);
      builder.pavilion(350, 70, 2, 16, { roof: 0xb8a06f });
      mark(
        builder,
        result,
        'beijing-canal',
        '运河探索馆',
        350,
        -48,
        y,
        '登上屋顶眺望环城道路，沿灯带步道到南侧开放亭台。',
      );
    } else if (meta.id === 'washington') {
      civic(builder, result, 300, 80, y);
      garden(builder, result, 'washington-garden', '纪念花园', 65, 310, y, 'civic');
      // A low outdoor forum with open entrances between seating blocks.
      builder.fill(-150, 2, 275, -55, 2, 345, 0xb0baad, { jitter: 0.02 });
      for (let row = 0; row < 4; row++)
        for (const side of [-1, 1]) bench(builder, -102 + side * 25, 288 + row * 12, y, 0xc7c2b1);
      builder.fill(-112, 3, 275, -92, 3, 282, 0xa2b0a6, { jitter: 0 });
      mark(
        builder,
        result,
        'washington-forum',
        '城市公共论坛',
        -102,
        320,
        y,
        '中央通道连接露天讲台与休息看台，适合步行探索或小队集合。',
      );
    } else if (meta.id === 'tokyo') {
      market(builder, result, 'tokyo', 320, 90, y);
      garden(builder, result, 'tokyo-shrine', '樱庭步行园', -85, 320, y, 'sakura');
      // A usable fish market and harbor promenade beside the existing pier.
      for (const dz of [-1, 1])
        for (let i = 0; i < 3; i++) {
          const shopX = 950 + i * 19,
            shopZ = dz * 15;
          builder.fill(shopX - 6, 2, shopZ - 5, shopX + 6, 2, shopZ + 5, 0xa6aea3, { jitter: 0 });
          builder.fill(shopX - 5, 3, shopZ, shopX + 5, 3, shopZ, 0x8a7d66, { jitter: 0 });
          builder.fill(shopX - 6, 6, shopZ - 5, shopX + 6, 6, shopZ + 5, 0x6b969d, { jitter: 0 });
          for (const dx of [-6, 6])
            builder.fill(shopX + dx, 3, shopZ - 5, shopX + dx, 5, shopZ - 5, 0x617b80, {
              jitter: 0,
            });
        }
      for (let shopX = 930; shopX <= 1025; shopX += 18) builder.lamp(shopX, 7, 3, 0x9aeee7, 4);
      mark(
        builder,
        result,
        'tokyo-harbor',
        '海港鱼市与栈桥',
        1009,
        0,
        y,
        '在开放鱼市补给，走向栈桥尽端；巡逻艇停在东南侧海面。',
      );
      result.pickups.push({ item: 'medkit', x: 989, z: 15, y: 4 });
    }
    // Cross-region activities are geographically separated, with a clear road.
    for (const d of result.discoveries || []) {
      if (Math.abs(d.x) < 450 && Math.abs(d.z) < 450) {
        if (Math.abs(d.z) > 250) builder.road(d.x - 3, 175, d.x + 3, d.z, 0xa8b1a4, 2);
        else builder.road(170, d.z - 3, d.x, d.z + 3, 0xa8b1a4, 2);
      }
    }
    const lift = builder.elevators.find((e) => e.floors >= 5);
    if (lift) {
      const q = { x: lift.spawnX, z: lift.spawnZ, y: lift.y + 1 + (lift.floors - 1) * 4 };
      mark(
        builder,
        result,
        meta.id + '-roof',
        '城市屋顶观景台',
        q.x,
        q.z,
        q.y,
        '乘坐观景电梯或沿折返楼梯登顶，俯瞰城市与远处地形。',
      );
    }
    return result;
  }
  function camp(builder, result, d, index) {
    d.x = Math.round(d.x);
    d.z = Math.round(d.z);
    const x = d.x,
      z = d.z;
    const y = Math.ceil(
      Math.max(
        ...[
          [-44, -44],
          [44, -44],
          [-44, 44],
          [44, 44],
          [0, 0],
        ].map(([a, c]) => builder.w.terrainGroundAt(x + a, z + c)),
      ),
    );
    const palette = [
        0x9e5545, 0xc3c6b3, 0x74979a, 0x9d9479, 0xbb975b, 0x77996c, 0xb6946d, 0xb7d3dc,
      ],
      accent = palette[index % palette.length];
    builder.fill(x - 43, y - 1, z - 42, x + 43, y - 1, z + 42, 0x9da89c, { jitter: 0.01 });
    builder.fill(x - 5, y - 1, z - 40, x + 5, y - 1, z + 43, 0xc7c6b0, { jitter: 0 });
    builder.modern(x - 24, z - 14, 16, 16, y - 1, 8, {
      wall: 0xb8bcb0,
      roof: accent,
      rooms: false,
      desk: false,
      name: '大陆考察站',
    });
    builder.gableHouse(x + 24, z - 18, 18, 16, y - 1, 5, 0xc2bda8, accent);
    // Mapping table, sample racks and four compass pylons form an actual camp.
    builder.fill(x + 18, y, z - 17, x + 23, y, z - 14, 0x789aa0, { jitter: 0 });
    for (let i = 0; i < 4; i++) {
      builder.fill(x + 30, y, z - 23 + i * 3, x + 32, y + 1, z - 22 + i * 3, accent, { jitter: 0 });
      builder.lamp(x - 36 + i * 24, z + 33, y, 0xb3e8d4, 5);
    }
    for (const side of [-1, 1]) bench(builder, x + side * 22, z + 16, y);
    builder.pavilion(x, z - 28, y - 1, 12, { roof: accent });
    result.pickups.push(
      { item: 'medkit', x: x + 25, z: z - 13, y: y + 0.8 },
      { item: 'ammo_light', x: x - 23, z: z - 12, y: y + 0.8 },
    );
    d.z = z + 23; // Arrival is the open forecourt, never inside a roof or display.
    mark(
      builder,
      result,
      d.id + '-camp',
      d.name + ' · 考察站',
      x,
      z + 8,
      y,
      '步行进入考察站和标本室，沿指南灯柱寻找附近的野外观测点。',
    );
    const ox = x + 84,
      oz = z + 80,
      oy = Math.ceil(builder.w.terrainGroundAt(ox, oz));
    builder.fill(ox - 9, oy - 1, oz - 9, ox + 9, oy - 1, oz + 9, 0xa5aa99, { jitter: 0.01 });
    builder.pavilion(ox, oz - 3, oy - 1, 10, { roof: accent });
    builder.lamp(ox + 8, oz + 6, oy, 0xf1d695, 6);
    mark(
      builder,
      result,
      d.id + '-field',
      d.name + ' · 野外观测点',
      ox,
      oz + 5,
      oy,
      '这里的海岸轮廓来自低分辨率地理数据；高程、植被和考察设施为程序化演绎。',
    );
    result.expeditions = result.expeditions || [];
    result.expeditions.push({ id: d.id, x, z, y, accent });
    return y;
  }
  class FieldJournal {
    constructor(game) {
      this.game = game;
      this.visited = new Set();
      this.timer = 0;
    }
    update(dt) {
      this.timer -= dt;
      if (this.timer > 0) return;
      this.timer = 0.4;
      const g = this.game,
        player = g.player;
      if (!player?.alive || g.inVehicle || player.elevatorRide) return;
      for (const place of (g.world.meta.discoveries || []).slice(0, 96)) {
        if (this.visited.has(place.id) || ![place.x, place.y, place.z].every(Number.isFinite))
          continue;
        if (
          Math.hypot(player.pos.x - place.x, player.pos.z - place.z) > (place.r || 9) ||
          Math.abs(player.pos.y - place.y) > 2
        )
          continue;
        this.visited.add(place.id);
        player.coins += 15;
        g.ui.toast('发现 ' + place.name + ' · 探索奖励 +15', 'good');
        g.saveLater();
        g.ui.renderDestinations();
        break;
      }
    }
  }
  MW.WorldPlaces = { city, camp };
  MW.FieldJournal = FieldJournal;
})();
