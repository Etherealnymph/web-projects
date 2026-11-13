/* 00 · 导读 + 常用物理参数 */
(function(){
const A = window.__DATA__ = window.__DATA__ || [];
const P = () => (window.__PID = (window.__PID||0)+1);

/* ============ 导读 ============ */
A.push({
pid:P(), sec:0, secTitle:'导读 · 这份复习页怎么用',
label:'导读', title:'半导体物理 · 期末总复习（题目汇总 · 全解 · 评析 · 知识点）',
statement:String.raw`
<p>本页把本学期<b>全部题目</b>汇总到一起：<b>期末复习要点</b>的 8 个知识板块、<b>基础练习</b>（填空／判断／选择，210 个小问）、<b>作业一～作业六</b>（31 道大题（含 5 类计算模板））。每道题都给出<b>答案</b>、<b>解答</b>、<b>关联知识点</b>，计算题与大题另附<b>评析</b>（易错点、命题意图、可以怎样拓展）。</p>
<p>原卷里<b>没有给出的答案</b>——基础练习全卷只有题面、六次作业的部分小问只画了图没写数——<b>这次全部补齐</b>，并对图上题给出读图方法与典型读数。</p>
<p style="font-size:.9em;color:var(--muted);margin:.2em 0 0">来源：基础练习.pdf（5 页）· 期末复习要点.pdf（1 页）· assignment 1～6.pdf 及对应作业解答页</p>`,
answer:'',
solh:'使用说明', solution:String.raw`
<p class="lead"><b>一、内容地图（按 M 看目录）</b></p>
<ul>
<li><b>01 常用物理参数</b>：普适常数、Si/Ge/GaAs 材料参数、SiO₂ 与金属功函数、公式总表、判据与速查数。</li>
<li><b>02 期末复习要点</b>：把复习提纲的 9 条拆成 8 页「要点 → 必背结论 → 常考题型 → 对应题号」。</li>
<li><b>03～08 作业一～六</b>：31 道大题（含 5 类计算模板）逐题全解（含数值代入过程）。</li>
<li><b>09～14 基础练习</b>：按章节分成 24 个题组、210 个小问，逐题给答案与关联知识点。</li>
<li><b>15 附录</b>：28 条易错清单 + 二十条必背结论（考前 10 分钟看这几页）。</li>
</ul>
<p class="lead"><b>二、三种用法</b></p>
<ul>
<li><b>按考试顺序过一遍</b>：<code>End</code> 到附录背结论，再从 <code>Home</code> 顺着 02 → 08 走。</li>
<li><b>自测</b>：按 <code>A</code> 把答案与解答模糊掉，只看题面先自己想，鼠标移上去核对。</li>
<li><b>查漏</b>：按 <code>O</code> 打开总览，用关键字（肖特基／有效质量／迁移率／复合……）筛出同类题。</li>
</ul>
<p class="lead"><b>三、符号与数值约定</b></p>
<p>室温一律取 $T=300\ \mathrm{K}$、$k_0T=0.0259\ \mathrm{eV}\approx0.026\ \mathrm{eV}$；Si 取 $n_i=1.5\times10^{10}\ \mathrm{cm^{-3}}$、$N_c=2.8\times10^{19}$、$N_v=1.04\times10^{19}\ \mathrm{cm^{-3}}$、$E_g=1.12\ \mathrm{eV}$、$\varepsilon_r=11.9$（作业中凡题给 $12$ 就用 $12$）；Ge 取 $n_i=2\times10^{13}$、$E_g=0.67\ \mathrm{eV}$、$\varepsilon_r=16$；GaAs 取 $E_g=1.42\ \mathrm{eV}$、$n_i=2\times10^{6}$。**不同教材的 $n_i$、有效质量略有差别，会让末位数字变动，不影响结论与量级。**</p>`,
kp:['全课程知识框架','题目—知识点索引','数值与符号约定'],
comment:String.raw`这份汇总的价值不在「多」，而在<b>把同一考点的散题并到一起</b>：例如「费米能级随温度变化」在基础练习里有 4 个选择题、作业三里又有一个完整的四种情形计算题，把它们放在一起看，才能看出<b>同一个 EF–T 曲线在不同题型里的三种问法</b>。建议先看 02 的提纲，再按题号回填。`
});

/* ============ 参数 1：普适常数 ============ */
A.push({
pid:P(), sec:1, secTitle:'01 · 常用物理参数',
label:'参数 1', title:'普适物理常数与常用换算',
statement:String.raw`
<table class="qa">
<thead><tr><th>量</th><th>符号</th><th>数值</th><th>本课程最常用的写法</th></tr></thead>
<tbody>
<tr><td>电子静止质量</td><td>$m_0$</td><td>$9.109\times10^{-31}\ \mathrm{kg}$</td><td>$m_0c^2=0.511\ \mathrm{MeV}$</td></tr>
<tr><td>元电荷</td><td>$q$</td><td>$1.602\times10^{-19}\ \mathrm{C}$</td><td>$1\ \mathrm{eV}=1.602\times10^{-19}\ \mathrm{J}$</td></tr>
<tr><td>普朗克常数</td><td>$h$</td><td>$6.626\times10^{-34}\ \mathrm{J\cdot s}$</td><td>$hc=1.24\ \mathrm{eV\cdot\mu m}$</td></tr>
<tr><td>约化普朗克常数</td><td>$\hbar$</td><td>$1.055\times10^{-34}\ \mathrm{J\cdot s}$</td><td>$\hbar=6.582\times10^{-16}\ \mathrm{eV\cdot s}$</td></tr>
<tr><td>玻尔兹曼常数</td><td>$k_0$</td><td>$1.381\times10^{-23}\ \mathrm{J/K}$</td><td>$k_0=8.617\times10^{-5}\ \mathrm{eV/K}$</td></tr>
<tr class="imp"><td>室温热能</td><td>$k_0T$</td><td>$4.14\times10^{-21}\ \mathrm{J}$</td><td>$0.0259\ \mathrm{eV}$（≈0.026），$k_0T/q=25.9\ \mathrm{mV}$</td></tr>
<tr><td>真空介电常数</td><td>$\varepsilon_0$</td><td>$8.854\times10^{-12}\ \mathrm{F/m}$</td><td>$8.854\times10^{-14}\ \mathrm{F/cm}$</td></tr>
<tr><td>真空光速</td><td>$c$</td><td>$2.998\times10^{8}\ \mathrm{m/s}$</td><td>—</td></tr>
<tr><td>阿伏伽德罗常数</td><td>$N_A$</td><td>$6.022\times10^{23}\ \mathrm{mol^{-1}}$</td><td>算质量密度 $\rho=Mn/V$ 用</td></tr>
<tr class="imp"><td>有效质量能量单位</td><td>$\hbar^2/2m_0$</td><td>—</td><td>$3.81\ \mathrm{eV\cdot\mathring{A}^2}$，即 $\hbar^2/m_0=7.62\ \mathrm{eV\cdot\mathring{A}^2}$</td></tr>
</tbody></table>`,
answer:'',
solh:'说明', solution:String.raw`
<p class="lead"><b>三条最容易记混的换算</b></p>
<ul>
<li><b>能量↔波长</b>：$E(\mathrm{eV})=\dfrac{1.24}{\lambda(\mu\mathrm m)}$。$E_g=1.12\ \mathrm{eV}\Rightarrow\lambda=1.11\ \mu\mathrm m$（Si 的吸收边在近红外）。</li>
<li><b>热能</b>：$k_0T=0.0259\ \mathrm{eV}$；$400\ \mathrm{K}$ 时 $0.0345\ \mathrm{eV}$，$500\ \mathrm{K}$ 时 $0.0431\ \mathrm{eV}$。<b>凡是 $E_F$ 的位置、电离度、注入比，分母都是 $k_0T$。</b></li>
<li><b>有效质量</b>：把 $\dfrac{\hbar^2k^2}{2m^*}$ 写成 $\dfrac{\hbar^2}{2m_0}\cdot\dfrac{m_0}{m^*}\cdot k^2$，再用 $\hbar^2/2m_0=3.81\ \mathrm{eV\cdot\mathring{A}^2}$，可以直接从 $E\!-\!k$ 图的曲率读出 $m^*/m_0$。</li>
</ul>
<p class="lead"><b>单位制陷阱</b></p>
<p>半导体物理里长度常用 $\mathrm{cm}$、$\mathrm{\mu m}$、$\mathrm{nm}$、$\mathrm{\mathring{A}}$ 混用：$1\ \mathrm{\mathring{A}}=0.1\ \mathrm{nm}=10^{-8}\ \mathrm{cm}$，$1\ \mu\mathrm m=10^{-4}\ \mathrm{cm}$。计算 $n_i$、$N_c$ 时用 $\mathrm{cm^{-3}}$；算电场、电容时常用 $\mathrm{V/cm}$、$\mathrm{F/cm^2}$，<b>一句话：全篇统一用 CGS-厘米制，只在最后换算</b>。</p>`,
kp: ['$k_0T$ 与热电压','能量—波长换算',String.raw`$\hbar^2/2m_0=3.81\ \mathrm{eV\cdot\mathring{A}^2}$`,'单位换算'],
comment:String.raw`这一页是<b>所有计算题的公共底稿</b>。经验：考试里 90% 的「算错」不是物理错，而是 $k_0T$ 用了 $0.026$ 却和 $0.0259$ 混着算，或者 $\varepsilon_s$ 忘了乘 $\varepsilon_0$。建议固定一套：$k_0T=0.0259$、$\varepsilon_0=8.85\times10^{-14}\ \mathrm{F/cm}$。`
});

/* ============ 参数 2：材料参数 ============ */
A.push({
pid:P(), sec:1, secTitle:'01 · 常用物理参数',
label:'参数 2', title:'Si / Ge / GaAs 的材料参数（300 K）',
statement:String.raw`
<table class="qa">
<thead><tr><th>参数</th><th>Si</th><th>Ge</th><th>GaAs</th></tr></thead>
<tbody>
<tr><td>晶体结构</td><td>金刚石（FCC 复式）</td><td>金刚石</td><td>闪锌矿（FCC 复式）</td></tr>
<tr><td>晶格常数 $a$</td><td>$5.431\ \mathrm{\mathring{A}}$</td><td>$5.658\ \mathrm{\mathring{A}}$</td><td>$5.653\ \mathrm{\mathring{A}}$</td></tr>
<tr class="imp"><td>禁带宽度 $E_g$</td><td>$1.12\ \mathrm{eV}$（0 K：1.17）</td><td>$0.67\ \mathrm{eV}$（0 K：0.74）</td><td>$1.42\ \mathrm{eV}$</td></tr>
<tr><td>带隙类型</td><td><b>间接</b>（导带底在 $\langle100\rangle$ 的 $\Delta$ 线，$0.85\times\frac{2\pi}{a}$）</td><td><b>间接</b>（导带底在 $L$ 点 $\langle111\rangle$）</td><td><b>直接</b>（导带底在 $\Gamma$，$k=0$）</td></tr>
<tr><td>导带极小值个数</td><td>6 个旋转椭球（沿 $\langle100\rangle$）</td><td>8 个半椭球（沿 $\langle111\rangle$）</td><td>1 个球面（$\Gamma$），另有 $L$ 谷、$X$ 谷</td></tr>
<tr><td>本征浓度 $n_i$</td><td>$1.5\times10^{10}\ \mathrm{cm^{-3}}$（有的书 $1.0\times10^{10}$）</td><td>$2.4\times10^{13}\ \mathrm{cm^{-3}}$</td><td>$1.8\times10^{6}\ \mathrm{cm^{-3}}$</td></tr>
<tr><td>有效状态密度 $N_c\,/\,N_v$</td><td>$2.8\times10^{19}\,/\,1.04\times10^{19}$</td><td>$1.04\times10^{19}\,/\,6.0\times10^{18}$</td><td>$4.7\times10^{17}\,/\,7.0\times10^{18}$</td></tr>
<tr><td>相对介电常数 $\varepsilon_r$</td><td>$11.9$（常取 12）</td><td>$16.0$</td><td>$13.1$</td></tr>
<tr><td>电子亲和能 $\chi$</td><td>$4.05\ \mathrm{eV}$</td><td>$4.0\ \mathrm{eV}$</td><td>$4.07\ \mathrm{eV}$</td></tr>
<tr><td>态密度有效质量 $m_n^*/m_0$，$m_p^*/m_0$</td><td>$1.08$，$0.56$</td><td>$0.56$，$0.37$</td><td>$0.067$，$0.48$</td></tr>
<tr><td>电导有效质量（电子）</td><td>$0.26$（纵 0.98 / 横 0.19）</td><td>$0.12$（纵 1.64 / 横 0.082）</td><td>$0.067$</td></tr>
<tr><td>重空穴 / 轻空穴 $m^*$</td><td>$0.53\,/\,0.16$</td><td>$0.36\,/\,0.043$</td><td>$0.45\,/\,0.082$</td></tr>
<tr><td>自旋—轨道分裂 $\Delta_{SO}$</td><td>$0.044\ \mathrm{eV}$</td><td>$0.29\ \mathrm{eV}$</td><td>$0.34\ \mathrm{eV}$</td></tr>
<tr><td>迁移率 $\mu_n\,/\,\mu_p$（$\mathrm{cm^2/(V\cdot s)}$）</td><td>$1350\,/\,500$（有的书 1500/450）</td><td>$3900\,/\,1900$</td><td>$8500\,/\,400$</td></tr>
<tr><td>原子体密度</td><td>$5.0\times10^{22}\ \mathrm{cm^{-3}}$</td><td>$4.4\times10^{22}\ \mathrm{cm^{-3}}$</td><td>$4.4\times10^{22}\ \mathrm{cm^{-3}}$</td></tr>
<tr><td>本征电阻率（300 K）</td><td>$\approx2.3\times10^{5}\ \Omega\cdot\mathrm{cm}$</td><td>$\approx47\ \Omega\cdot\mathrm{cm}$</td><td>$\approx10^{8}\ \Omega\cdot\mathrm{cm}$</td></tr>
<tr><td>击穿场强</td><td>$\approx3\times10^{5}\ \mathrm{V/cm}$</td><td>$\approx10^{5}\ \mathrm{V/cm}$</td><td>$\approx4\times10^{5}\ \mathrm{V/cm}$</td></tr>
</tbody></table>`,
answer:'',
solh:'说明', solution:String.raw`
<p class="lead"><b>杂质电离能（$\mathrm{eV}$，300 K 教材常用值）</b></p>
<table class="qa">
<thead><tr><th>材料</th><th>施主（$\Delta E_D=E_c-E_D$）</th><th>受主（$\Delta E_A=E_A-E_v$）</th></tr></thead>
<tbody>
<tr><td>Si</td><td>P 0.044，As 0.049，Sb 0.039</td><td>B 0.045，Al 0.057，Ga 0.065，In 0.16</td></tr>
<tr><td>Ge</td><td>P 0.012，As 0.0127，Sb 0.0096</td><td>B 0.0104，Al 0.0102，Ga 0.0108，In 0.0112</td></tr>
</tbody></table>
<p>Si 中的深能级（复合中心）：<b>Au</b> 施主能级 $E_v+0.35\ \mathrm{eV}$、受主能级 $E_c-0.54\ \mathrm{eV}$；<b>Cu、Fe、Cr、Ni</b> 也都是深能级。这些数值决定「浅／深」的分界：$\Delta E\lesssim0.1\ \mathrm{eV}$ 为浅，$\Delta E\gtrsim0.1\ \mathrm{eV}$ 为深。</p>
<p class="lead"><b>绝缘层与金属（做 MIS、肖特基题必备）</b></p>
<table class="qa">
<thead><tr><th>材料</th><th>$\varepsilon_r$</th><th>其他</th></tr></thead>
<tbody>
<tr><td>SiO₂</td><td>3.9</td><td>$E_g\approx9\ \mathrm{eV}$，$\chi\approx0.9\ \mathrm{eV}$，击穿场强 $\approx10^{7}\ \mathrm{V/cm}$，$1\ \mathrm{nm}$ 相当于 $3.45\times10^{-7}\ \mathrm{F/cm^2}$</td></tr>
<tr><td>Si₃N₄</td><td>7.5</td><td>—</td></tr>
<tr><td>Al₂O₃</td><td>9</td><td>—</td></tr>
</tbody></table>
<p><b>金属功函数</b>（$\mathrm{eV}$）：Al 4.28，TiW 4.59，W 4.55，Mo 4.60，Cr 4.50，Ni 5.15，Au 5.10，Pt 5.65，Ag 4.26，Cu 4.65；<b>重掺杂多晶硅</b>：$n^+$-Si $\approx4.05$，$p^+$-Si $\approx5.1$。</p>
<p class="lead"><b>三个「背下来最省事」的数</b></p>
<ul>
<li>Si 的 $N_c/N_v$ 之比 $\approx2.7$，所以本征费米能级 $E_i$ 在禁带中央<b>偏上</b>约 $0.012\ \mathrm{eV}$（常可忽略）。</li>
<li>$n_i^2=N_cN_v e^{-E_g/k_0T}$：Si 每升温 $10\ \mathrm{K}$，$n_i$ 约增大到 $2$ 倍；$100\ \mathrm{K}$ 增大 $10^{3}\sim10^{4}$ 倍。</li>
<li>$1\ \mathrm{nm}$ SiO₂ 的 $C_{ox}=3.45\times10^{-7}\ \mathrm{F/cm^2}=0.345\ \mu\mathrm{F/cm^2}$；$200\ \mathrm{nm}$ 就是 $1.73\times10^{-8}\ \mathrm{F/cm^2}$。</li>
</ul>`,
kp:['Si/Ge/GaAs 能带三要素','有效状态密度','杂质电离能','金属功函数与电子亲和能','SiO₂ 电容换算'],
comment:String.raw`把「$E_g$、带隙类型、导带底位置、有效质量、$\mu$、$n_i$」六件事按材料排成一张表，是本章性价比最高的记忆方式：<b>Si 与 Ge 同为间接带隙但谷位置不同（$\Delta$ 线 vs $L$ 点），GaAs 是唯一直接带隙、也是唯一能做发光器件的</b>。注意 Ge 的 $n_i$ 比 Si 大 3 个数量级、$E_g$ 只有一半——所有「Ge 器件漏电大、耐温差」的结论都从这两个数来。`
});

/* ============ 参数 3：公式总表 ============ */
A.push({
pid:P(), sec:1, secTitle:'01 · 常用物理参数',
label:'参数 3', title:'核心公式总表（按题型排）',
statement:String.raw`
<table class="qa">
<thead><tr><th>主题</th><th>公式</th><th>用在哪</th></tr></thead>
<tbody>
<tr><td>面间距</td><td>$d_{hkl}=\dfrac{a}{\sqrt{h^2+k^2+l^2}}$（立方；FCC 只对 $h,k,l$ 全奇或全偶成立）</td><td>作业一 2、6；基础练习 1</td></tr>
<tr><td>倒格子</td><td>$\boldsymbol a_i\cdot\boldsymbol b_j=2\pi\delta_{ij}$，$\boldsymbol b_1=\dfrac{2\pi}{V}\boldsymbol a_2\times\boldsymbol a_3$</td><td>作业一 4</td></tr>
<tr><td>有效质量</td><td>$\dfrac{1}{m^*}=\dfrac{1}{\hbar^2}\dfrac{\partial^2E}{\partial k^2}$；$\boldsymbol v=\dfrac1\hbar\nabla_kE$</td><td>作业二 2～5</td></tr>
<tr class="imp"><td>载流子浓度</td><td>$n_0=N_c e^{-(E_c-E_F)/k_0T}$，$p_0=N_v e^{-(E_F-E_v)/k_0T}$，$n_0p_0=n_i^2$</td><td>作业三 2～5</td></tr>
<tr><td>有效状态密度</td><td>$N_c=2.5\times10^{19}\left(\dfrac{m_n^*}{m_0}\right)^{3/2}\left(\dfrac{T}{300}\right)^{3/2}\ \mathrm{cm^{-3}}$</td><td>作业二 1</td></tr>
<tr><td>费米能级</td><td>$E_F=E_i+k_0T\ln\dfrac{n_0}{n_i}$，$n$ 型 $E_F=E_c-k_0T\ln\dfrac{N_c}{N_D}$</td><td>作业三 3～5</td></tr>
<tr class="imp"><td>电离度</td><td>施主 $\dfrac{N_D^+}{N_D}=\dfrac{1}{1+g_De^{(E_F-E_D)/k_0T}}$，受主 $\dfrac{N_A^-}{N_A}=\dfrac{1}{1+g_Ae^{(E_A-E_F)/k_0T}}$（$g_D=2$，$g_A=4$）</td><td>作业三 4～6</td></tr>
<tr><td>电导</td><td>$\sigma=nq\mu_n+pq\mu_p$，$\rho=1/\sigma$，$\boldsymbol J=\sigma\boldsymbol E$</td><td>作业四 7、8</td></tr>
<tr><td>迁移率</td><td>$\dfrac1\mu=\dfrac1{\mu_L}+\dfrac1{\mu_I}$，$\mu_L\propto T^{-3/2}$，$\mu_I\propto\dfrac{T^{3/2}}{N_I}$</td><td>基础练习 11</td></tr>
<tr><td>爱因斯坦关系</td><td>$\dfrac{D}{\mu}=\dfrac{k_0T}{q}$</td><td>作业四、五；基础练习 12</td></tr>
<tr><td>扩散长度</td><td>$L=\sqrt{D\tau}$，$D_n=\dfrac{k_0T}{q}\mu_n$，$D_p=\dfrac{k_0T}{q}\mu_p$</td><td>作业四 8；基础练习 12</td></tr>
<tr><td>连续性方程</td><td>$\dfrac{\partial \Delta p}{\partial t}=D_p\dfrac{\partial^2\Delta p}{\partial x^2}-\mu_pE\dfrac{\partial\Delta p}{\partial x}-\dfrac{\Delta p}{\tau_p}+g_p$</td><td>基础练习 12</td></tr>
<tr class="imp"><td>肖特基</td><td>$q\varphi_B=q(\varphi_m-\chi)$，$qV_{bi}=q\varphi_B-(E_c-E_F)$，$x_d=\sqrt{\dfrac{2\varepsilon_s(V_{bi}-V)}{qN_D}}$，$|E|_{\max}=\dfrac{qN_Dx_d}{\varepsilon_s}$</td><td>作业五 1、2</td></tr>
<tr><td>热电子发射</td><td>$J=A^*T^2e^{-q\varphi_B/k_0T}\left(e^{qV/k_0T}-1\right)$，$A^*=240\ \mathrm{A/(cm^2K^2)}$（n-Si 的 $120\times2$）</td><td>作业五 2(4)</td></tr>
<tr class="imp"><td>MIS</td><td>$C_{ox}=\dfrac{\varepsilon_{ox}\varepsilon_0}{d_{ox}}$，$V_{FB}=\varphi_{ms}-\dfrac{Q_{ox}}{C_{ox}}$，$V_T=V_{FB}+2\varphi_B+\dfrac{\sqrt{2\varepsilon_sqN_A(2\varphi_B)}}{C_{ox}}$</td><td>作业六 3、4</td></tr>
<tr><td>费米势</td><td>$\varphi_B=\dfrac{k_0T}{q}\ln\dfrac{N_A}{n_i}$（p 型），$\varphi_B=\dfrac{k_0T}{q}\ln\dfrac{N_D}{n_i}$（n 型）</td><td>作业六 2～4</td></tr>
</tbody></table>`,
answer:'',
solh:'说明', solution:String.raw`
<p class="lead"><b>两套「互为镜像」的符号，考场最容易翻车</b></p>
<ul>
<li><b>能量 vs 电势</b>：$E$ 的单位是 $\mathrm{eV}$，$\varphi$ 的单位是 $\mathrm{V}$，数值上 $q\varphi\leftrightarrow E$。写 $qV_{bi}=W_m-W_s$ 时，$W$ 用 $\mathrm{eV}$、$V$ 用 $\mathrm{V}$，两边差一个 $q$——<b>只要全程写成 $q\times$（电压）=（能量差），就不会错</b>。</li>
<li><b>表面势 $V_s$ 的正负</b>：p 型表面反型时能带向下弯，$V_s>0$；n 型积累时 $V_s>0$ 但物理是「电子堆积」。<b>定义式写清楚：$V_s=\psi(\text{表面})-\psi(\text{体内})$。</b></li>
</ul>
<p class="lead"><b>三个「一用就快」的化简</b></p>
<ul>
<li>$x_d=\sqrt{2\varepsilon_sV/(qN)}$：把 $\varepsilon_s$、$q$、$N$ 先算成一组「特征长度」，反偏、正偏只改 $V$，$x_d\propto\sqrt V$。</li>
<li>$V_T$ 的三项：$V_{FB}$（金半功函数差与氧化层电荷）+ $2\varphi_B$（表面势）+ 体电荷项（$\propto\sqrt{N_A}d_{ox}$）。<b>三个物理意义分开记，比背整条式子稳。</b></li>
<li>$J\propto e^{-q\varphi_B/k_0T}$：$\varphi_B$ 每变 $0.06\ \mathrm{V}$（$\approx2.3k_0T$），电流变 $10$ 倍；变 $0.026\ \mathrm{V}$ 变 $e$ 倍。</li>
</ul>`,
kp:['公式体系','量纲与符号约定','近似与化简'],
comment:String.raw`公式表不要「背」，要「按题型取用」：<b>凡是问「浓度」→ 费米分布＋电中性；问「电流」→ 漂移＋扩散＋连续性；问「能带图」→ 三个量（$E_c$、$E_F$、$q\varphi$）。</b>本页每一行都标了它出现在哪道题，考前按行回题过一遍，比通读教材快得多。`
});

/* ============ 参数 4：判据与速查 ============ */
A.push({
pid:P(), sec:1, secTitle:'01 · 常用物理参数',
label:'参数 4', title:'判据、阈值与速查数值',
statement:String.raw`
<table class="qa">
<thead><tr><th>判据</th><th>条件</th><th>含义／用途</th></tr></thead>
<tbody>
<tr class="imp"><td>非简并</td><td>$E_c-E_F\gtrsim3k_0T$ 且 $E_F-E_v\gtrsim3k_0T$</td><td>可用玻尔兹曼近似；否则要费米—狄拉克积分</td></tr>
<tr><td>简并</td><td>$E_c-E_F\le0$ 或 $E_F-E_v\le0$（即 $E_F$ 进入导带／价带）</td><td>基础练习 10 的选择题就考这一条</td></tr>
<tr><td>全电离（强电离）</td><td>电离度 $\ge90\%$，即 $|E_D-E_F|\gtrsim2.2k_0T$</td><td>饱和区：$n_0\approx N_D$，与温度无关</td></tr>
<tr><td>小注入</td><td>$\Delta n=\Delta p\ll n_0$（n 型）</td><td>少子寿命为常数，$\Delta p\propto e^{-t/\tau}$</td></tr>
<tr><td>大注入</td><td>$\Delta n\gtrsim n_0$</td><td>$\tau$ 不再是常数（直接复合时 $\tau\propto1/\Delta n$）</td></tr>
<tr><td>厚样品</td><td>$W\gg L_p$</td><td>$\Delta p=\Delta p_0e^{-x/L_p}$（指数衰减）</td></tr>
<tr><td>薄样品</td><td>$W\ll L_p$</td><td>$\Delta p$ 线性衰减，复合可忽略</td></tr>
<tr class="imp"><td>临界强反型</td><td>$V_s=2\varphi_B$，表面 $n_s=p_0$</td><td>MIS 的阈值电压定义点</td></tr>
<tr><td>平带</td><td>$V_s=0$（能带平直）</td><td>$V_{FB}$ 的定义点</td></tr>
<tr><td>欧姆接触</td><td>n 型 $W_m&lt;W_s$（反阻挡层）或重掺杂隧道接触</td><td>作业五 1 的四象限图</td></tr>
<tr><td>肖特基（阻挡层）</td><td>n 型 $W_m>W_s$；p 型 $W_m&lt;W_s$</td><td>整流接触</td></tr>
<tr><td>深耗尽</td><td>反型层来不及建立，$x_d>x_{dm}$</td><td>高频 C-V 扫得快时出现「下凹」</td></tr>
</tbody></table>`,
answer:'',
solh:'说明', solution:String.raw`
<p class="lead"><b>常用速查结果（直接可当答案用）</b></p>
<table class="qa">
<thead><tr><th>问题</th><th>结果</th></tr></thead>
<tbody>
<tr><td>Si 原子体密度</td><td>$8/a^3=5.0\times10^{22}\ \mathrm{cm^{-3}}$</td></tr>
<tr><td>Si 面密度（金刚石结构）</td><td>$\sigma_{100}=2/a^2=6.78\times10^{14}$，$\sigma_{110}=2\sqrt2/a^2=9.59\times10^{14}$，$\sigma_{111}=4/(\sqrt3a^2)=7.83\times10^{14}\ \mathrm{cm^{-2}}$（<b>$\sigma_{110}>\sigma_{111}>\sigma_{100}$</b>）</td></tr>
<tr><td>FCC 面间距</td><td>$d_{100}=a/2$，$d_{110}=a/(2\sqrt2)$，$d_{111}=a/\sqrt3$</td></tr>
<tr><td>室温 $N_c$/$N_v$（Si）</td><td>$2.8\times10^{19}$/$1.04\times10^{19}\ \mathrm{cm^{-3}}$</td></tr>
<tr><td>$N_D=10^{16}$ 的 n-Si</td><td>$E_c-E_F=0.18\ \mathrm{eV}$，$n_0=10^{16}$，$p_0=2.25\times10^{4}\ \mathrm{cm^{-3}}$</td></tr>
<tr><td>$N_A=10^{16}$ 的 p-Si</td><td>$\varphi_B=0.358\ \mathrm{V}$，$2\varphi_B=0.716\ \mathrm{V}$</td></tr>
<tr><td>Si 的 $L_p$（$\tau=10\ \mu s$，$\mu_p=500$）</td><td>$D_p=12.9\ \mathrm{cm^2/s}$，$L_p=11.4\ \mu\mathrm{m}$</td></tr>
<tr><td>肖特基 $\varphi_B=0.54\ \mathrm{V}$、$A^*T^2=2.16\times10^{7}$</td><td>$J_0\approx0.044\ \mathrm{A/cm^2}$（300 K）</td></tr>
<tr><td>$N_D=10^{16}$、$V_R=1\ \mathrm{V}$ 的肖特基势垒宽度</td><td>$x_d\approx0.43\ \mu\mathrm{m}$，$|E|_{\max}\approx6.4\times10^{4}\ \mathrm{V/cm}$</td></tr>
</tbody></table>`,
kp:['判据体系','典型数值','量级估计'],
comment:String.raw`判据表是选择题的「标准答案生成器」：基础练习里大量「××说法是否正确」，本质都是问「有没有越过这条判据」。例如「强电离区载流子浓度与温度无关」——对，因为电离度 ≥90% 已经把这个区定义死了；「施主全部电离后必定是强 n 型」——错，因为还可能有受主补偿。`
});
})();
