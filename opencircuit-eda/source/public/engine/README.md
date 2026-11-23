# OpenCircuit 浏览器求解器

`ngspice.mjs` 与同仓库 `circuit-lab/vendor/ngspice.mjs` 字节一致。原始包为 `@o.z/ngspice-wasm@0.0.0`（ngspice 46）。构建来源、打包修订和许可证见 [原始封装](https://github.com/Etherealnymph/web-projects/tree/54f201e5933fd3419a71cb55617ac6403856083b/circuit-lab/vendor)、[WASM 许可证](WASM-LICENSE.txt)和 [ngspice 许可证](NGSPICE-COPYING.txt)。

`sky130/sky130_fd_pr__ind_03_90.model.spice` 为 SkyWater 原始四端螺旋电感子电路。引脚顺序为 a、b、中心抽头 ct、衬底 sub。获取自 [SkyWater 固定版本](https://github.com/google/skywater-pdk-libs-sky130_fd_pr/blob/f62031a1be9aefe902d6d54cddd6f59b57627436/cells/ind_03/sky130_fd_pr__ind_03_90.model.spice)，保留原文和 [Apache-2.0 许可证](sky130/LICENSE)。将该模型和 `sky130/tank.cir` 放入同一工程目录，运行入口中的 AC 分析即可观察并联谐振峰。测试激励为 1 A 小信号电流，端口电压数值对应端口阻抗（Ω）。

`sky130/mos-transfer.cir` 采用同一发布版本的 [1.8 V NMOS](https://github.com/google/skywater-pdk-libs-sky130_fd_pr/tree/f62031a1be9aefe902d6d54cddd6f59b57627436/cells/nfet_01v8)。入口引用原始 `__mismatch.corner.spice`、`__tt.corner.spice`，后者再引用 `__tt.pm3.spice`，三份模型文件都保留上游参数和版权声明。在 W = L = 1 µm、VDS = 50 mV、VGS = 1.8 V、27 °C、TT 条件下，仿真端点为 −I(VD) ≈ 12.0773 µA。
