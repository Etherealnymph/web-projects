/* 03 · 作业三（热平衡载流子）+ 作业四（输运与非平衡） */
(function(){
const A = window.__DATA__ = window.__DATA__ || [];
const P = () => (window.__PID = (window.__PID||0)+1);

/* ================= 作业三 ================= */
const S3 = '05 · 作业三 · 热平衡载流子';

A.push({
pid:P(), sec:5, secTitle:S3,
label:'作业三 · 1', title:'浅能级杂质与深能级杂质的特点和作用',
statement:String.raw`
<p>试说明浅能级杂质和深能级杂质的特点和作用。</p>`,
answer:String.raw`<p><b>浅能级</b>：能级紧靠带边、电离能 $\sim k_0T$、室温几乎全电离，<b>决定导电类型与载流子浓度</b>；<b>深能级</b>：能级深入禁带中部、室温几乎不电离，<b>主要作复合中心／产生中心／陷阱</b>，控制少子寿命，对浓度贡献可忽略。</p>`,
solution:String.raw`
<p class="lead"><b>一、浅能级杂质（决定"有多少载流子"）</b></p>
<ul>
<li><b>能级位置</b>：施主能级紧靠导带底（$E_c-0.04\sim0.05\ \mathrm{eV}$），受主能级紧靠价带顶（$E_v+0.045\sim0.16\ \mathrm{eV}$）。</li>
<li><b>电离能小</b>：与室温 $k_0T=0.026\ \mathrm{eV}$ 同量级，室温下电离度接近 $100\%$ → 强电离区 $n_0\approx N_D$、$p_0\approx N_A$。</li>
<li><b>结构成因</b>：多为<b>替代式</b>杂质，与被替代的宿主原子半径、电负性接近，价电子数只差 1（Si 中 Ⅴ 族 P、As、Sb 是施主，Ⅲ 族 B、Al、Ga、In 是受主）。束缚载流子的轨道半径很大（几十个晶格常数），受介电屏蔽强，故电离能小。</li>
<li><b>作用</b>：① <b>提供载流子、决定导电类型</b>——所有器件的"电导调制"基础；② 形成 pn 结与异质结构；③ <b>对少子寿命影响小</b>（能级离带边近，俘获截面小、俘获后极易再发射，不是有效复合中心）。</li>
</ul>
<p class="lead"><b>二、深能级杂质（决定"活多久"）</b></p>
<ul>
<li><b>能级位置</b>：深入禁带中部（$\Delta E\gtrsim0.1\ \mathrm{eV}$，甚至接近 $\frac{E_g}{2}$），室温电离度极小。</li>
<li><b>结构成因</b>：与宿主原子半径、电子结构差别大（重金属 Au、Cu、Fe、Cr、Ni 在 Si 中），以及空位、杂质—缺陷络合物；常形成<b>多重能级</b>（同时有施主、受主能级）。</li>
<li><b>作用</b>：① <b>复合中心</b>（最主要）——经电子、空穴两步俘获完成 SRH 复合，显著降低少子寿命，如 Si 中掺 Au 可把寿命压到纳秒量级；② <b>产生中心</b>——反偏耗尽区中热激发产生电子—空穴对，使反向漏电流增大、噪声增加；③ <b>陷阱中心</b>——暂时俘获再释放，造成开关延迟；④ 在 LED／激光器中作非辐射复合中心，降低发光效率。</li>
<li><b>有益利用</b>：控制寿命（金掺杂快恢复二极管、晶闸管）、补偿掺杂制备半绝缘材料（GaAs 掺 Cr、InP 掺 Fe）、深能级瞬态谱（DLTS）表征缺陷。</li>
</ul>
<p class="lead"><b>三、对照</b></p>
<table class="qa">
<thead><tr><th>项目</th><th>浅能级</th><th>深能级</th></tr></thead>
<tbody>
<tr><td>能级位置</td><td>靠带边</td><td>禁带中部</td></tr>
<tr><td>电离能</td><td>$\sim0.03\!-\!0.07\ \mathrm{eV}$（$\approx k_0T$）</td><td>$>0.1\ \mathrm{eV}$，可接近 $E_g/2$</td></tr>
<tr><td>室温电离度</td><td>$\approx100\%$</td><td>很小</td></tr>
<tr><td>对浓度</td><td><b>起决定作用</b></td><td>可忽略</td></tr>
<tr><td>对寿命</td><td>影响小</td><td><b>作用显著</b></td></tr>
<tr><td>典型</td><td>P、As、Sb；B、Al、Ga、In</td><td>Au、Cu、Fe、Cr、Ni；缺陷络合物</td></tr>
<tr><td>用途</td><td>定类型与电阻率</td><td>控寿命、半绝缘补偿、缺陷研究</td></tr>
</tbody></table>`,
kp:['浅能级杂质','深能级杂质','施主/受主电离能','复合中心','补偿掺杂与半绝缘'],
comment:String.raw`这题的分水岭是<b>能否把「浅→浓度」「深→寿命」这条对应关系说透</b>。常见答法只罗列能级数值，缺少"为什么"：浅能级电离能小，是因为<b>束缚轨道半径大、介电屏蔽强</b>（类氢模型 $E_D=\frac{m^*}{m_0}\frac{13.6}{\varepsilon_r^2}\ \mathrm{eV}$，Si 中算出来正好是几十 meV）；深能级能级靠近禁带中央，<b>电子和空穴的俘获概率相当</b>，才成为有效复合中心。`
});

A.push({
pid:P(), sec:5, secTitle:S3,
label:'作业三 · 2', title:'什么是热平衡状态和热平衡载流子？',
statement:String.raw`
<p>什么是热平衡状态和热平衡载流子？</p>`,
answer:String.raw`<p><b>热平衡状态</b>：一定温度下无光照、无外加电压、无注入时，产生率＝复合率、载流子浓度不随时间变化、<b>全样品有统一费米能级</b>、宏观无净电流的状态。<b>热平衡载流子</b>：在该状态下由本征激发与杂质电离产生、按费米分布（非简并时按玻尔兹曼）分布的电子与空穴，记作 $n_0$、$p_0$，满足 $n_0p_0=n_i^2$。</p>`,
solution:String.raw`
<p class="lead"><b>一、热平衡状态的三个等价判据</b></p>
<ul>
<li><b>动态平衡</b>：$\dfrac{\mathrm dn_0}{\mathrm dt}=\dfrac{\mathrm dp_0}{\mathrm dt}=0$，即单位时间产生的电子—空穴对数等于复合掉的数目；</li>
<li><b>统一费米能级</b>：即使是不均匀掺杂、有内建电场，$E_F$ 也处处相同（$E_F$ 水平是平衡态的标志）；</li>
<li><b>质量作用定律</b>：非简并时 $n_0p_0=n_i^2$，与掺杂无关。</li>
</ul>
<p class="lead"><b>二、热平衡载流子</b></p>
<p>产生途径只有两条：<b>本征激发</b>（价带电子跃迁到导带）和<b>杂质电离</b>。浓度由温度与掺杂决定：</p>
<p>$$n_0=N_ce^{-(E_c-E_F)/k_0T},\qquad p_0=N_ve^{-(E_F-E_v)/k_0T}$$</p>
<p>n 型中 $n_0$ 为多子、$p_0$ 为少子；p 型反之。<b>它们只取决于温度、掺杂浓度（及杂质能级），与外界注入无关。</b></p>
<p class="lead"><b>三、与「非平衡载流子」的区别</b></p>
<table class="qa">
<thead><tr><th>项目</th><th>热平衡 $n_0,p_0$</th><th>非平衡 $\Delta n,\Delta p$</th></tr></thead>
<tbody>
<tr><td>成因</td><td>本征激发＋杂质电离（内部、自发）</td><td>光照、外加电压、注入等外界作用</td></tr>
<tr><td>费米能级</td><td>统一 $E_F$</td><td>$E_F$ 不适用，需<b>准费米能级</b> $E_{Fn}$、$E_{Fp}$</td></tr>
<tr><td>质量作用</td><td>$n_0p_0=n_i^2$</td><td>$np>n_i^2$，$\Delta p$ 按 $e^{-t/\tau}$ 衰减</td></tr>
<tr><td>随时间</td><td>不变</td><td>衰减并伴随扩散</td></tr>
<tr><td>作用</td><td>决定电导"背景"、结的内建电势</td><td>决定器件工作电流（pn 结注入、光生载流子）</td></tr>
</tbody></table>
<p><b>注意</b>：杂质未完全电离时，要把电离度与电中性条件联立求解 $n_0$、$p_0$（这正是作业三第 4～6 题的做法）。</p>`,
kp:['热平衡判据','统一费米能级','质量作用定律','热平衡载流子 vs 非平衡载流子','准费米能级'],
comment:String.raw`「热平衡」最容易被误解成「浓度相等」或「没有电场」——都不对。<b>pn 结在平衡时内部有很强的内建电场、浓度也处处不等，但它仍是热平衡态</b>，因为产生与复合抵消、$E_F$ 处处水平。反过来，<b>稳定光照下浓度不随时间变，却不是平衡态</b>（$np>n_i^2$）——这就是基础练习里「浓度稳定就一定热平衡」那道判断题的考点。`
});

A.push({
pid:P(), sec:5, secTitle:S3,
label:'作业三 · 3', title:'少子浓度—杂质浓度曲线为什么是斜率 −1 的直线？',
statement:String.raw`
<p>下图是不同温度下、只掺入一种杂质的 N 型半导体中热平衡少子浓度与杂质浓度的关系曲线，说明曲线为什么呈如此趋势。</p>`,
answer:String.raw`<p>饱和区 $n_0\approx N_D$，由 $n_0p_0=n_i^2$ 得 $p_0=\dfrac{n_i^2}{N_D}$，双对数坐标下是<b>斜率 $-1$ 的直线</b>；温度越高 $n_i$ 越大，直线整体<b>平行上移</b>，竖直平移量 $=2\lg\dfrac{n_i(T_2)}{n_i(T_1)}$。</p>`,
solution:String.raw`
<p class="lead"><b>一、为什么是斜率 $-1$ 的直线</b></p>
<p>在杂质电离为主的温度范围（饱和区）内，施主基本全部电离、本征激发可忽略，故 $n_0\approx N_D$。由质量作用定律 $n_0p_0=n_i^2$：</p>
<p>$$p_0=\frac{n_i^2}{N_D}$$</p>
<p>取对数：$\lg p_0=2\lg n_i-\lg N_D$，对 $\lg N_D$ 的斜率恒为 $-1$。这就是图中四条<b>互相平行、斜率 $-1$</b> 的直线的来源：<b>杂质浓度每增大 10 倍，少子浓度就减到 1/10</b>。</p>
<p>物理上很直观：掺杂越重，多子越多，按 $n_0p_0=n_i^2$，少子必然越少。</p>
<p class="lead"><b>二、为什么温度越高曲线越靠上</b></p>
<p>$n_i^2=N_cN_ve^{-E_g/k_0T}$ 随温度指数增大（每升 $10\ \mathrm{K}$，$n_i$ 约翻倍），同一杂质浓度下 $p_0=\frac{n_i^2}{N_D}$ 随之迅速变大。两条相邻温度曲线的竖直平移量恰为</p>
<p>$$\Delta\lg p_0=2\lg\frac{n_i(T_2)}{n_i(T_1)}$$</p>
<p>这正是图中四条线"平行且等间距上移"的原因。</p>
<p class="lead"><b>三、定量核对</b></p>
<table class="qa">
<thead><tr><th>$T$</th><th>$298\ \mathrm{K}$</th><th>$348\ \mathrm{K}$</th><th>$398\ \mathrm{K}$</th><th>$448\ \mathrm{K}$</th></tr></thead>
<tbody>
<tr><td>$n_i/\mathrm{cm^{-3}}$</td><td>$1.3\times10^{10}$</td><td>$3.7\times10^{11}$</td><td>$4.7\times10^{12}$</td><td>$3.5\times10^{13}$</td></tr>
<tr><td>$p_0$（$N_D=10^{16}$）</td><td>$1.7\times10^{4}$</td><td>$1.4\times10^{7}$</td><td>$2.2\times10^{9}$</td><td>$1.2\times10^{11}$</td></tr>
</tbody></table>
<p>计算结果与原图的直线位置、走向一致。</p>
<p class="lead"><b>四、适用范围与偏离</b></p>
<ul>
<li>前提是「杂质基本全电离（$n_0\approx N_D$）且本征激发可忽略」。<b>掺杂很重</b>（$N_D\gtrsim10^{18}$，接近简并）时施主电离度下降、且重掺杂使禁带变窄（有效 $n_i$ 增大），实际 $p_0$ 会<b>高于</b> $1/N_D$ 直线；</li>
<li><b>温度过高</b>进入本征区后 $n_0\approx n_i$，曲线不再符合该规律（图中直线族在高 $N_D$ 端弯曲就是这个原因）。</li>
</ul>`,
kp: [String.raw`饱和区 $n_0\approx N_D$`,'质量作用定律','$n_i(T)$ 的指数增长','双对数坐标斜率','偏离：简并与本征区'],
comment:String.raw`考"解释曲线"的题，答题模板是<b>「写出关系式 → 取对数 → 读出斜率/截距的物理意义 → 说明适用条件」</b>四步，而不是描述图形。本题的关键观察是：<b>四条线互相平行，说明斜率与温度无关（只由质量作用定律决定）；只整体平移，说明温度只改变截距（$2\lg n_i$）</b>。能说出这两句，就已经拿到大部分分。`
});

A.push({
pid:P(), sec:5, secTitle:S3,
label:'作业三 · 4', title:'掺 B 与 In 的 p 型 Si 中 In 的浓度',
statement:String.raw`
<p>某掺杂 B 的非简并 p 型 Si 中含有一定浓度的 In，已知 B 的浓度 $N_{A1}=10^{16}\ \mathrm{cm^{-3}}$，室温下测出空穴浓度 $p_0=1.1\times10^{16}\ \mathrm{cm^{-3}}$。已知 $N_V=1.04\times10^{19}\ \mathrm{cm^{-3}}$，B 的电离能 $\Delta E_{A1}=0.045\ \mathrm{eV}$，In 的电离能 $\Delta E_{A2}=0.16\ \mathrm{eV}$，求半导体中 In 的浓度。</p>`,
answer:String.raw`<p>$N_{\mathrm{In}}\approx3.0\times10^{15}\ \mathrm{cm^{-3}}$（其中已电离 $1.0\times10^{15}$，电离度约 $33\%$）。</p>`,
solution:String.raw`
<p class="lead"><b>一、由 $p_0$ 定 $E_F$</b></p>
<p>$$E_F-E_v=k_0T\ln\frac{N_V}{p_0}=0.0259\ln\frac{1.04\times10^{19}}{1.1\times10^{16}}=0.0259\times6.852=0.177\ \mathrm{eV}$$</p>
<p>即 $E_F$ 在价带顶上方 $0.177\ \mathrm{eV}$ 处，<b>恰在 In 能级（$0.16\ \mathrm{eV}$）之上 $0.017\ \mathrm{eV}$</b>。</p>
<p class="lead"><b>二、判断 B 是否全电离</b></p>
<p>$E_F-E_{A1}=0.177-0.045=0.132\ \mathrm{eV}\gg k_0T$，受主能级远在 $E_F$ 之下、几乎全被电子占据：</p>
<p>$$N_{A1}^-\approx N_{A1}=1.0\times10^{16}\ \mathrm{cm^{-3}}$$</p>
<p class="lead"><b>三、由电中性条件求 In 已电离的浓度</b></p>
<p>忽略本征激发（$p_0\gg n_0$），电中性条件 $p_0=N_{A1}^-+N_{A2}^-$ 给出</p>
<p>$$N_{A2}^-=p_0-N_{A1}^-=1.1\times10^{16}-1.0\times10^{16}=1.0\times10^{15}\ \mathrm{cm^{-3}}$$</p>
<p class="lead"><b>四、由电离度反推 In 的总浓度</b></p>
<p>受主电离度（简并因子 $g_A=4$）：</p>
<p>$$\frac{N_{A2}^-}{N_{\mathrm{In}}}=\frac{1}{1+g_Ae^{(E_{A2}-E_F)/k_0T}}=\frac{1}{1+4e^{-0.017/0.0259}}=\frac{1}{1+4\times0.510}=\frac{1}{3.04}=0.329$$</p>
<p>即 In 只有约 $\frac13$ 电离，故</p>
<p>$$N_{\mathrm{In}}=\frac{1.0\times10^{15}}{0.329}=\boxed{3.0\times10^{15}\ \mathrm{cm^{-3}}}$$</p>
<table class="qa">
<thead><tr><th>量</th><th>数值</th><th>说明</th></tr></thead>
<tbody>
<tr><td>$E_F-E_v$</td><td>$0.177\ \mathrm{eV}$</td><td>由 $p_0$ 决定</td></tr>
<tr><td>B 的电离度</td><td>$\approx100\%$</td><td>$E_F-E_{A1}=0.132\ \mathrm{eV}\gg k_0T$</td></tr>
<tr><td>In 的电离度</td><td>$\approx33\%$</td><td>$E_{A2}-E_F=-0.017\ \mathrm{eV}$，与 $k_0T$ 同量级</td></tr>
<tr><td>$N_{\mathrm{In}}$</td><td>$3.0\times10^{15}\ \mathrm{cm^{-3}}$</td><td>约 $\frac13$ 电离</td></tr>
</tbody></table>
<p><b>注</b>：若课程不引入简并因子（取 $g_A=1$），电离度为 $0.66$，得 $N_{\mathrm{In}}\approx1.5\times10^{15}$。本页按标准统计（$g_A=4$）给出 $3.0\times10^{15}$。</p>`,
kp:['由 $p_0$ 反求 $E_F$','受主电离度公式（$g_A=4$）','电中性条件','补偿与深能级参与电离','非简并条件'],
comment:String.raw`这道题的"题眼"是 <b>In 的电离能 $0.16\ \mathrm{eV}$ 正好卡在 $E_F$ 附近</b>——所以它只电离了三分之一，必须先算电离度、再由已电离浓度反推总浓度，<b>不能直接把 $1.0\times10^{15}$ 当成 In 的浓度</b>。这类"深受主部分电离"的题，标准顺序是：<b>$p_0\to E_F\to$ 逐个判电离度 $\to$ 电中性 $\to$ 反推总浓度</b>。另外 $p_0=1.1\times10^{16}$ 略大于 $N_{A1}$，说明确有第二个受主贡献，这是题目给的"钩子"。`
});

A.push({
pid:P(), sec:5, secTitle:S3,
label:'作业三 · 5', title:'n 型衬底与外延层：$E_F$ 与载流子浓度的四种情形',
statement:String.raw`
<p>制造某晶体管是在 n 型硅衬底上外延一层 n 型外延层，再在外延层中扩散硼、磷而成。</p>
<p>① 设 n 型硅单晶衬底是掺锑的，锑的电离能为 $0.039\ \mathrm{eV}$，300 K 时 $E_F$ 位于导带底下面 $0.026\ \mathrm{eV}$ 处，计算锑的浓度和导带中的电子浓度。</p>
<p>② 设 n 型外延层中杂质均匀分布，杂质浓度为 $4.6\times10^{15}\ \mathrm{cm^{-3}}$，计算 300 K 时 $E_F$ 的位置及电子和空穴浓度。</p>
<p>③ 在上述外延层中扩散硼后，硼的浓度分布随样品深度变化。设扩散层某一深度处硼浓度为 $5.2\times10^{15}\ \mathrm{cm^{-3}}$，计算 300 K 时 $E_F$ 的位置及电子和空穴浓度。</p>
<p>④ 如温度升高到 500 K，计算 ③ 中电子和空穴的浓度。</p>`,
answer:String.raw`<p>① $N_{\mathrm{Sb}}\approx4.4\times10^{19}\ \mathrm{cm^{-3}}$（电离度仅约 23%），$n_0\approx1.0\times10^{19}\ \mathrm{cm^{-3}}$。</p>
<p>② $E_F=E_c-0.226\ \mathrm{eV}$，$n_0=4.6\times10^{15}$，$p_0\approx4.9\times10^{4}\ \mathrm{cm^{-3}}$。</p>
<p>③ 净受主 $6.0\times10^{14}$，$E_F=E_v+0.253\ \mathrm{eV}$，$p_0=6.0\times10^{14}$，$n_0\approx3.8\times10^{5}\ \mathrm{cm^{-3}}$。</p>
<p>④ $n_i(500\ \mathrm{K})\approx1.4\times10^{14}\ \mathrm{cm^{-3}}$，需用一般解：$p_0\approx6.3\times10^{14}$，$n_0\approx3.3\times10^{13}\ \mathrm{cm^{-3}}$。</p>`,
solution:String.raw`
<p class="lead"><b>① 掺锑衬底：重掺杂 → 施主只有约 23% 电离</b></p>
<p>由 $E_F=E_c-0.026\ \mathrm{eV}$ 与 $n_0=N_ce^{-(E_c-E_F)/k_0T}$：</p>
<p>$$n_0=2.8\times10^{19}\exp\left(-\frac{0.026}{0.0259}\right)=2.8\times10^{19}\times0.366=1.03\times10^{19}\ \mathrm{cm^{-3}}$$</p>
<p>施主能级在 $E_c-0.039$，故 $E_F-E_D=0.013\ \mathrm{eV}$，电离度</p>
<p>$$\frac{N_D^+}{N_D}=\frac{1}{1+g_De^{(E_F-E_D)/k_0T}}=\frac{1}{1+2e^{0.013/0.0259}}=\frac{1}{1+2\times1.652}=0.232$$</p>
<p>由 $n_0=N_D^+$：</p>
<p>$$N_{\mathrm{Sb}}=\frac{1.03\times10^{19}}{0.232}=4.4\times10^{19}\ \mathrm{cm^{-3}}$$</p>
<p><b>要点</b>：重掺杂时 $E_F$ 已接近导带（$E_c-0.026$），与 $E_D$ 只差 $0.013\ \mathrm{eV}$，施主远未全电离，<b>杂质浓度必须显著大于电子浓度</b>。</p>
<p class="lead"><b>② 外延层 $N_D=4.6\times10^{15}$：轻掺杂 → 全部电离</b></p>
<p>$$E_c-E_F=k_0T\ln\frac{N_c}{N_D}=0.0259\ln\frac{2.8\times10^{19}}{4.6\times10^{15}}=0.0259\times8.714=0.226\ \mathrm{eV}$$</p>
<p>$$n_0=N_D=4.6\times10^{15},\qquad p_0=\frac{n_i^2}{n_0}=\frac{2.25\times10^{20}}{4.6\times10^{15}}=4.9\times10^{4}\ \mathrm{cm^{-3}}$$</p>
<p class="lead"><b>③ 扩硼后（补偿）：变成 p 型</b></p>
<p>硼 $5.2\times10^{15}>N_D=4.6\times10^{15}$，净受主</p>
<p>$$N_A'=5.2\times10^{15}-4.6\times10^{15}=6.0\times10^{14}\ \mathrm{cm^{-3}}$$</p>
<p>$$p_0\approx N_A'=6.0\times10^{14},\qquad E_F-E_v=k_0T\ln\frac{N_v}{p_0}=0.0259\ln\frac{1.04\times10^{19}}{6.0\times10^{14}}=0.253\ \mathrm{eV}$$</p>
<p>$$n_0=\frac{n_i^2}{p_0}=\frac{2.25\times10^{20}}{6.0\times10^{14}}=3.8\times10^{5}\ \mathrm{cm^{-3}}$$</p>
<p>$E_F$ 位于禁带中线（$\approx E_v+0.56$）<b>之下</b>，确为 p 型。</p>
<p class="lead"><b>④ 升到 500 K：本征激发不可忽略，必须用一般解</b></p>
<p>$$n_i(500\ \mathrm{K})\approx1.5\times10^{10}\left(\frac{500}{300}\right)^{3/2}\exp\left[\frac{1.09}{2k_0}\left(\frac1{300}-\frac1{500}\right)\right]\approx1.4\times10^{14}\ \mathrm{cm^{-3}}$$</p>
<p>已与净掺杂 $6.0\times10^{14}$ 同量级，不能再用 $p_0=N_A'$，改用</p>
<p>$$p_0=\frac{N_A'+\sqrt{N_A'^2+4n_i^2}}{2}=\frac{6.0\times10^{14}+\sqrt{3.6\times10^{29}+7.8\times10^{28}}}{2}=6.3\times10^{14}$$</p>
<p>$$n_0=\frac{n_i^2}{p_0}=\frac{1.96\times10^{28}}{6.3\times10^{14}}=3.3\times10^{13}\ \mathrm{cm^{-3}}$$</p>
<p>（校验 $p_0-n_0=6.0\times10^{14}=N_A'$ ✓。）<b>与 ③ 相比，少子（电子）浓度从 $3.8\times10^{5}$ 猛增到 $3.3\times10^{13}$，涨了 8 个数量级</b>——这就是「高温下少子暴增、器件漏电失效」的定量说明。</p>`,
kp: ['重掺杂下施主不完全电离',String.raw`$E_c-E_F=k_0T\ln(N_c/N_D)$`,'补偿后净杂质','本征区的一般解（二次方程）','$n_i(T)$ 的指数增长'],
comment:String.raw`四个小问其实在练同一件事：<b>先判温区与补偿，再选公式</b>。① 是「重掺杂→不能假设全电离」，③ 是「补偿→取净杂质」，④ 是「高温→不能忽略 $n_i$」。最常见的错法是四个小问都用 $n_0=N_D$、$p_0=n_i^2/N_D$ 一把梭，那样 ① 会把 $N_{\mathrm{Sb}}$ 少算 4 倍、④ 会把少子少算 8 个数量级。`
});

A.push({
pid:P(), sec:5, secTitle:S3,
label:'作业三 · 6', title:'掺砷 n 型硅「饱和区」的掺杂浓度范围',
statement:String.raw`
<p>以施主杂质电离 $90\%$ 作为强电离的标准，求掺砷的 n 型硅在 300 K 时，以杂质电离为主的饱和区掺杂质的浓度范围。</p>`,
answer:String.raw`<p>$1.5\times10^{11}\ \mathrm{cm^{-3}}\lesssim N_D\lesssim2.3\times10^{17}\ \mathrm{cm^{-3}}$。</p>
<p>下限由「本征激发可忽略（$N_D\gg n_i$）」给出，上限由「施主电离度 $\ge90\%$」给出。</p>`,
solution:String.raw`
<p class="lead"><b>一、上限：由「$90\%$ 电离」定</b></p>
<p>砷在 Si 中 $\Delta E_D=0.049\ \mathrm{eV}$（取教材常见值），施主电离度（$g_D=2$）</p>
<p>$$\frac{N_D^+}{N_D}=\frac{1}{1+g_De^{(E_F-E_D)/k_0T}}=0.9\;\Longrightarrow\;e^{(E_F-E_D)/k_0T}=\frac{1}{9g_D}=0.0556$$</p>
<p>$$E_F-E_D=-k_0T\ln(18)=-0.0259\times2.890=-0.0749\ \mathrm{eV}$$</p>
<p>$$E_F=E_D-0.0749=(E_c-0.049)-0.0749=E_c-0.124\ \mathrm{eV}$$</p>
<p>此时导带电子浓度</p>
<p>$$n_0=N_ce^{-(E_c-E_F)/k_0T}=2.8\times10^{19}e^{-0.124/0.0259}=2.8\times10^{19}\times8.4\times10^{-3}=2.3\times10^{17}\ \mathrm{cm^{-3}}$$</p>
<p>即 $N_D$ 若超过约 $2.3\times10^{17}\ \mathrm{cm^{-3}}$，300 K 时施主电离度就低于 $90\%$，不再满足「强电离」标准。</p>
<p class="lead"><b>二、下限：由「以杂质电离为主」定</b></p>
<p>要求本征激发可忽略，即多子浓度主要由杂质提供：</p>
<p>$$n_0\approx N_D\gg n_i$$</p>
<p>工程上取 $N_D\ge10n_i=1.5\times10^{11}\ \mathrm{cm^{-3}}$。</p>
<p class="lead"><b>三、结论</b></p>
<p>$$\boxed{1.5\times10^{11}\ \mathrm{cm^{-3}}\lesssim N_D\lesssim2.3\times10^{17}\ \mathrm{cm^{-3}}}$$</p>
<p>在此范围内 $n_0\approx N_D$ 成立、载流子浓度几乎不随温度变化，这就是 $n_0\!-\!T$ 曲线上的<b>饱和区（强电离区）</b>。</p>
<p>注：若不引入简并因子（$g_D=1$），上限为 $4.6\times10^{17}$；若取 $g_D=2$ 但用 $\Delta E_D=0.045$，上限约为 $2.6\times10^{17}$——<b>量级不变</b>。</p>`,
kp: ['电离度公式','强电离判据 90%','饱和区',String.raw`$N_D\gg n_i$ 判据`,'掺杂上限与固溶度'],
comment:String.raw`这题的答案<b>不是一个数，而是一个区间</b>，两端来自两个不同的物理要求，答题时务必分开写清「上限由电离度定、下限由本征激发可忽略定」。很多人只算上限就交卷，丢掉一半分。另外要意识到「饱和区上限」的现实意义：<b>掺杂越重，工作温度上限越低</b>（高温下电离度下降、器件失效），这与基础练习里「掺杂浓度增加，最高工作温度升高、最低工作温度降低」那道填空题正好互补。`
});

/* ================= 作业四 ================= */
const S4 = '06 · 作业四 · 输运与非平衡载流子';

A.push({
pid:P(), sec:6, secTitle:S4,
label:'作业四 · 1', title:'什么是载流子的散射？说明散射的物理意义',
statement:String.raw`
<p>什么是载流子的散射？说明散射的物理意义。</p>`,
answer:String.raw`<p><b>散射</b>：载流子在晶体中运动时与晶格振动（声子）、电离杂质、缺陷及其他载流子相互作用，使速度的大小和方向发生随机突变的过程。<b>物理意义</b>：它把外场驱动的定向加速不断"打断"成随机运动，使漂移速度饱和于 $v_d=\mu E$，从而<b>决定迁移率、电阻率与一切输运量</b>，是宏观欧姆定律的微观起源。</p>`,
solution:String.raw`
<p class="lead"><b>一、散射是什么</b></p>
<p>载流子一方面做无规则热运动（室温热速度 $\sim10^{7}\ \mathrm{cm/s}$），另一方面在外场下做定向运动。运动过程中与<b>晶格原子（热振动）、电离杂质、缺陷、其他载流子</b>发生"碰撞"，速度发生随机突变，这就是散射（旧称"碰撞"）。两次散射之间的运动叫<b>自由运动</b>，其平均时间称<b>平均自由时间</b>（弛豫时间）$\tau$，平均距离称平均自由程 $l$。散射强弱用散射概率 $P=\frac1\tau$ 描述。</p>
<p class="lead"><b>二、物理意义</b></p>
<ul>
<li><b>建立"加速—散射"动态平衡，使漂移速度有限。</b>若没有散射，恒电场下载流子会一直加速、电流无限增大。有散射后，每飞行 $\tau$ 就损失一次定向速度，稳态下 $v_d=\dfrac{q\tau}{m^*}E=\mu E$——<b>这是从微观散射过渡到宏观欧姆定律的关键一步</b>。</li>
<li><b>决定迁移率与电导率</b>：$\mu=\dfrac{q\tau}{m^*}$，$\sigma=nq\mu$。散射越强（$\tau$ 越小），迁移率越低、电阻率越高。</li>
<li><b>决定"哪种散射主导"随温度、掺杂的转换</b>：低温、重掺杂时电离杂质散射为主；高温、轻掺杂时晶格（声学波）散射为主。这就是 $\mu\!-\!T$ 曲线出现极大值的原因。</li>
<li><b>是热电子、速度饱和、Gunn 效应的物理基础</b>：强场下载流子能量升高，光学波／谷间散射增强，导致速度饱和（Si）或负微分电导（GaAs）。</li>
</ul>
<p class="lead"><b>三、几种主要散射机构</b></p>
<table class="qa">
<thead><tr><th>机构</th><th>起因</th><th>$\mu$ 的温度依赖</th></tr></thead>
<tbody>
<tr><td>声学波（形变势）</td><td>纵声学波引起晶格形变</td><td>$\mu_L\propto T^{-3/2}$（$T\uparrow$，$\mu\downarrow$）</td></tr>
<tr><td>电离杂质</td><td>库仑势场</td><td>$\mu_I\propto T^{3/2}/N_I$（$T\uparrow$，$\mu\uparrow$）</td></tr>
<tr><td>极性光学波</td><td>纵光学波引起极化</td><td>$\mu\propto(e^{\theta/T}-1)$（$T\uparrow$，$\mu\uparrow$）</td></tr>
<tr><td>谷间散射</td><td>等价谷之间跃迁</td><td>高温、强场显著（GaAs 负微分电导）</td></tr>
</tbody></table>`,
kp: ['散射与平均自由时间',String.raw`$\mu=q\tau/m^*$`,'散射机构与温度依赖','速度饱和'],
comment:String.raw`「散射的物理意义」不能只答"载流子碰撞"，要点出<b>它是欧姆定律的微观机制</b>：没有散射就没有稳态漂移速度，电流会随时间无限增长。建议答题时配一句定量的话：<b>$\tau\approx10^{-13}\ \mathrm{s}$、$v_d\approx10^{7}\ \mathrm{cm/s}$（$E=10^{3}\ \mathrm{V/cm}$ 时），比热速度小两个数量级</b>——有数才显得真的理解。`
});

A.push({
pid:P(), sec:6, secTitle:S4,
label:'作业四 · 2', title:'结合 GaAs 能带结构解释高场负微分电导',
statement:String.raw`
<p>结合 GaAs 能带结构简述 GaAs 在高场下产生负微分电导效应的原因。</p>`,
answer:String.raw`<p>GaAs 的 $\Gamma$ 谷（$m^*=0.067m_0$、迁移率高）与 $L$ 谷（$m^*\approx0.55m_0$、迁移率低）能量差仅 $\approx0.29\ \mathrm{eV}$。电场增强使电子获得足够能量<b>从 $\Gamma$ 谷转移到 $L$ 谷（谷间转移）</b>，平均迁移率骤降，漂移速度随电场增大反而<b>下降</b>，即 $I\!-\!V$ 出现负斜率（Gunn 效应）。</p>`,
solution:String.raw`
<p class="lead"><b>一、能带前提</b></p>
<ul>
<li>GaAs 是<b>直接带隙</b>，导带极小在 $\Gamma$ 点，$m^*=0.067m_0$、$\mu\approx8500\ \mathrm{cm^2/(V\cdot s)}$，电子很"轻"。</li>
<li>沿 $\langle111\rangle$ 方向的 $L$ 点还有一组<b>卫星谷</b>（8 个等价谷），能量比 $\Gamma$ 谷高 $\Delta E_{\Gamma L}\approx0.29\ \mathrm{eV}$；$L$ 谷电子有效质量约 $0.55m_0$（大 8 倍）、迁移率低一个数量级，且 $L$ 谷处态密度大（能容纳更多电子）。</li>
</ul>
<p class="lead"><b>二、负微分电导的机制（三步）</b></p>
<ul>
<li><b>低场</b>：电子几乎全在 $\Gamma$ 谷，$v_d=\mu_\Gamma E$ 线性上升；</li>
<li><b>中场</b>（$E\gtrsim3\ \mathrm{kV/cm}$）：一部分电子被电场"加热"到能量超过 $0.29\ \mathrm{eV}$，通过<b>谷间散射</b>转入 $L$ 谷。$L$ 谷电子重、迁移率低，<b>平均迁移率下降</b>；</li>
<li><b>高场</b>：转移比例继续增大，虽然电场更大，但<b>$v_d=\mu(E)E$ 随 $E$ 反而下降</b>——微分电导 $\dfrac{\mathrm dJ}{\mathrm dE}&lt;0$，即负微分电导。</li>
</ul>
<p>当全部电子都转移到 $L$ 谷后，$v_d$ 重新随 $E$ 上升（饱和段）。所以 $v\!-\!E$ 曲线呈<b>"上升—峰值—下降—再上升"</b>的 N 形，峰值速度约 $2\times10^{7}\ \mathrm{cm/s}$、阈值电场约 $3.2\ \mathrm{kV/cm}$。</p>
<p class="lead"><b>三、为什么能形成 Gunn 振荡</b></p>
<p>负微分电导使样品中电场分布不稳定：局部高场区的电子转移到 $L$ 谷、电阻变大，形成<b>高场畴（偶极畴）</b>；畴以约 $10^{7}\ \mathrm{cm/s}$ 的速度向阳极漂移、到达阳极后消失，电流随之周期变化——这就是 Gunn 二极管的微波振荡（几 GHz～几十 GHz）。</p>
<p class="lead"><b>四、对比：Si 为什么没有</b></p>
<p>Si 的导带极小本身就在 $\langle100\rangle$ 的 $\Delta$ 线，卫星谷（$L$、$X$）能量高得多（$\gtrsim1\ \mathrm{eV}$），强场下电子只能被光学波散射"加热"而<b>速度饱和</b>，不会出现谷间转移的负微分电导。</p>`,
kp: [String.raw`GaAs 的 $\Gamma$/$L$/$X$ 谷`,'谷间转移','负微分电导与 Gunn 效应','速度饱和','高场畴'],
comment:String.raw`答题要点是<b>「两个谷的能量差足够小、$L$ 谷质量足够大」</b>这两个条件，缺一不成：能量差大则电子到不了 $L$ 谷；质量不大则转移后迁移率不会骤降。很多人只写"电子转移到卫星谷、迁移率下降"，没写<b>为什么迁移率下降（质量大、散射强）</b>，也没写<b>为什么 $v_d$ 会随 $E$ 下降（$\mu(E)$ 下降快于 $E$ 上升）</b>，这两句才是得分点。`
});

A.push({
pid:P(), sec:6, secTitle:S4,
label:'作业四 · 3', title:'间接复合的四个微观过程及其影响因素',
statement:String.raw`
<p>请简要描述间接复合的四个微观过程，并说明这些过程与哪些因素有关。</p>`,
answer:String.raw`<p>① <b>电子俘获</b> $c_n=r_nnN_t$（与电子浓度、俘获系数、复合中心浓度有关）；② <b>电子发射</b> $e_n=e_{n1}N_t$（只与温度有关）；③ <b>空穴俘获</b> $c_p=r_ppN_t$（与空穴浓度有关）；④ <b>空穴发射</b> $e_p$（只与温度有关）。平衡时 $e_n=r_nn_1$、$e_p=r_pp_1$，故发射过程只由温度与能级位置决定。</p>`,
solution:String.raw`
<p class="lead"><b>一、四个过程</b></p>
<table class="qa">
<thead><tr><th>过程</th><th>物理图像</th><th>速率</th><th>与什么有关</th></tr></thead>
<tbody>
<tr><td>① 电子俘获</td><td>导带电子落入复合中心能级 $E_t$</td><td>$c_n=r_n\,n\,N_t$</td><td>电子浓度 $n$、电子俘获系数 $r_n=\sigma_nv_{th}$、未被占据的中心数</td></tr>
<tr><td>② 电子发射</td><td>中心上的电子热激发回导带</td><td>$e_n=e_{n1}N_t=r_nn_1N_t$</td><td><b>只与温度</b>（通过 $n_1=N_ce^{-(E_c-E_t)/k_0T}$）及 $E_t$ 位置</td></tr>
<tr><td>③ 空穴俘获</td><td>中心上的电子与价带空穴复合（等价于空穴被中心俘获）</td><td>$c_p=r_p\,p\,N_t$</td><td>空穴浓度 $p$、空穴俘获系数 $r_p$</td></tr>
<tr><td>④ 空穴发射</td><td>中心从价带获得电子（等价于向价带发射空穴）</td><td>$e_p=e_{p1}N_t=r_pp_1N_t$</td><td><b>只与温度</b>（$p_1=N_ve^{-(E_t-E_v)/k_0T}$）</td></tr>
</tbody></table>
<p class="lead"><b>二、净复合率</b></p>
<p>稳态下中心占有率不随时间变，得 SRH 复合率</p>
<p>$$U=\frac{r_nr_pN_t\left(np-n_i^2\right)}{r_n\left[n+n_1\right]+r_p\left[p+p_1\right]}$$</p>
<p>小注入、强 n 型（$n\approx n_0\gg p$，$r_nn\gg r_pp$）时化简为</p>
<p>$$U\approx\frac{\Delta p}{\tau_p},\qquad \tau_p=\frac{1}{r_pN_t}$$</p>
<p>即<b>少子寿命只由少子（空穴）俘获系数与复合中心浓度决定，与多子浓度无关</b>。</p>
<p class="lead"><b>三、几个结论</b></p>
<ul>
<li><b>最有效的复合中心能级在禁带中央附近</b>（$E_t\approx E_i$）：此时 $n_1$、$p_1$ 都小，$U$ 最大。若 $E_t$ 靠近带边，中心刚俘获就立刻发射回去，净复合很小 → 变成<b>陷阱</b>而非复合中心。</li>
<li><b>俘获系数越大、中心浓度越高，寿命越短</b>。</li>
<li>温度升高时 $n_1,p_1$ 增大，$U$ 减小、寿命变长（这也是深能级复合随温度减弱的原因）。</li>
</ul>`,
kp: ['SRH 复合','俘获过程与发射过程','$n_1,p_1$ 与温度',String.raw`少子寿命 $\tau=1/(r_pN_t)$`,'有效复合中心位置'],
comment:String.raw`这题的关键区分是<b>「俘获 vs 发射」</b>：俘获的速率正比于<b>载流子浓度</b>，发射的速率只由<b>温度</b>控制（因为它是一个热激发过程，与外面有多少载流子无关）。所以基础练习里那句「与导带电子浓度有关的是电子俘获过程，只与温度有关的是发射过程」就是从这里来的。`
});

A.push({
pid:P(), sec:6, secTitle:S4,
label:'作业四 · 4', title:'复合中心与陷阱中心的区别',
statement:String.raw`
<p>描述复合中心和陷阱中心的区别。</p>`,
answer:String.raw`<p><b>复合中心</b>：能级靠近禁带中央、对电子与空穴的俘获概率相当，能连续完成"俘获电子→俘获空穴"两步，<b>使电子—空穴对真正消失</b>（净复合）；<b>陷阱</b>：只能俘获一种载流子，且俘获后很快再热发射回<b>原能带</b>，净效果是暂时储存而非复合。判据：能级偏离 $E_i$ 越远、对两种载流子的俘获截面差别越大，越像陷阱。</p>`,
solution:String.raw`
<p class="lead"><b>一、定义上的区别</b></p>
<table class="qa">
<thead><tr><th>项目</th><th>复合中心</th><th>陷阱中心</th></tr></thead>
<tbody>
<tr><td>功能</td><td>使导带电子与价带空穴<b>成对消失</b></td><td><b>暂时俘获</b>载流子，之后再释放回原带</td></tr>
<tr><td>能级位置</td><td><b>靠近禁带中央 $E_i$</b></td><td><b>偏离 $E_i$ 较远</b>（靠近某一带边）</td></tr>
<tr><td>俘获截面</td><td>$r_n\approx r_p$（对两种载流子都"抓得住"）</td><td>$r_n\gg r_p$（电子陷阱）或反之（空穴陷阱）</td></tr>
<tr><td>过程</td><td>俘获电子 → 俘获空穴（或反之），两步</td><td>俘获 → <b>热发射回原带</b>（一步）</td></tr>
<tr><td>对寿命</td><td>显著降低少子寿命</td><td>改变有效寿命、造成延迟与滞后</td></tr>
<tr><td>宏观效应</td><td>反向漏电（产生中心）、发光效率下降</td><td>开关延迟、频率响应变差、噪声、1/f 噪声</td></tr>
</tbody></table>
<p class="lead"><b>二、判据的定量表述</b></p>
<p>由 SRH 理论，若 $E_t$ 靠近 $E_c$，则 $n_1=N_ce^{-(E_c-E_t)/k_0T}$ 很大、$p_1$ 很小：电子被俘获后几乎立刻被发射回导带（因为 $e_n$ 很大），来不及等空穴来复合 → <b>只起陷阱作用</b>。反之 $E_t\approx E_i$ 时 $n_1\approx p_1\approx n_i$，两种俘获速率相当，最容易完成"两步"→ <b>有效复合中心</b>。</p>
<p>实用判据：<b>$\left|E_t-E_i\right|\lesssim$ 几个 $k_0T$ → 复合中心；$\left|E_t-E_i\right|$ 大（$\gtrsim0.1\ \mathrm{eV}$）→ 陷阱。</b></p>
<p class="lead"><b>三、同一能级可以"两副面孔"</b></p>
<p>复合／陷阱的划分不是绝对的，取决于<b>工作条件</b>：</p>
<ul>
<li>对电子陷阱而言，<b>$E_t$ 在 $E_F$ 之上且越接近 $E_F$，陷阱效应越明显</b>（因为此时电子被俘获后不易再发射，储存作用强）；</li>
<li>低温下发射率小，陷阱效应强；高温下发射率大，陷阱"漏"得快，作用减弱；</li>
<li>大注入时 quasi-Fermi 能级移动，同一中心可能从陷阱变成复合中心。</li>
</ul>`,
kp:['复合中心','陷阱中心','俘获截面比','能级位置与 $E_i$ 的关系','有效复合中心判据'],
comment:String.raw`一句话概括：<b>复合中心"收两次"（电子和空穴），陷阱"收一次再退回"</b>。答题时最好把判据落到数字上：$|E_t-E_i|$ 越小越像复合中心，越小越好；同时点出<b>陷阱效应与 $E_F$ 的相对位置有关</b>——这一句是区分"背过"和"懂了"的地方。`
});

A.push({
pid:P(), sec:6, secTitle:S4,
label:'作业四 · 5', title:'掺 P 硅的光照注入：浓度、注入水平与费米能级变化',
statement:String.raw`
<p>室温时一掺 P 浓度为 $10^{16}\ \mathrm{cm^{-3}}$ 的 Si 半导体中，在均匀光照下注入非平衡载流子，产生率为 $10^{22}\ \mathrm{cm^{-3}s^{-1}}$，寿命为 $5\ \mu\mathrm{s}$。室温时 $n_i=1.5\times10^{10}\ \mathrm{cm^{-3}}$。</p>
<p>(1) 计算载流子浓度，并说明是大注入还是小注入；(2) 光照前后的费米能级变化；(3) 停止注入 $30\ \mu\mathrm{s}$ 后的载流子浓度，此时是大注入还是小注入。</p>`,
answer:String.raw`<p>(1) $\Delta n=\Delta p=G\tau=5\times10^{16}\ \mathrm{cm^{-3}}$，$n=6\times10^{16}$、$p=5\times10^{16}$；<b>大注入</b>（$\Delta n\gg n_0$）。</p>
<p>(2) 光照前 $E_F=E_i+0.347\ \mathrm{eV}$；光照后 $E_{Fn}=E_i+0.394\ \mathrm{eV}$（上移 $0.047\ \mathrm{eV}$），$E_{Fp}=E_i-0.389\ \mathrm{eV}$（下移 $0.736\ \mathrm{eV}$），<b>准费米能级分裂约 $0.78\ \mathrm{eV}$</b>。</p>
<p>(3) $\Delta n=5\times10^{16}e^{-6}=1.2\times10^{14}$，$n\approx1.01\times10^{16}$、$p\approx1.2\times10^{14}$，<b>已转为小注入</b>。</p>`,
solution:String.raw`
<p class="lead"><b>一、注入浓度</b></p>
<p>稳态注入：$\Delta n=\Delta p=G\tau=10^{22}\times5\times10^{-6}=5\times10^{16}\ \mathrm{cm^{-3}}$。</p>
<p>n 型，$n_0\approx N_D=10^{16}$，$p_0=\dfrac{n_i^2}{n_0}=\dfrac{2.25\times10^{20}}{10^{16}}=2.25\times10^{4}\ \mathrm{cm^{-3}}$。</p>
<p>$$n=n_0+\Delta n=6\times10^{16},\qquad p=p_0+\Delta p\approx5\times10^{16}\ \mathrm{cm^{-3}}$$</p>
<p><b>判断注入水平</b>：$\Delta n=5\times10^{16}>n_0=10^{16}$，<b>大注入</b>。（注意：不是与 $n_i$ 比！）</p>
<p class="lead"><b>二、费米能级的变化</b></p>
<p>光照<b>前</b>（热平衡，统一 $E_F$）：</p>
<p>$$E_F-E_i=k_0T\ln\frac{n_0}{n_i}=0.0259\ln\frac{10^{16}}{1.5\times10^{10}}=0.0259\times13.41=0.347\ \mathrm{eV}$$</p>
<p>光照<b>后</b>（非平衡，用准费米能级）：</p>
<p>$$E_{Fn}-E_i=k_0T\ln\frac{n}{n_i}=0.0259\ln\frac{6\times10^{16}}{1.5\times10^{10}}=0.0259\times15.20=0.394\ \mathrm{eV}$$</p>
<p>$$E_i-E_{Fp}=k_0T\ln\frac{p}{n_i}=0.0259\ln\frac{5\times10^{16}}{1.5\times10^{10}}=0.0259\times15.02=0.389\ \mathrm{eV}$$</p>
<p>即</p>
<ul>
<li>电子准费米能级比原 $E_F$ <b>上移 $0.047\ \mathrm{eV}$</b>（很小，因为多子浓度变化不大）；</li>
<li>空穴准费米能级在原 $E_F$ 下方 $0.347+0.389=0.736\ \mathrm{eV}$，<b>下移 $0.736\ \mathrm{eV}$</b>（很大，因为少子浓度涨了 12 个数量级）；</li>
<li>两者分裂 $E_{Fn}-E_{Fp}=k_0T\ln\dfrac{np}{n_i^2}=0.78\ \mathrm{eV}$。</li>
</ul>
<p class="lead"><b>三、停止注入 30 μs 后</b></p>
<p>$$\Delta n=\Delta n_0e^{-t/\tau}=5\times10^{16}e^{-30/5}=5\times10^{16}\times2.48\times10^{-3}=1.24\times10^{14}\ \mathrm{cm^{-3}}$$</p>
<p>$$n=n_0+\Delta n=1.01\times10^{16},\qquad p=p_0+\Delta p\approx1.24\times10^{14}\ \mathrm{cm^{-3}}$$</p>
<p><b>此时 $\Delta n=1.2\times10^{14}\ll n_0=10^{16}$，已转为小注入。</b></p>`,
kp: [String.raw`$\Delta n=G\tau$`,'大注入/小注入判据','准费米能级','费米能级分裂',String.raw`指数衰减 $e^{-t/\tau}$`],
comment:String.raw`三个小问各埋一个坑：① <b>判注入水平要跟 $n_0$ 比，不是跟 $n_i$ 比</b>；② <b>大注入下 $E_F$ 已不适用</b>，必须换成准费米能级，而且「多子准费米能级几乎不动、少子准费米能级剧烈移动」是普遍规律；③ <b>同一次衰减实验里注入水平会变化</b>——$t=30\ \mu s=6\tau$ 后注入已衰减 400 倍，从小注入变回大注入。这也解释了为什么「少子寿命是常数」只在小注入下成立。`
});

A.push({
pid:P(), sec:6, secTitle:S4,
label:'作业四 · 6', title:'掺 Au 硅样品：估计 Au 浓度与载流子浓度',
statement:String.raw`
<p>某掺杂 Au 的硅样品中 As 的浓度为 $10^{15}\ \mathrm{cm^{-3}}$，在小注入条件下测得其少子寿命为 $10^{-8}\ \mathrm{s}$，$N_c=2.8\times10^{19}\ \mathrm{cm^{-3}}$。已知室温时 $n_i=1.5\times10^{10}\ \mathrm{cm^{-3}}$，空穴复合系数 $r_p=1.15\times10^{-7}\ \mathrm{cm^{3}/s}$。试估计样品中 Au 杂质的浓度，以及载流子浓度。</p>`,
answer:String.raw`<p>$N_{\mathrm{Au}}\approx8.7\times10^{14}\ \mathrm{cm^{-3}}$；补偿后 $n_0\approx1.3\times10^{14}\ \mathrm{cm^{-3}}$，$p_0\approx1.7\times10^{6}\ \mathrm{cm^{-3}}$。</p>`,
solution:String.raw`
<p class="lead"><b>一、由少子寿命反求复合中心浓度</b></p>
<p>n 型、小注入、强电离时，SRH 公式化简为</p>
<p>$$\tau_p=\frac{1}{r_pN_t}\;\Longrightarrow\;N_{\mathrm{Au}}=N_t=\frac{1}{r_p\tau_p}=\frac{1}{1.15\times10^{-7}\times10^{-8}}=8.7\times10^{14}\ \mathrm{cm^{-3}}$$</p>
<p class="lead"><b>二、Au 在 n 型 Si 中起受主作用（补偿施主）</b></p>
<p>Au 在 Si 中有两个能级：施主能级 $E_v+0.35\ \mathrm{eV}$、受主能级 $E_c-0.54\ \mathrm{eV}$。n 型中 $E_F$ 靠近导带（$E_c-0.18\ \mathrm{eV}$），<b>受主能级在 $E_F$ 之下 → 被电子填满 → 带负电（Au⁻）</b>，起受主作用；施主能级远在 $E_F$ 之下、被填满，故呈中性、不贡献。</p>
<p>于是有效施主浓度</p>
<p>$$N_D^{\mathrm{eff}}=N_{\mathrm{As}}-N_{\mathrm{Au}}=1.0\times10^{15}-8.7\times10^{14}=1.3\times10^{14}\ \mathrm{cm^{-3}}$$</p>
<p class="lead"><b>三、载流子浓度</b></p>
<p>$$n_0\approx N_D^{\mathrm{eff}}=1.3\times10^{14}\ \mathrm{cm^{-3}},\qquad p_0=\frac{n_i^2}{n_0}=\frac{2.25\times10^{20}}{1.3\times10^{14}}=1.7\times10^{6}\ \mathrm{cm^{-3}}$$</p>
<p>校验自洽性：$E_c-E_F=k_0T\ln\dfrac{N_c}{n_0}=0.0259\ln\dfrac{2.8\times10^{19}}{1.3\times10^{14}}=0.32\ \mathrm{eV}$，$E_F$ 仍在禁带上半部；受主能级 $E_c-0.54=E_v+0.58$ 远在 $E_F$ 之下 ✓，施主能级 $E_v+0.35$ 也在 $E_F$（$\approx E_v+0.54$）之下 ✓，与前面判断一致。</p>
<p class="lead"><b>四、结语</b></p>
<p>掺 Au 的浓度（$8.7\times10^{14}$）与 As 浓度（$10^{15}$）几乎相当，<b>补偿掉了 87% 的施主</b>，使电子浓度从 $10^{15}$ 降到 $1.3\times10^{14}$；同时 Au 作为复合中心把少子寿命压到 $10\ \mathrm{ns}$。这正是「金掺杂快恢复二极管」的原理：<b>用深能级杂质换速度</b>。</p>`,
kp: [String.raw`$\tau_p=1/(r_pN_t)$`,'Au 的双能级（施主＋受主）','深能级的补偿作用','有效施主浓度','金掺杂控寿命'],
comment:String.raw`这道题考的是<b>「深能级的两副面孔」</b>：同一批 Au 原子既做复合中心（决定 $\tau$）、又做受主（决定 $n_0$），二者要用同一个浓度 $N_t$ 串起来。<b>最容易错的是忘记补偿</b>，直接把 $n_0=10^{15}$ 写上去——那样 $p_0$ 会小 8 倍，且与"少子寿命 10 ns"矛盾。另外要会判断「哪个能级在 $E_F$ 之下」：n 型中只有受主能级起作用，这与基础练习里「Au 在 n 型 Si 中只有受主能级起作用、Au⁺ 对电子的俘获决定少子寿命」是同一考点。`
});

A.push({
pid:P(), sec:6, secTitle:S4,
label:'作业四 · 7', title:'N 型 Ge 的光电导电流密度',
statement:String.raw`
<p>室温下，一束恒定光源照在掺杂浓度为 $10^{15}\ \mathrm{cm^{-3}}$ 的 N 型 Ge 上，内部均匀产生载流子，每秒产生电子—空穴对为 $10^{14}\ \mathrm{cm^{-3}}$。同时外加强度 $E=10\ \mathrm{V/cm}$ 的电场。若 $n_i=2\times10^{13}\ \mathrm{cm^{-3}}$，电子和空穴的迁移率分别为 $3800$、$1800\ \mathrm{cm^2/(V\cdot s)}$，载流子寿命为 $10\ \mu\mathrm{s}$，试求半导体中的电流密度。</p>`,
answer:String.raw`<p>$J\approx6.1\ \mathrm{A/cm^2}$。注入的附加电导只占 $10^{-6}$ 量级，可忽略；电流几乎全部由多子（电子）漂移贡献。</p>`,
solution:String.raw`
<p class="lead"><b>一、平衡载流子</b></p>
<p>$$n_0=N_D=10^{15}\ \mathrm{cm^{-3}},\qquad p_0=\frac{n_i^2}{n_0}=\frac{4\times10^{26}}{10^{15}}=4\times10^{11}\ \mathrm{cm^{-3}}$$</p>
<p class="lead"><b>二、非平衡载流子</b></p>
<p>稳态下 $\Delta n=\Delta p=G\tau=10^{14}\times10^{-5}=10^{9}\ \mathrm{cm^{-3}}$，<b>远小于 $n_0$ → 小注入</b>。</p>
<p>$$n=n_0+\Delta n\approx1.000001\times10^{15},\qquad p=p_0+\Delta p=4\times10^{11}+10^{9}\approx4\times10^{11}$$</p>
<p class="lead"><b>三、电流密度</b></p>
<p>$$J=q\left(n\mu_n+p\mu_p\right)E$$</p>
<p>先算括号内：</p>
<p>$$n\mu_n=10^{15}\times3800=3.80\times10^{18},\qquad p\mu_p=4\times10^{11}\times1800=7.2\times10^{14}$$</p>
<p>空穴项比电子项小 4 个数量级，可忽略：</p>
<p>$$J=1.602\times10^{-19}\times3.80\times10^{18}\times10=\boxed{6.1\ \mathrm{A/cm^2}}$$</p>
<p class="lead"><b>四、讨论：光电导贡献有多大</b></p>
<p>$$\frac{\Delta\sigma}{\sigma_0}=\frac{(\mu_n+\mu_p)\Delta p}{\mu_nn_0}=\frac{(3800+1800)\times10^{9}}{3800\times10^{15}}=1.5\times10^{-6}$$</p>
<p>即<b>光照只使电导率增加百万分之一点五</b>，对总电流几乎没有影响。这说明：<b>要用电导（光电导）方法测非平衡载流子，必须用高阻、少子寿命长的材料</b>；本征 Ge（$n_i=2\times10^{13}$）比掺杂 Ge 灵敏得多。</p>`,
kp: [String.raw`$J=q(n\mu_n+p\mu_p)E$`,String.raw`$\Delta n=G\tau$`,'小注入判据',String.raw`光电导 $\Delta\sigma/\sigma_0$`,'多子导电'],
comment:String.raw`这道题看起来是"套公式"，其实考<b>量级意识</b>：先算 $\Delta n=G\tau=10^{9}$，再看它比 $n_0=10^{15}$ 小 6 个数量级，就知道"光电导可以忽略"——这一步比算出 6.1 更重要。考试里若题目问"光电导是否显著"，答"$10^{-6}$，不显著"才拿到分。<b>顺带记住：本征 Ge 的 $n_i=2\times10^{13}$ 比掺杂浓度还小两个数量级，所以它是"重掺杂"，不是本征。</b>`
});

A.push({
pid:P(), sec:6, secTitle:S4,
label:'作业四 · 8', title:'表面光生载流子的电导率与电流密度',
statement:String.raw`
<p>某 n 型长 Si 半导体中均匀掺杂，施主浓度为 $5\times10^{14}\ \mathrm{cm^{-3}}$，室温下杂质全部电离。如图，光照其 A 表面，表面均匀产生浓度为 $10^{14}\ \mathrm{cm^{-3}}$ 的载流子。已知室温时 Si 的本征载流子浓度为 $1.5\times10^{10}\ \mathrm{cm^{-3}}$，电子和空穴迁移率分别为 $1350$、$500\ \mathrm{cm^2V^{-1}s^{-1}}$，载流子寿命为 $30\ \mu\mathrm{s}$，室温下：</p>
<p>(1) 计算光照时半导体 A 表面的电导率；</p>
<p>(2) 若在半导体两侧施加电场 $10\ \mathrm{V/cm}$。计算光照停止 $3\ \mu\mathrm{s}$ 后，距离 A 表面 $10\ \mu\mathrm{m}$ 处的电流密度。</p>`,
answer:String.raw`<p>(1) $\sigma\approx0.138\ \mathrm{S/cm}$（$\rho\approx7.3\ \Omega\cdot\mathrm{cm}$）。</p>
<p>(2) $L_p\approx197\ \mu\mathrm{m}$，$\Delta p(10\ \mu\mathrm{m},3\ \mu\mathrm{s})\approx8.6\times10^{13}$；漂移电流 $1.34\ \mathrm{A/cm^2}$、少子扩散电流 $9\times10^{-3}\ \mathrm{A/cm^2}$，<b>合计约 $1.35\ \mathrm{A/cm^2}$</b>。</p>`,
solution:String.raw`
<p class="lead"><b>一、光照时 A 表面的电导率</b></p>
<p>表面处 $\Delta n=\Delta p=10^{14}$（题给"表面产生浓度"），$n_0=5\times10^{14}$，$p_0=\frac{n_i^2}{n_0}=\frac{2.25\times10^{20}}{5\times10^{14}}=4.5\times10^{5}$：</p>
<p>$$n=6\times10^{14},\qquad p=10^{14}+4.5\times10^{5}\approx10^{14}$$</p>
<p>$$\sigma=q(n\mu_n+p\mu_p)=1.602\times10^{-19}\left(6\times10^{14}\times1350+10^{14}\times500\right)$$</p>
<p>$$=1.602\times10^{-19}\times(8.10\times10^{17}+5.0\times10^{16})=1.602\times10^{-19}\times8.60\times10^{17}=0.138\ \mathrm{S/cm}$$</p>
<p>$$\rho=\frac1\sigma=7.3\ \Omega\cdot\mathrm{cm}$$</p>
<p class="lead"><b>二、$3\ \mu\mathrm{s}$ 后、距表面 $10\ \mu\mathrm{m}$ 处</b></p>
<p>扩散系数与扩散长度：</p>
<p>$$D_p=\frac{k_0T}{q}\mu_p=0.0259\times500=12.95\ \mathrm{cm^2/s},\qquad L_p=\sqrt{D_p\tau}=\sqrt{12.95\times3\times10^{-5}}=0.0197\ \mathrm{cm}=197\ \mu\mathrm{m}$$</p>
<p>因 $10\ \mu\mathrm{m}\ll L_p$，光照期间的稳态分布为指数衰减：</p>
<p>$$\Delta p(x)=\Delta p(0)e^{-x/L_p}=10^{14}e^{-10/197}=9.5\times10^{13}$$</p>
<p>光照停止后按 $e^{-t/\tau}$ 衰减：</p>
<p>$$\Delta p(10\ \mu\mathrm{m},3\ \mu\mathrm{s})=9.5\times10^{13}e^{-3/30}=9.5\times10^{13}\times0.905=8.6\times10^{13}\ \mathrm{cm^{-3}}$$</p>
<p>该处载流子浓度：$n=5\times10^{14}+8.6\times10^{13}=5.86\times10^{14}$，$p\approx8.6\times10^{13}$。</p>
<p class="lead"><b>三、漂移电流</b></p>
<p>$$J_{\text{漂}}=q(n\mu_n+p\mu_p)E=1.602\times10^{-19}\left(5.86\times10^{14}\times1350+8.6\times10^{13}\times500\right)\times10$$</p>
<p>$$=1.602\times10^{-19}\times(7.91\times10^{17}+4.3\times10^{16})\times10=1.602\times10^{-19}\times8.34\times10^{17}\times10=1.34\ \mathrm{A/cm^2}$$</p>
<p class="lead"><b>四、扩散电流（少子为主）</b></p>
<p>$$\left|\frac{\mathrm d\Delta p}{\mathrm dx}\right|=\frac{\Delta p}{L_p}=\frac{8.6\times10^{13}}{0.0197}=4.4\times10^{15}\ \mathrm{cm^{-4}}$$</p>
<p>$$J_{p,\text{扩}}=qD_p\left|\frac{\mathrm d\Delta p}{\mathrm dx}\right|=1.602\times10^{-19}\times12.95\times4.4\times10^{15}=9.1\times10^{-3}\ \mathrm{A/cm^2}$$</p>
<p>（电子扩散电流被 Dember 内建电场大部分抵消，小注入下只需计少子扩散项。）</p>
<p class="lead"><b>五、合计</b></p>
<p>$$J=J_{\text{漂}}+J_{p,\text{扩}}=1.34+0.009=\boxed{1.35\ \mathrm{A/cm^2}}$$</p>
<p><b>即：扩散只占 0.7%，电流几乎全是漂移；而漂移电流里多子（电子）又占 96%。</b></p>`,
kp: ['表面产生与扩散长度',String.raw`$e^{-x/L_p}$ 与 $e^{-t/\tau}$ 的双重衰减`,'漂移电流与扩散电流的量级','Dember 电场',String.raw`单位换算 $\mu\mathrm{m}\to\mathrm{cm}$`],
comment:String.raw`这是一道"综合但不难"的题，两个易错点：① <b>单位</b>——$10\ \mu\mathrm{m}=10^{-3}\ \mathrm{cm}$，若按 $\mathrm{cm}$ 算错位，$L_p$ 就会算成 $1970\ \mu\mathrm{m}$ 或 $19.7\ \mu\mathrm{m}$；② <b>双重衰减</b>——空间上按 $e^{-x/L_p}$、时间上按 $e^{-t/\tau}$，两个都要乘，只乘一个是最常见的失分点。算完记得检查量级：<b>漂移 $\sim1\ \mathrm{A/cm^2}$、扩散 $\sim10^{-2}\ \mathrm{A/cm^2}$</b>，这与"小注入下少子扩散电流远小于多子漂移电流"的一般结论一致。`
});
})();
