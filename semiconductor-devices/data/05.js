/* 05 · 基础练习 · 晶体结构与能带 */
(function(){
const A = window.__DATA__ = window.__DATA__ || [];
const P = () => (window.__PID = (window.__PID||0)+1);
const S = '09 · 基础练习 · 晶体结构与能带';

A.push({
pid:P(), sec:9, secTitle:S,
label:'第1章 · 填空', title:'晶格、晶面晶向、倒格子与布里渊区（填空 1–10）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>因为立方晶格的周期对称性，$\langle110\rangle$ 等效代表（ ）个晶向，$\{110\}$ 等效代表（ ）个非平行晶面</td><td class="ansv">12；6</td><td class="kpc">晶向族／晶面族计数；$\{110\}$ 共 12 个晶面、互相平行的成 6 对</td></tr>
<tr class="imp"><td class="n">2</td><td>晶格常数为 $a$ 的简单立方晶格中，$(110)$ 的面间距是（ ），面密度是（ ）；面心立方晶格中，$(110)$ 的面间距是（ ），面密度是（ ）</td><td class="ansv">$\dfrac{a}{\sqrt2}$，$\dfrac{1}{\sqrt2a^2}=0.707/a^2$；$\dfrac{a}{2\sqrt2}=0.354a$，$\dfrac{\sqrt2}{a^2}=1.414/a^2$</td><td class="kpc">面间距 $d=a/\sqrt{h^2+k^2+l^2}$；面密度＝面内原子数／面积；FCC 奇偶判据</td></tr>
<tr><td class="n">3</td><td>GaAs、InSb、InP 中两元素电负性接近，价键以（ ）键为主，趋于形成（ ）结构，属于（ ）晶系</td><td class="ansv">共价；闪锌矿；立方</td><td class="kpc">电负性差→键型；闪锌矿结构</td></tr>
<tr><td class="n">4</td><td>GaN、ZnO、AlN 中元素电负性差异较大，价键以（ ）键为主，趋于形成（ ）结构，属于（ ）晶系</td><td class="ansv">离子；纤锌矿；六方</td><td class="kpc">离子性键；纤锌矿结构</td></tr>
<tr><td class="n">5</td><td>面心立方晶胞中包含（ ）个基元，属于（ ）晶系</td><td class="ansv">4；立方</td><td class="kpc">FCC 每个惯用胞 4 个格点</td></tr>
<tr class="imp"><td class="n">6</td><td>金刚石结构是（简单／复式）格子，可看成 2 套（ ）晶格沿（ ）方向滑移（ ）长度套构而成</td><td class="ansv">复式；面心立方；$\langle111\rangle$（具体取 $[111]$）；$\dfrac{\sqrt3}{4}a$（体对角线的 $\frac14$）</td><td class="kpc">金刚石＝双 FCC 套构；基元位移 $\left(\frac14,\frac14,\frac14\right)$</td></tr>
<tr><td class="n">7</td><td>Si 具有金刚石结构，它是一种（简单／复式）晶格，其基元包含（ ）个不同位向的 Si 原子，晶胞中包含（ ）个基元</td><td class="ansv">复式；2；4（共 8 个原子）</td><td class="kpc">金刚石基元；惯用胞原子数 8</td></tr>
<tr class="imp"><td class="n">8</td><td>简单立方晶格的倒易格子是（ ）格子，体心立方晶格的倒易格子是（ ）格子，面心立方晶格的倒易格子是（ ）格子</td><td class="ansv">简单立方；面心立方；体心立方</td><td class="kpc">正倒格子互为倒易（FCC↔BCC）</td></tr>
<tr><td class="n">9</td><td>倒格子空间的格点对应正格子空间的晶面族，倒格矢量模量的量纲为（ ）</td><td class="ansv">$\mathrm{m^{-1}}$（长度的倒数）</td><td class="kpc">$\boldsymbol b$ 的量纲＝$1/$长度；$|\boldsymbol G|=\dfrac{2\pi}{d}$</td></tr>
<tr class="imp"><td class="n">10</td><td>简单立方晶格的第一布里渊区形状是（ ），体心立方晶格的是（ ），面心立方晶格的是（ ）</td><td class="ansv">立方体（边长 $\frac{2\pi}{a}$）；正十二面体；截角八面体</td><td class="kpc">第一 BZ＝倒空间 W–S 原胞</td></tr>
</tbody></table>`,
answer:'',
solution:'',
kp:['晶面族与晶向族计数','面间距与面密度','金刚石/闪锌矿/纤锌矿','倒格子与布里渊区'],
comment:String.raw`这 10 个空是「晶体结构」这一章的<b>全部骨架</b>：结构（金刚石／闪锌矿／纤锌矿）→ 格子与基元 → 倒格子与布里渊区。三条最容易错的：<b>① $\{110\}$ 到底是 6 还是 12</b>——晶面族含 12 个晶面，但题目问"非平行"，故答 6（本页两者都写出，避免判卷歧义）；<b>② FCC 的 $d_{110}$</b>——按几何晶面族是 $a/\sqrt2$，按相邻原子面是 $a/(2\sqrt2)$，作业一第 2 题用的是后者；<b>③ 金刚石的"2 套 FCC 沿 $[111]$ 滑移 $\frac{\sqrt3}{4}a$"</b>——不是 $a/4$，滑移量是体对角线的四分之一。`
});

A.push({
pid:P(), sec:9, secTitle:S,
label:'第1章 · 选择', title:'第一布里渊区边界与倒格子原胞体积（选择 1–2）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>边长为 $a$ 的简单立方晶胞的第一布里渊区边界位于（ ）<br>
A. $\pm\frac{\pi}{2a}i,\pm\frac{\pi}{2a}j,\pm\frac{\pi}{2a}k$　B. $\pm\frac{\pi}{a}i,\pm\frac{\pi}{a}j,\pm\frac{\pi}{a}k$　C. $\pm\frac{2\pi}{a}i,\pm\frac{2\pi}{a}j,\pm\frac{2\pi}{a}k$　D. $\pm\frac{4\pi}{a}i,\pm\frac{4\pi}{a}j,\pm\frac{4\pi}{a}k$</td><td class="ansv">B</td><td class="kpc">$k=\pm\dfrac{\pi}{a}$ 为 $\Gamma$ 到最近倒格点 $\frac{2\pi}{a}$ 的中点</td></tr>
<tr class="imp"><td class="n">2</td><td>边长为 $a$ 的面心立方晶胞，其倒格子原胞体积是（ ）<br>A. $a^3$　B. $\left(\frac{2\pi}{a}\right)^3$　C. $2\left(\frac{2\pi}{a}\right)^3$　D. $4\left(\frac{2\pi}{a}\right)^3$</td><td class="ansv">D</td><td class="kpc">$V^*=\dfrac{(2\pi)^3}{V}$，FCC 惯用胞 $V=a^3$，原胞 $V=\frac{a^3}{4}$</td></tr>
</tbody></table>`,
answer:'',
solution:String.raw`
<p class="lead"><b>第 1 题的推理</b>：SC 的倒格矢 $\boldsymbol G=\frac{2\pi}{a}(m,n,l)$，最近倒格点在 $\pm\frac{2\pi}{a}\hat i$ 等处；第一 BZ 边界是原点到最近倒格点连线的垂直平分面，即 $k_x=\pm\frac{\pi}{a}$。故第一 BZ 是边长 $\frac{2\pi}{a}$ 的立方体，边界在 $\pm\frac{\pi}{a}$。</p>
<p class="lead"><b>第 2 题的推理</b>：倒格子原胞体积 $V^*=\dfrac{(2\pi)^3}{V_{\text{原胞}}}$。FCC 惯用胞含 4 个格点，原胞体积 $V_{\text{原胞}}=\frac{a^3}{4}$，故</p>
<p>$$V^*=\frac{(2\pi)^3}{a^3/4}=4\left(\frac{2\pi}{a}\right)^3$$</p>
<p>选 D。<b>注意区分「惯用胞」与「原胞」</b>——这是本题唯一的陷阱。</p>`,
kp: ['倒格矢','第一布里渊区边界',String.raw`倒格子原胞体积 $V^*=(2\pi)^3/V$`,'惯用胞 vs 原胞'],
comment:String.raw`这两道题考的都是<b>"倒空间尺度与正空间成反比"</b>：正空间常用惯用胞 $a$，倒空间用原胞体积。第 2 题若忘记 FCC 惯用胞含 4 个格点，会误选 B。<b>记一个等式就够：$V^*=(2\pi)^3/V_{\text{原胞}}$</b>，凡是问倒格子原胞体积的题都从这里出发。`
});

A.push({
pid:P(), sec:9, secTitle:S,
label:'第1章 · 填空', title:'共有化运动、能带与有效质量（填空 1–9）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>电子壳层交叠使得电子可以从一个原子的电子壳层转移到相邻原子的相似电子壳层，这就是电子的（ ）运动</td><td class="ansv">共有化</td><td class="kpc">共有化运动；能带由原子能级分裂形成</td></tr>
<tr><td class="n">2</td><td>硅的晶格结构具有（ ）对称性，原子间的结合力是（ ）；能带结构上，硅是（ ）半导体</td><td class="ansv">金刚石结构（立方，$O_h^7$）；共价键；间接带隙</td><td class="kpc">金刚石结构；sp³ 共价键；间接带隙</td></tr>
<tr class="imp"><td class="n">3</td><td>有效质量由能带结构决定，硅的电子有效质量（ ）空穴有效质量</td><td class="ansv">小于</td><td class="kpc">$m_n^*=0.26m_0&lt;m_p^*=0.56m_0$（电导／态密度有效质量）</td></tr>
<tr><td class="n">4</td><td>半导体紧邻价带上面的允带是空带，称为（ ）带</td><td class="ansv">导</td><td class="kpc">导带、价带、禁带</td></tr>
<tr><td class="n">5</td><td>导带和价带之间的能隙称为（ ），在（ ）中没有允许电子存在的能级</td><td class="ansv">禁带（$E_g$）；禁带</td><td class="kpc">禁带的定义</td></tr>
<tr><td class="n">6</td><td>半导体与绝缘体的能带差异在于（ ）宽度不同</td><td class="ansv">禁带</td><td class="kpc">$E_g$：半导体 $\lesssim3\ \mathrm{eV}$、绝缘体 $\gtrsim4\ \mathrm{eV}$</td></tr>
<tr class="imp"><td class="n">7</td><td>（ ）的大小决定了价电子从价带顶跃迁到导带底所需的最小能量</td><td class="ansv">禁带宽度 $E_g$</td><td class="kpc">本征激发的最小能量</td></tr>
<tr><td class="n">8</td><td>与绝缘体相比，半导体价带电子激发到导带所需的能量（ ）</td><td class="ansv">小</td><td class="kpc">$E_g$ 小→本征激发容易</td></tr>
<tr class="imp"><td class="n">9</td><td>有效质量概括了（ ）对载流子的作用，可通过（ ）实验来测量</td><td class="ansv">内部周期性势场（晶格势场）；回旋共振</td><td class="kpc">有效质量的物理意义；回旋共振测 $m^*$</td></tr>
</tbody></table>`,
answer:'',
solution:'',
kp:['共有化运动','导带/价带/禁带','有效质量的物理意义','回旋共振'],
comment:String.raw`这一组考「能带的语言」。第 3 空的答案需要一点记忆：<b>Si 的电子有效质量小于空穴</b>（这也是为什么 n 沟道器件比 p 沟道快），但 Ge 恰好相反（$m_n^*=0.12&lt;m_p^*=0.36$，还是电子小）——<b>只有 GaAs 的轻空穴（0.082）才和电子（0.067）可比</b>。第 9 空「有效质量概括了内部周期性势场的作用」是标准答法，<b>不能说"概括了晶格原子的作用"</b>，因为周期势场是整体效应。`
});

A.push({
pid:P(), sec:9, secTitle:S,
label:'第1章 · 填空', title:'禁带宽度、带隙类型与等能面（填空 1–10）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>在间接能隙半导体中，载流子跃迁前后波矢（ ）变化</td><td class="ansv">发生（$\Delta k\ne0$，需声子参与）</td><td class="kpc">直接／间接跃迁的动量守恒</td></tr>
<tr class="imp"><td class="n">2</td><td>半导体的禁带宽度负温度系数特征，是指禁带宽度随温度升高而（ ）</td><td class="ansv">减小（变窄）</td><td class="kpc">$E_g(T)=E_g(0)-\dfrac{\alpha T^2}{T+\beta}$</td></tr>
<tr><td class="n">3</td><td>半导体的禁带宽度与其所对应的光子发光波长成（ ）比例关系</td><td class="ansv">反（$E_g=\dfrac{1.24}{\lambda/\mu\mathrm m}$）</td><td class="kpc">$E=hc/\lambda$</td></tr>
<tr class="imp"><td class="n">4</td><td>Si 的禁带宽度是（ ）$\mathrm{eV}$，Ge 的是（ ）$\mathrm{eV}$，GaAs 的 $E_g$ =（ ）$\mathrm{eV}$</td><td class="ansv">1.12；0.67；1.42</td><td class="kpc">300 K 典型值（0 K：1.17 / 0.74 / 1.52）</td></tr>
<tr><td class="n">5</td><td>硅是（ ）带隙半导体，锗是（ ）带隙半导体，砷化镓是（ ）带隙半导体</td><td class="ansv">间接；间接；直接</td><td class="kpc">带隙类型判据：导带底与价带顶是否同 $k$</td></tr>
<tr class="imp"><td class="n">6</td><td>半导体 Si 的晶体结构是（ ），导带极小值位于（ ），有（ ）个（ ）形等能面；价带中有（ ）空穴</td><td class="ansv">金刚石结构；$\langle100\rangle$ 方向的 $\Delta$ 线（离 $\Gamma$ 为 $0.85\times\frac{2\pi}{a}$）；6；旋转椭球；2 种（重、轻空穴）</td><td class="kpc">Si 的 6 谷；椭球等能面；HH/LH</td></tr>
<tr><td class="n">7</td><td>半导体锗的晶体结构是（ ），导带极小值位于（ ），有（ ）个（ ）形等能面；价带中有（ ）空穴</td><td class="ansv">金刚石结构；$L$ 点（$\langle111\rangle$ 方向的布里渊区边界）；8；半椭球（旋转椭球）；2 种</td><td class="kpc">Ge 的 $L$ 谷；8 个半椭球＝4 个整谷</td></tr>
<tr class="imp"><td class="n">8</td><td>GaAs 是（ ）结构半导体，结合键是（ ），导带极小值位于（ ），等能面为（ ）形，在（ ）还存在一个导带极小值；价带中有（ ）空穴</td><td class="ansv">闪锌矿；共价键（含离子性／极性键）；$\Gamma$ 点（布里渊区中心，$k=0$）；球；$\langle111\rangle$ 方向的 $L$ 点（另有 $\langle100\rangle$ 的 $X$ 谷）；2 种</td><td class="kpc">闪锌矿；直接带隙；$\Gamma$/$L$/$X$ 谷</td></tr>
<tr><td class="n">9</td><td>重空穴是指（ ）较大的空穴</td><td class="ansv">有效质量</td><td class="kpc">重空穴/轻空穴的定义</td></tr>
<tr><td class="n">10</td><td>六方 GaN 是（ ）结构半导体，结合键是（ ）</td><td class="ansv">纤锌矿；极性共价键（含较强离子性）</td><td class="kpc">纤锌矿；宽禁带 $E_g\approx3.4\ \mathrm{eV}$</td></tr>
</tbody></table>
<p style="font-size:.86em;color:var(--muted);margin:.4em 0 0">★ 另有两个<b>图题</b>（原卷给出两幅 $E\!-\!k$ 图）：</p>
<table class="qa">
<thead><tr><th>图</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">图a</td><td>该半导体禁带宽度是（ ）$\mathrm{eV}$，是（ ）带隙半导体；价带等能面是（ ）形，导带有（ ）个（ ）形等能面</td><td class="ansv">读图：$E_g\approx1.12\ \mathrm{eV}$；<b>间接</b>（导带极小在 $\langle100\rangle$、与价带顶错开）；价带为翘曲抛物面；导带 6 个旋转椭球</td><td class="kpc">读 $E\!-\!k$ 图定 $E_g$ 与带隙类型（Si）</td></tr>
<tr class="imp"><td class="n">图b</td><td>该半导体是（ ），禁带宽度是（ ）$\mathrm{eV}$，是（ ）带隙半导体</td><td class="ansv">读图：$E_g\approx1.42\ \mathrm{eV}$；<b>直接</b>（导带极小与价带顶同在 $\Gamma$）；判为 GaAs</td><td class="kpc">直接带隙的判据（GaAs）</td></tr>
</tbody></table>`,
answer:'',
solution:String.raw`
<p class="lead"><b>读图定 $E_g$ 与带隙类型的三步</b></p>
<ul>
<li><b>找价带顶</b>：通常都在 $\Gamma$（$k=0$），读其能量。</li>
<li><b>找导带底</b>：看极小值出现在 $\Gamma$ 还是在某个方向上（$\Delta$ 线、$L$ 点）。<b>极小在 $\Gamma$ → 直接；不在 $\Gamma$ → 间接</b>。</li>
<li><b>$E_g$＝导带底能量－价带顶能量</b>（不是 $E(0)$，也不是两条带的最宽间距）。</li>
</ul>
<p>由此：图 a 的导带极小在 $\langle100\rangle$ 方向、与价带顶错开 → 间接带隙、$E_g\approx1.12\ \mathrm{eV}$，是 Si；图 b 的导带极小正落在 $\Gamma$ → 直接带隙、$E_g\approx1.42\ \mathrm{eV}$，是 GaAs。</p>`,
kp: ['禁带宽度与温度','$E_g$—波长换算','Si/Ge/GaAs 的带隙与谷位置','等能面形状',String.raw`读 $E\!-\!k$ 图`],
comment:String.raw`这一组的高频错点是<b>第 6、7、8 空的"个数"</b>：Si 是 <b>6 个整椭球</b>（$\pm k_x,\pm k_y,\pm k_z$），Ge 是 <b>8 个半椭球</b>（等价 4 个整谷，因为位于布里渊区边界、每个只算一半）。另外「价带中有（ ）空穴」一般答 <b>2 种（重、轻）</b>；严格说还有自旋—轨道分裂带，共三支，考试通常只要"重、轻"两种。`
});

A.push({
pid:P(), sec:9, secTitle:S,
label:'第1章 · 判断', title:'能带基础概念判断题（1–11）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>判断</th><th>理由／关联知识点</th></tr></thead>
<tbody>
<tr><td class="n">1</td><td>最外壳层的电子的共有化运动最为显著</td><td class="ansv ok">√</td><td class="kpc">外层电子与相邻原子交叠最大</td></tr>
<tr><td class="n">2</td><td>能带由一系列准连续的能级构成，它们覆盖一定的能量范围</td><td class="ansv ok">√</td><td class="kpc">能带的形成；准连续（$\sim10^{22}$ 个能级）</td></tr>
<tr class="imp"><td class="n">3</td><td>价电子为晶体不同的电子壳层所共有</td><td class="ansv no">×</td><td class="kpc">价电子为<b>整个晶体</b>所共有，不是"不同壳层共有"</td></tr>
<tr><td class="n">4</td><td>0 K 时原子核被冻结在格点、动能为零，所有电子倾向于占据最低能级，价带满、导带空</td><td class="ansv ok">√</td><td class="kpc">0 K 的基态；严格讲原子核仍有零点振动（常忽略）</td></tr>
<tr class="imp"><td class="n">5</td><td>满带电子不导电</td><td class="ansv ok">√</td><td class="kpc">满带中电子成对抵消，$\sum\boldsymbol v=0$</td></tr>
<tr class="imp"><td class="n">6</td><td>不满带电子不导电</td><td class="ansv no">×</td><td class="kpc">不满带才能导电（金属、半导体导带）</td></tr>
<tr><td class="n">7</td><td>空穴是空的电子态，是准粒子</td><td class="ansv ok">√</td><td class="kpc">空穴：价带空态的等效正电荷准粒子</td></tr>
<tr><td class="n">8</td><td>半导体中的导带电子是不成键的自由电子，价带电子是成键电子</td><td class="ansv ok">√</td><td class="kpc">导带＝反键态、可在晶体中自由运动</td></tr>
<tr class="imp"><td class="n">9</td><td>金属的能带被电子全部填充，所以有良好的导电性能</td><td class="ansv no">×</td><td class="kpc">金属是<b>部分填充</b>带；满带反而不能导电</td></tr>
<tr class="imp"><td class="n">10</td><td>半导体的禁带宽度是材料的固有性质，与温度、应力等外界因素无关</td><td class="ansv no">×</td><td class="kpc">$E_g$ 随 $T$ 升高而减小；应力、重掺杂也会改变</td></tr>
<tr class="imp"><td class="n">11</td><td>重空穴是指有效质量比电子有效质量大的空穴，轻空穴是指比电子小的空穴</td><td class="ansv no">×</td><td class="kpc">重／轻是<b>空穴之间</b>比较（HH 0.53、LH 0.16），不以电子为参照</td></tr>
</tbody></table>`,
answer:'',
solution:'',
kp:['共有化运动','满带/不满带导电性','空穴概念','导带/价带的成键性质','$E_g$ 的温度与应力依赖','重空穴/轻空穴'],
comment:String.raw`11 个判断里错了 5 个，全部是「一字之差」型陷阱：<b>第 3 题</b>把"整个晶体共有"偷换成"不同壳层共有"；<b>第 9 题</b>把金属说成"满带"（恰恰相反，满带不导电）；<b>第 11 题</b>把"重／轻空穴"的比较基准从"空穴之间"换成"与电子比"。<b>做题技巧：判断题里凡是出现"全部""一定""无关""只与"这类绝对词，先怀疑它是错的。</b>`
});
})();
