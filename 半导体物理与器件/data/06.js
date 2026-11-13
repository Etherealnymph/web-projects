/* 06 · 基础练习 · 热平衡载流子与杂质 */
(function(){
const A = window.__DATA__ = window.__DATA__ || [];
const P = () => (window.__PID = (window.__PID||0)+1);
const S = '10 · 基础练习 · 热平衡载流子与杂质';

A.push({
pid:P(), sec:10, secTitle:S,
label:'第2章 · 判断一', title:'热平衡、费米能级与本征载流子（判断 1–15）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>判断</th><th>理由／关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>室温下 P 型硅中，受主杂质电离提供空穴浓度，本征激发提供电子浓度，所以电子浓度等于硅的本征载流子浓度</td><td class="ansv no">×</td><td class="kpc">p 型中 $n_0=\dfrac{n_i^2}{N_A}&lt;n_i$，本征激发提供的电子大部分被"质量作用"压低</td></tr>
<tr class="imp"><td class="n">2</td><td>热平衡态时，当半导体掺入的杂质含量改变时，乘积 $n_0p_0$ 要发生改变</td><td class="ansv no">×</td><td class="kpc">$n_0p_0=n_i^2$ 只与 $T$（与材料）有关，与掺杂无关</td></tr>
<tr><td class="n">3</td><td>半导体中掺杂浓度很高时，禁带宽度变小</td><td class="ansv ok">√</td><td class="kpc">重掺杂带隙变窄效应（杂质带与带尾）</td></tr>
<tr><td class="n">4</td><td>半导体器件正常稳定工作时，可工作在过渡区和强电离区</td><td class="ansv ok">√</td><td class="kpc">器件工作温区：饱和区与过渡区</td></tr>
<tr><td class="n">5</td><td>非简并 n 型半导体费米能级位于禁带中央能级之上</td><td class="ansv ok">√</td><td class="kpc">$E_F=E_i+k_0T\ln\dfrac{n_0}{n_i}>E_i$</td></tr>
<tr class="imp"><td class="n">6</td><td>越靠近禁带，导带和价带的状态密度越大</td><td class="ansv ok">√</td><td class="kpc">$g(E)\propto(E-E_c)^{1/2}$，离开带边而增大（原题"越靠近禁带"指越深入能带）</td></tr>
<tr><td class="n">7</td><td>半导体中电子占据量子态的几率，既服从费米分布，也服从玻尔兹曼分布</td><td class="ansv ok">√</td><td class="kpc">非简并时玻尔兹曼是费米分布的近似</td></tr>
<tr class="imp"><td class="n">8</td><td>半导体费米能级是材料的固有性质，与温度、掺杂情况无关</td><td class="ansv no">×</td><td class="kpc">$E_F$ 由 $T$ 与掺杂共同决定，不是材料常数</td></tr>
<tr class="imp"><td class="n">9</td><td>只要温度不变，载流子浓度稳定后半导体就一定处于热平衡态</td><td class="ansv no">×</td><td class="kpc">稳定光照下浓度不变但 $np>n_i^2$，是<b>稳态而非平衡态</b></td></tr>
<tr><td class="n">10</td><td>非简并半导体是指电子或空穴占据量子态的几率可用玻尔兹曼分布计算</td><td class="ansv ok">√</td><td class="kpc">非简并的定义（等价于 $E_c-E_F\gg k_0T$）</td></tr>
<tr class="imp"><td class="n">11</td><td>所有本征半导体的费米能级处于禁带中心</td><td class="ansv no">×</td><td class="kpc">只有 $m_n^*=m_p^*$ 时才严格在中央；Si 略偏上</td></tr>
<tr><td class="n">12</td><td>本征载流子浓度与半导体是否掺杂无关，与温度、禁带宽度有关</td><td class="ansv ok">√</td><td class="kpc">$n_i^2=N_cN_ve^{-E_g/k_0T}$</td></tr>
<tr class="imp"><td class="n">13</td><td>半导体本征载流子浓度与温度成正比，随温度上升而升高</td><td class="ansv no">×</td><td class="kpc">是指数关系（$\propto T^{3/2}e^{-E_g/2k_0T}$），不是正比</td></tr>
<tr><td class="n">14</td><td>本征载流子浓度与温度在 $\ln n_i\!\sim\!1/T$ 坐标下近似为一直线，直线越陡，禁带宽度越大</td><td class="ansv ok">√</td><td class="kpc">斜率 $\approx-\dfrac{E_g}{2k_0}$</td></tr>
<tr class="imp"><td class="n">15</td><td>强电离半导体一定表现为强极性半导体</td><td class="ansv no">×</td><td class="kpc">「强电离」讲电离度，「极性」讲键的离子性，两者无关</td></tr>
</tbody></table>`,
answer:'',
solution:'',
kp:['质量作用定律','费米能级与 $T$、掺杂的关系','本征载流子浓度','非简并条件','稳态 vs 平衡态'],
comment:String.raw`15 题错 7 个，集中在<b>"什么会改变 $n_0p_0$、什么会改变 $n_i$"</b>。记住一句：<b>$n_0p_0=n_i^2$ 与掺杂无关、只与温度和材料有关；而 $n_0$、$p_0$ 各自都随掺杂变化</b>。第 9 题的"稳态≠平衡"是本章最哲学也最常考的一句：<b>是否平衡看 $np$ 与 $n_i^2$ 的关系，不看浓度是否随时间变</b>。`
});

A.push({
pid:P(), sec:10, secTitle:S,
label:'第2章 · 判断二', title:'杂质、电离与复合（判断 1–10）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>判断</th><th>理由／关联知识点</th></tr></thead>
<tbody>
<tr><td class="n">1</td><td>强电离区中载流子浓度由施主或受主杂质浓度决定，与温度无关</td><td class="ansv ok">√</td><td class="kpc">饱和区 $n_0\approx N_D$，与 $T$ 基本无关</td></tr>
<tr class="imp"><td class="n">2</td><td>施主杂质全部电离后，半导体必定为强 n 型</td><td class="ansv no">×</td><td class="kpc">若有受主补偿（$N_A>N_D$）则可能是 p 型；"全电离"与"强 n 型"是两件事</td></tr>
<tr class="imp"><td class="n">3</td><td>费米能级越接近价带，受主电离程度越低，价带中空穴浓度越高</td><td class="ansv ok">√</td><td class="kpc">$E_F$ 下行→越过 $E_A$→电离度降低；同时 $p_0=N_ve^{-(E_F-E_v)/k_0T}$ 增大</td></tr>
<tr class="imp"><td class="n">4</td><td>费米能级越远离导带，施主电离程度越高，导带和价带中电子浓度越高</td><td class="ansv no">×</td><td class="kpc">前半对、后半错：$E_F$ 远离导带 → 电子浓度<b>越低</b></td></tr>
<tr class="imp"><td class="n">5</td><td>温度一定，杂质半导体中少子由本征电离提供、多子由杂质电离提供，故少子浓度不变</td><td class="ansv no">×</td><td class="kpc">$n_0p_0=n_i^2$：掺杂越重少子越少，少子随掺杂变化</td></tr>
<tr><td class="n">6</td><td>非平衡状态指的是电子浓度和空穴浓度不相等</td><td class="ansv no">×</td><td class="kpc">非平衡指 $np>n_i^2$；本征半导体平衡时 $n_0=p_0$ 也"相等"</td></tr>
<tr><td class="n">7</td><td>禁带宽度越小的材料，通常其直接复合概率也越小</td><td class="ansv no">×</td><td class="kpc">$r$ 随 $E_g$ 减小而<b>增大</b>（GaAs 直接复合强、Si 弱）</td></tr>
<tr class="imp"><td class="n">8</td><td>对电子陷阱而言，费米能级以上的能级，越接近 $E_F$，陷阱效应越明显</td><td class="ansv ok">√</td><td class="kpc">$E_t$ 略高于 $E_F$ 时俘获后难再发射，储存作用最强</td></tr>
<tr class="imp"><td class="n">9</td><td>当少数载流子注入增强时，电子的准费米能级变化值大于空穴的准费米能级变化值</td><td class="ansv no">×</td><td class="kpc">恰好相反：多子准费米能级几乎不动，<b>少子准费米能级移动最大</b></td></tr>
<tr><td class="n">10</td><td>为鉴定半导体材料晶体质量，可通过测量非平衡载流子寿命</td><td class="ansv ok">√</td><td class="kpc">寿命对缺陷、深能级敏感，是常规检测手段</td></tr>
</tbody></table>`,
answer:'',
solution:'',
kp:['饱和区','补偿','电离度与 $E_F$','质量作用定律','直接复合系数','准费米能级','寿命与晶体质量'],
comment:String.raw`第 3 题值得单独说：它看起来"两个半句都对"，但要小心方向——<b>$E_F$ 越靠近价带 = $E_F$ 越低</b>，此时它逐渐低于 $E_A$，受主"抓不住电子"、电离度下降；同时 $E_v$ 与 $E_F$ 距离变小，$p_0$ 指数增大。两个结论方向一致，所以整句为真。<b>第 9 题是反面教材：小注入下多子准费米能级几乎不动，少子准费米能级大幅移动</b>——这也是作业四第 5 题(2)的核心结论。`
});

A.push({
pid:P(), sec:10, secTitle:S,
label:'第2章 · 填空', title:'分布函数、浓度公式与杂质作用（填空 1–6、9–11）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>电子的费米分布函数是（ ），玻尔兹曼分布函数是（ ）</td><td class="ansv">$f(E)=\dfrac{1}{1+e^{(E-E_F)/k_0T}}$；$f\approx e^{-(E-E_F)/k_0T}$</td><td class="kpc">费米—狄拉克分布；非简并近似</td></tr>
<tr><td class="n">2</td><td>空穴的费米分布函数是（ ），玻尔兹曼分布函数是（ ）</td><td class="ansv">$1-f(E)=\dfrac{1}{1+e^{(E_F-E)/k_0T}}$；$e^{-(E_F-E)/k_0T}$</td><td class="kpc">空穴占据概率＝电子未占据概率</td></tr>
<tr class="imp"><td class="n">3</td><td>热平衡态时，非简并半导体电子浓度公式是（ ），空穴浓度公式是（ ）</td><td class="ansv">$n_0=N_ce^{-(E_c-E_F)/k_0T}$；$p_0=N_ve^{-(E_F-E_v)/k_0T}$</td><td class="kpc">载流子浓度公式</td></tr>
<tr><td class="n">4</td><td>温度相同，半导体禁带宽度越大，本征载流子浓度（ ）</td><td class="ansv">越小</td><td class="kpc">$n_i^2=N_cN_ve^{-E_g/k_0T}$</td></tr>
<tr><td class="n">5</td><td>本征半导体是指（ ）的半导体，本征半导体中电子浓度与空穴浓度（ ）</td><td class="ansv">不含杂质与缺陷（纯净）；相等（$=n_i$）</td><td class="kpc">本征半导体的定义</td></tr>
<tr><td class="n">6</td><td>本征半导体中电中性条件是（ ）</td><td class="ansv">$n_0=p_0$（即 $n_0=p_0=n_i$）</td><td class="kpc">电中性条件</td></tr>
<tr class="imp"><td class="n">9</td><td>Au 在 Si 中是有效复合中心，但施主能级与受主能级不同时起作用：n 型 Si 中只有（ ）起作用；p 型 Si 中只有（ ）起作用；Au⁺ 对（ ）的俘获决定少子寿命</td><td class="ansv">受主能级；施主能级；电子</td><td class="kpc">深能级的双能级；$E_F$ 决定的填充状态；少子俘获</td></tr>
<tr class="imp"><td class="n">10</td><td>一定温度下热平衡时，杂质半导体中电子浓度与空穴浓度之积为常数，只与（ ）有关，而与（ ）无关</td><td class="ansv">温度（及材料 $E_g$）；掺杂浓度</td><td class="kpc">质量作用定律</td></tr>
<tr class="imp"><td class="n">11</td><td>同温度下禁带越宽的本征半导体，载流子浓度（ ），电阻率（ ）；本征硅温度越高，载流子浓度（ ），电阻率（ ）<br>A. 越高　B. 越低　C. 先降后升　D. 先升后降</td><td class="ansv">B；A；A；B</td><td class="kpc">$n_i$ 与 $E_g$、$T$ 的关系；本征电阻率 $\rho=\frac{1}{n_iq(\mu_n+\mu_p)}$</td></tr>
</tbody></table>
<p style="font-size:.86em;color:var(--muted);margin:.3em 0 0">＊原卷缺第 7、8 题编号。</p>`,
answer:'',
solution:String.raw`
<p class="lead"><b>第 9 题的推理</b>：Au 在 Si 中同时有施主能级 $E_v+0.35\ \mathrm{eV}$ 与受主能级 $E_c-0.54\ \mathrm{eV}$。</p>
<ul>
<li><b>n 型</b>：$E_F$ 靠近导带（$E_c-0.2$ 左右），受主能级 $E_c-0.54$ 在 $E_F$ <b>之下</b> → 被电子填满 → 带负电（Au⁻）→ 起<b>受主</b>作用；施主能级远在 $E_F$ 之下、也被填满 → 中性、不起作用。</li>
<li><b>p 型</b>：$E_F$ 靠近价带，施主能级 $E_v+0.35$ 在 $E_F$ <b>之上</b> → 空着 → 带正电（Au⁺）→ 起<b>施主</b>作用。</li>
<li>p 型中少子是电子，Au⁺ 对<b>电子</b>的俘获决定少子寿命。</li>
</ul>
<p class="lead"><b>第 11 题的第二空</b>：本征硅温度升高，$n_i$ 指数增长远快于迁移率的下降，故 $\rho$ 单调<b>下降</b>（若讨论的是杂质半导体，则饱和区内 $\rho$ 随 $T$ 上升，因为多子浓度不变、迁移率下降——这是两种不同的曲线，别混）。</p>`,
kp:['费米—狄拉克分布与玻尔兹曼近似','载流子浓度公式','本征半导体与电中性','Au 的双能级','质量作用定律','本征电阻率'],
comment:String.raw`第 9 题是本组最难的一空，判据只有一句：<b>看能级在 $E_F$ 的哪一侧——在 $E_F$ 之下被电子填满，在之上则空着</b>。同一批 Au 原子在 n 型和 p 型中"扮演不同的角色"，这正是深能级杂质"两副面孔"的最佳例证（作业四第 6 题就是把它算成数字）。第 11 题则要区分<b>本征半导体与杂质半导体的 $\rho\!-\!T$ 走势完全相反</b>。`
});

A.push({
pid:P(), sec:10, secTitle:S,
label:'第2章 · 选择一', title:'载流子浓度与杂质电离（选择 1–8）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>热平衡时，半导体中电子浓度与空穴浓度之积为常数，它只与（ ）有关<br>A. 杂质浓度　B. 杂质类型　C. 禁带宽度　D. 温度</td><td class="ansv">D</td><td class="kpc">$n_0p_0=n_i^2(T)$；对给定材料 $E_g$ 固定，故只与 $T$ 有关</td></tr>
<tr><td class="n">2</td><td>若某半导体中导带中发现电子的几率为零，则该半导体必定（ ）<br>A. 不含施主　B. 不含受主　C. 不含任何杂质　D. 处于绝对零度</td><td class="ansv">D</td><td class="kpc">$f(E_c)=0$ 要求 $E_c-E_F\to\infty$，只有 $T\to0$ 才成立</td></tr>
<tr class="imp"><td class="n">3</td><td>本征半导体是指（ ）的半导体<br>A. 不含杂质与缺陷　B. 电子浓度与空穴浓度相等　C. 电阻率最高　D. 电子浓度与本征载流子浓度相等</td><td class="ansv">A</td><td class="kpc">本征半导体的<b>定义</b>是"纯净"；B 是它的推论（也是可操作的判据）</td></tr>
<tr class="imp"><td class="n">4</td><td>以下 4 种半导体中最适合制作高温器件的是（ ）<br>A. Si　B. Ge　C. GaAs　D. GaN</td><td class="ansv">D</td><td class="kpc">宽禁带（GaN $E_g\approx3.4\ \mathrm{eV}$）→ $n_i$ 小 → 高温下少子不失控</td></tr>
<tr class="imp"><td class="n">5</td><td>半导体材料的本征载流子浓度值和（ ）有关<br>A. 掺杂浓度　B. 禁带宽度　C. 载流子的有效质量　D. 温度</td><td class="ansv">B、C、D</td><td class="kpc">$n_i^2=N_cN_ve^{-E_g/k_0T}$，而 $N_c,N_v\propto(m^*)^{3/2}$；<b>与掺杂无关</b></td></tr>
<tr class="imp"><td class="n">6</td><td>影响杂质电离程度的可能因素包括（ ）<br>A. 掺杂浓度　B. 温度　C. 杂质电离能　D. 导带/价带有效状态密度</td><td class="ansv">A、B、C、D</td><td class="kpc">电离度 $=\dfrac{1}{1+2e^{(E_F-E_D)/k_0T}}$，$E_F$ 又由 $N_D$、$N_c$ 决定</td></tr>
<tr><td class="n">7</td><td>过渡区时，p 型半导体空穴来源途径包括（ ）<br>A. 受主杂质电离　B. 本征激发　C. 施主杂质电离</td><td class="ansv">A、B</td><td class="kpc">过渡区＝本征激发与杂质电离相当</td></tr>
<tr class="imp"><td class="n">8</td><td>对于 n 型 Si，通常认为 90% 以上杂质电离即为全电离，以下四种情况中，不能全电离的是（ ）<br>A. $E_D-E_F=10k_0T$　B. $5k_0T$　C. $k_0T$　D. $-k_0T$</td><td class="ansv">C、D</td><td class="kpc">电离度 $=\dfrac{1}{1+2e^{-(E_D-E_F)/k_0T}}$：C 得 58%、D 得 15%</td></tr>
</tbody></table>`,
answer:'',
solution:String.raw`
<p class="lead"><b>第 8 题定量核对</b>（$g_D=2$）：</p>
<table class="qa">
<thead><tr><th>$E_D-E_F$</th><th>$10k_0T$</th><th>$5k_0T$</th><th>$k_0T$</th><th>$-k_0T$</th></tr></thead>
<tbody>
<tr><td>电离度</td><td>$99.99\%$</td><td>$98.7\%$</td><td>$57.6\%$</td><td>$15.5\%$</td></tr>
</tbody></table>
<p>故 C、D 达不到 90%，选 C、D。</p>
<p class="lead"><b>第 5、6 题为什么要"多选"</b></p>
<p>$n_i$ 由 $E_g$、$N_c$、$N_v$、$T$ 共同决定，而 $N_c,N_v\propto(m^*T)^{3/2}$，所以凡问"$n_i$ 与什么有关"，只要选项里出现 $E_g$、$m^*$、$T$ 就都要选，<b>唯独掺杂无关</b>。电离程度同理：它本质上是 $E_F$ 相对 $E_D$ 的位置问题，而 $E_F$ 由掺杂、$T$、$N_c$ 共同决定，所以四项全选。</p>`,
kp:['质量作用定律','本征半导体的定义','宽禁带与高温器件','$n_i$ 的影响因素','电离度与 90% 判据','过渡区'],
comment:String.raw`第 3 题的 A 与 B 都能"说通"，但<b>定义题选定义</b>：本征半导体＝纯净无缺陷（A）；B 是它的结论，若题目改成"如何判断是否本征"才选 B。第 2 题容易误选 C——<b>"导带无电子"不需要不含杂质，只需要温度足够低</b>（本征激发冻结），所以 D 才严格成立。`
});

A.push({
pid:P(), sec:10, secTitle:S,
label:'第2章 · 选择二', title:'杂质作用、导电类型与补偿（选择 1–4）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>室温下将 Al 作为杂质掺入本征 Si 中：Al 的作用是（ ），多子是（ ），费米能级位于（ ），温度从室温升高时 $E_F$ 向（ ）移动<br>A. 施主　B. 受主　C. 复合中心　D. 电子　E. 空穴　F. $E_i$ 以上　G. $E_i$ 以下　H. $E_i$</td><td class="ansv">B；E；G；H</td><td class="kpc">Ⅲ 族＝受主；p 型 $E_F&lt;E_i$；升温 $E_F\to E_i$</td></tr>
<tr class="imp"><td class="n">2</td><td>间接复合过程中，与导带电子浓度有关的微观过程是（ ）；与电子浓度和空穴浓度无关、仅与温度有关的微观过程是（ ）<br>A. 电子发射　B. 电子俘获　C. 空穴发射　D. 空穴俘获　E. 电子发射与空穴发射　F. 电子俘获与空穴俘获</td><td class="ansv">B；E</td><td class="kpc">俘获速率 $\propto$ 载流子浓度；发射速率只由 $T$ 决定（$e_n\propto e^{-(E_c-E_t)/k_0T}$）</td></tr>
<tr class="imp"><td class="n">3</td><td>将硅原子作为杂质掺入砷化镓，浓度 $10^{16}\ \mathrm{cm^{-3}}$，其中 15% 取代 As、85% 取代 Ga，全部电离且忽略本征激发，则该半导体为（ ），多子浓度为（ ）<br>A. N 型　B. P 型　C. 本征型　D. $8.5\times10^{15}$　E. $7\times10^{15}$　F. $1.5\times10^{15}$</td><td class="ansv">B；E</td><td class="kpc">双性杂质（amphoteric）：Si 占 As 位＝施主，占 Ga 位＝受主；净受主 $=8.5-1.5=7\times10^{15}$</td></tr>
<tr class="imp"><td class="n">4</td><td>室温下对 N 型半导体，若施主掺杂浓度增加：$n_0p_0$（ ）$n_i^2$，其功函数（ ）；若有光注入，$np$（ ）$n_i^2$<br>A. 大于　B. 等于　C. 小于　D. 增大　E. 不变　F. 减小</td><td class="ansv">B；F；A</td><td class="kpc">质量作用定律；$W_s=\chi+(E_c-E_F)$ 随 $N_D$ 增大而减小；光注入 $np>n_i^2$</td></tr>
</tbody></table>`,
answer:'',
solution:String.raw`
<p class="lead"><b>第 3 题：双性杂质</b></p>
<p>Si 在 GaAs 中是 <b>amphoteric（双性）杂质</b>：</p>
<ul>
<li>Si 取代 <b>As</b>（Ⅴ 族位）→ 多一个价电子 → <b>施主</b>；浓度 $0.15\times10^{16}=1.5\times10^{15}$；</li>
<li>Si 取代 <b>Ga</b>（Ⅲ 族位）→ 少一个价电子 → <b>受主</b>；浓度 $0.85\times10^{16}=8.5\times10^{15}$。</li>
</ul>
<p>净受主 $=8.5\times10^{15}-1.5\times10^{15}=7.0\times10^{15}\ \mathrm{cm^{-3}}$ → <b>P 型</b>，多子（空穴）浓度 $7\times10^{15}\ \mathrm{cm^{-3}}$。选 B、E。</p>
<p class="lead"><b>第 4 题：功函数的方向</b></p>
<p>$W_s=\chi+(E_c-E_F)$，而 $E_c-E_F=k_0T\ln\dfrac{N_c}{N_D}$ 随 $N_D$ 增大而<b>减小</b>，故 $W_s$ <b>减小</b>。这条常与"金属功函数与掺杂无关"对照着考（基础练习第 13 章第 1 题）。</p>`,
kp:['Ⅲ/Ⅴ 族杂质与导电类型','$E_F$ 随温度趋近 $E_i$','俘获 vs 发射','双性杂质与补偿','$W_s$ 与掺杂的关系'],
comment:String.raw`第 3 题是最漂亮的"双性杂质"题：<b>同一批 Si 原子，15% 做施主、85% 做受主，净效果由"占位比例"决定</b>。这类题的通用解法是"分别算出施主数与受主数、取净值、定类型"。第 4 题的后半问「光注入下 $np$ 大于 $n_i^2$」是"非平衡"的标志，与前面判断题第 6 题互为反面。<b>第 2 题要能一句话说出理由：俘获靠"撞上"，所以正比于载流子浓度；发射靠"热激发"，所以只与温度有关。</b>`
});

A.push({
pid:P(), sec:10, secTitle:S,
label:'第2章 · 选择三', title:'非平衡载流子与复合（选择 1–8）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>注入停止后，N 型半导体中非平衡载流子浓度随时间衰减的规律正确的是（ ）<br>A. $\Delta p(t)=p_0e^{-t/\tau_p}$　B. $\Delta p(t)=\Delta p_0e^{-t/\tau_p}$　C. $\Delta n(t)=n_0e^{-t/\tau_n}$　D. $\Delta n(t)=\Delta n_0e^{-t/\tau_p}$</td><td class="ansv">B</td><td class="kpc">衰减的是<b>非平衡</b>部分 $\Delta p_0$（不是平衡值 $p_0$）；满足 $\Delta n=\Delta p$</td></tr>
<tr class="imp"><td class="n">2</td><td>按复合机构分，复合的微观过程包括（ ）<br>A. 直接复合　B. 间接复合　C. 体内复合　D. 辐射复合　E. 俄歇复合</td><td class="ansv">A、B、E</td><td class="kpc">按机构：直接、间接（SRH）、俄歇；C 按位置分、D 按能量释放方式分</td></tr>
<tr class="imp"><td class="n">3</td><td>一块半导体寿命 $\tau=10\ \mu\mathrm{s}$，光照突然停止 $20\ \mu\mathrm{s}$ 后，非平衡载流子衰减到原来的（ ）<br>A. $e$　B. $1/e$　C. $1/e^2$　D. $1/2$</td><td class="ansv">C</td><td class="kpc">$e^{-20/10}=e^{-2}$</td></tr>
<tr><td class="n">4</td><td>测量载流子寿命的方法包括（ ）<br>A. 直流光电导衰减法　B. 高频光电导衰减法　C. 光磁电法　D. 霍尔效应</td><td class="ansv">A、B、C</td><td class="kpc">光电导衰减、光磁电效应；霍尔测浓度与迁移率</td></tr>
<tr class="imp"><td class="n">5</td><td>对于大注入下的直接复合，非平衡载流子的寿命不再是个常数，它与（ ）<br>A. 非平衡载流子浓度成正比　B. 平衡载流子浓度成正比　C. 非平衡载流子浓度成反比　D. 平衡载流子浓度成反比</td><td class="ansv">C</td><td class="kpc">大注入 $\tau=\dfrac{1}{r(n_0+p_0+\Delta p)}\approx\dfrac{1}{r\Delta p}\propto\dfrac{1}{\Delta p}$</td></tr>
<tr class="imp"><td class="n">6</td><td>以下关于直接复合的理解，正确的有（ ）<br>A. 导带电子直接落入价带与空穴复合　B. 非简并情况下产生率基本不受载流子浓度影响　C. 产生率与温度无关　D. 小注入条件下，半导体电导率越高，寿命就越短</td><td class="ansv">A、B、D</td><td class="kpc">$G_0=rn_i^2$ 只与 $T$ 有关（故 C 错）；$\tau=1/[r(n_0+p_0)]$，电导率高→载流子多→$\tau$ 短</td></tr>
<tr class="imp"><td class="n">7</td><td>间接复合、小注入下，强 N 型半导体的少子寿命与（ ）<br>A. $p_0$ 成反比　B. $n_0$ 成反比　C. 复合中心浓度成正比　D. 复合中心浓度成反比</td><td class="ansv">D</td><td class="kpc">$\tau_p=\dfrac{1}{r_pN_t}$，与 $n_0$、$p_0$ 无关</td></tr>
<tr class="imp"><td class="n">8</td><td>以下关于间接复合的理解，正确的有（ ）<br>A. 非平衡载流子通过复合中心的复合　B. 净复合率小于零时表示净产生　C. 重掺杂 n 型材料的寿命与俘获系数成反比　D. 最有效的复合中心能级处于费米能级附近</td><td class="ansv">A、B、C</td><td class="kpc">D 错：最有效复合中心在<b>禁带中央 $E_i$ 附近</b>，不是 $E_F$ 附近</td></tr>
</tbody></table>`,
answer:'',
solution:String.raw`
<p class="lead"><b>第 5 题：大注入下 $\tau$ 为什么与 $\Delta p$ 成反比</b></p>
<p>直接复合的净复合率 $U=r(np-n_i^2)$。大注入时 $n\approx p\approx\Delta p\gg n_0,p_0$，故</p>
<p>$$U\approx r\Delta p^2,\qquad \tau\equiv\frac{\Delta p}{U}\approx\frac{1}{r\Delta p}$$</p>
<p>即<b>注入越强、寿命越短</b>——这与"小注入下 $\tau$ 是常数"形成鲜明对照，也是作业四第 5 题"$G\tau=5\times10^{16}$ 时不能直接用 $\Delta n=G\tau$ 反推"的原因（严格说要解 $\dfrac{\mathrm d\Delta p}{\mathrm dt}=G-r\Delta p^2$）。</p>
<p class="lead"><b>第 8 题 D 项为什么错</b></p>
<p>有效复合中心的条件是 $n_1\approx p_1\approx n_i$，即 $E_t\approx E_i$（<b>禁带中央</b>）。若 $E_t$ 靠近 $E_F$，中心被"填满"或"抽空"，另一类载流子的俘获反而变慢，净复合率下降。<b>这里把"费米能级"与"本征能级"混为一谈是经典陷阱</b>。</p>`,
kp: [String.raw`$\Delta p=\Delta p_0e^{-t/\tau}$`,'复合的分类（机构/位置/能量）','大注入寿命','直接复合的产生率','SRH 强 n 型寿命','有效复合中心位置'],
comment:String.raw`本组 8 题里 6 题是"多选题"，说明这一章的概念题以<b>"哪些说法都成立"</b>为主。两个高频陷阱：<b>① 第 1 题把 $\Delta p_0$ 写成 $p_0$</b>（衰减的是非平衡部分）；<b>② 第 8 题 D 把 $E_i$ 换成 $E_F$</b>。还有第 6 题 C 项"产生率与温度无关"是错的：$G_0=rn_i^2\propto e^{-E_g/k_0T}$，随温度指数变化。`
});

A.push({
pid:P(), sec:10, secTitle:S,
label:'第2章 · 选择四', title:'简并半导体与费米能级的移动（选择 1、2、4–8）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>简并半导体是指（ ）的半导体<br>A. $(E_c-E_F)\ge0$ 或 $(E_F-E_v)\ge0$　B. $(E_c-E_F)\le0$ 或 $(E_F-E_v)\le0$　C. 能使用玻尔兹曼近似计算载流子浓度　D. 导带底和价带顶能容纳多个状态相同的电子</td><td class="ansv">B</td><td class="kpc">简并＝$E_F$ 进入导带或价带；此时玻尔兹曼失效（C 反了）</td></tr>
<tr class="imp"><td class="n">2</td><td>对于掺入施主杂质的 n 型半导体，当 $E_D=E_F$ 时，电离的施主杂质占总掺杂浓度的比例为（ ）<br>A. $1/2$　B. $1/3$　C. $1/4$　D. $1/5$</td><td class="ansv">B</td><td class="kpc">$\dfrac{1}{1+g_De^{0}}=\dfrac{1}{1+2}=\dfrac13$</td></tr>
<tr class="imp"><td class="n">4</td><td>对于掺入施主杂质的半导体，掺杂浓度一定时，温度从室温逐步升高，费米能级向（ ）移动<br>A. $E_c$　B. $E_v$　C. $E_i$　D. $E_F$</td><td class="ansv">C</td><td class="kpc">高温趋本征，$E_F\to E_i$</td></tr>
<tr class="imp"><td class="n">5</td><td>对于只含一种杂质的非简并 n 型半导体，$E_F$ 随温度上升而（ ）<br>A. 单调上升　B. 单调下降　C. 经过一个极小值趋近 $E_i$　D. 经过一个极大值趋近 $E_i$</td><td class="ansv">D</td><td class="kpc">低温弱电离区 $E_F$ 上升（趋近 $E_D$），饱和区后下降，高温趋 $E_i$ → 有极大值</td></tr>
<tr><td class="n">6</td><td>在纯的半导体硅中掺入硼，在一定温度下，当掺入浓度增加时，费米能级向（ ）移动<br>A. $E_c$　B. $E_v$　C. $E_i$　D. $E_F$</td><td class="ansv">B</td><td class="kpc">受主增多 → 空穴增多 → $E_F$ 下行趋 $E_v$</td></tr>
<tr class="imp"><td class="n">7</td><td>低温弱电离时，掺杂 Si 半导体载流子浓度由（ ）决定<br>A. 掺杂浓度　B. 温度　C. 禁带宽度　D. 杂质电离能</td><td class="ansv">D</td><td class="kpc">$n_0\propto e^{-\Delta E_D/2k_0T}$，主导因素是电离能（并与 $T$ 指数相关）</td></tr>
<tr class="imp"><td class="n">8</td><td>稳定光照情况下，关于半导体中载流子所处状态，正确的是（ ）<br>A. 浓度一直变化，处于非平衡　B. 浓度不变，处于稳态即平衡态　C. 浓度不变，处于稳态但仍然是非平衡态　D. 浓度一直变化，处于稳态但仍非平衡</td><td class="ansv">C</td><td class="kpc">稳态≠平衡：$np>n_i^2$ 仍成立</td></tr>
</tbody></table>
<p style="font-size:.86em;color:var(--muted);margin:.3em 0 0">＊原卷缺第 3 题编号。</p>`,
answer:'',
solution:String.raw`
<p class="lead"><b>$E_F\!-\!T$ 曲线的三段（第 5 题）</b></p>
<table class="qa">
<thead><tr><th>温区</th><th>$E_F$ 位置</th><th>随 $T$ 的变化</th></tr></thead>
<tbody>
<tr><td>低温弱电离区</td><td>$(E_c+E_D)/2$ 附近</td><td><b>上升</b>（载流子仍随 $T$ 增加，$E_F$ 向 $E_D$ 靠）</td></tr>
<tr><td>饱和区</td><td>$E_c$ 下方 $k_0T\ln(N_c/N_D)$</td><td><b>下降</b>（$N_c\propto T^{3/2}$ 增大）</td></tr>
<tr><td>本征区</td><td>$\to E_i$</td><td>继续下降，直到与 $E_i$ 重合</td></tr>
</tbody></table>
<p>所以 $E_F$ 先升后降，出现一个<b>极大值</b>，选 D。</p>
<p class="lead"><b>第 7 题：为什么是"电离能"主导</b></p>
<p>低温弱电离区，由电中性条件 $n_0=N_D^+$ 可解出</p>
<p>$$n_0\approx\left(\frac{N_cN_D}{2}\right)^{1/2}e^{-\Delta E_D/2k_0T}$$</p>
<p>温度与电离能以<b>指数</b>方式进入（$e^{-\Delta E_D/2k_0T}$），而掺杂浓度只是 $1/2$ 次方——故"由电离能（与温度）决定"，与 $E_g$ 无关（此时本征激发尚未起来）。</p>`,
kp: ['简并判据','$E_D=E_F$ 时电离度 1/3',String.raw`$E_F\!-\!T$ 三段曲线`,'掺杂浓度对 $E_F$ 的影响','低温弱电离','稳态 vs 平衡'],
comment:String.raw`第 5 题是本组最易错的：多数人凭"$E_F$ 最终趋近 $E_i$"就选"单调下降"，但<b>低温段 $E_F$ 是上升的</b>——因为此时载流子随温度增加、$E_F$ 要"追着" $E_D$ 走。记住这张三段图，等于同时掌握了 $n_0\!-\!T$ 曲线和 $\rho\!-\!T$ 曲线的形状。<b>第 2 题只要记住 $g_D=2$、$E_D=E_F$ 时电离度恰为 $1/3$</b>，这类题都可秒答。`
});
})();
