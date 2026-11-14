/* 07 · 基础练习 · 漂移散射 + 扩散连续性 */
(function(){
const A = window.__DATA__ = window.__DATA__ || [];
const P = () => (window.__PID = (window.__PID||0)+1);

/* ---------- 第 3 章 漂移与散射 ---------- */
const S1 = '11 · 基础练习 · 漂移、散射与电导';

A.push({
pid:P(), sec:11, secTitle:S1,
label:'第3章 · 填空', title:'漂移、散射机构与迁移率（填空 1–13）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr><td class="n">1</td><td>半导体在外加电场下，载流子将会做（ ），其运动速度正比于（ ），比例系数称为（ ）</td><td class="ansv">定向（漂移）运动；电场强度 $E$；迁移率 $\mu$</td><td class="kpc">$v_d=\mu E$</td></tr>
<tr class="imp"><td class="n">2</td><td>相同情况下空穴的电导有效质量（ ）于电子的电导有效质量，空穴的迁移率（ ）于电子的迁移率</td><td class="ansv">大；小</td><td class="kpc">$\mu=\dfrac{q\tau}{m^*}$，$m_p^*>m_n^*$ → $\mu_p&lt;\mu_n$</td></tr>
<tr class="imp"><td class="n">3</td><td>电离杂质散射是因（ ）势场引起的散射机构，该散射机构决定的迁移率成分随温度升高而（ ），随杂质浓度增大而（ ）</td><td class="ansv">库仑（带电中心）势场；增大；减小</td><td class="kpc">$\mu_I\propto\dfrac{T^{3/2}}{N_I}$</td></tr>
<tr><td class="n">4</td><td>室温下，本征半导体中主要的散射机制是（ ）</td><td class="ansv">晶格振动（声学波）散射</td><td class="kpc">本征材料杂质少，声学波散射主导</td></tr>
<tr class="imp"><td class="n">5</td><td>对 GaAs 材料而言，负微分电导是由于电子发生（ ），迁移率变（ ）</td><td class="ansv">谷间散射（$\Gamma\to L$ 谷转移）；小</td><td class="kpc">负微分电导；$L$ 谷质量大</td></tr>
<tr class="imp"><td class="n">6</td><td>纵声学波引起（ ）势场，该散射机构决定的迁移率成分随温度升高而（ ）</td><td class="ansv">形变（声学形变）势场；减小</td><td class="kpc">$\mu_L\propto T^{-3/2}$</td></tr>
<tr class="imp"><td class="n">7</td><td>纵光学波引起（ ）势场，该散射机构决定的迁移率成分随温度升高而（ ）</td><td class="ansv">极性（极化）势场；增大</td><td class="kpc">$\mu_{po}\propto\left(e^{\theta/T}-1\right)$，$T\uparrow$ 则 $\mu\uparrow$</td></tr>
<tr class="imp"><td class="n">8</td><td>（ ）和（ ）散射是半导体中的主要散射机构。温度越低，（ ）散射对迁移率的影响越显著；温度越高，（ ）散射对迁移率的影响越显著</td><td class="ansv">电离杂质；晶格振动；电离杂质；晶格振动</td><td class="kpc">两种散射的温度依赖相反 → $\mu\!-\!T$ 有极大值</td></tr>
<tr><td class="n">9</td><td>本征半导体的电阻率随温度升高而（ ）</td><td class="ansv">减小（降低）</td><td class="kpc">$n_i$ 指数增长压过 $\mu$ 的下降</td></tr>
<tr class="imp"><td class="n">10</td><td>强电场下，Si 半导体中载流子迁移率随电场增强而降低，与载流子受到的（ ）散射有关；GaAs 半导体中出现负微分电导现象，是因为载流子发生了（ ）散射</td><td class="ansv">光学波（谷间）散射；谷间（$\Gamma\to L$）</td><td class="kpc">速度饱和；负微分电导</td></tr>
<tr><td class="n">11</td><td>欧姆定律的微分形式为（ ）</td><td class="ansv">$\boldsymbol J=\sigma\boldsymbol E$</td><td class="kpc">微分形式的欧姆定律</td></tr>
<tr class="imp"><td class="n">12</td><td>载流子在半导体中不断遭遇散射，平均自由时间表示（ ）</td><td class="ansv">两次连续散射之间的平均时间（载流子保持定向速度的平均时间 $\tau$）</td><td class="kpc">$\tau$ 与 $\mu=q\tau/m^*$</td></tr>
<tr class="imp"><td class="n">13</td><td>杂质半导体的工作温区为其强电离区。掺杂浓度增加时，其最高工作温度将（ ），最低工作温度将（ ）</td><td class="ansv">升高；降低</td><td class="kpc">重掺杂 → 高温下电离度下降（上限更高）但低温冻结更早（下限更低）</td></tr>
</tbody></table>`,
answer:'',
solution:String.raw`
<p class="lead"><b>第 13 题的方向要分清</b></p>
<ul>
<li><b>最高工作温度升高</b>：掺杂越重，饱和区能维持到更高的温度（本征激发要超过 $N_D$ 才失效），故"工作温区上移"。</li>
<li><b>最低工作温度降低</b>：掺杂越重，低温下杂质冻结（载流子"冻回"杂质能级）开始得更早、更明显，故下限更低。</li>
</ul>
<p>所以<b>掺杂越重，工作温区越宽</b>——但代价是简并化、迁移率下降。</p>
<p class="lead"><b>第 8 题的"两个温度方向"</b></p>
<p>$$\frac1\mu=\frac1{\mu_L}+\frac1{\mu_I},\qquad \mu_L\propto T^{-3/2},\quad \mu_I\propto\frac{T^{3/2}}{N_I}$$</p>
<p>低温时 $\mu_I$ 小（占主导）、随 $T$ 升高而增大；高温时 $\mu_L$ 小、随 $T$ 升高而减小 → 合成的 $\mu(T)$ 出现极大值。</p>`,
kp: [String.raw`$\mu=q\tau/m^*$`,String.raw`电离杂质散射 $\mu_I\propto T^{3/2}/N_I$`,String.raw`声学波散射 $\mu_L\propto T^{-3/2}$`,'极性光学波散射','速度饱和与谷间转移','工作温区'],
comment:String.raw`13 个空几乎全是「两种散射的温度方向相反」的推论：<b>低温低迁移率（杂质散射）→ 升温变好；高温低迁移率（晶格散射）→ 升温变坏</b>。只要抓住这一条，第 3、6、7、8、9 题可以一起答出来。<b>第 10 题要特别注意"Si 与 GaAs 的机制不同"</b>：Si 是速度饱和（散射增强），GaAs 是谷间转移（迁移率骤降），两者不是同一回事。`
});

A.push({
pid:P(), sec:11, secTitle:S1,
label:'第3章 · 选择', title:'散射机构、电阻率与样品比较（选择 1–6）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>对 Si 而言，载流子迁移率随电场增强而降低，是因为载流子与晶格发生了（ ）；对 GaAs 而言，负微分电导是由于电子发生（ ），迁移率变（ ）<br>A. 光学波散射　B. 声学波散射　C. 电离杂质散射　D. 谷间散射　E. 变大　F. 变小　G. 不变</td><td class="ansv">A；D；F</td><td class="kpc">强场热载流子→光学波散射；$\Gamma\to L$ 谷间转移→迁移率变小</td></tr>
<tr class="imp"><td class="n">2</td><td>室温下，晶格振动是（ ）中主要的散射机制，而电离杂质散射和晶格振动是（ ）中主要的散射机制<br>A. 本征半导体　B. 非本征半导体</td><td class="ansv">A；B</td><td class="kpc">本征材料杂质少；掺杂材料两种并存</td></tr>
<tr><td class="n">3</td><td>半导体的电阻率由（ ）电导率决定，（ ）对电阻率的贡献可以忽略<br>A. 多子　B. 少子</td><td class="ansv">A；B</td><td class="kpc">$\sigma=nq\mu_n+pq\mu_p$，少子浓度小几个数量级</td></tr>
<tr class="imp"><td class="n">5</td><td>因库仑力作用引起的散射机构是（ ），该散射机构决定的迁移率成分随温度升高而（ ）<br>A. 电离杂质散射　B. 晶格振动散射　C. 增大　D. 减小</td><td class="ansv">A；C</td><td class="kpc">库仑散射；$\mu_I\propto T^{3/2}$ 随 $T$ 增大</td></tr>
<tr class="imp"><td class="n">6</td><td>室温下有两块硅样品：A 为本征材料，B 中同时掺入 $1\times10^{17}\ \mathrm{cm^{-3}}$ 的砷和 $1\times10^{17}\ \mathrm{cm^{-3}}$ 的铝，则它们的电阻率（ ）<br>A. $A>B$　B. $A\ge B$　C. $A=B$　D. $A\le B$　E. $A&lt;B$</td><td class="ansv">C</td><td class="kpc">完全补偿 → 净杂质≈0 → 载流子浓度仍为本征值 $n_i$ → 电阻率相同</td></tr>
</tbody></table>
<p style="font-size:.86em;color:var(--muted);margin:.3em 0 0">＊原卷缺第 4 题编号。</p>`,
answer:'',
solution:String.raw`
<p class="lead"><b>第 6 题的推理</b></p>
<p>样品 B 中 $N_D=N_A=10^{17}\ \mathrm{cm^{-3}}$，<b>完全补偿</b>，净杂质浓度为零。由电中性条件与质量作用定律，$n_0-p_0=N_D-N_A=0$、$n_0p_0=n_i^2$，故</p>
<p>$$n_0=p_0=n_i=1.5\times10^{10}\ \mathrm{cm^{-3}}$$</p>
<p>与样品 A（本征）完全相同，故 $\sigma$ 相同、$\rho$ 相同，选 C。</p>
<p><b>补充说明</b>：严格说 B 中电离杂质浓度高达 $2\times10^{17}\ \mathrm{cm^{-3}}$，电离杂质散射更强、迁移率略低，$\rho_B$ 会<b>略大于</b> $\rho_A$（约高几个百分点）。但作为选择题，其考点是<b>「补偿不改变载流子浓度」</b>，故标准答案为 C。</p>`,
kp:['强场散射机制','本征/非本征的散射','多子决定电阻率','电离杂质散射','完全补偿'],
comment:String.raw`第 6 题是本章最有"物理味"的一题：<b>补偿掺杂把施主和受主"互相抵消"，载流子浓度退回本征值，但散射中心却翻倍</b>——这提示我们「电阻率由 $n$ 和 $\mu$ 共同决定」，只看浓度会漏掉迁移率。答题时若写 C 并补一句"严格讲 B 因电离杂质散射更强而略高"，是最完整的答案。`
});

/* ---------- 第 5 章 扩散 ---------- */
const S2 = '12 · 基础练习 · 扩散与连续性方程';

A.push({
pid:P(), sec:12, secTitle:S2,
label:'第5章 · 判断+填空', title:'稳态扩散、爱因斯坦关系与连续性方程（判断 1–6、填空 7–13）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>判断／答案</th><th>理由／关联知识点</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">判1</td><td>稳态扩散指的是半导体中各处载流子的浓度相同</td><td class="ansv no">×</td><td class="kpc">稳态＝浓度<b>不随时间</b>变化，可以有梯度（$\partial/\partial t=0$，$\partial/\partial x\ne0$）</td></tr>
<tr class="imp"><td class="n">判2</td><td>在非平衡半导体中，扩散电流密度方向与载流子浓度梯度方向相同</td><td class="ansv no">×</td><td class="kpc">$(J_p)_{\text{扩}}=-qD_p\dfrac{\mathrm d\Delta p}{\mathrm dx}$，与梯度<b>反向</b></td></tr>
<tr><td class="n">判3</td><td>爱因斯坦关系反映了非简并半导体内载流子迁移率与扩散系数的关系</td><td class="ansv ok">√</td><td class="kpc">$\dfrac{D}{\mu}=\dfrac{k_0T}{q}$</td></tr>
<tr class="imp"><td class="n">判4</td><td>爱因斯坦关系是基于热平衡状态讨论得出的结论，因此只能适用于热平衡半导体</td><td class="ansv no">×</td><td class="kpc">推导用平衡态，但结论在<b>非简并、小注入</b>下仍近似成立</td></tr>
<tr><td class="n">判5</td><td>连续性方程是漂移、扩散同时存在并考虑复合与产生诸因素后，少子所遵守的运动方程</td><td class="ansv ok">√</td><td class="kpc">少子连续性方程</td></tr>
<tr class="imp"><td class="n">判6</td><td>连续性方程反映少子浓度在半导体内的空间分布，与时间变化率无关</td><td class="ansv no">×</td><td class="kpc">方程左边正是 $\dfrac{\partial\Delta p}{\partial t}$</td></tr>
<tr><td class="n">填7</td><td>半导体在外加电场下，载流子将会做（ ）运动，其运动速度正比于（ ），比例系数称为（ ）</td><td class="ansv">漂移；电场强度；迁移率</td><td class="kpc">$v_d=\mu E$</td></tr>
<tr><td class="n">填8</td><td>当半导体中的载流子浓度存在梯度分布时，载流子将做（ ）运动；扩散流密度与浓度梯度成正比，比例系数称为（ ）</td><td class="ansv">扩散；扩散系数 $D$</td><td class="kpc">$S=-D\dfrac{\mathrm dn}{\mathrm dx}$</td></tr>
<tr class="imp"><td class="n">填9</td><td>爱因斯坦关系能够反映（ ）与（ ）之间的联系</td><td class="ansv">迁移率 $\mu$；扩散系数 $D$</td><td class="kpc">$D/\mu=k_0T/q$</td></tr>
<tr><td class="n">填10</td><td>连续性方程描述少子随空间与时间变化，同时考虑了漂移运动、（ ）运动、（ ）以及其他外界因素引起的产生</td><td class="ansv">扩散；复合</td><td class="kpc">漂移＋扩散＋复合＋产生</td></tr>
<tr class="imp"><td class="n">填11</td><td>（ ）表示非平衡载流子在复合前所能扩散深入的平均距离，（ ）表示非平衡载流子在复合前所能漂移深入的平均距离</td><td class="ansv">扩散长度 $L=\sqrt{D\tau}$；漂移长度 $L_E=\mu E\tau$</td><td class="kpc">扩散长度／漂移长度</td></tr>
<tr class="imp"><td class="n">填12</td><td>某半导体表面附近空穴浓度梯度为 $10^{19}\ \mathrm{cm^{-4}}$，空穴扩散系数为 $10\ \mathrm{cm^2/s}$，则扩散电流密度大小是（ ）</td><td class="ansv">$16\ \mathrm{A/cm^2}$</td><td class="kpc">$J_p=qD_p\left|\dfrac{\mathrm dp}{\mathrm dx}\right|$</td></tr>
<tr><td class="n">填13</td><td>半导体中载流子定向运动形成电流的两大驱动力是（ ）和（ ）</td><td class="ansv">电场（漂移）；浓度梯度（扩散）</td><td class="kpc">漂移与扩散</td></tr>
</tbody></table>`,
answer:'',
solution:String.raw`
<p class="lead"><b>填 12 的计算</b></p>
<p>$$J_p=qD_p\left|\frac{\mathrm dp}{\mathrm dx}\right|=1.602\times10^{-19}\times10\times10^{19}=1.602\times10^{20}\times10^{-19}=16\ \mathrm{A/cm^2}$$</p>
<p><b>单位核对</b>：$q[\mathrm C]\times D[\mathrm{cm^2/s}]\times\dfrac{\mathrm dp}{\mathrm dx}[\mathrm{cm^{-4}}]=\mathrm{C/(cm^2\cdot s)}=\mathrm{A/cm^2}$ ✓。</p>
<p class="lead"><b>判 2 的方向问题</b></p>
<p>设 $\Delta p$ 沿 $+x$ 减小（$\mathrm d\Delta p/\mathrm dx&lt;0$），则空穴向 $+x$ 扩散（$S_p>0$），但</p>
<p>$$(J_p)_{\text{扩}}=-qD_p\frac{\mathrm d\Delta p}{\mathrm dx}>0$$</p>
<p>即<b>空穴扩散电流与扩散流同向、与浓度梯度反向</b>。对电子：$S_n=-D_n\frac{\mathrm dn}{\mathrm dx}$，而 $J_n=-qS_n$，故<b>电子扩散电流与电子流反向</b>。</p>`,
kp:['稳态的定义','扩散电流的方向','爱因斯坦关系','连续性方程的构成','扩散长度/漂移长度','扩散电流计算'],
comment:String.raw`判断题 4 值得强调：<b>爱因斯坦关系虽然由热平衡推出，却在小注入非平衡下仍然成立</b>——因为它的物理根源是"载流子的热运动能量 $k_0T$"，只要分布仍是玻尔兹曼型就不受影响。这也是为什么所有器件方程里都放心地用 $D=\frac{k_0T}{q}\mu$。<b>填 12 的关键是单位</b>：梯度单位是 $\mathrm{cm^{-4}}$（浓度 $\mathrm{cm^{-3}}$ 再除以长度），不是 $\mathrm{cm^{-3}}$。`
});

A.push({
pid:P(), sec:12, secTitle:S2,
label:'第5章 · 选择', title:'扩散流、扩散长度与电流方向（选择 1–13）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>题目</th><th>答案</th><th>关联知识点</th></tr></thead>
<tbody>
<tr><td class="n">1</td><td>非平衡载流子的扩散运动是由于（ ）引起的<br>A. 光照　B. 浓度梯度　C. 电场　D. 注入</td><td class="ansv">B</td><td class="kpc">扩散的驱动力是浓度梯度</td></tr>
<tr><td class="n">2</td><td>扩散流密度与非平衡载流子的（ ）成正比<br>A. 浓度　B. 浓度梯度　C. 寿命　D. 迁移率</td><td class="ansv">B</td><td class="kpc">$S=-D\dfrac{\mathrm d\Delta p}{\mathrm dx}$</td></tr>
<tr class="imp"><td class="n">3</td><td>对于半导体厚样品（$W\gg L_p$）中的一维稳态扩散，以下描述正确的是（ ）<br>A. 非子浓度分布随厚度指数衰减　B. 非子浓度梯度随厚度指数减小　C. 非子扩散流密度随厚度指数减小　D. 非子在扩散过程中应考虑复合</td><td class="ansv">A、B、C、D</td><td class="kpc">$\Delta p=\Delta p_0e^{-x/L_p}$，三者都按 $e^{-x/L_p}$ 衰减，且厚样品中复合不可忽略</td></tr>
<tr class="imp"><td class="n">4</td><td>对于半导体薄样品（$W\ll L_p$）中的一维稳态扩散，以下描述正确的是（ ）<br>A. 非子浓度分布随厚度线性衰减　B. 非子浓度梯度不变　C. 非子扩散流密度不变　D. 非子在扩散过程中可忽略复合</td><td class="ansv">A、B、C、D</td><td class="kpc">$W\ll L_p$ → 复合可忽略 → 线性分布、梯度恒定、流密度恒定</td></tr>
<tr class="imp"><td class="n">5</td><td>N 型半导体中载流子同时存在扩散与漂移时：电子扩散电流与扩散运动方向（ ），漂移电流与电场方向（ ）；空穴漂移电流与漂移运动方向（ ），漂移电流与电场方向（ ）<br>A. 相同　B. 相反　C. 无法判断</td><td class="ansv">B；A；A；A</td><td class="kpc">电子带负电：$J_n=-qS_n$、$J_n$ 与 $E$ 同向；空穴带正电：都同向</td></tr>
<tr class="imp"><td class="n">6</td><td>一维情形下，沿 $x$ 方向光照掺杂均匀的 N 型半导体，外加均匀电场，无其它产生，达到稳态后，以下<b>不成立</b>的是（ ）<br>A. $\dfrac{\mathrm dE}{\mathrm dx}=0$　B. $g_p=0$　C. $\dfrac{\mathrm dp}{\mathrm dt}=0$　D. $\dfrac{\mathrm d^2p}{\mathrm dx^2}=\dfrac{\mathrm d^2\Delta p}{\mathrm dx^2}$　E. 以上都成立</td><td class="ansv">E</td><td class="kpc">四项都成立：均匀电场、无其他产生、稳态、$p=p_0+\Delta p$ 且 $p_0$ 为常数</td></tr>
<tr class="imp"><td class="n">7</td><td>均匀掺杂的 N 型半导体，光均匀照射，内部均匀产生非子，无电场、无其它产生，达到稳态<b>前</b>，以下成立的是（ ）<br>A. $\dfrac{\mathrm dp}{\mathrm dx}=0$　B. $g_p=0$　C. $\dfrac{\mathrm dp}{\mathrm dt}=0$　D. $\dfrac{\Delta p}{\tau_p}=0$　E. 以上都成立</td><td class="ansv">A</td><td class="kpc">均匀产生 → 无梯度（A 成立）；有产生（B 错）、稳态前 $\mathrm dp/\mathrm dt\ne0$（C 错）</td></tr>
<tr class="imp"><td class="n">8</td><td>关于扩散流密度和扩散电流密度，以下表达式<b>错误</b>的是（ ）<br>A. $S_p(x)=-D_p\dfrac{\mathrm d\Delta p}{\mathrm dx}$　B. $S_n(x)=-D_n\dfrac{\mathrm d\Delta n}{\mathrm dx}$　C. $(J_p)_{\text{扩}}=-qD_p\dfrac{\mathrm d\Delta p}{\mathrm dx}$　D. $(J_n)_{\text{扩}}=-qD_n\dfrac{\mathrm d\Delta n}{\mathrm dx}$</td><td class="ansv">D</td><td class="kpc">电子带负电，应为 $(J_n)_{\text{扩}}=+qD_n\dfrac{\mathrm d\Delta n}{\mathrm dx}$</td></tr>
<tr class="imp"><td class="n">9</td><td>在室温下，非简并 Si 中电子扩散系数 $D_n$ 与杂质浓度 $N_D$ 的关系曲线</td><td class="ansv">随 $N_D$ 增大而减小（低掺杂时基本不变，高掺杂时明显下降）</td><td class="kpc">$D_n=\frac{k_0T}{q}\mu_n$，$\mu_n$ 随电离杂质散射增强而下降</td></tr>
<tr class="imp"><td class="n">10</td><td>对载流子的扩散系数没有明显影响的是（ ）<br>A. 杂质浓度　B. 有效质量　C. 电场强度　D. 温度</td><td class="ansv">C</td><td class="kpc">$D=\frac{k_0T}{q}\mu$，$\mu$ 由散射（杂质、温度）与有效质量决定；低场下与 $E$ 无关</td></tr>
<tr class="imp"><td class="n">11</td><td>半导体中载流子扩散系数的大小取决于其中的（ ）<br>A. 复合机构　B. 散射机构　C. 能带结构　D. 晶体结构</td><td class="ansv">B、C</td><td class="kpc">$D=\frac{k_0T}{q}\mu=\frac{k_0T}{q}\cdot\dfrac{q\tau}{m^*}$：散射（$\tau$）与能带结构（$m^*$）</td></tr>
<tr class="imp"><td class="n">12</td><td>Si 半导体中已知 $\mu_n=1350\ \mathrm{cm^2/(V\cdot s)}$，则电子扩散系数为（ ）<br>A. $3.51$　B. $35.1$　C. $1.35$　D. $13.5\ \mathrm{cm^2/s}$</td><td class="ansv">B</td><td class="kpc">$D_n=\frac{k_0T}{q}\mu_n=0.0259\times1350=35.0$</td></tr>
<tr class="imp"><td class="n">13</td><td>半导体中某少子寿命为 $8.7\times10^{-8}\ \mathrm{s}$，扩散系数为 $13\ \mathrm{cm^2/s}$，则扩散长度是（ ）<br>A. $10.6\ \mu\mathrm{m}$　B. $1.06\ \mu\mathrm{m}$　C. $10.6\ \mathrm{cm}$　D. $1.06\ \mathrm{nm}$</td><td class="ansv">A</td><td class="kpc">$L=\sqrt{D\tau}=\sqrt{13\times8.7\times10^{-8}}=1.06\times10^{-3}\ \mathrm{cm}=10.6\ \mu\mathrm{m}$</td></tr>
</tbody></table>`,
answer:'',
solution:String.raw`
<p class="lead"><b>第 5 题：四个方向的"配对规则"</b></p>
<table class="qa">
<thead><tr><th>量</th><th>方向关系</th></tr></thead>
<tbody>
<tr><td>电子扩散流 $S_n$</td><td>沿浓度降低方向</td></tr>
<tr><td>电子扩散电流 $J_n$</td><td>与 $S_n$ <b>反向</b>（因带负电）</td></tr>
<tr><td>电子漂移电流</td><td>与 $E$ <b>同向</b>（$J_n=qn\mu_nE$）</td></tr>
<tr><td>空穴扩散流 $S_p$</td><td>沿浓度降低方向</td></tr>
<tr><td>空穴扩散电流 $J_p$</td><td>与 $S_p$ <b>同向</b></td></tr>
<tr><td>空穴漂移电流</td><td>与 $E$ <b>同向</b></td></tr>
</tbody></table>
<p>所以答案依次为：B、A、A、A。</p>
<p class="lead"><b>第 12、13 题的计算</b></p>
<p>$$D_n=\frac{k_0T}{q}\mu_n=0.0259\times1350=35.0\ \mathrm{cm^2/s}\;\;(\text{选 B})$$</p>
<p>$$L_p=\sqrt{D_p\tau}=\sqrt{13\times8.7\times10^{-8}}=1.06\times10^{-3}\ \mathrm{cm}=10.6\ \mu\mathrm{m}\;\;(\text{选 A})$$</p>
<p class="lead"><b>第 9 题的曲线形状</b></p>
<p>低掺杂（$N_D\lesssim10^{16}$）时 $D_n$ 基本由声学波散射决定、近似不变；$N_D\gtrsim10^{17}$ 后电离杂质散射迅速增强，$\mu_n$ 下降，$D_n$ 随 $N_D$ 增大而<b>单调下降</b>。</p>`,
kp: ['扩散的驱动力','厚样品/薄样品的扩散解','扩散电流的方向','连续性方程各项','$D_n$–$N_D$ 关系',String.raw`$D=\frac{k_0T}{q}\mu$`,String.raw`$L=\sqrt{D\tau}$`],
comment:String.raw`这一组是全卷「最容易混淆方向」的地方：<b>四个量、四种方向</b>，安全做法是先算"流"再乘电荷。<b>第 3、4 题要对比记</b>：厚样品＝指数、可变梯度、必须考虑复合；薄样品＝线性、恒定梯度、可忽略复合——这两条是"厚/薄"判据的全部内容。<b>第 6、7 题是同一物理情境的稳态/非稳态对照</b>：稳态时 $\mathrm dp/\mathrm dt=0$ 成立，非稳态则不成立，其余各项（无梯度、无产生）与时间无关。`
});
})();
