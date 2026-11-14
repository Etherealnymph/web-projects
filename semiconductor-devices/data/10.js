/* 10 · 附录：易错清单与必背结论 */
(function(){
const A = window.__DATA__ = window.__DATA__ || [];
const P = () => (window.__PID = (window.__PID||0)+1);
const S = '15 · 附录 · 易错清单与必背结论';

A.push({
pid:P(), sec:15, secTitle:S,
label:'附录 1', title:'易错清单：28 个「每次都有人错」的点',
statement:String.raw`
<p>下面每一条都能在阅卷时独立扣分（括号内为对应题号），建议考前逐条自问一遍。</p>
<table class="qa">
<thead><tr><th>#</th><th>易错点</th><th>正确说法</th><th>出处</th></tr></thead>
<tbody>
<tr class="imp"><td class="n">1</td><td>FCC 的 $(100)$ 面间距直接代 $a/\sqrt{h^2+k^2+l^2}$</td><td>得 $a$ 是错的，真实原子面间距是 $a/2$（有效指数 $(200)$）</td><td class="kpc">作业一 2</td></tr>
<tr><td class="n">2</td><td>金刚石结构的 $(110)$ 与 $(111)$ 面密度大小</td><td>$\sigma_{110}>\sigma_{111}>\sigma_{100}$，与纯 FCC 相反</td><td class="kpc">作业一 6</td></tr>
<tr class="imp"><td class="n">3</td><td>把晶面指数当截距</td><td>晶面指数＝截距的<b>倒数</b>之比；$(211)$ 的截距是 $\left(\frac12,1,1\right)$</td><td class="kpc">作业一 1、3</td></tr>
<tr><td class="n">4</td><td>带宽写成 $E(0)$</td><td>带宽＝带顶－带底，须先找极值</td><td class="kpc">作业二 2</td></tr>
<tr class="imp"><td class="n">5</td><td>"能带越窄、有效质量越小"</td><td>恰恰相反：曲率越小（带越平）质量越大</td><td class="kpc">作业二 3、4</td></tr>
<tr><td class="n">6</td><td>带顶电子质量当成最小</td><td>带顶 $m^*&lt;0$；比"大小"要比 $|m^*|$</td><td class="kpc">作业二 3</td></tr>
<tr class="imp"><td class="n">7</td><td>空穴能量直接读价带电子能量</td><td>$E_h=-E_e$，否则轻重空穴会判反</td><td class="kpc">作业二 4</td></tr>
<tr><td class="n">8</td><td>判大/小注入时与 $n_i$ 比</td><td>应与<b>多子平衡浓度 $n_0$</b> 比</td><td class="kpc">作业四 5、7</td></tr>
<tr class="imp"><td class="n">9</td><td>"少子准费米能级不动、多子动"</td><td>反了：小注入下<b>多子</b>准费米能级几乎不动</td><td class="kpc">作业四 5</td></tr>
<tr><td class="n">10</td><td>衰减公式写成 $p_0e^{-t/\tau}$</td><td>衰减的是非平衡部分 $\Delta p_0e^{-t/\tau}$</td><td class="kpc">基础·选择三 1</td></tr>
<tr class="imp"><td class="n">11</td><td>"最有效复合中心在 $E_F$ 附近"</td><td>在<b>禁带中央 $E_i$</b> 附近</td><td class="kpc">作业四 3、4</td></tr>
<tr><td class="n">12</td><td>复合与陷阱混为一谈</td><td>复合"收两次"，陷阱"收一次再退回"</td><td class="kpc">作业四 4</td></tr>
<tr class="imp"><td class="n">13</td><td>重掺杂仍用 $n_0=N_D$</td><td>$E_F$ 接近 $E_D$ 时电离度只有 20%～30%，须用 $N_D^+$ 公式</td><td class="kpc">作业三 5①</td></tr>
<tr><td class="n">14</td><td>高温后仍用 $p_0=N_A'$</td><td>$n_i$ 与净掺杂可比时要用二次方程一般解</td><td class="kpc">作业三 5④</td></tr>
<tr class="imp"><td class="n">15</td><td>把"饱和区掺杂范围"只算上限</td><td>区间两端来源不同：上限看电离度，下限看 $n_i$ 可否忽略</td><td class="kpc">作业三 6</td></tr>
<tr><td class="n">16</td><td>补偿后忘取净杂质</td><td>$N_{\text{net}}=|N_D-N_A|$，类型由净值符号定</td><td class="kpc">作业三 5③</td></tr>
<tr class="imp"><td class="n">17</td><td>深能级只当复合中心、忘其补偿作用</td><td>Au 在 n 型中同时做受主，$n_0=N_D-N_{\mathrm{Au}}$</td><td class="kpc">作业四 6</td></tr>
<tr><td class="n">18</td><td>扩散电流方向与梯度同向</td><td>$(J_p)_{\text{扩}}=-qD_p\dfrac{\mathrm dp}{\mathrm dx}$，<b>反向</b></td><td class="kpc">基础·判断 2</td></tr>
<tr class="imp"><td class="n">19</td><td>电子扩散电流取 $-qD_n\dfrac{\mathrm dn}{\mathrm dx}$</td><td>电子带负电，$J_n=+qD_n\dfrac{\mathrm dn}{\mathrm dx}$（与空穴反号）</td><td class="kpc">基础·选择 8</td></tr>
<tr><td class="n">20</td><td>厚/薄样品的结论混用</td><td>厚：指数、梯度变、复合重要；薄：线性、梯度恒定、复合可忽略</td><td class="kpc">基础·选择 3、4</td></tr>
<tr class="imp"><td class="n">21</td><td>"加偏压金属侧势垒也变"</td><td>金属侧 $\varphi_B$ <b>不变</b>，只有半导体侧 $V_{bi}$ 变</td><td class="kpc">作业五 1</td></tr>
<tr><td class="n">22</td><td>p 型阻挡层条件写反</td><td>n 型 $W_m>W_s$；p 型 $W_m&lt;W_s$</td><td class="kpc">基础·选择 3、4</td></tr>
<tr class="imp"><td class="n">23</td><td>"只有反阻挡层能做欧姆接触"</td><td>重掺杂隧穿是工程上主要手段</td><td class="kpc">基础·判断 5</td></tr>
<tr><td class="n">24</td><td>MIS 电容说成并联</td><td>绝缘层电容与半导体电容<b>串联</b></td><td class="kpc">基础·判断 1</td></tr>
<tr class="imp"><td class="n">25</td><td>$V_{FB}$ 与 $V_T$ 的符号混用</td><td>平移方向只看 $\varphi_{ms}$；$V_T$ 的极性看衬底类型</td><td class="kpc">基础·选择 10</td></tr>
<tr><td class="n">26</td><td>$V_s=2\varphi_B$ 与 $V_s=0$ 混</td><td>$V_s=2\varphi_B$ 是临界强反型，$V_s=0$ 是平带</td><td class="kpc">作业六 2</td></tr>
<tr class="imp"><td class="n">27</td><td>高频 C–V 的饱和值写成 $C_{ox}$</td><td>饱和在 $C_{\min}=\dfrac{C_{ox}C_{d\max}}{C_{ox}+C_{d\max}}$</td><td class="kpc">作业六 1、4</td></tr>
<tr class="imp"><td class="n">28</td><td>$k_0T$ 取 0.026 与 0.0259 混用、$\varepsilon_s$ 忘乘 $\varepsilon_0$</td><td>全程统一；$\varepsilon_s=11.9\varepsilon_0=1.05\times10^{-12}\ \mathrm{F/cm}$</td><td class="kpc">全部计算题</td></tr>
</tbody></table>`,
answer:'',
solution:'',
kp:['考前查漏','符号与方向','量级与判据'],
comment:String.raw`这 28 条不是"知识点"，而是<b>"扣分点"</b>——每一条都能在阅卷时独立扣分，且互不重复。建议考前只做一件事：<b>把这张表逐条自问，答不上来的回对应页重看</b>。经验上，能躲开其中 20 条，分数就能上一个档次。`
});

A.push({
pid:P(), sec:15, secTitle:S,
label:'附录 2', title:'二十条必背结论（考前 10 分钟看这页）',
statement:String.raw`
<table class="qa">
<thead><tr><th>#</th><th>结论</th></tr></thead>
<tbody>
<tr><td class="n">1</td><td>立方晶系 $d_{hkl}=\dfrac{a}{\sqrt{h^2+k^2+l^2}}$；<b>FCC 只取 $h,k,l$ 全奇或全偶</b>，$d_{100}=a/2$、$d_{110}=a/(2\sqrt2)$、$d_{111}=a/\sqrt3$</td></tr>
<tr><td class="n">2</td><td>金刚石＝两套 FCC 沿 $[111]$ 滑移 $\frac{\sqrt3}{4}a$；闪锌矿＝同骨架但两套子格为异种原子；纤锌矿＝六方 ABAB 堆垛</td></tr>
<tr><td class="n">3</td><td>第一 BZ＝倒空间 W–S 原胞；SC→立方体、BCC→正十二面体、FCC→截角八面体</td></tr>
<tr><td class="n">4</td><td>有效质量 $\dfrac{1}{m^*}=\dfrac{1}{\hbar^2}\dfrac{\partial^2E}{\partial k^2}$：带底为正、带顶为负、曲率越大 $|m^*|$ 越小</td></tr>
<tr><td class="n">5</td><td>Si 间接 1.12（$\Delta$ 线，6 谷）；Ge 间接 0.67（$L$ 点，8 个半椭球）；GaAs 直接 1.42（$\Gamma$，球面）</td></tr>
<tr><td class="n">6</td><td>$n_0p_0=n_i^2$ 只与 $T$（和材料）有关，与掺杂无关；$n_i^2=N_cN_ve^{-E_g/k_0T}$</td></tr>
<tr><td class="n">7</td><td>$E_F=E_i+k_0T\ln\dfrac{n_0}{n_i}$；n 型 $E_c-E_F=k_0T\ln\dfrac{N_c}{N_D}$</td></tr>
<tr><td class="n">8</td><td>电离度：施主 $\dfrac{1}{1+2e^{(E_F-E_D)/k_0T}}$，受主 $\dfrac{1}{1+4e^{(E_A-E_F)/k_0T}}$；$E_D=E_F$ 时恰为 $1/3$</td></tr>
<tr><td class="n">9</td><td>$E_F\!-\!T$ 三段：低温弱电离区<b>上升</b>、饱和区<b>下降</b>、高温趋 $E_i$（中间有极大值）</td></tr>
<tr><td class="n">10</td><td>简并：$E_c-E_F\le0$ 或 $E_F-E_v\le0$；此时玻尔兹曼近似失效</td></tr>
<tr><td class="n">11</td><td>$\sigma=nq\mu_n+pq\mu_p$，$\rho\approx\dfrac{1}{N_Dq\mu_n}$（n 型，由多子决定）</td></tr>
<tr><td class="n">12</td><td>$\mu_L\propto T^{-3/2}$、$\mu_I\propto T^{3/2}/N_I$，$\dfrac1\mu=\dfrac1{\mu_L}+\dfrac1{\mu_I}$ → $\mu\!-\!T$ 有极大值</td></tr>
<tr><td class="n">13</td><td>$\Delta n=G\tau$；小注入 $\tau$ 为常数、大注入 $\tau\propto1/\Delta p$；$\Delta p=\Delta p_0e^{-t/\tau}$</td></tr>
<tr><td class="n">14</td><td>SRH：俘获正比于载流子浓度、发射只由温度决定；强 n 型 $\tau_p=\dfrac{1}{r_pN_t}$；有效复合中心在 $E_i$ 附近</td></tr>
<tr><td class="n">15</td><td>$\dfrac{D}{\mu}=\dfrac{k_0T}{q}=0.0259\ \mathrm{V}$；$L=\sqrt{D\tau}$；$J=qD\left|\dfrac{\mathrm d\Delta p}{\mathrm dx}\right|$</td></tr>
<tr><td class="n">16</td><td>厚样品 $\Delta p=\Delta p_0e^{-x/L_p}$；薄样品线性分布、复合可忽略</td></tr>
<tr><td class="n">17</td><td>肖特基：$q\varphi_B=q(\varphi_m-\chi)$ <b>不随偏压变</b>；$qV_{bi}=q\varphi_B-(E_c-E_F)$ <b>随偏压变</b>；$x_d=\sqrt{\dfrac{2\varepsilon_s(V_{bi}-V)}{qN_D}}$</td></tr>
<tr><td class="n">18</td><td>$J=A^*T^2e^{-q\varphi_B/k_0T}\left(e^{qV/k_0T}-1\right)$；$\varphi_B$ 变 $0.06\ \mathrm{V}$ 电流变 10 倍</td></tr>
<tr><td class="n">19</td><td>MIS：$C$ 为串联；$V_{FB}=\dfrac{W_m-W_s}{q}-\dfrac{Q_{ox}}{C_{ox}}$；$V_T=V_{FB}+2\varphi_B+\dfrac{Q_{d\max}}{C_{ox}}$；$V_s=2\varphi_B$ 为临界强反型</td></tr>
<tr><td class="n">20</td><td>高频强反型 $C\to C_{\min}=\dfrac{C_{ox}C_{d\max}}{C_{ox}+C_{d\max}}$；低频 $C\to C_{ox}$；扫得快出现深耗尽</td></tr>
</tbody></table>`,
answer:'',
solution:String.raw`
<p class="lead"><b>考前 10 分钟的执行顺序</b></p>
<ol>
<li><b>先看第 1～5 条</b>（结构、能带、有效质量）：临场最有效的记忆题。</li>
<li><b>再看第 6～10 条</b>（统计）：公式少，但每年必考。</li>
<li><b>然后 11～16 条</b>（输运、复合、扩散）：计算题的主体。</li>
<li><b>最后 17～20 条</b>（金半、MIS）：两道大题必出其一，把 $V_T$ 的三项与 $C_{\min}$ 的表达式各写一遍。</li>
</ol>
<p class="lead"><b>答题时的三个习惯</b></p>
<ul>
<li><b>先写公式再代数</b>：即使算错，公式分仍在。</li>
<li><b>每步标单位</b>：$\mathrm{cm^{-3}}$、$\mathrm{V/cm}$、$\mathrm{F/cm^2}$ 是最常错的三处。</li>
<li><b>算完做量级检查</b>：$n_0\sim10^{15}\!-\!10^{17}$、$x_d\sim0.1\ \mu\mathrm{m}$、$V_T\sim1\ \mathrm{V}$、肖特基正向 $J\sim10^{3}\ \mathrm{A/cm^2}$——偏离一个数量级就该回头找错。</li>
</ul>`,
kp:['考前速记','答题规范','量级检查'],
comment:String.raw`把这页当作进考场前的最后一眼。<b>20 条里真正容易忘的是第 8、9、14、19 条</b>（电离度的简并因子、$E_F\!-\!T$ 曲线有极大值、$\tau_p=1/(r_pN_t)$、$V_T$ 的三项），其余大多能从物理图像推出。<b>若只剩 2 分钟，就看第 8、14、19 三条。</b>`
});
})();
