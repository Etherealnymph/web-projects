/* 01 · 期末复习要点：知识地图 */
(function(){
const A = window.__DATA__ = window.__DATA__ || [];
const P = () => (window.__PID = (window.__PID||0)+1);
const S = '02 · 期末复习要点（知识地图）';

/* ---- 1 ---- */
A.push({
pid:P(), sec:2, secTitle:S,
label:'要点 1', title:'晶体结构 · 晶面晶向 · 倒格子与布里渊区',
statement:String.raw`
<p><b>提纲原文</b>：晶体结构，晶面、晶向以及晶面族、晶向族，晶面距、面密度；波矢、布里渊区、倒格子概念。</p>
<table class="qa">
<thead><tr><th>必背结论</th><th>细节／公式</th></tr></thead>
<tbody>
<tr class="imp"><td>三种立方格子</td><td>简单立方（SC）每个晶胞 1 个格点；体心立方（BCC）2 个；面心立方（FCC）4 个。金刚石＝FCC＋双原子基元（8 个原子/晶胞），闪锌矿＝金刚石骨架但两套子格为异种原子</td></tr>
<tr><td>晶向族</td><td>$\langle uv w\rangle$ 表示全部等效方向；立方晶系 $\langle110\rangle$ 有 12 个、$\langle111\rangle$ 有 8 个、$\langle100\rangle$ 有 6 个</td></tr>
<tr><td>晶面族</td><td>$\{hkl\}$；$\{110\}$ 共 12 个晶面（彼此平行者算一对，非平行 6 组）、$\{111\}$ 8 个、$\{100\}$ 6 个</td></tr>
<tr class="imp"><td>面间距</td><td>$d_{hkl}=\dfrac{a}{\sqrt{h^2+k^2+l^2}}$（立方）。<b>FCC 只有 $h,k,l$ 全奇或全偶才对应真实原子面</b>：$d_{100}=a/2$、$d_{110}=a/(2\sqrt2)$、$d_{111}=a/\sqrt3$</td></tr>
<tr><td>面密度</td><td>$\sigma=\dfrac{\text{面内原子数}}{\text{面内面积}}$；金刚石结构 $\sigma_{110}>\sigma_{111}>\sigma_{100}$（注意与纯 FCC 相反）</td></tr>
<tr class="imp"><td>倒格子</td><td>$\boldsymbol a_i\cdot\boldsymbol b_j=2\pi\delta_{ij}$，$\boldsymbol b_1=\dfrac{2\pi}{V}\boldsymbol a_2\times\boldsymbol a_3$；<b>SC→SC、BCC→FCC、FCC→BCC</b></td></tr>
<tr><td>布里渊区</td><td>第一 BZ＝倒空间的 Wigner–Seitz 原胞：SC 为立方体（$\pm\pi/a$），BCC 为正十二面体，FCC 为截角八面体（8 个六边形＋6 个正方形）</td></tr>
<tr><td>波矢</td><td>$k$ 的量纲为 $\mathrm{m^{-1}}$（倒格矢同理）；$k=\dfrac{2\pi}{\lambda}$，$\hbar k$ 为晶体动量</td></tr>
</tbody></table>`,
answer:'',
solh:'要点精讲', solution:String.raw`
<p class="lead"><b>常考题型（3 类，都在作业一里出现过）</b></p>
<ul>
<li><b>画图／换算</b>：给一组 $(hkl)$、$[uvw]$ 要求在晶胞里画出来；或证明 FCC 的 $(hkl)\leftrightarrow(h_1h_2h_3)$ 换算。核对技巧：<b>立方晶系中 $[uvw]\perp(uvw)$</b>，画完用这一条自检。</li>
<li><b>面间距／面密度</b>：先判「该面是否真实存在」（FCC 判奇偶），再代公式；面密度＝面内原子数 ÷ 面内面积。</li>
<li><b>倒格子／布里渊区</b>：二维问题用 $\boldsymbol b_1=\dfrac{2\pi}{a}\hat i$ 直接写；第一 BZ 用「最近邻倒格点连线的垂直平分线」围。</li>
</ul>
<p class="lead"><b>对应题号</b></p>
<p>作业一 1～4、6（P014–P017、P019）；基础练习 09 的题组 1～3（P045–P047）。</p>`,
kp:['面间距 $d_{hkl}$','晶面族与晶向族计数','倒格子与布里渊区','金刚石/闪锌矿结构','面密度'],
comment:String.raw`这一板块最容易「会背不会用」：$d=a/\sqrt{h^2+k^2+l^2}$ 谁都会写，但 FCC 的 $(100)$ 直接代会得 $a$（错），真实原子面间距是 $a/2$——<b>因为面心原子正好插在中间，使 (100) 面的有效指数变成 (200)</b>。判断规则只有一句：<b>FCC 的 $h,k,l$ 全奇或全偶才有衍射、才是真实原子面</b>。另外金刚石结构的面密度排序与 FCC 相反（(110) 最大），原因同样是「多了基元原子」。`
});

/* ---- 2 ---- */
A.push({
pid:P(), sec:2, secTitle:S,
label:'要点 2', title:'能带结构 · 有效质量 · 费米能级',
statement:String.raw`
<p><b>提纲原文</b>：常见半导体的晶体结构、能带结构、布里渊区，费米能级、有效质量概念。</p>
<table class="qa">
<thead><tr><th>必背结论</th><th>细节／公式</th></tr></thead>
<tbody>
<tr class="imp"><td>三者能带三要素</td><td>Si：间接、$E_g=1.12$、导带底在 $\langle100\rangle$ 的 $\Delta$ 线（$0.85\times\frac{2\pi}{a}$）、6 个旋转椭球；Ge：间接、$0.67$、导带底在 $L$ 点、8 个半椭球；GaAs：<b>直接</b>、$1.42$、导带底在 $\Gamma$、球面</td></tr>
<tr><td>价带</td><td>三支：重空穴 HH、轻空穴 LH（在 $\Gamma$ 简并）＋自旋—轨道分裂带 SO（$\Delta_{SO}$：Si 0.044、Ge 0.29、GaAs 0.34 eV）</td></tr>
<tr class="imp"><td>有效质量</td><td>$\dfrac{1}{m^*}=\dfrac{1}{\hbar^2}\dfrac{\partial^2E}{\partial k^2}$：<b>带底 $m^*>0$、带顶 $m^*&lt;0$；曲率越大 $|m^*|$ 越小</b>。空穴 $m_p^*=-m_n^*$（同一点）</td></tr>
<tr><td>速度</td><td>$v=\dfrac1\hbar\dfrac{\partial E}{\partial k}$；带顶带底 $v=0$</td></tr>
<tr><td>电导／态密度有效质量</td><td>Si 电子：$\frac{1}{m_c^*}=\frac{1}{3}\left(\frac{2}{m_l^*}+\frac{1}{m_t^*}\right)$；$m_d^*=(m_l^*m_t^{*2})^{1/3}$</td></tr>
<tr class="imp"><td>费米能级</td><td>$E_F$ 是「电子占据概率 50% 的能级」；热平衡时<b>全样品统一、处处水平</b>；$E_F$ 的位置由温度与掺杂共同决定，<b>不是材料常数</b></td></tr>
<tr><td>本征费米能级</td><td>$E_i$ 位于禁带中央附近；$E_i-E_v=\frac{E_g}{2}+\frac{3}{4}k_0T\ln\frac{m_p^*}{m_n^*}$（Si 因 $m_n^*>m_p^*$ 略偏上）</td></tr>
</tbody></table>`,
answer:'',
solh:'要点精讲', solution:String.raw`
<p class="lead"><b>常考题型</b></p>
<ul>
<li><b>由 $E(k)$ 求带宽、速度、有效质量</b>：把 $\cos ka$ 在带顶带底展开，或直接求 $\partial^2E/\partial k^2$。<b>注意带宽＝带顶能量－带底能量，不是 $E(0)$</b>。</li>
<li><b>读能带图判 $m^*$</b>：开口向上且越陡 → 正质量且越小；开口向下 → 负质量（等价于空穴正质量）。比较两个带时只能比曲率，不能比高度。</li>
<li><b>重／轻空穴判别</b>：同一 $k$ 处下落得多（曲率大）的是轻空穴；$m^*\propto1/a$（抛物线系数）。</li>
</ul>
<p class="lead"><b>对应题号</b></p>
<p>作业二 1～5（P020–P024）；基础练习 09 的题组 3～5（P047–P049）。</p>`,
kp:['有效质量定义','$E(k)$ 与群速度','重/轻空穴','间接带隙 vs 直接带隙','费米能级'],
comment:String.raw`最典型的陷阱是<b>把「能带越窄」当成「有效质量越小」</b>——恰恰相反：曲率越小（带越平、越窄）有效质量越大。作业二第 3 题的三条能带里，第 Ⅲ 带最陡但最低，第 Ⅱ 带最平且在带顶，所以 Ⅲ 的电子最轻、Ⅱ 的电子质量为负。<b>另一个陷阱是「带顶的电子质量是负的，但空穴质量是正的」</b>，两者大小相等。`
});

/* ---- 3 ---- */
A.push({
pid:P(), sec:2, secTitle:S,
label:'要点 3', title:'掺杂 · 杂质能级 · 热平衡载流子统计',
statement:String.raw`
<p><b>提纲原文</b>：半导体掺杂，施主、受主，浅能级与深能级杂质的特点和作用；热平衡状态、费米分布与玻尔兹曼分布、非简并与简并半导体、载流子浓度随温度与杂质浓度的变化。</p>
<table class="qa">
<thead><tr><th>必背结论</th><th>细节／公式</th></tr></thead>
<tbody>
<tr class="imp"><td>浅能级</td><td>Ⅴ 族（P、As、Sb）在 Si 中是施主，能级 $E_c-0.04\sim0.05\ \mathrm{eV}$；Ⅲ 族（B、Al、Ga、In）是受主，$E_v+0.045\sim0.16\ \mathrm{eV}$。室温几乎全电离，<b>决定导电类型与载流子浓度</b></td></tr>
<tr><td>深能级</td><td>Au、Cu、Fe、Cr 等，能级深入禁带中部，室温几乎不电离；<b>主要作用是复合中心／产生中心／陷阱</b>（控制寿命），对浓度贡献可忽略</td></tr>
<tr><td>热平衡判据</td><td>① 浓度不随时间变（产生率＝复合率）；② 统一费米能级；③ $n_0p_0=n_i^2$</td></tr>
<tr class="imp"><td>两种分布</td><td>$f(E)=\dfrac{1}{1+e^{(E-E_F)/k_0T}}$；非简并时 $e^{(E-E_F)/k_0T}\gg1$，退化为玻尔兹曼 $f\approx e^{-(E-E_F)/k_0T}$</td></tr>
<tr><td>浓度公式</td><td>$n_0=N_ce^{-(E_c-E_F)/k_0T}$，$p_0=N_ve^{-(E_F-E_v)/k_0T}$，$n_i^2=N_cN_ve^{-E_g/k_0T}$</td></tr>
<tr class="imp"><td>电中性条件</td><td>$n_0+N_A^-=p_0+N_D^+$；强电离区简化为 $n_0\approx N_D-N_A$（$N_D>N_A$）</td></tr>
<tr><td>三个温区</td><td>低温弱电离区（$n_0$ 由 $E_D$、$T$ 决定）→ 饱和区（$n_0\approx N_D$，与 $T$ 无关）→ 本征区（$n_0\to n_i$）</td></tr>
<tr><td>简并</td><td>$E_F$ 进入导带（$E_c-E_F\le0$）或价带（$E_F-E_v\le0$）；此时玻尔兹曼失效、$E_F$ 随掺杂剧变、$E_g$ 变窄</td></tr>
</tbody></table>`,
answer:'',
solh:'要点精讲', solution:String.raw`
<p class="lead"><b>常考题型</b></p>
<ul>
<li><b>给掺杂与温度，求 $E_F$、$n_0$、$p_0$</b>：先判温区 → 取电中性条件的简化式 → 由 $n_0$ 反求 $E_F$。<b>顺序永远是「温区 → 电中性 → 浓度 → $E_F$」</b>。</li>
<li><b>补偿与深能级</b>：净杂质＝$N_D-N_A$；若深能级在 $E_F$ 之下（对 n 型是受主型），它也会被填充而参与补偿。</li>
<li><b>电离度</b>：$90\%$ 全电离 ↔ $|E_D-E_F|\approx2.2k_0T$，用它求「饱和区的掺杂上限」。</li>
<li><b>$E_F$ 随温度的变化曲线</b>：低温在 $(E_c+E_D)/2$ 附近 → 弱电离区略升 → 饱和区下降 → 高温趋近 $E_i$（中间出现一个极大值）。</li>
</ul>
<p class="lead"><b>对应题号</b></p>
<p>作业三 1～6（P025–P030）；基础练习 10 全部题组（P050–P056）。</p>`,
kp:['浅/深能级杂质','费米—狄拉克分布','质量作用定律 $n_0p_0=n_i^2$','电中性条件','电离度与温区','简并判据'],
comment:String.raw`这一章是<b>全课程计算量最大、也最容易丢分</b>的地方，核心只有一条电中性条件，但每一项都可能被忽略：深能级是否电离、受主简并因子取 4、补偿后净杂质是谁。经验做法是<b>先画一条从 $E_v$ 到 $E_c$ 的「能级尺」</b>，把所有杂质能级和 $E_F$ 标上去，谁在 $E_F$ 之下、谁之上，一眼就能看出电离与否——作业三第 4 题（B＋In 双受主）就是靠这一步定出 In 只电离了 33%。`
});

/* ---- 4 ---- */
A.push({
pid:P(), sec:2, secTitle:S,
label:'要点 4', title:'漂移 · 散射 · 迁移率与电阻率',
statement:String.raw`
<p><b>提纲原文</b>：漂移运动与迁移率，散射理论，迁移率、电阻率、电导率与温度、电离杂质浓度的关系，电阻率与电导率的计算。</p>
<table class="qa">
<thead><tr><th>必背结论</th><th>细节／公式</th></tr></thead>
<tbody>
<tr class="imp"><td>漂移</td><td>$v_d=\mu E$，$\mu=\dfrac{q\tau}{m^*}$，$\boldsymbol J=nq\mu_n\boldsymbol E+pq\mu_p\boldsymbol E=\sigma\boldsymbol E$</td></tr>
<tr class="imp"><td>两种主要散射</td><td><b>晶格振动（声学波）散射</b>：$\mu_L\propto T^{-3/2}$（温度升高、散射增强、迁移率下降）；<b>电离杂质散射</b>：$\mu_I\propto\dfrac{T^{3/2}}{N_I}$（温度升高、载流子变快、散射减弱）</td></tr>
<tr><td>合成</td><td>$\dfrac1\mu=\dfrac1{\mu_L}+\dfrac1{\mu_I}$：低温以电离杂质散射为主，高温以晶格散射为主 → $\mu\!-\!T$ 曲线有极大值</td></tr>
<tr><td>其他散射</td><td>光学波（极性光学）散射：$\mu\propto\left(e^{\theta/T}-1\right)$，随 $T$ 升高而<b>增大</b>；谷间散射（GaAs 负微分电导的关键）；中性杂质散射（低温重掺杂）</td></tr>
<tr class="imp"><td>电阻率</td><td>$\rho=\dfrac{1}{nq\mu_n+pq\mu_p}\approx\dfrac{1}{N_Dq\mu_n}$（n 型）；<b>由多子决定，少子贡献可忽略</b></td></tr>
<tr><td>本征半导体</td><td>$\rho=\dfrac{1}{n_iq(\mu_n+\mu_p)}$，<b>随温度升高而下降</b>（$n_i$ 指数上升压过 $\mu$ 的下降）；杂质半导体在饱和区 $\rho$ 随 $T$ 上升而上升（$\mu$ 下降主导）</td></tr>
<tr><td>强电场</td><td>Si：$v_d$ 饱和（光学波／谷间散射增强）；GaAs：$\Gamma\to L$ 谷间转移 → <b>负微分电导（Gunn 效应）</b></td></tr>
</tbody></table>`,
answer:'',
solh:'要点精讲', solution:String.raw`
<p class="lead"><b>常考题型</b></p>
<ul>
<li><b>两块样品比较电阻率</b>：先算载流子浓度（是否补偿），再比迁移率（杂质多者 $\mu$ 小）。</li>
<li><b>$\rho\!-\!T$ 曲线</b>：本征区下降、饱和区上升、低温冻结区上升，三段式；曲线的「拐点」就是温区边界。</li>
<li><b>光注入下的电导</b>：$\Delta\sigma=q(\mu_n+\mu_p)\Delta p$，光电导＝本底电导＋附加电导。</li>
</ul>
<p class="lead"><b>对应题号</b></p>
<p>作业四 1、2、7、8（P031–P032、P037–P038）；基础练习 11 的两个题组（P057–P058）。</p>`,
kp: [String.raw`迁移率 $\mu=q\tau/m^*$`,String.raw`声学波散射 $\mu\propto T^{-3/2}$`,String.raw`电离杂质散射 $\mu\propto T^{3/2}/N_I$`,'电导率与电阻率','负微分电导','速度饱和'],
comment:String.raw`记住<b>「两种散射的温度方向相反」</b>这一件事，就能自己推出所有 $\mu\!-\!T$、$\rho\!-\!T$ 曲线：低温 $\mu_I$ 主导、温度升高 $\mu$ 变大；高温 $\mu_L$ 主导、温度升高 $\mu$ 变小；所以曲线必有极大值。考试里问「为什么低温迁移率随温度升高而增大」——答案是<b>载流子热运动速度变大，经过带电中心时偏转变小</b>，不是"杂质变少"。`
});

/* ---- 5 ---- */
A.push({
pid:P(), sec:2, secTitle:S,
label:'要点 5', title:'非平衡载流子 · 复合理论 · 少子寿命',
statement:String.raw`
<p><b>提纲原文</b>：非平衡状态与非平衡载流子，大注入与小注入，复合理论，直接复合与间接复合的微观过程，少子寿命，有效复合中心与有效陷阱，复合中心与陷阱的异同。</p>
<table class="qa">
<thead><tr><th>必背结论</th><th>细节／公式</th></tr></thead>
<tbody>
<tr class="imp"><td>非平衡判据</td><td>$np>n_i^2$；用<b>准费米能级</b>描述：$n=N_ce^{-(E_c-E_{Fn})/k_0T}$，$p=N_ve^{-(E_{Fp}-E_v)/k_0T}$，$E_{Fn}-E_{Fp}=k_0T\ln\dfrac{np}{n_i^2}$</td></tr>
<tr><td>小注入／大注入</td><td>小注入：$\Delta n=\Delta p\ll n_0$，$\tau$ 为常数，$\Delta p=\Delta p_0e^{-t/\tau}$；大注入：$\Delta n\gtrsim n_0$，直接复合时 $\tau=\dfrac{1}{r(n_0+p_0+\Delta p)}$，<b>$\tau$ 随 $\Delta p$ 增大而减小</b></td></tr>
<tr class="imp"><td>直接复合</td><td>净复合率 $U=r(np-n_i^2)$；小注入 $\tau=\dfrac{1}{r(n_0+p_0)}$；<b>禁带越窄 $r$ 越大、寿命越短</b>（GaAs 直接复合强，Si 弱）</td></tr>
<tr class="imp"><td>间接复合（SRH 四过程）</td><td>① 电子俘获 $c_n=r_nnN_t$；② 电子发射 $e_n=e_{n1}N_t$（只与 $T$ 有关）；③ 空穴俘获 $c_p=r_ppN_t$；④ 空穴发射 $e_p$（只与 $T$ 有关）。<b>与电子浓度有关的是俘获过程，与载流子浓度无关、只与温度有关的是发射过程</b></td></tr>
<tr><td>少子寿命</td><td>强 n 型：$\tau_p\approx\dfrac{1}{r_pN_t}$（与多子浓度无关）；最有效的复合中心能级<b>靠近禁带中央（$E_i$）</b></td></tr>
<tr class="imp"><td>复合中心 vs 陷阱</td><td><b>复合中心</b>：连续完成「俘获电子→俘获空穴」，能级靠近 $E_i$、俘获概率相近；<b>陷阱</b>：俘获后很快再发射回原带，净效果是暂时储存，能级离 $E_i$ 远（对电子陷阱，$E_t$ 在 $E_F$ 之上且越接近 $E_F$ 越明显）</td></tr>
<tr><td>其他复合</td><td>俄歇复合（三粒子，重掺杂、高注入时显著）；表面复合（表面态，$s$ 表面复合速度）</td></tr>
</tbody></table>`,
answer:'',
solh:'要点精讲', solution:String.raw`
<p class="lead"><b>常考题型</b></p>
<ul>
<li><b>给 $G$、$\tau$ 求注入浓度、判大/小注入</b>：$\Delta n=G\tau$，与 $n_0$ 比。</li>
<li><b>停止注入后的衰减</b>：$\Delta n=\Delta n_0e^{-t/\tau}$；<b>大注入后经一段时间会转为小注入</b>（作业四第 5 题第(3)问）。</li>
<li><b>由 $\tau$ 反求复合中心浓度</b>：$\tau_p=1/(r_pN_t)$。</li>
<li><b>准费米能级的分裂</b>：小注入时 $E_{Fn}$ 几乎不动、$E_{Fp}$ 大幅下移（作业四第 5 题第(2)问的反面）。</li>
</ul>
<p class="lead"><b>对应题号</b></p>
<p>作业四 3～6（P033–P036）；基础练习 10 的题组 6（复合选择题，P055）。</p>`,
kp:['准费米能级','小注入/大注入','直接复合','SRH 间接复合四过程','少子寿命','复合中心与陷阱'],
comment:String.raw`「大注入还是小注入」几乎每年都考，判断标准只有一个：<b>$\Delta n$ 与 $n_0$ 比</b>，不是与 $n_i$ 比。作业四第 5 题的 $G\tau=5\times10^{16}$ 远大于 $n_0=10^{16}$，所以是大注入；而 30 μs 后 $\Delta n$ 衰到 $1.2\times10^{14}$，反而变成小注入——<b>同一块样品、同一次实验，注入水平会随时间变化</b>，这是最容易漏的一句。`
});

/* ---- 6 ---- */
A.push({
pid:P(), sec:2, secTitle:S,
label:'要点 6', title:'扩散 · 连续性方程 · 爱因斯坦关系',
statement:String.raw`
<p><b>提纲原文</b>：扩散运动与扩散系数，一维稳态扩散方程（厚、薄样品），非平衡载流子浓度计算，爱因斯坦关系的运用与推导，电流密度方程的计算，少子运动方程。</p>
<table class="qa">
<thead><tr><th>必背结论</th><th>细节／公式</th></tr></thead>
<tbody>
<tr class="imp"><td>扩散流与电流</td><td>$S_p=-D_p\dfrac{\mathrm d\Delta p}{\mathrm dx}$，$(J_p)_{\text{扩}}=-qD_p\dfrac{\mathrm d\Delta p}{\mathrm dx}$；<b>电子扩散电流与扩散流方向相反</b>（因带负电）</td></tr>
<tr class="imp"><td>爱因斯坦关系</td><td>$\dfrac{D}{\mu}=\dfrac{k_0T}{q}$。推导核心：热平衡下扩散电流与漂移电流精确抵消，$n(x)=N_ce^{-(E_c-q\varphi)/k_0T}$ 求导得 $\dfrac{D_n}{\mu_n}=\dfrac{k_0T}{q}$</td></tr>
<tr><td>稳态扩散（厚样品 $W\gg L$）</td><td>$\Delta p=\Delta p_0e^{-x/L_p}$，$L_p=\sqrt{D_p\tau_p}$；梯度、扩散流都按指数衰减</td></tr>
<tr><td>稳态扩散（薄样品 $W\ll L$）</td><td>$\Delta p$ 线性衰减、梯度为常数、扩散流为常数，复合可忽略</td></tr>
<tr class="imp"><td>连续性方程</td><td>$\dfrac{\partial\Delta p}{\partial t}=D_p\dfrac{\partial^2\Delta p}{\partial x^2}-\mu_pE\dfrac{\partial\Delta p}{\partial x}-\dfrac{\Delta p}{\tau_p}+g_p$；<b>稳态</b>时左边为 0</td></tr>
<tr><td>扩散长度／漂移长度</td><td>$L=\sqrt{D\tau}$（复合前平均扩散距离）；$L_E=\mu E\tau$（复合前平均漂移距离）</td></tr>
<tr><td>两大驱动力</td><td>电场（漂移）与浓度梯度（扩散）</td></tr>
</tbody></table>`,
answer:'',
solh:'要点精讲', solution:String.raw`
<p class="lead"><b>常考题型</b></p>
<ul>
<li><b>给梯度、$D$ 求扩散电流</b>：$J=qD\left|\dfrac{\mathrm d\Delta p}{\mathrm dx}\right|$，注意单位 $\mathrm{cm^{-4}}$。</li>
<li><b>给 $\mu$ 求 $D$、给 $\tau$ 求 $L$</b>：$D=\frac{k_0T}{q}\mu=0.0259\mu$；$L=\sqrt{D\tau}$（作业四第 8 题、基础练习 12 的第 12、13 题）。</li>
<li><b>光照停止后的电流</b>：浓度随时间按 $e^{-t/\tau}$ 衰减、随深度按 $e^{-x/L}$ 衰减，两者相乘；电流＝漂移（多子）＋扩散（少子）。</li>
<li><b>爱因斯坦关系的证明</b>：热平衡 $J_n=0$ → $qn\mu_nE+qD_n\frac{\mathrm dn}{\mathrm dx}=0$，代入 $n(x)$ 与 $E=-\frac{\mathrm d\varphi}{\mathrm dx}$ 即得。</li>
</ul>
<p class="lead"><b>对应题号</b></p>
<p>作业四 7、8（P037–P038）、作业五 2(5)（P040）；基础练习 12 的两个题组（P059–P060）。</p>`,
kp: ['扩散流密度与扩散电流','爱因斯坦关系',String.raw`扩散长度 $L=\sqrt{D\tau}$`,'连续性方程','厚样品/薄样品'],
comment:String.raw`这一章的计算题几乎都是「一个公式＋单位换算」，真正的难点在<b>符号</b>：空穴扩散电流与浓度梯度反向、电子扩散电流与电子流反向，四个方向两两配对，稍微绕一下就写错。<b>安全写法：先写「流」$S=-D\frac{\mathrm dn}{\mathrm dx}$，再乘 $+q$（空穴）或 $-q$（电子）得到电流</b>，永远不用背方向。`
});

/* ---- 7 ---- */
A.push({
pid:P(), sec:2, secTitle:S,
label:'要点 7', title:'金属—半导体接触（肖特基势垒）',
statement:String.raw`
<p><b>提纲原文</b>：金半接触，肖特基势垒模型与能带图，表面态，金属与半导体功函数，势垒区势场、电场分布，表面势与表面载流子浓度，两侧势垒高度与耗尽层近似下势垒宽度的计算，整流特性、整流理论及修正（镜像力、隧穿效应），热发射电流密度计算。</p>
<table class="qa">
<thead><tr><th>必背结论</th><th>细节／公式</th></tr></thead>
<tbody>
<tr class="imp"><td>两类接触</td><td>n 型：$W_m>W_s$ → <b>阻挡层（整流）</b>，能带向上弯；$W_m&lt;W_s$ → 反阻挡层（欧姆）。p 型恰好相反</td></tr>
<tr class="imp"><td>两个势垒高度</td><td>金属侧（电子）$q\varphi_B=q(\varphi_m-\chi)$，<b>只由材料决定、不随偏压变</b>；半导体侧 $qV_{bi}=q\varphi_B-(E_c-E_F)$，<b>随偏压线性变</b>（正偏降低、反偏升高）</td></tr>
<tr><td>势垒区</td><td>耗尽近似：$x_d=\sqrt{\dfrac{2\varepsilon_s(V_{bi}-V)}{qN_D}}$，$|E|_{\max}=\dfrac{qN_Dx_d}{\varepsilon_s}=\sqrt{\dfrac{2qN_D(V_{bi}-V)}{\varepsilon_s}}$，$V(x)$ 为抛物线</td></tr>
<tr><td>表面浓度</td><td>$n_s=N_De^{-qV_s/k_0T}$（$V_s$ 为表面势／能带弯曲量）；通常比体内小几个数量级 → 耗尽层</td></tr>
<tr class="imp"><td>整流特性</td><td>$J=A^*T^2e^{-q\varphi_B/k_0T}\left(e^{qV/k_0T}-1\right)=J_0\left(e^{qV/k_0T}-1\right)$；<b>反向饱和电流只由 $\varphi_B$ 与 $T$ 决定</b></td></tr>
<tr><td>两种理论</td><td>势垒宽度 $\gg$ 电子平均自由程 → <b>扩散理论</b>（$J_0$ 与 $\mu$、$N_D$、$x_d$ 有关）；反之 → <b>热电子发射理论</b>（$J_0$ 只与 $\varphi_B$、$T$ 有关）</td></tr>
<tr class="imp"><td>两种修正</td><td><b>镜像力</b>：使势垒降低 $\Delta\varphi\propto\sqrt{E}$，<b>反偏时更强</b>；<b>隧道效应</b>：电子穿过势垒，使等效势垒降低，<b>反偏／重掺杂时显著</b></td></tr>
<tr><td>欧姆接触</td><td>两条路：① 选 $W_m&lt;W_s$（n 型）的反阻挡层；② <b>重掺杂使势垒极薄，靠隧穿导电</b>（工程上主要用这条）</td></tr>
<tr><td>表面态</td><td>高密度表面态时 $E_F$ 被钉扎在中性面 $q\varphi_0$ 附近 → <b>$\varphi_B$ 与金属功函数（及掺杂）几乎无关</b>；施主型表面态：空时中性、失电子带正电；受主型：空时中性、得电子带负电</td></tr>
</tbody></table>`,
answer:'',
solh:'要点精讲', solution:String.raw`
<p class="lead"><b>常考题型</b></p>
<ul>
<li><b>画三种偏压下的能带图</b>：只改半导体侧弯曲量与 $E_{Fm}$ 位置，金属侧 $\varphi_B$ 不动（作业五 1）。</li>
<li><b>定量算 $W_s$、$V_s$、$n_s$、$x_d$、$E_{\max}$、$J$</b>：一条龙，注意每步的 $q$（作业五 2）。</li>
<li><b>少子扩散电流与多子热发射电流比较</b>：证明肖特基是「单极器件」。</li>
<li><b>判断题</b>：正偏时「金属侧势垒不变、半导体侧降低」这一对结论必考。</li>
</ul>
<p class="lead"><b>对应题号</b></p>
<p>作业五 1、2（P039–P040）；基础练习 13 的四个题组（P061–P064）。</p>`,
kp: ['阻挡层/反阻挡层',String.raw`$\varphi_B$ 与 $V_{bi}$`,'耗尽层近似','热电子发射','镜像力与隧穿','表面态与费米钉扎','欧姆接触'],
comment:String.raw`全章只有一句话要绝对记牢：**加偏压只改变半导体一侧的势垒（$V_{bi}$），不改变金属一侧的 $\varphi_B$**。所有「正偏时势垒怎么变」的判断题都在考这句话。另一个高频失分点是 $q\varphi_B=q(\varphi_m-\chi)$ 与 $qV_{bi}=q\varphi_B-(E_c-E_F)$ 里那个 $E_c-E_F$——<b>半导体掺杂越重，$V_{bi}$ 越小、势垒越薄、反向电流越大</b>，这也正是「重掺杂做欧姆接触」的物理依据。`
});

/* ---- 8 ---- */
A.push({
pid:P(), sec:2, secTitle:S,
label:'要点 8', title:'MIS 结构 · 表面状态 · C–V 特性',
statement:String.raw`
<p><b>提纲原文</b>：MIS 结构，外加栅压与表面状态，各状态下表面能带图特征，表面势与空间电荷区厚度，临界强反型与开启电压，高频／低频 C–V 特性，非理想 MIS 结构，平带电压含义及计算，金半功函数差与绝缘层电荷对 C–V 和开启电压的影响，绝缘层电荷密度计算。</p>
<table class="qa">
<thead><tr><th>必背结论</th><th>细节／公式</th></tr></thead>
<tbody>
<tr class="imp"><td>五种表面状态</td><td>多子积累 → 平带 → 耗尽 → 弱反型 → 临界强反型（$V_s=2\varphi_B$）→ 强反型</td></tr>
<tr class="imp"><td>电容</td><td>$C=\left(\dfrac{1}{C_{ox}}+\dfrac{1}{C_s}\right)^{-1}$（<b>串联</b>）；$C_{ox}=\dfrac{\varepsilon_{ox}\varepsilon_0}{d_{ox}}$；积累区与低频强反型区 $C\to C_{ox}$；高频强反型区 $C\to\dfrac{C_{ox}C_{d\max}}{C_{ox}+C_{d\max}}$ 并<b>饱和</b></td></tr>
<tr><td>空间电荷区</td><td>耗尽近似 $x_d=\sqrt{\dfrac{2\varepsilon_sV_s}{qN}}$；最大耗尽宽度 $x_{dm}=\sqrt{\dfrac{2\varepsilon_s\cdot2\varphi_B}{qN}}$</td></tr>
<tr class="imp"><td>平带电压</td><td>$V_{FB}=\varphi_{ms}-\dfrac{Q_{ox}}{C_{ox}}$，$\varphi_{ms}=\dfrac{W_m-W_s}{q}$；<b>$V_{FB}$ 就是「使能带平直」所需的栅压</b></td></tr>
<tr class="imp"><td>开启（阈值）电压</td><td>$V_T=V_{FB}+2\varphi_B+\dfrac{\sqrt{2\varepsilon_sqN_A(2\varphi_B)}}{C_{ox}}$（p 型衬底，$V_T>0$）；n 型衬底符号全反</td></tr>
<tr><td>费米势</td><td>$\varphi_B=\dfrac{k_0T}{q}\ln\dfrac{N_A}{n_i}$（p 型）</td></tr>
<tr class="imp"><td>高频 vs 低频</td><td>强反型区：<b>低频</b>反型层电荷能跟随小信号 → $C\approx C_{ox}$；<b>高频</b>反型层"冻结" → $C$ 饱和在 $C_{ox}$ 与 $C_{d\max}$ 串联值；<b>深耗尽</b>：扫得快、来不及产生少子，$C$ 可低于饱和值</td></tr>
<tr><td>非理想因素</td><td>① 金半功函数差 $\varphi_{ms}$ → 曲线平移；② 绝缘层电荷（可动 $\mathrm{Na^+}$、固定电荷、界面陷阱）→ 平移／拉伸；③ 界面态 → 频率台阶。**$Q_{ox}>0$ 使 $V_{FB}$、$V_T$ 向负方向移动**</td></tr>
</tbody></table>`,
answer:'',
solh:'要点精讲', solution:String.raw`
<p class="lead"><b>常考题型</b></p>
<ul>
<li><b>算 $W_m$、$W_s$、$V_{FB}$、$V_T$</b>：四个量串成一条链（作业六 3）。</li>
<li><b>由实测 $V_T$ 反求界面电荷</b>：$\Delta V_T=-\dfrac{Q_f}{C_{ox}}$，$Q_f=qN_f$。</li>
<li><b>由 C–V 曲线提参数</b>：积累平台 → $d_{ox}$；反型平台 → $x_{dm}$ → 掺杂；平台平移 → 界面电荷（作业六 4）。</li>
<li><b>判 p 沟／n 沟</b>：积累区在正栅压侧 → 多子是电子 → n 型衬底 → p 沟道。</li>
</ul>
<p class="lead"><b>对应题号</b></p>
<p>作业六 1～4（P041–P044）；基础练习 14 的三个题组（P065–P067）。</p>`,
kp: ['五种表面状态','$C_{ox}$ 与串联电容',String.raw`$V_{FB}$ 与 $\varphi_{ms}$`,'$V_T$ 三项','高频/低频/深耗尽 C–V','界面电荷'],
comment:String.raw`MIS 一章的题目「看起来长、其实套公式」，唯一需要真正理解的是<b>高频曲线为什么饱和</b>：反型层里的少子不是现成的，要靠产生—复合慢慢供给；小信号变化太快时供给跟不上，反型层电荷就"冻住"，只有耗尽层边缘还能动，于是 $C$ 卡在 $C_{ox}$ 与 $C_{d\max}$ 的串联值上。<b>由此还能顺带解释：宽禁带半导体（少子产生慢）在高频下很难反型、容易出现深耗尽。</b>`
});
})();
