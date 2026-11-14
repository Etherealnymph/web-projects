# 地理数据来源与使用边界

## Natural Earth 陆地轮廓

- 项目：[Natural Earth](https://www.naturalearthdata.com/)
- 数据集：`ne_110m_land`，1:110 million 的全球陆地轮廓。
- 获取日期：2026-11-04。
- 数据来源：[Natural Earth vector / ne_110m_land.geojson](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson)。
- 原始数据地址：<https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson>。
- 使用许可：[Natural Earth Terms of Use](https://www.naturalearthdata.com/about/terms-of-use/)。Natural Earth 数据属于公共领域。

本项目读取 Polygon 的外环，保留 127 个环、5,091 个坐标点，将经纬度四舍五入至小数点后四位，嵌入 `js/geography.js`。轮廓随页面离线运行，不依赖在线地图服务或 API Key。将高纬度图形用于平面展示会出现投影形变；原始数据比例尺决定了小岛、狭窄海湾和海岸细节的精度上限。

## 游戏地形与城市

北京、Washington、Tokyo 的地理中心使用近似经纬坐标作导航参考。城市与大陆的高程、道路、建筑、机场、铁路、港口和玩法设施由本项目程序生成，不属于上述真实地理数据集，也不是城市测绘成果。

城市采用局部等距圆柱坐标，并按中心纬度调整经度缩放。每个城市的可探索范围为 32,768 m × 32,768 m。大陆模式采用赤道为基准的等距圆柱坐标，地球平均半径参数为 6,371,008.8 m；坐标是投影米，高纬度东西向距离有形变。建筑模型与高程均未校准为现实世界的精确比例。

## 后续接入真实数据

若以后接入真实高程或建筑，应采用具有合法使用许可的分块数据，给每个区块标明地理范围、坐标参考系、分辨率、来源和版本，并保留现有按需加载与卸载机制。不要将整份全球建筑库转换为常驻方块数组。当前导出的世界文件包含地形配置和用户方块；要在其他电脑完整重现大陆轮廓，需要同时使用这一版本的 `geography.js`。
