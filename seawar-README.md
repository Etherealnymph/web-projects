# 怒海争锋（SEAWAR）

## 项目定位

纯前端单文件 Canvas 即时策略海战，不需要安装依赖或启动后端。当前海图包含 48 座岛屿，游戏目标是控制至少 65% 的海域，或者消灭所有敌对势力。

入口：[seawar.html](./seawar.html)

## 玩法

### 核心循环

1. 港口、渔场、要塞和灯塔会持续产出兵力；
2. 拖拽己方岛屿到目标岛屿派遣舰队；
3. 通过舰炮削弱敌岛结构，打到 0 会进入“压制”状态；
4. 在压制期间登陆，可用更少的兵力夺岛；
5. 占领更多岛屿、升级等级、建造岸防炮台，抵挡敌人的周期性突袭。

### 新增战役系统

- **战术技能**：点击“战术 T”或按 `T`，全体己方岛屿获得紧急征募兵力并修复 12% 结构；冷却 48 秒。
- **海域事件**：大约每 58～80 秒随机触发。
  - 潮汐补给：随机己方岛屿获得额外兵力；
  - 顺风潮：己方结构获得修复；
  - 海盗伏击：敌军从现有领地抽调舰队袭击己方岛屿。
- **战役星章**：胜利后按波次表现获得 1～3 星；胜场、星章和成就通过浏览器本地存档累计。

## 操作

| 操作 | 作用 |
|---|---|
| 鼠标拖拽 / 手机拖动 | 从己方岛屿向目标派兵 |
| `U` | 升级当前选中岛屿 |
| `B` | 建造岸防炮台 |
| `T` | 使用紧急征募战术 |
| `F` / 空格 | 旗舰下海或归港 |
| `WASD` / 方向键 | 操控旗舰 |
| 鼠标左键 | 旗舰舰炮 |
| 鼠标右键 / 触屏轻点 | 旗舰鱼雷 |
| `P` | 暂停 |
| `H` | 显示玩法提示 |

## 本地运行

直接双击 HTML 文件即可。若浏览器限制本地文件能力，可在项目根目录启动静态服务器：

```powershell
cd D:\Project\html
python -m http.server 8123 --bind 127.0.0.1
```

然后打开 <http://127.0.0.1:8123/seawar.html>。

## GitHub Pages 联网多人

联网使用 Supabase Realtime，不需要给 GitHub Pages 配置服务器：

1. 在 Supabase 创建一个项目；
2. 在 Project Settings → API 复制 **Project URL** 和 **anon public key**；
3. 编辑 [seawar-config.js](./seawar-config.js)：

   ```js
   window.SEAWAR_SUPABASE_CONFIG = {
     url: 'https://你的项目.supabase.co',
     anonKey: '你的 anon public key'
   };
   ```

4. 把 `seawar.html`、`seawar-config.js` 和相关页面推送到 GitHub Pages；
5. 房主点击“创建房间”，其他玩家填写相同房间号后点击“加入房间”。

游戏使用 Realtime Broadcast，不依赖数据库表。房主负责权威模拟并广播快照，其他玩家发送派兵、升级、建炮台和战术指令。房主关闭页面后房间结束；建议每个房间不超过 4 名玩家。`anon public key` 可以放在前端，**不要**放入 `service_role key`。

## 自动化测试

项目自带无头 Canvas/DOM 打桩测试器：

```powershell
node .\_seawar_test\harness.js .\seawar.html "autotest=1&steps=9000&seed=12345&diff=1"
node .\_seawar_test\harness.js .\seawar.html "autotest=1&steps=1800&seed=4242&diff=1" .\_seawar_test\probe_defense.js
```

测试会检查地图连通性、数值稳定性、战斗、炮击、压制、炮台和渲染冒烟结果。

## 存档说明

存档键名为 `seawar-profile-v1`，只保存胜场、星章和已解锁成就，不保存正在进行的战局。清空该键即可重置战役档案。
