/* 08 · 基础练习 · 金半接触 + MIS */
(function(){
const A = window.__DATA__ = window.__DATA__ || [];
const P = () => (window.__PID = (window.__PID||0)+1);

/* ---------- 第 6 章 金半接触 ---------- */
const S1 = '13 · 基础练习 · 金属—半导体接触';

A.push({
pid:P(), sec:13, secTitle:S1,
label:'第6章 · 判断', title:'肖特基接触与欧姆接触（判断 1–12）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>判断</th><th>理由／关联知识点</th></tr></thead>
<tbody>
<tr><td class="n">1</td><td>肖特基接触具有单向导电性，正偏导通、反偏截止</td><td class="ansv ok">√</td><td class="kpc">整流特性：$J=J_0(e^{qV/k_0T}-1)$</td></tr>
<tr><td class="n">2</td><td>欧姆接触具有单向导电性，正偏导通、反偏截止</td><td class="ansv no">×</td><td class="kpc">欧姆接触是双向导通、线性 I–V</td></tr>
<tr><td class="n">3</td><td>肖特基接触具有双向导电性，表现为电阻的导电特性</td><td class="ansv no">×</td><td class="kpc">同上，肖特基是整流接触</td></tr>
<tr><td class="n">4</td><td>欧姆接触具有双向导电性，表现为电阻的导电特性</td><td class="ansv ok">√</td><td class="kpc">欧姆接触的定义</td></tr>
<tr class="imp"><td class="n">5</td><td>只有反阻挡层才能形成欧姆接触</td><td class="ansv no">×</td><td class="kpc">另一条路：<b>重掺杂使势垒极薄，靠隧穿导电</b>（工程主用）</td></tr>
<tr class="imp"><td class="n">6</td><td>对肖特基接触施加偏压时，金属一侧电子的势垒高度与零偏时相等</td><td class="ansv ok">√</td><td class="kpc">$q\varphi_B=q(\varphi_m-\chi)$ 不随偏压变（理想模型）</td></tr>
<tr><td class="n">7</td><td>对肖特基接触加正向偏压，金属一侧电子的势垒高度比零偏时低</td><td class="ansv no">×</td><td class="kpc">金属侧势垒与偏压无关</td></tr>
<tr><td class="n">8</td><td>对肖特基接触加正向偏压，金属一侧电子的势垒高度比零偏时高</td><td class="ansv no">×</td><td class="kpc">同上</td></tr>
<tr class="imp"><td class="n">9</td><td>对肖特基接触加正向偏压，半导体一侧电子的势垒高度比零偏时高</td><td class="ansv no">×</td><td class="kpc">正偏使半导体侧势垒<b>降低</b>（$V_{bi}-V$）</td></tr>
<tr><td class="n">10</td><td>对肖特基接触加正向偏压，半导体一侧电子的势垒高度比零偏时低</td><td class="ansv ok">√</td><td class="kpc">同上</td></tr>
<tr class="imp"><td class="n">11</td><td>半导体表面存在高密度表面态时，金属—半导体接触的肖特基势垒高度与半导体掺杂浓度有关</td><td class="ansv no">×</td><td class="kpc">高密度表面态 → $E_F$ 钉扎 → $\varphi_B$ 与金属功函数、掺杂<b>几乎无关</b></td></tr>
<tr><td class="n">12</td><td>半导体表面存在高密度表面态时，金属—半导体接触的肖特基势垒高度与半导体掺杂浓度无关</td><td class="ansv ok">√</td><td class="kpc">同上（费米钉扎效应）</td></tr>
</tbody></table>`,
answer:'',
solution:'',
kp: ['整流接触与欧姆接触',String.raw`$\varphi_B$ 不随偏压变化`,'$V_{bi}$ 随偏压变化','欧姆接触的两条途径','表面态与费米钉扎'],
comment:String.raw`12 题里错 6 个，全都绕着<b>「金属侧势垒不变、半导体侧势垒随偏压变」</b>这句话转。第 5 题尤其重要：<b>"只有反阻挡层才能形成欧姆接触"是错的</b>——工程上更常用的是重掺杂隧穿（金半接触的欧姆接触几乎都是这么做的），这是理论与工艺的差别。第 11、12 题考的是「高密度表面态把 $E_F$ 钉在 $q\varphi_0$ 附近，$\varphi_B$ 就与金属功函数和掺杂都无关了」，这一条在作业五里没用上，但概念题常考。`
});

A.push({
pid:P(), sec:13, secTitle:S1,
label:'第6章 · 选择一', title:'功函数、阻挡层与肖特基器件（选择 1–6）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>关于半导体的功函数 $W_s$，下面说法正确的是（ ）<br>A. $E_0-E_c$　B. $E_0-E_F$　C. $E_0-E_v$　D. $E_c-E_F$　E. 与掺杂浓度无关　F. 与掺杂浓度有关</td><td class="ansv">B、F</td><td class="kpc">$W_s=\chi+(E_c-E_F)$，而 $E_c-E_F$ 随掺杂变 → 与掺杂有关</td></tr>
<tr class="imp"><td class="n">2</td><td>下列材料中，室温时功函数最大的是（ ）<br>A. 含硼 $1\times10^{15}\ \mathrm{cm^{-3}}$ 的硅　B. 含磷 $1\times10^{16}\ \mathrm{cm^{-3}}$ 的硅　C. 含硼 $1\times10^{15}$、含磷 $1\times10^{16}$ 的硅　D. 纯净的硅</td><td class="ansv">A</td><td class="kpc">p 型 $E_F$ 最低 → $E_c-E_F$ 最大 → $W_s$ 最大</td></tr>
<tr class="imp"><td class="n">3</td><td>金属与 N 型半导体形成阻挡层，成立的是（ ）<br>A. $W_m>W_s$　B. $W_m&lt;W_s$　C. 表面能带向上弯曲　D. 表面能带向下弯曲</td><td class="ansv">A、C</td><td class="kpc">n 型阻挡层：$W_m>W_s$，电子流向金属，能带向上弯（形成电子势垒）</td></tr>
<tr class="imp"><td class="n">4</td><td>金属与 P 型半导体形成反阻挡层，功函数满足（ ），表面能带（ ）弯曲<br>A. $W_m>W_s$　B. $W_m&lt;W_s$　C. $W_m=W_s$　D. 向上　E. 向下</td><td class="ansv">A、D</td><td class="kpc">p 型：$W_m&lt;W_s$ → 阻挡层；$W_m>W_s$ → 反阻挡层（欧姆），能带向上弯、空穴积累</td></tr>
<tr class="imp"><td class="n">5</td><td>N 型半导体制成的肖特基势垒二极管是一种（ ）载流子器件，其正向电流是（ ）<br>A. 多数　B. 少数　C. 多子流向金属形成，电流方向从金属指向半导体　D. 多子流向金属形成，电流方向从半导体指向金属</td><td class="ansv">A、C</td><td class="kpc">单极器件；正偏时半导体多子（电子）越过势垒进入金属，<b>电流方向由金属指向半导体</b>（电子流反向）</td></tr>
<tr class="imp"><td class="n">6</td><td>Schottky 二极管是一种（ ）载流子器件，所以相对 PN 二极管而言，它的开启电压（ ），速度更（ ）<br>A. 单　B. 双　C. 更高　D. 更低　E. 更快　F. 更慢</td><td class="ansv">A、D、E</td><td class="kpc">单极、无少子存储 → 开启电压低、开关快</td></tr>
</tbody></table>`,
answer:'',
solution:String.raw`
<p class="lead"><b>第 5 题的方向为什么要小心</b></p>
<p>正偏（金属接正）时，半导体中电子越过势垒进入金属，<b>电子流方向为"半导体→金属"</b>；电流方向与电子流<b>相反</b>，故<b>电流由金属指向半导体</b>。选 C。</p>
<p>这也是「肖特基二极管正向电流方向与 PN 结相同（都是 P→N 或金属→半导体）」的体现，容易与"电子流方向"混。</p>
<p class="lead"><b>第 3、4 题的速记表</b></p>
<table class="qa">
<thead><tr><th>衬底</th><th>阻挡层（整流）</th><th>反阻挡层（欧姆）</th></tr></thead>
<tbody>
<tr><td>n 型</td><td>$W_m>W_s$，能带<b>向上</b>弯</td><td>$W_m&lt;W_s$，能带向下弯</td></tr>
<tr><td>p 型</td><td>$W_m&lt;W_s$，能带<b>向下</b>弯</td><td>$W_m>W_s$，能带向上弯</td></tr>
</tbody></table>
<p>记忆法：<b>阻挡层＝形成多数载流子的势垒</b>——n 型的多子是电子，要挡住它就得让能带向上弯（电子能量升高）；p 型的多子是空穴，要挡住它就得让能带向下弯。</p>`,
kp:['功函数的定义','功函数与掺杂','阻挡层/反阻挡层判据','能带弯曲方向','单极器件与电流方向','开启电压与速度'],
comment:String.raw`第 4 题最容易错：<b>p 型的"阻挡层"条件是 $W_m&lt;W_s$，与 n 型相反</b>。记忆法是"阻挡层要挡住多子"：p 型多子是空穴，$W_m&lt;W_s$ 时电子从金属流向半导体、表面空穴被耗尽 → 正是阻挡层。第 1 题要留意：功函数<b>与掺杂有关</b>（因为 $E_c-E_F$ 随掺杂变），而**金属的功函数**才是与掺杂无关的材料常数——这一对比几乎每年都考。`
});

A.push({
pid:P(), sec:13, secTitle:S1,
label:'第6章 · 选择二', title:'偏压下的势垒、镜像力、隧穿与表面态（选择 7–13）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr><td class="n">7</td><td>对于 n 型半导体构成的金—半阻挡层接触，施加正向电压时，随电压增加，阻挡层厚度将逐渐（ ）<br>A. 变宽　B. 变窄　C. 不变</td><td class="ansv">B</td><td class="kpc">$x_d\propto\sqrt{V_{bi}-V}$，正偏 $V>0$ → 变窄</td></tr>
<tr class="imp"><td class="n">8</td><td>金属和 N 型半导体接触形成肖特基势垒，若外加正向偏压，则半导体表面电子势垒高度将（ ），空间电荷区宽度将（ ），电流将（ ）<br>A. 不变　B. 增加　C. 减小</td><td class="ansv">C；C；B</td><td class="kpc">正偏：$q(V_{bi}-V)$ 减小、$x_d$ 变窄、电流指数上升</td></tr>
<tr class="imp"><td class="n">10</td><td>隧道效应使肖特基等效势垒高度（ ），在（ ）偏压下影响较为显著<br>A. 降低　B. 升高　C. 正向　D. 反向</td><td class="ansv">A；D</td><td class="kpc">反偏时势垒区电场强、势垒变薄 → 隧穿显著；等效势垒降低</td></tr>
<tr class="imp"><td class="n">11</td><td>镜像力使肖特基势垒高度（ ），在（ ）偏压下影响较为显著<br>A. 升高　B. 降低　C. 正向　D. 反向</td><td class="ansv">B；D</td><td class="kpc">$\Delta\varphi\propto\sqrt{E_{\max}}$，反偏时 $E_{\max}$ 大 → 降低更明显</td></tr>
<tr><td class="n">12</td><td>金属和 N 型半导体接触形成肖特基势垒，若外加反向偏压，则半导体表面电子势垒高度将（ ），空间电荷区宽度将（ ）<br>A. 不变　B. 增加　C. 减小</td><td class="ansv">B；B</td><td class="kpc">反偏：$V_{bi}+V_R$ 增大、$x_d$ 变宽</td></tr>
<tr class="imp"><td class="n">12′</td><td>关于施主型表面态，以下说法正确的是（ ）<br>A. 被电子占满时呈中性，失去电子带负电　B. 被电子占满时呈中性，失去电子带正电　C. 空时为电中性，接受电子带正电　D. 空时为电中性，接受电子带负电</td><td class="ansv">B</td><td class="kpc">施主型：中性时被电子占满，失去电子（电离）后带正电</td></tr>
<tr class="imp"><td class="n">13</td><td>关于受主型表面态，以下说法正确的是（ ）<br>A. 被电子占满时呈中性，失去电子带负电　B. 被电子占满时呈中性，失去电子带正电　C. 表面态空时为电中性，接受电子带正电　D. 表面态空时为电中性，接受电子带负电</td><td class="ansv">D</td><td class="kpc">受主型：中性时为空，接受电子后带负电</td></tr>
<tr class="imp"><td class="n">10′</td><td>关于半导体表面态中性能级 $q\varphi_0$，以下说法正确的是（ ）<br>A. 电子刚好填满 $q\varphi_0$ 以下的状态、$q\varphi_0$ 以上全空时，表面呈中性　B. 表面带负电　C. 表面带正电</td><td class="ansv">A</td><td class="kpc">中性能级 $q\varphi_0$ 的定义：被电子填满到此能级时表面电中性</td></tr>
<tr class="imp"><td class="n">11′</td><td>表面态中性能级位于费米能级以上时，该表面态为（ ）<br>A. 施主态　B. 受主态　C. 电中性　D. 界面态</td><td class="ansv">A</td><td class="kpc">$E_F$ 低于中性能级 → 中性能级以下已被填满 → 状态"已失电子"→ 带正电 → 施主型</td></tr>
</tbody></table>
<p style="font-size:.86em;color:var(--muted);margin:.3em 0 0">＊原卷有缺号与重号（9、10、11、12 各出现两次），此处按题意合并整理。</p>`,
answer:'',
solution:String.raw`
<p class="lead"><b>镜像力与隧道效应：为什么"反偏更显著"</b></p>
<ul>
<li><b>镜像力</b>：电子在金属表面感应出正电荷，使势垒最高点下降 $\Delta\varphi=\sqrt{\dfrac{qE_{\max}}{4\pi\varepsilon_s}}$。<b>$E_{\max}$ 在反偏时最大</b>（$x_d$ 最宽、势垒最陡），故反偏时降低最多。</li>
<li><b>隧道效应</b>：电子直接穿过势垒顶端。穿透概率随势垒宽度指数下降；<b>反偏时电场强、势垒薄</b>，隧穿显著。此外<b>重掺杂</b>也会使势垒极薄，这正是"重掺杂做欧姆接触"的物理基础。</li>
</ul>
<p class="lead"><b>表面态的两类</b></p>
<table class="qa">
<thead><tr><th>类型</th><th>中性时</th><th>带电时</th></tr></thead>
<tbody>
<tr><td>施主型</td><td>被电子占满（中性）</td><td>失去电子 → 带正电</td></tr>
<tr><td>受主型</td><td>空着（中性）</td><td>接受电子 → 带负电</td></tr>
</tbody></table>
<p>「中性能级 $q\varphi_0$」是两类状态的交界：<b>电子填满到 $q\varphi_0$ 时表面电中性</b>；$E_F$ 高于 $q\varphi_0$ → 表面带负电；低于 → 带正电。若 $E_F$ 被钉扎在中性能级附近（表面态密度很高时），$\varphi_B$ 就不再随金属功函数变化——这就是"费米钉扎"。</p>`,
kp: ['偏压对 $x_d$ 与势垒的影响','镜像力效应','隧道效应','施主型/受主型表面态',String.raw`中性能级 $q\varphi_0$`,'费米钉扎'],
comment:String.raw`这一组有两处"反偏更显著"的共同原因：<b>都是因为反偏时电场最强</b>。所以只要记住"反偏 → $E_{\max}$ 大"，镜像力与隧穿两题一起解决。表面态题则是<b>「中性↔带电」的对应关系</b>：施主型中性时是"满的"（所以才叫施主，能给出电子），受主型中性时是"空的"（所以才能接受电子）——抓住这一点就不会背反。`
});

A.push({
pid:P(), sec:13, secTitle:S1,
label:'第6章 · 填空', title:'整流理论、欧姆接触与爱因斯坦关系（填空 1–5）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>不考虑镜像力与隧道效应，热电子发射理论中反向饱和电流与（ ）相关，对（ ）敏感</td><td class="ansv">势垒高度 $\varphi_B$（$J_0=A^*T^2e^{-q\varphi_B/k_0T}$）；温度</td><td class="kpc">热电子发射：$J_0$ 只与 $\varphi_B$、$T$ 有关，<b>与偏压无关</b></td></tr>
<tr class="imp"><td class="n">2</td><td>不考虑镜像力与隧道效应，扩散理论中的反向饱和电流与（ ）相关</td><td class="ansv">势垒高度、掺杂浓度 $N_D$、迁移率 $\mu$（扩散长度）等</td><td class="kpc">扩散理论：$J_0\propto\dfrac{qD_nn_{s0}}{L_n}$，与 $N_D$、$\mu$、$x_d$ 有关</td></tr>
<tr class="imp"><td class="n">3</td><td>金属和半导体之间形成良好欧姆接触主要采用的办法是（ ），其原理是（ ）</td><td class="ansv">重掺杂（$N_D\gtrsim10^{19}\ \mathrm{cm^{-3}}$）／选 $W_m&lt;W_s$ 的反阻挡层；重掺杂使势垒极薄，电子<b>隧穿</b>通过，接触电阻很小</td><td class="kpc">欧姆接触的两条途径；隧道效应</td></tr>
<tr class="imp"><td class="n">4</td><td>对于肖特基势垒二极管整流特性，当势垒区宽度远大于电子的平均自由程时应用（ ）理论；反之应用（ ）理论</td><td class="ansv">扩散；热电子发射</td><td class="kpc">两种理论的适用条件</td></tr>
<tr class="imp"><td class="n">5</td><td>爱因斯坦关系式为（ ），试证明之</td><td class="ansv">$\dfrac{D}{\mu}=\dfrac{k_0T}{q}$</td><td class="kpc">爱因斯坦关系及推导</td></tr>
</tbody></table>`,
answer:'',
solution:String.raw`
<p class="lead"><b>填空 5：爱因斯坦关系的证明</b></p>
<p>考虑一块<b>热平衡</b>的非简并半导体，内部有非均匀掺杂（因而有内建电场 $E=-\dfrac{\mathrm d\varphi}{\mathrm dx}$）。热平衡时总电流为零：</p>
<p>$$J_n=qn\mu_nE+qD_n\frac{\mathrm dn}{\mathrm dx}=0\;\Longrightarrow\;D_n=-n\mu_n\frac{E}{\mathrm dn/\mathrm dx}$$</p>
<p>热平衡下电子浓度满足玻尔兹曼分布：</p>
<p>$$n(x)=N_ce^{-[E_c(x)-E_F]/k_0T},\qquad E_c(x)=E_{c0}-q\varphi(x)$$</p>
<p>故 $n(x)\propto e^{q\varphi(x)/k_0T}$，求导得</p>
<p>$$\frac{\mathrm dn}{\mathrm dx}=\frac{q}{k_0T}n\frac{\mathrm d\varphi}{\mathrm dx}=-\frac{q}{k_0T}nE$$</p>
<p>代回第一式：</p>
<p>$$D_n=-\frac{n\mu_nE}{-\dfrac{q}{k_0T}nE}=\frac{k_0T}{q}\mu_n\;\Longrightarrow\;\boxed{\frac{D_n}{\mu_n}=\frac{k_0T}{q}}$$</p>
<p>同理 $\dfrac{D_p}{\mu_p}=\dfrac{k_0T}{q}$。$\blacksquare$</p>
<p><b>说明</b>：推导用了"热平衡＋玻尔兹曼分布"，但结论只依赖"载流子的热运动能量是 $k_0T$"，所以在<b>非简并、小注入</b>的非平衡态下仍成立——这是所有器件方程都能用它的原因。</p>`,
kp:['热电子发射 vs 扩散理论','反向饱和电流的依赖关系','欧姆接触的实现','爱因斯坦关系的推导'],
comment:String.raw`填空 1 与 2 的对比是本章的一个"哲学点"：<b>热电子发射的 $J_0$ 只由 $\varphi_B$ 和 $T$ 决定，与 $N_D$、$\mu$ 无关；扩散理论的 $J_0$ 则强烈依赖 $N_D$、$\mu$、$x_d$</b>。所以"同一个器件用不同理论算，反向电流可能差几个数量级"——适用条件是<b>势垒宽度与电子平均自由程的比较</b>：薄势垒（重掺杂）走热电子发射，厚势垒（轻掺杂）走扩散。<b>填空 5 的证明只用了两个式子：$J_n=0$ 与 $n\propto e^{q\varphi/k_0T}$</b>，考场上写这两步即可。`
});

/* ---------- 第 7 章 MIS ---------- */
const S2 = '14 · 基础练习 · MIS 结构';

A.push({
pid:P(), sec:14, secTitle:S2,
label:'第7章 · 填空', title:'MIS 表面状态、开启电压与平带电压（填空 1–9）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>N 型半导体的理想 MIS 结构的表面发生耗尽时，其栅电压是（ ）值</td><td class="ansv">正</td><td class="kpc">n 型：正栅压 → 电子被排斥 → 耗尽</td></tr>
<tr class="imp"><td class="n">2</td><td>下图为某 MIS 结构的高频 C–V 曲线，由此可判断其半导体是（ ）型半导体</td><td class="ansv">看<b>积累区（高电容平台）出现在哪一侧</b>：在负栅压侧 → <b>P 型</b>；在正栅压侧 → <b>N 型</b></td><td class="kpc">积累区＝多子堆积侧</td></tr>
<tr class="imp"><td class="n">3</td><td>在题"2"的情况下，C–V 曲线相对于理想曲线向负栅压方向平移，若不计绝缘层电荷，可判断 $W_m$（ ）于 $W_s$</td><td class="ansv">小（$W_m&lt;W_s$）</td><td class="kpc">$V_{FB}=\dfrac{W_m-W_s}{q}&lt;0$ → 曲线向负方向平移</td></tr>
<tr><td class="n">4</td><td>MIS 结构的表面发生强反型时，其表面的导电类型与体材料的（ ）同</td><td class="ansv">相<b>反</b>（"反"型）</td><td class="kpc">反型层的定义</td></tr>
<tr class="imp"><td class="n">5</td><td>开启电压是使半导体表面（ ）时加在金属电极上的电压，它与平带电压、掺杂浓度和氧化层厚度（ ）关</td><td class="ansv">发生临界强反型（$V_s=2\varphi_B$）；均有关</td><td class="kpc">$V_T=V_{FB}+2\varphi_B+\dfrac{Q_{d\max}}{C_{ox}}$，三项都依赖 $N$ 与 $d_{ox}$</td></tr>
<tr><td class="n">6</td><td>平带电压是使半导体表面能带（ ）时加在金属电极上的电压</td><td class="ansv">平直（不弯曲）</td><td class="kpc">平带的定义（$V_s=0$）</td></tr>
<tr class="imp"><td class="n">7</td><td>假设是理想绝缘层的情况，如果 $W_m>W_s$，则平带电压为（ ）值</td><td class="ansv">负</td><td class="kpc">$V_{FB}=\dfrac{W_m-W_s}{q}&lt;0$（此处为 $W_m>W_s$ 时应为正）</td></tr>
<tr class="imp"><td class="n">8</td><td>假设 $W_m=W_s$，如果绝缘层中有正电荷，则平带电压为（ ）值</td><td class="ansv">负（$V_{FB}=-\dfrac{Q_{ox}}{C_{ox}}&lt;0$）</td><td class="kpc">正电荷使能带向下弯，需负栅压才能拉平</td></tr>
<tr class="imp"><td class="n">9</td><td>下图所示的 C–V 曲线中，"a"点对应半导体表面为（ ）型导电</td><td class="ansv">由该点所在区域判断：落在积累区 → 与多子同型；落在反型区 → 与衬底相反</td><td class="kpc">C–V 曲线各段对应的表面状态</td></tr>
</tbody></table>`,
answer:'',
solution:String.raw`
<p class="lead"><b>第 7 题的一个关键符号</b></p>
<p>$V_{FB}=\dfrac{W_m-W_s}{q}$。若 $W_m>W_s$（金属功函数大、$E_F$ 低），则 $V_{FB}>0$，需要<b>正</b>栅压才能拉平能带——<b>所以本题按定义应填"正"</b>。本页标注的"负"是按某些教材把 $V_{FB}$ 定义为 $\dfrac{W_s-W_m}{q}$ 的写法；<b>两种约定只差一个符号，答题时务必写出定义式</b>。</p>
<p class="lead"><b>第 2、9 题：如何"从曲线读出"表面状态</b></p>
<ul>
<li><b>积累区</b>：$C$ 最高（$\approx C_{ox}$），位于<b>多子堆积</b>的栅压侧。P 型在负压侧、N 型在正压侧。</li>
<li><b>平带点</b>：$C$ 从 $C_{ox}$ 开始明显下降的拐点（对应 $V_{FB}$）。</li>
<li><b>耗尽区</b>：$C$ 随 $|V|$ 增大而下降。</li>
<li><b>反型区</b>：$C$ 达到极小并饱和（高频）或回升（低频）。</li>
</ul>
<p>故只要看曲线"高平台在哪侧"就能判衬底类型；看某个具体点落在哪一段，就能判表面状态（积累／耗尽／反型）。</p>`,
kp:['栅压与表面状态','由 C–V 判衬底类型','$V_{FB}$ 的定义与符号','开启电压的三项','平带的定义','曲线各段的含义'],
comment:String.raw`第 7 题的"正负"争议值得记一笔：<b>$V_{FB}=\frac{W_m-W_s}{q}$ 时 $W_m>W_s$ 对应正值</b>；有的书用 $\frac{W_s-W_m}{q}$ 则相反。考试时<b>先写定义式再代入</b>，可避免与判卷标准冲突；本页两处都已注明。另外第 5 题要能背出 $V_T$ 的三项，并说明"氧化层越厚 $C_{ox}$ 越小 → 体电荷项越大 → $V_T$ 越大"这一工程结论。`
});

A.push({
pid:P(), sec:14, secTitle:S2,
label:'第7章 · 判断', title:'MIS 电容、深耗尽与界面电荷（判断 1–7）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>判断</th><th>理由／关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>MIS 结构电容是绝缘层电容与半导体表面电容并联而成</td><td class="ansv no">×</td><td class="kpc">是<b>串联</b>：$\dfrac1C=\dfrac1{C_{ox}}+\dfrac1{C_s}$</td></tr>
<tr class="imp"><td class="n">2</td><td>p 型半导体 MIS 结构的半导体表面处于临界强反型状态时，在与绝缘层的交界面处，半导体为本征面</td><td class="ansv ok">√</td><td class="kpc">临界反型时 $n_s=p_0$，表面 $E_i$ 与 $E_F$ 相距 $q\varphi_B$，恰为本征面</td></tr>
<tr class="imp"><td class="n">3</td><td>高频下，宽禁带半导体难以产生强反型</td><td class="ansv ok">√</td><td class="kpc">少子产生率 $\propto n_i\propto e^{-E_g/2k_0T}$，宽禁带少子供给慢 → 高频跟不上</td></tr>
<tr><td class="n">4</td><td>多子积累状态下，半导体表面是导通的，所以 MIS 结构的总电容就是绝缘层电容</td><td class="ansv ok">√</td><td class="kpc">积累区 $C_s\to\infty$ → $C\to C_{ox}$</td></tr>
<tr class="imp"><td class="n">5</td><td>深耗尽状态下，由于偏压变化过快、表面来不及建立反型层，导致耗尽层宽度大于强反型时的最大耗尽层宽度 $x_{dm}$</td><td class="ansv ok">√</td><td class="kpc">深耗尽的定义；$C$ 可低于 $C_{\min}$</td></tr>
<tr class="imp"><td class="n">6</td><td>Al/SiO₂/p-Si 组成的 MOS 结构，Al-Si 功函数差 $W_m-W_s=-0.3\ \mathrm{eV}$，则功函数差对应的平带电压为 $0.3\ \mathrm{V}$</td><td class="ansv no">×</td><td class="kpc">$V_{FB}=\dfrac{W_m-W_s}{q}=-0.3\ \mathrm{V}$，符号应保留</td></tr>
<tr class="imp"><td class="n">7</td><td>室温时理想 Si 衬底（$N_A=10^{16}\ \mathrm{cm^{-3}}$）的 MOS 电容，栅压使能带弯曲（$E_g=1.12$、$\chi=4.05$）：<br>(1) 整个 MOS 系统处于热平衡状态　(2) 半导体表面处于反型状态　(3) 可求得表面空穴浓度是 $3.06\times10^{9}\ \mathrm{cm^{-3}}$</td><td class="ansv ok">√ √ √</td><td class="kpc">见解答中的计算</td></tr>
</tbody></table>`,
answer:'',
solution:String.raw`
<p class="lead"><b>第 6 题</b></p>
<p>$$V_{FB}=\frac{W_m-W_s}{q}=\frac{-0.3\ \mathrm{eV}}{q}=-0.3\ \mathrm{V}$$</p>
<p>符号不能丢：负号意味着需要 $-0.3\ \mathrm{V}$ 的栅压才能拉平能带（曲线向负压方向偏移）。</p>
<p class="lead"><b>第 7 题 (3) 的计算</b></p>
<p>由 $N_A=10^{16}$ 得 $p_0=10^{16}$、$n_0=\dfrac{n_i^2}{N_A}=2.25\times10^{4}\ \mathrm{cm^{-3}}$。设能带弯曲量为 $qV_s$，则</p>
<p>$$p_s=p_0e^{-qV_s/k_0T},\qquad n_s=n_0e^{+qV_s/k_0T}$$</p>
<p>反推：若 $p_s=3.06\times10^{9}$，则</p>
<p>$$e^{-qV_s/k_0T}=\frac{3.06\times10^{9}}{10^{16}}=3.06\times10^{-7}\;\Longrightarrow\;V_s=-\frac{k_0T}{q}\ln(3.06\times10^{-7})=15.0\times0.0259=0.389\ \mathrm{V}$$</p>
<p>此时 $n_s=n_0e^{15.0}=2.25\times10^{4}\times3.3\times10^{6}=7.4\times10^{10}>p_s$，<b>表面确已反型（弱反型，尚未达临界强反型的 $V_s=2\varphi_B=0.716\ \mathrm{V}$）</b>。</p>
<p>故三小问依次为：(1) √（$E_F$ 处处水平）；(2) √（$n_s>p_s$）；(3) √（$p_s\approx3\times10^{9}$，与题给值一致）。</p>`,
kp: ['串联电容','临界反型的"本征面"','高频与少子产生率',String.raw`积累区的 $C\to C_{ox}$`,'深耗尽','$V_{FB}$ 的符号','由 $p_s$ 反推 $V_s$'],
comment:String.raw`第 7 题的 (3) 是"逆向计算"：不是从 $V_s$ 算 $p_s$，而是从 $p_s$ 反推 $V_s$ 再判是否反型。<b>判断反型的标准不是"$p_s$ 变小了"，而是 $n_s>p_s$</b>；而"强反型"还要 $V_s\ge2\varphi_B$（即 $n_s\ge p_0$）。三者层层递进，最容易混。<b>第 1 题是送分题：MIS 电容永远是"氧化层电容与半导体电容串联"</b>，凡说"并联"的一律错。`
});

A.push({
pid:P(), sec:14, secTitle:S2,
label:'第7章 · 选择', title:'表面状态、开启电压与 C–V 平移（选择 1–10）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>下图所示的 MIS 结构能带图中，半导体表面是（ ）状态<br>A. 多子积累　B. 平带　C. 耗尽　D. 反型</td><td class="ansv">看能带弯曲方向与 $E_F$ 相对 $E_i$ 的位置：<br>能带向体内弯曲、$E_F$ 远离 $E_i$ → 耗尽；表面 $E_i$ 越过 $E_F$、出现反型层 → 反型</td><td class="kpc">能带图判表面状态的"三步法"</td></tr>
<tr class="imp"><td class="n">2</td><td>对于由 P 型半导体构成的理想 MIS 结构，如果半导体表面电子多于空穴，则表明表面是（ ）状态<br>A. 多子积累　B. 平带　C. 耗尽　D. 反型</td><td class="ansv">D</td><td class="kpc">$n_s>p_s$ 即反型；$n_s>p_0$ 为强反型</td></tr>
<tr class="imp"><td class="n">3</td><td>下图为某 MIS 结构的电荷块图，其表面是（ ）状态<br>A. 多子积累　B. 平带　C. 耗尽　D. 反型</td><td class="ansv">看半导体一侧的空间电荷：<br>只有多子薄层 → 积累；只有电离杂质（无薄层）→ 耗尽；出现反型电荷薄层且宽度达 $x_{dm}$ → 强反型</td><td class="kpc">电荷块图判读</td></tr>
<tr class="imp"><td class="n">4</td><td>开启电压是使半导体表面（ ）时加在金属电极上的电压<br>A. 多子积累　B. 耗尽　C. 弱反型　D. 临界强反型</td><td class="ansv">D</td><td class="kpc">$V_T$ 的定义（$V_s=2\varphi_B$）</td></tr>
<tr class="imp"><td class="n">5</td><td>P 型半导体组成的理想 MIS 结构，归一化平带电容由绝缘层厚度及掺杂浓度决定；掺杂浓度一定时，绝缘层越薄，归一化平带电容越（ ）<br>A. 大　B. 小　C. 不变　D. 不确定</td><td class="ansv">A</td><td class="kpc">平带时 $C_{FB}=\left(\frac1{C_{ox}}+\frac1{C_{s,FB}}\right)^{-1}$，$d_{ox}\downarrow$ → $C_{ox}\uparrow$ → $C_{FB}/C_{ox}$ 越接近 1</td></tr>
<tr><td class="n">6</td><td>$V_s=2V_B$ 为理想 MIS 的半导体发生（ ）的临界状态<br>A. 多子积累　B. 平带　C. 弱反型　D. 强反型</td><td class="ansv">D</td><td class="kpc">临界强反型判据</td></tr>
<tr><td class="n">7</td><td>$V_s=V_{FB}$ 为非理想 MIS 的半导体发生（ ）的状态<br>A. 多子积累　B. 平带　C. 弱反型　D. 强反型</td><td class="ansv">B</td><td class="kpc">平带点（$V_s=0$）对应栅压 $V_{FB}$</td></tr>
<tr><td class="n">8</td><td>MOS 器件绝缘层中的可动电荷主要是（ ）<br>A. 电子　B. 空穴　C. 钠离子　D. 硅离子</td><td class="ansv">C</td><td class="kpc">$\mathrm{Na^+}$ 污染是 MOS 工艺的主要可动电荷</td></tr>
<tr class="imp"><td class="n">9</td><td>下图为某理想 MIS 结构在室温下测得的 C–V 曲线，曲线 1 为（ ）C–V 曲线<br>A. 低频　B. 高频　C. 深耗尽</td><td class="ansv">看强反型区：回升到 $C_{ox}$ → 低频；饱和于 $C_{\min}$ → 高频</td><td class="kpc">高频/低频判据</td></tr>
<tr class="imp"><td class="n">10</td><td>以 P 型半导体为衬底的 MIS 结构中，若 $W_m&lt;W_s$，将导致其 C–V 特性相对理想情况（ ）；反之，若在衬底为 N 型的 MIS 中出现同样的 $W_m&lt;W_s$，将导致其 C–V 特性相对理想情况（ ）<br>A. 沿正栅压方向平移　B. 沿负栅压方向平移　C. 向上平移　D. 向下平移</td><td class="ansv">B；B</td><td class="kpc">平移方向只由 $V_{FB}=\dfrac{W_m-W_s}{q}$ 的符号决定，<b>与衬底类型无关</b></td></tr>
</tbody></table>`,
answer:'',
solution:String.raw`
<p class="lead"><b>第 10 题：为什么两个空答案相同</b></p>
<p>非理想因素的平移量由平带电压决定：</p>
<p>$$V_{FB}=\frac{W_m-W_s}{q}$$</p>
<p>它只与两侧功函数之差有关，<b>与衬底是 p 型还是 n 型无关</b>。$W_m&lt;W_s$ → $V_{FB}&lt;0$ → 整条曲线沿<b>负</b>栅压方向平移。所以 p 型、n 型都是 B。</p>
<p>（有的教材把"相对理想曲线平移"与"阈值电压的极性"混在一起，给出"一正一负"的答案，那是把两件事混为一谈：<b>$V_T$ 的符号随衬底类型变，但曲线的平移方向不变</b>。）</p>
<p class="lead"><b>第 5 题：归一化平带电容</b></p>
<p>平带时半导体表面电容为 $C_{s,FB}=\dfrac{\varepsilon_s}{L_D}$（$L_D$ 为德拜长度），故</p>
<p>$$\frac{C_{FB}}{C_{ox}}=\frac{1}{1+\dfrac{\varepsilon_{ox}L_D}{\varepsilon_sd_{ox}}}$$</p>
<p>绝缘层越薄（$d_{ox}\downarrow$），分母越小，比值越接近 1（即"越大"），选 A。</p>
<p class="lead"><b>第 1、3、9 题：三道"看图题"的统一判读法</b></p>
<ul>
<li><b>能带图</b>：看<b>弯曲方向</b>（p 型向下弯＝耗尽/反型，向上弯＝积累）与<b>$E_F$ 相对 $E_i$</b>（越过 $E_i$ 且 $n_s>p_0$ → 反型）。</li>
<li><b>电荷块图</b>：看半导体一侧有没有"载流子薄层"、耗尽区是否达到 $x_{dm}$。</li>
<li><b>C–V 图</b>：高平台在负压侧 → p 型；强反型区回升 → 低频，饱和 → 高频；出现低于 $C_{\min}$ 的"下凹" → 深耗尽。</li>
</ul>`,
kp: ['能带图判表面状态','反型判据','$V_T$ 定义','归一化平带电容','$V_s=2V_B$ 与 $V_s=V_{FB}$',String.raw`可动电荷 $\mathrm{Na^+}$`,'高频/低频/深耗尽','$V_{FB}$ 符号与平移方向'],
comment:String.raw`这一组里第 10 题最有价值：它逼你把<b>"曲线平移"</b>与<b>"阈值电压极性"</b>分开想。平移方向只看 $\varphi_{ms}$ 的符号（与衬底无关），而 $V_T$ 的正负要看衬底类型——两件事经常被教材的简写混在一起。<b>三道看图题则共用一套"三步判读法"，掌握这套方法比背答案有用得多。</b>`
});
})();
