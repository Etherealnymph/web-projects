/* 04 · 作业五（金半接触）+ 作业六（MIS） */
(function(){
const A = window.__DATA__ = window.__DATA__ || [];
const P = () => (window.__PID = (window.__PID||0)+1);

/* ================= 作业五 ================= */
const S5 = '07 · 作业五 · 金属—半导体接触';

A.push({
pid:P(), sec:7, secTitle:S5,
label:'作业五 · 1', title:'功函数差 2 eV 的肖特基势垒：平衡、正偏、反偏能带图',
statement:String.raw`
<p>若某金属与某 N 型半导体接触，形成肖特基势垒。若金属和半导体的功函数相差 $2\ \mathrm{eV}$，试分别画出平衡时、施加 $1\ \mathrm{V}$ 正偏压、施加 $1\ \mathrm{V}$ 负偏压时的能带图，标注肖特基两侧势垒高度、费米能级位置。</p>`,
answer:String.raw`<p>金属侧势垒 $q\varphi_B$ <b>始终不变</b>；半导体侧势垒（能带弯曲量）平衡时 $2\ \mathrm{eV}$、正偏 $1\ \mathrm{V}$ 时 $1\ \mathrm{eV}$、反偏 $1\ \mathrm{V}$ 时 $3\ \mathrm{eV}$。费米能级：平衡时一条水平线；加偏压后两侧错开 $qV$。</p>`,
solution:String.raw`
<p class="lead"><b>一、画图前必须固定的三条规则</b></p>
<ul>
<li><b>费米能级</b>：平衡时整个体系 $E_F$ 是一条水平线；加偏压 $V$ 后金属侧与半导体侧不再重合，能量上相差 $qV$。</li>
<li><b>金属侧势垒</b>：$q\varphi_B=q(\varphi_m-\chi)$ 只由材料本身决定，<b>不随偏压变化</b>。本题只给功函数之差、没给电子亲和能，故 $\varphi_B$ 只能写成 $\varphi_B=\varphi_m-\chi$ 的形式。</li>
<li><b>半导体侧势垒</b>：等于接触电势差（内建电势）$qV_{bi}=q\varphi_B-(E_c-E_F)_{\text{体内}}$，<b>随偏压线性变化</b>：正偏（金属接正）降低，反偏升高。</li>
</ul>
<p class="lead"><b>二、本题的已知量与待标量</b></p>
<p>$\varphi_m-\varphi_s=2\ \mathrm{V}$，在能带图上表现为半导体能带在界面附近<b>向上弯曲的总量</b>。设体内 $E_c-E_F$ 为某个由掺杂决定的量（本题未给，作为符号保留），则</p>
<p>$$qV_{bi}=q(\varphi_m-\varphi_s)-(E_c-E_F)_{\text{体内}}=2\ \mathrm{eV}-(E_c-E_F)$$</p>
<p>即平衡时量出的两个数——金属侧 $\varphi_B$ 与半导体侧 $V_{bi}$——相差恰好是体内 $E_c-E_F$。</p>
<table class="qa">
<thead><tr><th>状态</th><th>偏压 $V$</th><th>半导体侧势垒 $q(V_{bi}-V)$</th><th>金属侧势垒 $q\varphi_B$</th><th>两条 $E_F$</th><th>能带弯曲</th></tr></thead>
<tbody>
<tr><td>平衡</td><td>$0$</td><td>$2\ \mathrm{eV}$</td><td>$q\varphi_B$</td><td>拉平，$E_{Fm}=E_{Fs}$</td><td>向上弯 $2\ \mathrm{eV}$</td></tr>
<tr><td>正偏（金属接＋）</td><td>$+1\ \mathrm{V}$</td><td>$1\ \mathrm{eV}$</td><td>仍为 $q\varphi_B$</td><td>$E_{Fm}$ 比 $E_{Fs}$ 低 $1\ \mathrm{eV}$</td><td>向上弯 $1\ \mathrm{eV}$，耗尽区变窄</td></tr>
<tr><td>反偏（金属接－）</td><td>$-1\ \mathrm{V}$</td><td>$3\ \mathrm{eV}$</td><td>仍为 $q\varphi_B$</td><td>$E_{Fm}$ 比 $E_{Fs}$ 高 $1\ \mathrm{eV}$</td><td>向上弯 $3\ \mathrm{eV}$，耗尽区变宽</td></tr>
</tbody></table>
<p>符号约定：取体内 $E_{Fs}$ 作为能量参考（画成水平不动），金属 $E_{Fm}$ 随之移动。</p>
<p class="lead"><b>三、三种情况的画法（文字版，供对照打分）</b></p>
<ul>
<li><b>平衡</b>：先画一条水平的 $E_F$ 贯穿金属与半导体（贯穿＝平衡的标志）。金属侧画一条水平线代表 $E_{Fm}$ 附近的能带，它与 $E_F$ 距离即 $q\varphi_B$；半导体侧体内 $E_c$ 在 $E_F$ 上方 $(E_c-E_F)_{\text{体内}}$ 处，越靠近界面能带越往上抬，到界面共抬 $2\ \mathrm{eV}$，于是界面处 $E_c$ 与金属侧对齐。标注 $q\varphi_B$（金属侧）、$qV_{bi}=2\ \mathrm{eV}$（半导体侧）、耗尽层宽度 $x_d$。</li>
<li><b>正偏 $1\ \mathrm{V}$</b>：$E_{Fm}$ 比 $E_{Fs}$ 低 $1\ \mathrm{eV}$（两条线错开）；金属侧 $E_c$ 与 $E_{Fm}$ 距离不变；半导体能带向上弯曲量减为 $1\ \mathrm{eV}$、耗尽区变窄。<b>结果</b>：半导体电子看到的势垒从 $2\ \mathrm{eV}$ 降到 $1\ \mathrm{eV}$，大量电子越过势垒进入金属 → 正向电流大，这就是正向导通。</li>
<li><b>反偏 $1\ \mathrm{V}$</b>：$E_{Fm}$ 比 $E_{Fs}$ 高 $1\ \mathrm{eV}$；弯曲量增到 $3\ \mathrm{eV}$、耗尽区变宽。<b>结果</b>：半导体电子面对的势垒升到 $3\ \mathrm{eV}$，几乎无法越过；能越过金属侧势垒 $\varphi_B$ 进入半导体的电子由金属中费米分布的高能尾巴决定，基本不随反偏电压变化 → 反向电流很小且饱和。</li>
</ul>
<p class="lead"><b>四、关键结论</b></p>
<p>外加偏压<b>只改变半导体一侧的势垒高度与耗尽区宽度，不改变金属一侧的势垒高度</b>。反向饱和电流只由 $\varphi_B$ 与 $T$ 决定，因此几乎与反偏电压无关；而正向电流随正偏指数上升——两者结合即得肖特基二极管的单向导电性。</p>`,
kp: ['肖特基势垒能带图',String.raw`金属侧 $\varphi_B$ 与半导体侧 $V_{bi}$`,'偏压对两侧势垒的不同作用','费米能级错开 $qV$'],
comment:String.raw`画这类图只需守两条"不变量"：<b>① 金属侧 $\varphi_B$ 恒定；② 平衡时 $E_F$ 必须贯穿（一条水平线）</b>。剩下的都是"半导体能带弯曲量变多变少"。评分点通常在标注上：<b>$q\varphi_B$、$qV_{bi}$、$x_d$、$qV$ </b>四处，漏一个扣一处。注意本题只给功函数差、没给 $\chi$，所以<b>不能把 $\varphi_B$ 写成具体数字</b>，这是题目故意设的"显示你是否知道 $\varphi_B$ 由 $\varphi_m-\chi$ 决定"。`
});

A.push({
pid:P(), sec:7, secTitle:S5,
label:'作业五 · 2', title:'TiW / n-Si 肖特基二极管的定量计算',
statement:String.raw`
<p>$300\ \mathrm{K}$ 时，有一块施主浓度 $N_D=10^{16}\ \mathrm{cm^{-3}}$ 的 n 型 Si 材料，杂质全部电离，其 $(100)$ 面与 TiW 合金接触形成肖特基二极管。已知 TiW 功函数 $4.59\ \mathrm{eV}$，Si 电子亲和能 $4.05\ \mathrm{eV}$，$E_g=1.12\ \mathrm{eV}$，相对介电常数 $12$，$N_C=10^{19}\ \mathrm{cm^{-3}}$，$k_0T=0.026\ \mathrm{eV}$，$n_i=10^{10}\ \mathrm{cm^{-3}}$，$\varepsilon_0=8.85\times10^{-14}\ \mathrm{F/cm}$，$A^*=240\ \mathrm{A/(cm^2K^2)}$，$\mu_n=1500$、$\mu_p=500\ \mathrm{cm^2/(V\cdot s)}$。</p>
<p>(1) 计算半导体的功函数 $W_s$；(2) 计算平衡时 Si(100) 表面的表面势 $V_s$ 和表面电子浓度 $n_s$；(3) 若施加 $1\ \mathrm{V}$ 反向偏压，计算肖特基势垒两侧的势垒高度以及势垒宽度；(4) 若由于镜像力和隧道效应导致势垒高度降低 $0.02\ \mathrm{eV}$，计算施加 $0.3\ \mathrm{V}$ 正向偏压时流过二极管的电流密度；(5) 若表面势垒区内少子浓度为线性分布，计算流过二极管的少子扩散电流。</p>`,
answer:String.raw`<p>(1) $W_s\approx4.23\ \mathrm{eV}$。</p>
<p>(2) $V_s\approx0.36\ \mathrm{V}$（能带向上弯 0.36 eV），$n_s\approx9.6\times10^{9}\ \mathrm{cm^{-3}}$。</p>
<p>(3) 金属侧 $\varphi_B=0.54\ \mathrm{V}$（不变）；半导体侧 $1.36\ \mathrm{V}$；$x_d\approx0.42\ \mu\mathrm{m}$，$|E|_{\max}\approx6.4\times10^{4}\ \mathrm{V/cm}$。</p>
<p>(4) $J\approx4.5\times10^{3}\ \mathrm{A/cm^2}$。</p>
<p>(5) $J_{p,\text{扩}}\approx2\times10^{-4}\ \mathrm{A/cm^2}$，比热电子发射电流小 7 个数量级，<b>可忽略</b>。</p>`,
solution:String.raw`
<p class="lead"><b>(1) 半导体的功函数</b></p>
<p>功函数＝电子亲和能＋导带底到费米能级的距离。施主全部电离，$n_0=N_D$：</p>
<p>$$E_c-E_F=k_0T\ln\frac{N_c}{N_D}=0.026\ln\frac{10^{19}}{10^{16}}=0.026\times6.908=0.180\ \mathrm{eV}$$</p>
<p>$$W_s=\chi+(E_c-E_F)=4.05+0.18=\boxed{4.23\ \mathrm{eV}}$$</p>
<p>校核：$E_c-E_F=0.18\ \mathrm{eV}\gg k_0T$，与「杂质全部电离、非简并」自洽。</p>
<p class="lead"><b>(2) 平衡时的表面势与表面电子浓度</b></p>
<p>接触后费米能级拉平，半导体能带向上弯曲，弯曲总量（接触电势差）</p>
<p>$$qV_s=W_m-W_s=4.59-4.23=0.36\ \mathrm{eV}\;\Longrightarrow\;V_s=0.36\ \mathrm{V}$$</p>
<p>$$n_s=N_De^{-qV_s/k_0T}=10^{16}e^{-0.36/0.026}=10^{16}\times e^{-13.85}=10^{16}\times9.6\times10^{-7}=\boxed{9.6\times10^{9}\ \mathrm{cm^{-3}}}$$</p>
<p>比体内（$10^{16}$）小 6 个数量级——界面附近电子几乎被"赶空"，即<b>耗尽层</b>。这正是肖特基势垒整流特性的来源。</p>
<p class="lead"><b>(3) 反偏 $1\ \mathrm{V}$ 时两侧势垒与势垒宽度</b></p>
<p>① 金属侧（不随偏压变）：</p>
<p>$$q\varphi_B=W_m-\chi=4.59-4.05=0.54\ \mathrm{eV}$$</p>
<p>② 半导体侧（随偏压变）：</p>
<p>$$q(V_{bi}+V_R)=0.36+1.0=1.36\ \mathrm{eV}$$</p>
<p>③ 势垒宽度（耗尽近似，突变结）：</p>
<p>$$x_d=\sqrt{\frac{2\varepsilon_s(V_{bi}+V_R)}{qN_D}}=\sqrt{\frac{2\times(12\times8.85\times10^{-14})\times1.36}{1.602\times10^{-19}\times10^{16}}}=\sqrt{1.80\times10^{-9}}=4.2\times10^{-5}\ \mathrm{cm}=0.42\ \mu\mathrm{m}$$</p>
<p>界面最大电场：</p>
<p>$$|E|_{\max}=\frac{qN_Dx_d}{\varepsilon_s}=\frac{1.602\times10^{-19}\times10^{16}\times4.2\times10^{-5}}{1.062\times10^{-12}}=6.4\times10^{4}\ \mathrm{V/cm}$$</p>
<p><b>小结</b>：反偏时金属侧 $\varphi_B$ 不动，半导体侧由 $0.36\ \mathrm{eV}$ 升到 $1.36\ \mathrm{eV}$，势垒宽度由约 $0.22\ \mu\mathrm{m}$ 增宽到 $0.42\ \mu\mathrm{m}$。反向电流由 $\varphi_B$ 决定，几乎不随反偏电压变化——这就是反向饱和电流的由来。</p>
<p class="lead"><b>(4) 势垒降低 $0.02\ \mathrm{eV}$ 后，$0.3\ \mathrm{V}$ 正偏时的电流密度</b></p>
<p>有效势垒高度 $q\varphi_B'=0.54-0.02=0.52\ \mathrm{eV}$。肖特基二极管以多子热电子发射为主：</p>
<p>$$J=A^*T^2e^{-q\varphi_B'/k_0T}\left(e^{qV/k_0T}-1\right)$$</p>
<p>其中 $A^*T^2=240\times300^2=2.16\times10^{7}\ \mathrm{A/(cm^2)}$、$e^{-0.52/0.026}=e^{-20}=2.06\times10^{-9}$、$e^{0.3/0.026}-1=e^{11.54}-1=1.02\times10^{5}$：</p>
<p>$$J=2.16\times10^{7}\times2.06\times10^{-9}\times1.02\times10^{5}=4.5\times10^{3}\ \mathrm{A/cm^2}$$</p>
<p>讨论：若忽略这 $0.02\ \mathrm{eV}$ 的降低，$J_0$ 变为 $e^{-0.02/0.026}=0.46$ 倍，即 $J\approx2.1\times10^{3}\ \mathrm{A/cm^2}$。<b>势垒每降 $0.02\ \mathrm{eV}$，正向电流就翻一倍多</b>——这就是镜像力对肖特基 I–V 特性如此敏感的原因。同时 $4.5\ \mathrm{kA/cm^2}$ 在真实器件中会因串联电阻而达不到。</p>
<p class="lead"><b>(5) 势垒区内少子线性分布时的少子扩散电流</b></p>
<p>正偏 $0.3\ \mathrm{V}$ 时势垒区宽度（$V_{bi}-V=0.36-0.30=0.06\ \mathrm{V}$）：</p>
<p>$$x_d=\sqrt{\frac{2\varepsilon_s\times0.06}{qN_D}}=8.9\times10^{-6}\ \mathrm{cm}$$</p>
<p>界面处少子（空穴）浓度 $p_s=p_0e^{qV/k_0T}$，势垒区边界为平衡值 $p_0=\dfrac{n_i^2}{N_D}=10^{4}\ \mathrm{cm^{-3}}$，线性分布给出梯度</p>
<p>$$\frac{\mathrm dp}{\mathrm dx}=\frac{p_0\left(e^{qV/k_0T}-1\right)}{x_d}=\frac{10^{4}\times1.02\times10^{5}}{8.9\times10^{-6}}=1.15\times10^{14}\ \mathrm{cm^{-4}}$$</p>
<p>$$J_{p,\text{扩}}=qD_p\frac{\mathrm dp}{\mathrm dx}=1.602\times10^{-19}\times(0.026\times500)\times1.15\times10^{14}=2.4\times10^{-4}\ \mathrm{A/cm^2}$$</p>
<p>与热电子发射电流之比 $\dfrac{2.4\times10^{-4}}{4.5\times10^{3}}\approx5\times10^{-8}$，<b>完全可以忽略</b>。</p>
<p>这正是肖特基二极管与 pn 结最本质的区别：<b>pn 结靠少子注入与扩散导电（有电荷存储、反向恢复慢）；肖特基靠多子热电子发射（无少子存储、开关极快）</b>。</p>`,
kp: [String.raw`$W_s=\chi+(E_c-E_F)$`,'$qV_s=W_m-W_s$','表面载流子浓度 $n_s=N_De^{-qV_s/k_0T}$',String.raw`耗尽近似 $x_d$ 与 $|E|_{\max}$`,String.raw`热电子发射 $J=A^*T^2e^{-q\varphi_B/k_0T}(e^{qV/k_0T}-1)$`,'少子扩散电流比较'],
comment:String.raw`这道题是本章"全流程"标准题，五问对应五个公式，串起来就是一张肖特基器件的完整画像。<b>最容易错的是第(2)问的 $n_s$</b>：$e^{-13.85}=9.6\times10^{-7}$，很容易少乘或多乘一个数量级，建议写成 $10^{16}\times10^{-6.15}$ 再算。<b>第(5)问的意义不在数字，而在比值</b>——把 $10^{-4}$ 与 $10^{3}$ 一除，才真正理解"单极器件"四个字。`
});

/* ================= 作业六 ================= */
const S6 = '08 · 作业六 · MIS 结构';

A.push({
pid:P(), sec:8, secTitle:S6,
label:'作业六 · 1', title:'MIS 电容的高频与低频 C–V 曲线及其成因',
statement:String.raw`
<p>MIS 结构的 C–V 特性与频率有关，右图为某 MIS 电容在小信号状态时的 C–V 特性图，分别指出该 MIS 电容的高频和低频 C–V 特性曲线，并说明其产生原因。</p>`,
answer:String.raw`<p><b>高频</b>：强反型区电容饱和在 $C_{\min}=\dfrac{C_{ox}C_{d\max}}{C_{ox}+C_{d\max}}$、不再回升的那支；<b>低频</b>：强反型区电容重新回升、趋近 $C_{ox}$ 的那支。<b>成因</b>：高频下少子的产生—复合跟不上小信号，反型层电荷被"冻结"，只有耗尽层边缘响应；低频下少子有充裕时间增减，表面被反型层屏蔽成近似导体。</p>`,
solution:String.raw`
<p class="lead"><b>一、总电容是串联</b></p>
<p>$$C=\left(\frac{1}{C_{ox}}+\frac{1}{C_s}\right)^{-1},\qquad C_{ox}=\frac{\varepsilon_{ox}\varepsilon_0}{d_{ox}}$$</p>
<p>两个极限：<b>上限</b> $C\to C_{ox}$（表面像一块导体板，$C_s\to\infty$）——积累区与<b>低频强反型区</b>都属于这种情况；<b>下限</b> $C\to\dfrac{C_{ox}C_{d\max}}{C_{ox}+C_{d\max}}$（只有耗尽层电荷随信号变）——<b>高频强反型区</b>。</p>
<p class="lead"><b>二、两条曲线的区分</b></p>
<ul>
<li><b>高频曲线</b>：强反型区电容<b>饱和在 $C_{\min}$ 并保持不回升</b>（图中较低、较平的那支）；</li>
<li><b>低频曲线</b>：强反型区电容<b>重新回升、趋近 $C_{ox}$</b>（图中较高的那支）。</li>
</ul>
<p>一句话判据：<b>强反型区里 $C$ 高（$\approx C_{ox}$）的是低频，$C$ 低（$=C_{\min}$）的是高频。</b></p>
<p class="lead"><b>三、成因：反型层电荷能否跟随小信号</b></p>
<p>反型层中的少子不是"现成的"，而是靠<b>少子的产生—复合</b>（体内产生、界面态产生）与少子扩散来供给／抽走，响应时间 $\tau_R$ 很长（毫秒～秒量级，与少子寿命、界面态密度、温度有关）。于是：</p>
<ul>
<li><b>高频</b>（$\omega\gg1/\tau_R$）：小信号变化太快，少子产生—复合来不及跟上，<b>反型层电荷被"冻结"</b>，不随信号增减；只有耗尽层边缘随信号移动，$C_s\to C_d$；强反型后 $x_d$ 达到最大值 $x_{dm}$ 不再变，故 $C$ 饱和在 $C_{\min}$。</li>
<li><b>低频</b>（$\omega\ll1/\tau_R$）：少子有充裕时间响应，<b>反型层电荷能随交流小信号增减</b>，表面被反型层"屏蔽"成近似理想导体，$C_s$ 很大，$C\to C_{ox}$。</li>
<li><b>中间频率</b>：少子部分响应，两条极限之间出现过渡段（有时可见"台阶"）；转折频率约 $1/\tau_R$。</li>
</ul>
<table class="qa">
<thead><tr><th>偏置状态</th><th>随小信号变化的是</th><th>高频</th><th>低频</th></tr></thead>
<tbody>
<tr><td>积累区</td><td>多子在表面堆积，进出极快</td><td>$C\approx C_{ox}$</td><td>$C\approx C_{ox}$</td></tr>
<tr><td>耗尽区</td><td>耗尽层边缘（$x_d$ 伸缩）</td><td>$C=\left(\frac1{C_{ox}}+\frac1{C_d}\right)^{-1}$</td><td>同左</td></tr>
<tr><td>强反型区</td><td>高频：反型层"冻结"；低频：反型层电荷</td><td>$C\to C_{\min}$（饱和）</td><td>$C\to C_{ox}$</td></tr>
</tbody></table>
<p class="lead"><b>四、两种常考的"额外"现象</b></p>
<ul>
<li><b>深耗尽</b>：从积累区快速扫向反型区、又不给少子产生的时间，耗尽层继续展宽，$C$ 甚至低于 $C_{\min}$，然后随时间弛豫回 $C_{\min}$——<b>这恰好反证了"少子供给"是决定曲线的关键</b>。</li>
<li><b>界面态</b>：界面态在中等频率可充放电，贡献附加电容，使曲线出现频率台阶／拉伸；界面态密度越大，高频与低频差别越明显。</li>
</ul>`,
kp:['$C_{ox}$ 与串联电容','高频/低频强反型','反型层电荷的响应时间','深耗尽','界面态对 C–V 的影响'],
comment:String.raw`判读要点只有一句：<b>看强反型区那一段——回升的是低频，饱和的是高频</b>。但答题必须给出"为什么"，即<b>少子的供给速度</b>。建议顺带写一句深耗尽，因为它是这条逻辑最漂亮的验证：<b>扫得快 → 少子来不及产生 → 耗尽层继续展宽 → $C$ 掉到 $C_{\min}$ 以下</b>。`
});

A.push({
pid:P(), sec:8, secTitle:S6,
label: '作业六 · 2', title:String.raw`证明临界强反型时 $V_s=2\varphi_B$ 并画能带图`,
statement:String.raw`
<p>试以 p 型半导体为例，证明 MIS 结构中半导体表面为临界反型状态时的表面势 $V_s=2\varphi_B$，其中 $\varphi_B$ 为费米势。并画出此时半导体表面的能带图。</p>`,
answer:String.raw`<p>临界反型的判据是<b>表面少子（电子）浓度等于体内多子（空穴）浓度</b>：$n_s=p_0$。代入 $n_s=n_ie^{qV_s/k_0T}$、$p_0=n_ie^{-q\varphi_B/k_0T}$ 即得 $V_s=2\varphi_B$。</p>`,
solution:String.raw`
<p class="lead"><b>一、符号与两个基本关系</b></p>
<p>取 p 型半导体，栅压为正时能带在表面<b>向下弯曲</b>。定义表面势（表面相对体内的电势）$V_s=\psi_s-\psi_b>0$，费米势（费米能级相对本征能级的位置，p 型取正）</p>
<p>$$\varphi_B=\frac{E_i-E_F}{q}=\frac{k_0T}{q}\ln\frac{N_A}{n_i}$$</p>
<p>由玻尔兹曼关系，体内与表面的载流子浓度：</p>
<p>$$p_0=n_ie^{-q\varphi_B/k_0T},\qquad n_s=n_ie^{qV_s/k_0T}$$</p>
<p class="lead"><b>二、临界反型的判据</b></p>
<p>临界（强）反型的定义是：<b>表面处的少子（电子）浓度恰好等于体内的多子（空穴）浓度</b>，即</p>
<p>$$n_s=p_0$$</p>
<p>此时表面由"本征型"刚刚转为反型层；再加大栅压，表面电子就超过体内空穴，反型层真正形成（这就是强反型的工程判据）。</p>
<p class="lead"><b>三、证明</b></p>
<p>把两个表达式代入判据：</p>
<p>$$n_ie^{qV_s/k_0T}=n_ie^{-q\varphi_B/k_0T}$$</p>
<p>约去 $n_i$、两边取对数：</p>
<p>$$\frac{qV_s}{k_0T}=-\frac{q\varphi_B}{k_0T}+2\ln(\cdots)\;\Longrightarrow\;\boxed{V_s=2\varphi_B}$$</p>
<p>（等价说法：临界反型时 $E_F$ 恰在表面本征能级与体内费米能级的"中点"，即表面 $E_i$ 比体内 $E_i$ 高 $2q\varphi_B$，故表面 $E_i-E_F=q\varphi_B$，正好与体内相反。）</p>
<p>$$\blacksquare$$</p>
<p class="lead"><b>四、两个常用推论（第 3、4 题要用）</b></p>
<p>最大耗尽层宽度：</p>
<p>$$x_{dm}=\sqrt{\frac{2\varepsilon_s(2\varphi_B)}{qN_A}}$$</p>
<p>阈值电压：</p>
<p>$$V_T=V_{FB}+2\varphi_B+\frac{\sqrt{2\varepsilon_sqN_A(2\varphi_B)}}{C_{ox}}$$</p>
<p>第三项就是最大耗尽层电荷 $Q_{d\max}=qN_Ax_{dm}$ 在氧化层上的电压降 $Q_{d\max}/C_{ox}$。</p>
<p class="lead"><b>五、临界反型时表面能带图的要点</b></p>
<ul>
<li><b>$E_F$ 水平</b>（热平衡、无电流）；</li>
<li><b>能带向下弯曲 $qV_s=2q\varphi_B$</b>：$E_c$、$E_i$、$E_v$ 在表面处都比体内低 $2q\varphi_B$；弯曲只发生在厚度约 $x_{dm}$ 的空间电荷区内，体内保持平坦；</li>
<li><b>表面 $E_i$ 高于 $E_F$ 达 $q\varphi_B$</b>：说明表面已反型为 n 型，但反型程度刚好与体内 p 型"对称"——这就是"临界"的含义；</li>
<li><b>浓度关系</b>：表面 $n_s=p_0$；体内 $p_0=N_A$、$n_0=n_i^2/N_A$；空间电荷区内净电荷为电离受主负电荷 $-qN_A$（宽度 $x_{dm}$）。</li>
</ul>`,
kp: ['表面势 $V_s$',String.raw`费米势 $\varphi_B$`,'临界强反型判据 $n_s=p_0$','最大耗尽层宽度','能带图三要素'],
comment:String.raw`证明只有三行，但要写清<b>判据的来源</b>：临界反型为什么定义为 $n_s=p_0$ 而不是 $n_s=n_i$？因为 $n_s=n_i$ 只是"表面变本征"（弱反型），而工程上把"少子浓度赶超体内多子"当作强反型的门槛，这样定义的 $V_s=2\varphi_B$ 才能让 $V_T$ 公式里的三项各有明确物理意义。<b>画能带图时别忘了标 $x_{dm}$ 和 $2q\varphi_B$ 这两个量</b>，它们是评分点。`
});

A.push({
pid:P(), sec:8, secTitle:S6,
label:'作业六 · 3', title:'$n^+$-Si/SiO₂/p-Si 电容：功函数、$V_{FB}$、$V_T$ 与界面电荷',
statement:String.raw`
<p>硅基 MOS 电容可采用 n 型重掺杂的 $n^+$-Si 半导体代替金属栅，构成 $n^+$-Si/SiO₂/p-Si 电容结构。若 $n^+$-Si 栅的费米能级位于导带内且比导带底高 $0.05\ \mathrm{eV}$，p-Si 衬底掺杂浓度 $N_A=10^{16}\ \mathrm{cm^{-3}}$，SiO₂ 厚度 $200\ \mathrm{nm}$，SiO₂ 相对介电常数 $3.9$，Si 相对介电常数 $12$，$n^+$-Si 与 p-Si 的电子亲和能均为 $4.05\ \mathrm{eV}$，禁带宽度均为 $1.12\ \mathrm{eV}$，$n_i=10^{10}\ \mathrm{cm^{-3}}$，$\varepsilon_0=8.85\times10^{-14}\ \mathrm{F/cm}$，温度 $300\ \mathrm{K}$。</p>
<p>(1) 计算该 MOS 电容 $n^+$-Si 栅和 p-Si 衬底的功函数，以及平带电压 $V_{FB}$；(2) 计算使衬底表面出现强反型时的阈值电压 $V_T$；(3) 若 SiO₂/p-Si 界面存在固定正电荷，测得 $V_T=2.0\ \mathrm{V}$，计算界面电荷密度；(4) 画出临界强反型时 MOS 系统能带图以及电荷块图。</p>`,
answer:String.raw`<p>(1) $W_g=4.00\ \mathrm{eV}$，$W_s=4.97\ \mathrm{eV}$，$V_{FB}=-0.97\ \mathrm{V}$。</p>
<p>(2) $2\varphi_B=0.716\ \mathrm{V}$，$V_T\approx2.60\ \mathrm{V}$。</p>
<p>(3) $Q_f\approx1.0\times10^{-8}\ \mathrm{C/cm^2}$，即 $N_f\approx6.5\times10^{10}\ \mathrm{cm^{-2}}$（正电荷）。</p>
<p>(4) 见解答中的能带图与电荷块图要点。</p>`,
solution:String.raw`
<p class="lead"><b>准备：费米势、氧化层电容</b></p>
<p>$$\varphi_B=\frac{k_0T}{q}\ln\frac{N_A}{n_i}=0.0259\ln\frac{10^{16}}{10^{10}}=0.0259\times13.82=0.358\ \mathrm{V}$$</p>
<p>$$C_{ox}=\frac{\varepsilon_{ox}\varepsilon_0}{d_{ox}}=\frac{3.9\times8.85\times10^{-14}}{200\times10^{-7}}=1.73\times10^{-8}\ \mathrm{F/cm^2}$$</p>
<p>$$\varepsilon_s=12\varepsilon_0=1.062\times10^{-12}\ \mathrm{F/cm}$$</p>
<p>并近似认为本征能级位于禁带中央：$E_i=E_v+0.56\ \mathrm{eV}$。</p>
<p class="lead"><b>(1) 两个功函数与平带电压</b></p>
<p><b>$n^+$-Si 栅</b>：$E_F$ 在导带内、比 $E_c$ 高 $0.05\ \mathrm{eV}$，即 $E_c-E_F=-0.05\ \mathrm{eV}$：</p>
<p>$$W_g=\chi+(E_c-E_F)=4.05-0.05=4.00\ \mathrm{eV}$$</p>
<p><b>p-Si 衬底</b>：$E_F$ 在本征能级之下 $q\varphi_B=0.358\ \mathrm{eV}$，故 $E_c-E_F=\frac{E_g}{2}+q\varphi_B=0.56+0.358=0.918\ \mathrm{eV}$：</p>
<p>$$W_s=\chi+(E_c-E_F)=4.05+0.56+0.358=4.97\ \mathrm{eV}$$</p>
<p><b>平带电压</b>（栅与衬底功函数之差除以 $q$）：</p>
<p>$$V_{FB}=\frac{W_g-W_s}{q}=4.00-4.97=-0.97\ \mathrm{V}$$</p>
<p>物理含义：p-Si 的功函数比 $n^+$-Si 栅大 $0.97\ \mathrm{eV}$，电子从栅流向 Si 更容易，所以必须加 $-0.97\ \mathrm{V}$ 的栅压才能"拉平"能带。<b>负的 $V_{FB}$ 说明该电容的 C–V 曲线整体向负压方向偏移。</b></p>
<p class="lead"><b>(2) 强反型阈值电压</b></p>
<p>临界强反型时 $V_s=2\varphi_B=0.716\ \mathrm{V}$，最大耗尽层宽度与最大体电荷：</p>
<p>$$x_{dm}=\sqrt{\frac{2\varepsilon_s(2\varphi_B)}{qN_A}}=\sqrt{\frac{2\times1.062\times10^{-12}\times0.716}{1.602\times10^{-19}\times10^{16}}}=3.08\times10^{-5}\ \mathrm{cm}=0.31\ \mu\mathrm{m}$$</p>
<p>$$Q_{d\max}=qN_Ax_{dm}=1.602\times10^{-19}\times10^{16}\times3.08\times10^{-5}=4.93\times10^{-8}\ \mathrm{C/cm^2}$$</p>
<p>$$\frac{Q_{d\max}}{C_{ox}}=\frac{4.93\times10^{-8}}{1.73\times10^{-8}}=2.85\ \mathrm{V}$$</p>
<p>$$V_T=V_{FB}+2\varphi_B+\frac{Q_{d\max}}{C_{ox}}=-0.97+0.716+2.85=\boxed{2.60\ \mathrm{V}}$$</p>
<p>三项分别是：功函数差（$-0.97$）、表面势（$0.716$）、体电荷压降（$2.85$）。</p>
<p class="lead"><b>(3) 由实测 $V_T$ 反推界面固定电荷</b></p>
<p>界面固定电荷 $Q_f$ 位于氧化层与半导体之间，它对 $V_{FB}$（从而对 $V_T$）的贡献是 $-Q_f/C_{ox}$：</p>
<p>$$V_T^{\text{实测}}=V_T^{\text{理想}}-\frac{Q_f}{C_{ox}}$$</p>
<p>与理想值之差 $2.60-2.00=0.60\ \mathrm{V}$，故</p>
<p>$$Q_f=C_{ox}\times0.60=1.73\times10^{-8}\times0.60=1.04\times10^{-8}\ \mathrm{C/cm^2}$$</p>
<p>$$N_f=\frac{Q_f}{q}=\frac{1.04\times10^{-8}}{1.602\times10^{-19}}=6.5\times10^{10}\ \mathrm{cm^{-2}}$$</p>
<p><b>为正电荷</b>（与题设一致）。物理上：正电荷吸引 Si 中的电子、使半导体更容易反型，<b>阈值电压向负方向移动</b>——与"氧化层电荷使 $V_T$ 降低"的规律一致。</p>
<p class="lead"><b>(4) 能带图与电荷块图要点</b></p>
<ul>
<li><b>能带图</b>：$E_F$ 处处水平（热平衡）；栅为简并 $n^+$-Si（$E_F$ 在 $E_c$ 上 $0.05\ \mathrm{eV}$）；SiO₂ 禁带很宽（$\approx9\ \mathrm{eV}$），与 Si 导带偏移约 $3.2\ \mathrm{eV}$，形成对电子的高势垒；p-Si 表面能带<b>向下弯曲 $2q\varphi_B=0.716\ \mathrm{eV}$</b>，弯曲区厚度 $x_{dm}\approx0.31\ \mu\mathrm{m}$。</li>
<li><b>电荷块图</b>：由电中性 $Q_g+Q_f+Q_{d}=0$（临界强反型时反型层电荷 $Q_n\approx0$），半导体一侧是<b>电离受主形成的负空间电荷</b>（在 $x_{dm}$ 内均匀分布 $-qN_A$）加上界面处的正电荷薄层 $Q_f$；栅上为等量正电荷。</li>
</ul>`,
kp: ['重掺杂栅的功函数','$V_{FB}=(W_m-W_s)/q$',String.raw`$\varphi_B=\frac{k_0T}{q}\ln(N_A/n_i)$`,'$V_T$ 的三项','最大耗尽层电荷','界面固定电荷与 $V_T$ 偏移'],
comment:String.raw`这道题的价值在于<b>把 $V_T$ 拆成三项</b>：功函数差、表面势、体电荷压降。三项各有物理意义，分开算既不容易错，也方便检查量级（$2\varphi_B\approx0.7\ \mathrm{V}$、体电荷项 $\approx2\sim3\ \mathrm{V}$）。第 (3) 问的符号最容易搞反：<b>正电荷使 $V_T$ 变小</b>，所以实测值（2.0）小于理想值（2.6）对应正电荷；如果得到负电荷，说明符号约定用反了。`
});

A.push({
pid:P(), sec:8, secTitle:S6,
label:'作业六 · 4', title:'由实验 C–V 曲线提取 MOSFET 的 $t_{ox}$、掺杂与界面陷阱电荷',
statement:String.raw`
<p>The experimental capacitance–voltage curve of a Si-based MOSFET is sketched in Fig. 1. Its oxide layer is SiO₂ with $\varepsilon_{ox}=3.9$. The gate metal work function is $W_m=4\ \mathrm{eV}$. The temperature is $300\ \mathrm{K}$. Based on this information, determine: (a) Is this a p-MOSFET or an n-MOSFET? (b) What is the oxide layer thickness? (c) What is the semiconductor doping level? (d) What is the surface concentration of trapped charges in the semiconductor-oxide interface?</p>
<p><b>读图数据</b>（题给示意图）：积累平台 $C_{ox}=11.5\ \mathrm{nF/cm^2}$；反型平台 $C_{\min}=8.4\ \mathrm{nF/cm^2}$；曲线由平带开始下弯处 $V_{FB}\approx-0.5\ \mathrm{V}$；阈值点 $V_T\approx-3\ \mathrm{V}$（两者都在负压区）。</p>`,
answer:String.raw`<p>(a) <b>p-MOSFET</b>（n 型衬底）。</p>
<p>(b) $t_{ox}=3.9\varepsilon_0/C_{ox}\approx300\ \mathrm{nm}$。</p>
<p>(c) 由 $C_{\min}$ 解出 $x_{dm}$，再联立强反型条件得 $N_D\approx7.8\times10^{15}\ \mathrm{cm^{-3}}$。</p>
<p>(d) 由实测 $V_T$ 与理想 $V_T$ 之差：$Q_{it}\approx-1.9\times10^{-8}\ \mathrm{C/cm^2}$，即 $N_{it}\approx1.2\times10^{11}\ \mathrm{cm^{-2}}$（负电荷）。</p>`,
solution:String.raw`
<p class="lead"><b>(a) 器件类型：看积累区在哪一侧</b></p>
<p>积累区（$C\approx C_{ox}$，表面多子堆积）出现在<b>正栅压</b>一侧，说明多子是电子 → <b>衬底为 n 型</b>；耗尽／反型区（$C$ 下降并饱和）出现在<b>负栅压</b>一侧，与图中 $V_{FB}$、$V_T$ 均为负值一致。n 型衬底上形成的是空穴导电沟道 → <b>p 沟道器件</b>。</p>
<p>校核：n 型 Si（$N_D\approx7.8\times10^{15}$）的功函数 $W_s=\chi+k_0T\ln\frac{N_c}{N_D}=4.05+0.21=4.26\ \mathrm{eV}$，而 $W_m=4.0\ \mathrm{eV}$，故 $\varphi_{ms}=W_m-W_s\approx-0.26\ \mathrm{V}&lt;0$，与本图整条曲线向负压方向偏移一致 ✓。</p>
<p class="lead"><b>(b) 氧化层厚度</b></p>
<p>积累平台对应的电容就是氧化层电容：</p>
<p>$$t_{ox}=\frac{\varepsilon_{ox}\varepsilon_0}{C_{ox}}=\frac{3.9\times8.85\times10^{-14}}{11.5\times10^{-9}}=3.0\times10^{-5}\ \mathrm{cm}=\boxed{300\ \mathrm{nm}}$$</p>
<p class="lead"><b>(c) 掺杂浓度</b></p>
<p>高频强反型时 $C_{\min}$ 是 $C_{ox}$ 与最大耗尽层电容 $C_{d\max}$ 的串联：</p>
<p>$$\frac{1}{C_{\min}}=\frac{1}{C_{ox}}+\frac{1}{C_{d\max}}\;\Longrightarrow\;C_{d\max}=\left(\frac{1}{8.4}-\frac{1}{11.5}\right)^{-1}\mathrm{nF/cm^2}=31.2\ \mathrm{nF/cm^2}$$</p>
<p>$$x_{dm}=\frac{\varepsilon_s}{C_{d\max}}=\frac{1.062\times10^{-12}}{3.12\times10^{-8}}=3.4\times10^{-5}\ \mathrm{cm}=0.34\ \mu\mathrm{m}$$</p>
<p>再由 $x_{dm}=\sqrt{\dfrac{2\varepsilon_s(2\varphi_B)}{qN_D}}$ 与 $\varphi_B=\dfrac{k_0T}{q}\ln\dfrac{N_D}{n_i}$ 联立（迭代一次即可收敛）：</p>
<p>$$N_D=\frac{2\varepsilon_s(2\varphi_B)}{qx_{dm}^2}=7.8\times10^{15}\ \mathrm{cm^{-3}}$$</p>
<p>回代校核：$\varphi_B=0.0259\ln\frac{7.8\times10^{15}}{1.5\times10^{10}}=0.341\ \mathrm{V}$，$2\varphi_B=0.682\ \mathrm{V}$，$x_{dm}=\sqrt{\frac{2\times1.062\times10^{-12}\times0.682}{1.602\times10^{-19}\times7.8\times10^{15}}}=3.4\times10^{-5}\ \mathrm{cm}$ ✓ 自洽。</p>
<p class="lead"><b>(d) 界面陷阱电荷面密度</b></p>
<p>界面陷阱电荷相当于一层位于界面的电荷，使整条曲线沿电压轴平移 $\Delta V=-\dfrac{Q_{it}}{C_{ox}}$，故可用<b>实测 $V_T$ 与理论 $V_T$ 之差</b>求。</p>
<p>① 理论（无陷阱电荷）阈值电压（p 沟道，负值）：</p>
<p>$$V_T^{\text{理想}}=V_{FB}+2\varphi_B+\frac{\sqrt{2\varepsilon_sqN_D(2\varphi_B)}}{C_{ox}}=-0.26-0.68-3.70\approx-4.6\ \mathrm{V}$$</p>
<p>② 与实测比较：$\Delta V_T=V_T^{\text{实测}}-V_T^{\text{理想}}=-3.0-(-4.6)=+1.6\ \mathrm{V}$，故</p>
<p>$$Q_{it}=-C_{ox}\Delta V_T=-11.5\times10^{-9}\times1.6=-1.9\times10^{-8}\ \mathrm{C/cm^2}$$</p>
<p>$$N_{it}=\frac{|Q_{it}|}{q}=1.2\times10^{11}\ \mathrm{cm^{-2}}$$</p>
<p><b>符号为负</b>（被电子占据的受主型界面态）。物理含义：负的界面电荷排斥 n 型衬底中的电子、帮助空穴反型，使 p 沟道器件的阈值电压绝对值变小。</p>
<p class="lead"><b>关于读数的说明（很重要）</b></p>
<p>题给 Fig. 1 是一张<b>示意图</b>：若改用平带点 $V_{FB}=-0.5\ \mathrm{V}$ 估算，得到 $Q_{it}=+2.7\times10^{-9}\ \mathrm{C/cm^2}$，<b>符号与量级都与用 $V_T$ 的结果不同</b>。原因是示意图把"耗尽—反型"过渡段画得比理论（$\Delta V=3.7\ \mathrm{V}$）窄得多，两个标注电压无法与同一个 $C_{ox}$ 同时自洽。<b>本页以 $V_T$ 为准</b>（因为 (d) 问的是"使阈值电压偏移的界面陷阱电荷"）；严格做法是同时给出两处读数并检验一致性——真实器件的 C–V 曲线会自动满足自洽关系。</p>`,
kp: ['由 $C_{ox}$ 求 $t_{ox}$',String.raw`$C_{\min}$ 与 $x_{dm}$`,'强反型条件联立求掺杂','界面陷阱电荷与曲线平移','示意图读数的不自洽'],
comment:String.raw`这类"从 C–V 曲线提参数"的题，答题顺序是固定的：<b>高平台 → $t_{ox}$；低平台 → $x_{dm}$ → 掺杂；曲线平移 → 界面电荷；积累区位置 → 器件类型</b>，四步互不依赖，任何一步卡住都不影响其他步。<b>本题还特意留了一个"坑"</b>：示意图的两个标注电压彼此不自洽，若不加说明地用 $V_{FB}$ 去算，会得到符号相反的界面电荷。<b>敢于指出"题给图不自洽"并说明取舍理由，是这道题的加分点。</b>`
});
})();
