function experiment(id, name, description, entry, netlist, config, expected, libraries = []) {
  return { id, name, description, entry, files: [{ name: entry, content: netlist.trim() + '\n' }, ...libraries], config, expected };
}

const rcLibrary = {
  name: 'cells/rc.lib',
  content: `* First-order passive filter cell
* Ports: input, output, reference
.subckt RC_CELL in out ref
R1 in out 1k
C1 out ref 100n
.ends RC_CELL
`,
};

export const experiments = [
  experiment('rc-step', 'RC 阶跃响应', '沿信号源、滤波单元和负载追踪充放电过程。可在图层中进入 RC_CELL。', 'rc-step.cir', `
* RC step response | 1 kOhm / 100 nF
.include "cells/rc.lib"

* 0 to 3.3 V, 1 kHz excitation
Vdrive in 0 DC 0 AC 1 PULSE(0 3.3 100u 200n 200n 500u 1m)
Xfilter in out 0 RC_CELL

* Zero-volt probe measures load current from out to load
Vsense out load 0
Rload load 0 100k
.tran 1u 3m
.end`, { type: 'tran', step: '1u', stop: '3m', maxStep: '2u' },
    '高电平持续足够长时，输出趋近 3.267 V。接入 100 kΩ 负载后，时间常数约 99.0 µs。', [rcLibrary]),
  experiment('divider', '电阻分压与电流', '比较分压节点电压和串联支路的电流方向。', 'divider.cir', `
* Loaded resistor divider | DC operating point
Vcc supply 0 5
Rtop supply out 1k
Vsense out tap 0
Rbottom tap 0 2k
.op
.end`, { type: 'op' }, 'V(out) = 3.3333 V，I(Vsense) = +1.6667 mA，I(Vcc) = −1.6667 mA。'),
  experiment('rc-bode', '一阶低通频响', '测量 −3 dB 截止点和输出相位。输入交流幅值为 1 V。', 'rc-bode.cir', `
* RC low-pass | small-signal AC sweep
Vdrive in 0 DC 0 AC 1
R1 in out 1k
C1 out 0 100n
.ac dec 40 10 1Meg
.end`, { type: 'ac', scale: 'dec', points: 40, start: '10', end: '1Meg' },
    '截止频率 1.592 kHz，输出幅值约 0.7071 V，相位约 −45°。'),
  experiment('rlc', '串联 RLC 谐振', '查看电阻两端的带通响应，比较谐振峰与理论值。', 'rlc.cir', `
* Series RLC | voltage across damping resistance
Vdrive in 0 DC 0 AC 1
L1 in mid 10m
C1 mid out 100n
R1 out 0 100
.ac dec 80 100 100k
.end`, { type: 'ac', scale: 'dec', points: 80, start: '100', end: '100k' },
    '理想谐振频率约 5.033 kHz。谐振时 V(out) 幅值接近 1 V。'),
  experiment('diode-dc', '二极管 I–V 扫描', '用串联限流电阻与零伏电流探针观察正向导通。', 'diode-dc.cir', `
* Silicon diode | source-voltage sweep
Vbias supply 0 0
Rlim supply anode 100
D1 anode probe DLAB
Vsense probe 0 0
.model DLAB D(IS=1e-12 N=1)
.dc Vbias 0 1 0.005
.end`, { type: 'dc', source: 'Vbias', start: '0', end: '1', step: '0.005' },
    '扫描终点满足 I(Vsense) = [1 V − V(anode)] / 100 Ω，可用同一扫描点的读数核对。'),
  experiment('tone', '双音频谱', '在 1 kHz 基波与三次谐波之间用峰值标记核对幅值比。', 'dual-tone.cir', `
* Two-tone source | 1 kHz + 3 kHz
Bgen out 0 V=sin(6283.185307179586*time)+0.25*sin(18849.55592153876*time)
Vsense out load 0
Rload load 0 1k
.tran 1.953125u 8m 0 1.953125u
.end`, { type: 'tran', step: '1.953125u', stop: '8m', maxStep: '1.953125u' },
    '两条谱线在 1 kHz 和 3 kHz，分别约 0.7071 和 0.1768 Vrms，幅值相差 12.04 dB。'),
  experiment('bridge', '惠斯通电桥', '将电压表两端接到 left 与 right，观察桥臂失配产生的差分电压。', 'bridge.cir', `
* Unbalanced Wheatstone bridge
Vcc supply 0 5
R1 supply left 1k
R2 left 0 1k
R3 supply right 1k
R4 right 0 1.1k
.op
.end`, { type: 'op' }, 'V(left) = 2.5 V，V(right) ≈ 2.61905 V，差分电压约 −119.05 mV。'),
  experiment('mos-corners', '工艺角与栅极偏置', '在工艺库面板中切换两组教学 MOS 模型，并改变栅极偏置。', 'bias.cir', `
* MOS bias | illustrative level-1 process corners
.lib "models/teaching.lib" tt
.param VGATE=1
Vgate gate 0 {VGATE}
Vdrain drain 0 0.1
M1 drain gate 0 0 LAB_N W=10u L=1u
.op
.end`, { type: 'op' }, 'VGATE=1 V 时，TT 和 SS 教学角的漏极电流分别约为 45 µA 和 24.5 µA。', [
    {name:'models/teaching.lib', content:`* Educational model parameters
.lib tt
.model LAB_N NMOS (LEVEL=1 VTO=0.5 KP=100u)
.endl tt
.lib ss
.model LAB_N NMOS (LEVEL=1 VTO=0.6 KP=70u)
.endl ss
`},
  ]),
];
