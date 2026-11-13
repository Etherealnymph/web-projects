/* 02 · 作业一（晶体结构）+ 作业二（能带与有效质量） */
(function(){
const A = window.__DATA__ = window.__DATA__ || [];
const P = () => (window.__PID = (window.__PID||0)+1);

/* ================= 作业一 ================= */
const S1 = '03 · 作业一 · 晶体结构';

A.push({
pid:P(), sec:3, secTitle:S1,
label:'作业一 · 1', title:'画出立方晶系中的晶向与晶面（密勒指数）',
statement:String.raw`
<p>画出立方晶系中下列晶向和晶面（密勒指数）：</p>
<p>晶向 $[\bar101]$、$[1\bar10]$、$[112]$、$[121]$；晶面 $(11\bar1)$、$(\bar110)$、$(211)$、$(1\bar12)$。</p>`,
answer:String.raw`<p>4 条晶向都可用「从晶胞某顶点指向另一顶点（或棱／面心）」的箭头画出；4 个晶面分别用方程 $x+y-z=a$、$-x+y=0$、$2x+y+z=a$、$x-y+2z=a$ 截出。核对：<b>立方晶系里 $[uvw]\perp(uvw)$</b>。</p>`,
solution:String.raw`
<p class="lead"><b>一、约定</b> 以晶胞棱长 $a$ 为长度单位，原点取在晶胞一角，三条棱为 $x,y,z$ 轴。</p>
<p>晶向 $[uvw]$ 表示与矢量 $u\boldsymbol a_1+v\boldsymbol a_2+w\boldsymbol a_3$ 平行的方向（立方晶系即 $u\hat x+v\hat y+w\hat z$），指数取互质整数，负号记上划线。</p>
<p>为便于画进一个晶胞，把方向矢量按比例缩短到端点落在晶胞面／棱上，<b>方向本身不变</b>。</p>
<p class="lead"><b>二、四条晶向</b></p>
<table class="qa">
<thead><tr><th>晶向</th><th>方向矢量</th><th>画法（起点 → 终点）</th><th>特征</th></tr></thead>
<tbody>
<tr><td>$[\bar101]$</td><td>$(-1,0,1)$</td><td>$(1,0,0)\to(0,0,1)$</td><td>面（$xz$ 面）的对角线</td></tr>
<tr><td>$[1\bar10]$</td><td>$(1,-1,0)$</td><td>$(0,1,0)\to(1,0,0)$</td><td>底面（$xy$ 面）的对角线</td></tr>
<tr><td>$[112]$</td><td>$(1,1,2)$</td><td>$(0,0,0)\to\left(\tfrac12,\tfrac12,1\right)$</td><td>体对角线方向族，指向上底面棱的中点</td></tr>
<tr><td>$[121]$</td><td>$(1,2,1)$</td><td>$(0,0,0)\to\left(\tfrac12,1,\tfrac12\right)$</td><td>指向右侧面棱的中点</td></tr>
</tbody></table>
<p class="lead"><b>三、四个晶面</b></p>
<p>晶面 $(hkl)$ 在三个晶轴上的截距 $(m,n,p)$ 满足 $h:k:l=\dfrac1m:\dfrac1n:\dfrac1p$；平行于某轴则截距 $\infty$、对应指数为 0。离原点最近的那个面的方程为 $\dfrac{hx+ky+lz}{a}=1$。</p>
<table class="qa">
<thead><tr><th>晶面</th><th>截距（以 $a$ 计）</th><th>最近面方程</th><th>画法</th></tr></thead>
<tbody>
<tr><td>$(11\bar1)$</td><td>$(1,1,-1)$</td><td>$x+y-z=a$</td><td>过 $(a,0,0)$、$(0,a,0)$、$(0,0,-a)$ 的平面（第四个顶点在晶胞外，需延长 $z$ 轴）</td></tr>
<tr><td>$(\bar110)$</td><td>$(-1,1,\infty)$</td><td>$-x+y=0$</td><td>过原点、平行 $z$ 轴的竖直对角面</td></tr>
<tr><td>$(211)$</td><td>$\left(\tfrac12,1,1\right)$</td><td>$2x+y+z=a$</td><td>过 $(a/2,0,0)$、$(0,a,0)$、$(0,0,a)$</td></tr>
<tr><td>$(1\bar12)$</td><td>$\left(1,-1,\tfrac12\right)$</td><td>$x-y+2z=a$</td><td>过 $(a,0,0)$、$(0,-a,0)$、$(0,0,a/2)$</td></tr>
</tbody></table>
<p class="lead"><b>四、自检</b></p>
<p>立方晶系中，晶向 $[uvw]$ 与同指数的晶面 $(uvw)$ 垂直：$[110]\perp(110)$、$[112]\perp(112)$ 等。<b>该结论只对立方晶系成立</b>（六方晶系不成立），但它足以检查作图有没有把方向画反。</p>`,
kp: ['密勒指数','晶向指数','晶面截距与晶面方程',String.raw`立方晶系 $[uvw]\perp(uvw)$`],
comment:String.raw`作图题的评分点不是"画得像"，而是<b>截距是否读对、负指数是否标对</b>。两个常见错误：① 把 $(211)$ 的截距写成 $(2,1,1)$（那是把指数当截距了，正确是截距为指数的倒数 $\left(\frac12,1,1\right)$）；② 把 $[\bar101]$ 画成从原点到 $(-1,0,1)$ 的箭头——方向是对的，但箭头会跑出晶胞，<b>平移箭头不改变晶向</b>，画在 $(1,0,0)\to(0,0,1)$ 上更清楚。`
});

A.push({
pid:P(), sec:3, secTitle:S1,
label:'作业一 · 2', title:'面心立方晶体 (100)、(110)、(111) 的面间距',
statement:String.raw`
<p>设某面心立方晶体晶格常数为 $a$，求下列密勒指数晶面的面间距：$(100)$、$(110)$、$(111)$。</p>`,
answer:String.raw`<p>$d_{100}=\dfrac{a}{2}$，$d_{110}=\dfrac{a}{2\sqrt2}=0.354a$，$d_{111}=\dfrac{a}{\sqrt3}=0.577a$；<b>$d_{111}>d_{100}>d_{110}$</b>。</p>`,
solution:String.raw`
<p class="lead"><b>一、立方晶系的通式</b></p>
<p>离原点最近的面为 $hx+ky+lz=a$，相邻面为 $hx+ky+lz=2a$，法向单位矢 $\hat n=(h,k,l)/\sqrt{h^2+k^2+l^2}$，故</p>
<p>$$d_{hkl}=\frac{a}{\sqrt{h^2+k^2+l^2}}\qquad(\text{立方晶系})$$</p>
<p class="lead"><b>二、面心立方的修正：真实原子面要求 $h,k,l$ 全奇或全偶</b></p>
<p>FCC 的倒格子是 BCC，只有 $h,k,l$ 全奇或全偶时结构因子不为零。<b>物理原因</b>：面心原子正好插在「几何晶面」的正中间，若指数奇偶混合，相邻两层原子面完全相同，散射波相位差 $\pi$、相互抵消。<b>因此奇偶混合的指数要整体加倍后再用通式</b>。</p>
<table class="qa">
<thead><tr><th>晶面</th><th>奇偶性</th><th>有效指数</th><th>面间距</th><th>数值</th></tr></thead>
<tbody>
<tr><td>$(100)$</td><td>混合</td><td>$(200)$</td><td>$d_{100}=a/\sqrt{2^2}=a/2$</td><td>$0.500a$</td></tr>
<tr><td>$(110)$</td><td>混合</td><td>$(220)$</td><td>$d_{110}=a/\sqrt{2^2+2^2}=a/(2\sqrt2)$</td><td>$0.354a$</td></tr>
<tr><td>$(111)$</td><td>全奇</td><td>$(111)$</td><td>$d_{111}=a/\sqrt3$</td><td>$0.577a$</td></tr>
</tbody></table>
<p>$$d_{111}>\;d_{100}>\;d_{110}$$</p>
<p class="lead"><b>三、直观核对</b></p>
<p>沿 $[100]$ 方向，原子面依次在 $x=0,\frac a2,a,\cdots$——面心原子正好夹在两层角顶原子面之间，所以相邻原子面间距是 $a/2$ 而不是 $a$。沿 $[111]$ 方向是密排面堆垛，层间距就是 $a/\sqrt3$。<b>若不加修正，$(100)$、$(110)$ 会得到 $a$、$a/\sqrt2$，那只是"几何面"的间距，不是相邻原子面的真实距离。</b></p>`,
kp:['面间距公式','FCC 结构因子与消光规律','密排面 (111)'],
comment:String.raw`这道题的「正确答案」在不同书里写法不同：<b>有的书写 $d_{110}=a/\sqrt2$</b>（按几何晶面族定义），有的写 $a/(2\sqrt2)$（按相邻原子面定义）。判卷时看的是<b>你有没有说清用哪个约定</b>。本页统一采用「真实原子面」约定，并在评析里点出差别；考试作答建议一句话注明：「按相邻原子面计，FCC 的 $(100)$、$(110)$ 指数需加倍」。`
});

A.push({
pid:P(), sec:3, secTitle:S1,
label:'作业一 · 3', title:'证明 FCC 的密勒指数 $(hkl)$ 与原胞晶面指数 $(h_1h_2h_3)$ 的换算',
statement:String.raw`
<p>证明面心立方晶体密勒指数 $(hkl)$ 与晶面指数 $(h_1h_2h_3)$（以原胞基矢为坐标轴）的转换关系：</p>
<p>$$h_1=\frac{k+l}{2},\qquad h_2=\frac{h+l}{2},\qquad h_3=\frac{h+k}{2}$$</p>
<p>其中 $h_1,h_2,h_3$ 化为互质整数。例如密勒指数 $(110)$ 的晶面在原胞基矢 $\boldsymbol a_1,\boldsymbol a_2,\boldsymbol a_3$ 上的截距为 $2,2,1$，相应晶面指数为 $(112)$。</p>`,
answer:String.raw`<p>取惯用立方晶胞，$(hkl)$ 面方程 $hx+ky+lz=a$；原胞基矢 $\boldsymbol a_1=\frac a2(\hat y+\hat z)$、$\boldsymbol a_2=\frac a2(\hat z+\hat x)$、$\boldsymbol a_3=\frac a2(\hat x+\hat y)$。求出该面在三条原胞轴上的截距 $n_i=2/(\text{另两指数之和})$，取倒数之比即得。</p>`,
solution:String.raw`
<p class="lead"><b>一、两个坐标系</b></p>
<p>惯用（立方）晶胞边长 $a$，$(hkl)$ 面的最近面方程为</p>
<p>$$hx+ky+lz=a$$</p>
<p>固体物理的原胞基矢（每个横跨两个面心，两两夹角 $60^\circ$）：</p>
<p>$$\boldsymbol a_1=\frac a2(\hat y+\hat z),\quad \boldsymbol a_2=\frac a2(\hat z+\hat x),\quad \boldsymbol a_3=\frac a2(\hat x+\hat y)$$</p>
<p class="lead"><b>二、求该面在原胞轴上的截距</b></p>
<p>设面与 $\boldsymbol a_1$ 轴交于 $n_1\boldsymbol a_1=\left(0,\dfrac{n_1a}{2},\dfrac{n_1a}{2}\right)$，代入面方程：</p>
<p>$$k\cdot\frac{n_1a}{2}+l\cdot\frac{n_1a}{2}=a\;\Longrightarrow\;n_1=\frac{2}{k+l}$$</p>
<p>同理，与 $\boldsymbol a_2$、$\boldsymbol a_3$ 轴的交点给出</p>
<p>$$n_2=\frac{2}{h+l},\qquad n_3=\frac{2}{h+k}$$</p>
<p class="lead"><b>三、截距倒数之比即晶面指数</b></p>
<p>$$h_1:h_2:h_3=\frac1{n_1}:\frac1{n_2}:\frac1{n_3}=\frac{k+l}{2}:\frac{h+l}{2}:\frac{h+k}{2}$$</p>
<p>取互质整数即得</p>
<p>$$\boxed{\,h_1=\frac{k+l}{2},\quad h_2=\frac{h+l}{2},\quad h_3=\frac{h+k}{2}\,}\qquad\blacksquare$$</p>
<p class="lead"><b>四、反变换与验证</b></p>
<p>由三式联立可解出 $h=h_2+h_3-h_1$，$k=h_3+h_1-h_2$，$l=h_1+h_2-h_3$。</p>
<p>验证 $(110)$：$h_1=\frac{1+0}{2}=\frac12$，$h_2=\frac12$，$h_3=\frac{1+1}{2}=1$，乘 $2$ 化为互质整数得 $(112)$，即截距比 $2:2:1$，与题图一致。</p>
<p>附注：FCC 真实存在的晶面满足 $h,k,l$ 全奇或全偶，此时 $k+l$、$h+l$、$h+k$ 都是偶数，$h_1h_2h_3$ 自然是整数，不必再乘公因子。例：$(200)\to(011)$、$(220)\to(112)$、$(311)\to(122)$、$(111)\to(111)$。</p>`,
kp:['原胞基矢','晶面指数的定义（截距倒数之比）','FCC 两套指数换算','消光规律'],
comment:String.raw`本题的关键是<b>「截距的倒数之比」这一定义</b>，而不是几何直觉：晶面指数不是截距，是把截距取倒数再化整数。每一步只需把「轴上的点」写成矢量代回面方程，剩下的都是代数。<b>易错点：把 $(110)$ 直接写成 $(110)$ 而不化简</b>——$h_1=h_2=\frac12$ 不是整数，必须整体乘 $2$；乘公因子不改变晶面，只是让指数互质。`
});

A.push({
pid:P(), sec:3, secTitle:S1,
label:'作业一 · 4', title:'二维长方晶体的倒格子与第一、第二布里渊区',
statement:String.raw`
<p>二维长方晶体正格子原胞基矢为 $\boldsymbol a_1=a\hat i$、$\boldsymbol a_2=b\hat j$，求相应的倒格子基矢，并画出倒易点阵、倒格子原胞、第一及第二布里渊区。</p>`,
answer:String.raw`<p>$\boldsymbol b_1=\dfrac{2\pi}{a}\hat i$，$\boldsymbol b_2=\dfrac{2\pi}{b}\hat j$；倒格子原胞面积 $\dfrac{(2\pi)^2}{ab}$；第一布里渊区为矩形 $|k_x|\le\dfrac{\pi}{a}$、$|k_y|\le\dfrac{\pi}{b}$；第二布里渊区为贴在第一布里渊区四条边外的 4 块分离区域。</p>`,
solution:String.raw`
<p class="lead"><b>一、倒格基矢</b></p>
<p>由 $\boldsymbol a_i\cdot\boldsymbol b_j=2\pi\delta_{ij}$，因 $\hat i\perp\hat j$，直接得</p>
<p>$$\boldsymbol b_1=\frac{2\pi}{a}\hat i,\qquad \boldsymbol b_2=\frac{2\pi}{b}\hat j$$</p>
<p>倒易点阵为矩形点阵，$\boldsymbol G_{mn}=\dfrac{2\pi m}{a}\hat i+\dfrac{2\pi n}{b}\hat j$。</p>
<p class="lead"><b>二、倒格子原胞</b></p>
<p>以 $\boldsymbol b_1,\boldsymbol b_2$ 为边的平行四边形即倒格子原胞，面积</p>
<p>$$S^*=|\boldsymbol b_1\times\boldsymbol b_2|=\frac{(2\pi)^2}{ab}=\frac{(2\pi)^2}{S}$$</p>
<p>与正格子原胞面积 $S=ab$ 成反比——这是「正空间越大、倒空间越小」的普遍规律。</p>
<p class="lead"><b>三、第一布里渊区</b></p>
<p>作原点到最近邻倒格点连线的垂直平分线（Bragg 线），围成的区域即第一 BZ。最近邻倒格点距离为 $\min\left(\frac{2\pi}{a},\frac{2\pi}{b}\right)$，故第一 BZ 是边长 $\frac{2\pi}{a}\times\frac{2\pi}{b}$ 的<b>矩形</b>：</p>
<p>$$-\frac{\pi}{a}\le k_x\le\frac{\pi}{a},\qquad -\frac{\pi}{b}\le k_y\le\frac{\pi}{b}$$</p>
<p class="lead"><b>四、第二布里渊区</b></p>
<p>第一 BZ 之外、与次近邻倒格点中垂线所围的区域。<b>对长方（乃至正方）点阵，第二 BZ 由贴在第一 BZ 四条边外的 4 块分离区域组成</b>：每条边向外到相邻倒格点的中垂线为止，两侧被对角倒格点的中垂线切掉。$a\ne b$ 时四块是"两头尖的四边形"；$a=b$（正方）时退化为 4 个三角形。</p>
<p>高对称点：$\Gamma(0,0)$、$X\left(\frac\pi a,0\right)$、$Y\left(0,\frac\pi b\right)$、$M\left(\frac\pi a,\frac\pi b\right)$。</p>`,
kp:['倒格子定义与基矢','倒格子原胞体积','第一布里渊区（Wigner–Seitz 原胞）','第二布里渊区','二维长方点阵的高对称点'],
comment:String.raw`二维题的「模板」是：<b>正交基矢 → 倒格矢直接取倒数乘 $2\pi$</b>；一旦基矢不正交，就必须用 $\boldsymbol b_1=\frac{(2\pi)}{S}\boldsymbol a_2^\perp$ 这类叉乘公式。第二布里渊区的形状是本题唯一有难度的地方，判断标准是<b>「每块区域与第一 BZ 共用一条边」</b>——所以第二 BZ 一定是 4 块（二维矩形），而不是一整圈。`
});

A.push({
pid:P(), sec:3, secTitle:S1,
label:'作业一 · 5', title:'比较金刚石、闪锌矿与纤锌矿结构',
statement:String.raw`
<p>比较金刚石结构、闪锌矿结构和纤锌矿结构的特点。</p>`,
answer:String.raw`<p>三者都是 sp³ 四面体键合：金刚石＝FCC＋双原子同种基元（Si、Ge、C）；闪锌矿＝金刚石骨架但两套子格为异种原子（GaAs、InP、ZnS）；纤锌矿＝六方 ABAB 堆垛的四面体结构（GaN、ZnO、AlN）。前两者立方（ABCABC 沿 $[111]$），后者六方（ABAB 沿 $[0001]$）。</p>`,
solution:String.raw`
<table class="qa">
<thead><tr><th>项目</th><th>金刚石</th><th>闪锌矿</th><th>纤锌矿</th></tr></thead>
<tbody>
<tr><td>布拉伐格子</td><td>FCC</td><td>FCC</td><td>六角格子</td></tr>
<tr><td>基元</td><td>2 个<b>同种</b>原子：$(0,0,0)$、$\left(\frac14,\frac14,\frac14\right)$，每惯用胞 8 个</td><td>2 个<b>异种</b>原子：A 在 $(0,0,0)$、B 在 $\left(\frac14,\frac14,\frac14\right)$</td><td>4 个原子（2A＋2B）：A $(0,0,0)$、$\left(\frac13,\frac23,\frac12\right)$；B $(0,0,u)$、$\left(\frac13,\frac23,\frac12+u\right)$，$u\approx\frac38$</td></tr>
<tr><td>配位／键</td><td>4，纯共价 sp³</td><td>4，四面体键，含离子性（极性）</td><td>4，四面体键，极性更强，$c/a\approx1.633$</td></tr>
<tr><td>密排堆垛</td><td>ABCABC（沿 $[111]$）</td><td>ABCABC（沿 $[111]$）</td><td>ABAB（沿 $[0001]$）</td></tr>
<tr><td>晶系／空间群</td><td>立方，$Fd\bar3m$（有反演对称）</td><td>立方，$F\bar43m$（无中心对称）</td><td>六方，$P6_3mc$（无中心对称）</td></tr>
<tr><td>典型材料</td><td>C、Si、Ge、灰锡</td><td>GaAs、InP、CdTe、3C-SiC、立方 GaN</td><td>六方 GaN、ZnO、AlN、CdS</td></tr>
<tr><td>性质含义</td><td>单质、无极性；解理面 (111)</td><td>压电、非线性光学；GaAs 直接带隙</td><td>强自发极化与压电；GaN 高电子迁移率晶体管（HEMT）界面二维电子气</td></tr>
</tbody></table>
<p class="lead"><b>三点小结</b></p>
<ul>
<li><b>金刚石 vs 闪锌矿</b>：几何骨架完全相同（两套互穿 FCC，相对位移 $\left(\frac14,\frac14,\frac14\right)$），差别只在两套子格放的是否同种原子。<b>同种 → 金刚石（单质，无极性）；异种 → 闪锌矿（化合物，极性键）</b>。</li>
<li><b>闪锌矿 vs 纤锌矿</b>：AB 化合物的两种多型（polytype），可看作四面体双层沿 $[111]$（ABCABC）与沿 $[0001]$（ABAB）的不同堆垛。很多材料两种都有（ZnS、GaN），由制备条件决定。</li>
<li><b>半导体意义</b>：Si、Ge、GaAs 是金刚石／闪锌矿；GaN、ZnO、AlN 等宽禁带材料常用纤锌矿。无中心对称 → 压电与非线性光学。</li>
</ul>`,
kp:['金刚石结构','闪锌矿结构','纤锌矿结构','密排面堆垛 ABC/ABAB','极性键与压电性'],
comment:String.raw`比较题要按<b>「格子—基元—键—堆垛—对称性」</b>五层来写，而不是罗列材料名。最容易丢分的是<b>把闪锌矿说成"FCC 加一个原子"</b>：它是 FCC 加<b>两个原子的基元</b>（一个 A、一个 B），与金刚石唯一的区别是基元内两个原子不同种。<b>另一个常考点是 $c/a$ 与 $u$ 参数</b>：理想纤锌矿 $c/a=\sqrt{8/3}=1.633$、$u=3/8$，实际 GaN 的 $c/a=1.626$ 略小，这正是其自发极化的来源。`
});

A.push({
pid:P(), sec:3, secTitle:S1,
label:'作业一 · 6', title:'Si 的原子体密度与 (111)、(110)、(100) 面密度',
statement:String.raw`
<p>已知 Si 晶体的晶格常数 $a=5.43089\ \mathrm{\mathring{A}}$：(1) 求 Si 的原子体密度；(2) 比较 $(111)$、$(110)$、$(100)$ 晶面的面密度大小。</p>`,
answer:String.raw`<p>(1) $n=\dfrac{8}{a^3}=4.99\times10^{22}\ \mathrm{cm^{-3}}\approx5.0\times10^{22}\ \mathrm{cm^{-3}}$。</p>
<p>(2) $\sigma_{100}=\dfrac{2}{a^2}=6.78\times10^{14}$，$\sigma_{110}=\dfrac{2\sqrt2}{a^2}=9.59\times10^{14}$，$\sigma_{111}=\dfrac{4}{\sqrt3a^2}=7.83\times10^{14}\ \mathrm{cm^{-2}}$，即 <b>$\sigma_{110}>\sigma_{111}>\sigma_{100}$</b>。</p>`,
solution:String.raw`
<p class="lead"><b>一、原子体密度</b></p>
<p>Si 为金刚石结构：FCC 骨架 4 个原子＋基元附加 4 个，共 <b>8 个原子/惯用胞</b>。</p>
<p>$$a=5.43089\times10^{-8}\ \mathrm{cm},\qquad a^3=1.602\times10^{-22}\ \mathrm{cm^3}$$</p>
<p>$$n=\frac{8}{a^3}=\frac{8}{1.602\times10^{-22}}=4.99\times10^{22}\ \mathrm{cm^{-3}}\approx5.0\times10^{22}\ \mathrm{cm^{-3}}$$</p>
<p>校验质量密度：$\rho=\dfrac{8M_{\mathrm{Si}}}{N_Aa^3}=\dfrac{8\times28.09}{6.022\times10^{23}\times1.602\times10^{-22}}=2.33\ \mathrm{g/cm^3}$，与实测一致。</p>
<p class="lead"><b>二、面密度（每个原子面上的原子数 ÷ 该面单元面积）</b></p>
<table class="qa">
<thead><tr><th>晶面</th><th>原子面结构</th><th>面密度公式</th><th>数值 $(\mathrm{cm^{-2}})$</th><th>比值</th></tr></thead>
<tbody>
<tr><td>$(100)$</td><td>原子面间距 $a/4$，每层 $a^2$ 内 2 个原子</td><td>$\sigma_{100}=\dfrac{2}{a^2}$</td><td>$6.78\times10^{14}$</td><td>$1$</td></tr>
<tr><td>$(110)$</td><td>间距 $a/(2\sqrt2)$，每层 $\sqrt2a^2$ 内 4 个原子</td><td>$\sigma_{110}=\dfrac{2\sqrt2}{a^2}$</td><td>$9.59\times10^{14}$</td><td>$1.41$</td></tr>
<tr><td>$(111)$</td><td>双层密排面，每层 $\sqrt3a^2$ 内 4 个原子</td><td>$\sigma_{111}=\dfrac{4}{\sqrt3a^2}$</td><td>$7.83\times10^{14}$</td><td>$1.15$</td></tr>
</tbody></table>
<p>$$\boxed{\sigma_{110}>\sigma_{111}>\sigma_{100}}$$</p>
<p class="lead"><b>三、为什么与 FCC 的直觉相反</b></p>
<p>纯 FCC 的密排面是 $(111)$，面密度最大；<b>金刚石结构不是</b>：基元原子把 $(111)$ 拆成间距不等的双层，而 $(110)$ 面上原子排成锯齿链，反而最密。这个结论有实际意义：Si 的 $(110)$ 面在湿法腐蚀中表现各向异性、常被用作器件平台；$(111)$ 是解理面与外延常用面；$(100)$ 面密度最小，但每个表面原子只有 2 个悬挂键，所以现代 MOSFET 几乎都用 $(100)$ 衬底。</p>`,
kp:['金刚石结构原子数 8/cell','面密度计算','悬挂键与衬底选择','各向异性腐蚀'],
comment:String.raw`这道题的价值在于<b>「同一块晶体，不同晶面密度不同」</b>这一物理事实。计算时只要抓住 $\sigma=\dfrac{\text{面内原子数}}{\text{面内面积}}$，不必去数整个晶胞。<b>最容易被扣分的是把 $(111)$ 的双层结构当成单层</b>：金刚石的 $(111)$ 面是"间距 $\frac{\sqrt3a}{4}$ 与 $\frac{a}{4\sqrt3}$ 交替"的双层，若按单层算会得到 $\frac{8}{\sqrt3a^2}$，正好差一倍。`
});

/* ================= 作业二 ================= */
const S2 = '04 · 作业二 · 能带与有效质量';

A.push({
pid:P(), sec:4, secTitle:S2,
label:'作业二 · 1', title:'概述 Si、Ge、GaAs 能带结构的主要特征',
statement:String.raw`
<p>概述 Si、Ge 和 GaAs 能带结构的主要特征。</p>`,
answer:String.raw`<p>三者都是四面体 sp³ 键合、第一布里渊区为截角八面体、价带顶都在 $\Gamma$ 点且含重／轻空穴与自旋—轨道分裂带。<b>本质差别在导带底位置</b>：Si 在 $\langle100\rangle$ 的 $\Delta$ 线（间接，6 谷，$E_g=1.12$）；Ge 在 $L$ 点（间接，8 个半椭球，$0.67$）；GaAs 在 $\Gamma$ 点（<b>直接</b>，球面，$1.42$）。</p>`,
solution:String.raw`
<p class="lead"><b>一、共同点</b></p>
<ul>
<li><b>结构与成键</b>：Si、Ge 为金刚石结构，GaAs 为闪锌矿结构；每个原胞 2 个原子、8 个价电子；<b>价带由成键（sp³ 杂化）态构成、导带由反键态构成</b>，中间是禁带。</li>
<li><b>布里渊区</b>：FCC 倒格子的 Wigner–Seitz 原胞＝<b>截角八面体</b>：8 个六边形面（垂直 $\langle111\rangle$，面心到 $\Gamma$ 为 $\frac{\sqrt3}{2}\cdot\frac{2\pi}{a}$）＋6 个正方形面（垂直 $\langle100\rangle$，距 $\Gamma$ 为 $\frac{2\pi}{a}$）。</li>
<li><b>价带顶都在 $\Gamma$</b>，重空穴 HH 与轻空穴 LH 在 $\Gamma$ 简并，其下为自旋—轨道分裂带 SO，$\Delta_{SO}$：Si 0.044、Ge 0.29、GaAs 0.34 eV。</li>
<li><b>带边附近可用有效质量近似</b>：$E=\dfrac{\hbar^2k^2}{2m^*}$，曲率越大 $m^*$ 越小。</li>
</ul>
<p class="lead"><b>二、导带底位置（三者最主要的差别）</b></p>
<ul>
<li><b>Si：间接</b>。导带极小在 $\Delta$ 线（$\langle100\rangle$），位于 $\Gamma\to X$ 的 $0.85$ 倍处，即 $k_0\approx0.85\frac{2\pi}{a}$，共 <b>6 个等价谷</b>；等能面是沿 $\langle100\rangle$ 拉长的<b>旋转椭球</b>（$m_l=0.98$、$m_t=0.19$，电导有效质量 $0.26$、态密度 $1.08$）。<b>间接带隙 → 光跃迁需声子协助 → 发光效率极低</b>，所以 Si 不能做发光器件。</li>
<li><b>Ge：间接</b>。导带极小在布里渊区边界的 $L$ 点（$\langle111\rangle$），<b>8 个半椭球</b>（等价 4 个谷），$m_l=1.64$、$m_t=0.082$，横向质量很小、迁移率高。$E_g=0.67\ \mathrm{eV}$，但 $\Gamma$ 点还有一个仅高 $0.14\ \mathrm{eV}$ 的直接极小，所以 Ge 在近红外有较强光吸收。</li>
<li><b>GaAs：直接</b>。导带极小在 $\Gamma$（$k=0$），等能面为<b>球面</b>，$m^*=0.067m_0$，电子迁移率高达 $8500\ \mathrm{cm^2/(V\cdot s)}$。<b>直接带隙 → 发光效率高 → LED、激光器</b>。另有 $L$ 谷（$\langle111\rangle$，$\approx1.71\ \mathrm{eV}$，$m^*\approx0.55$）与 $X$ 谷（$\langle100\rangle$，$\approx1.90\ \mathrm{eV}$）；电场足够强时电子从 $\Gamma$ 转入 $L$ 谷，迁移率骤降 → <b>Gunn 效应（负微分电导）</b>。</li>
</ul>
<p class="lead"><b>三、对照表</b></p>
<table class="qa">
<thead><tr><th>材料</th><th>结构</th><th>带隙类型／$E_g$</th><th>导带底</th><th>谷数</th><th>$m_n^*$</th><th>HH/LH</th></tr></thead>
<tbody>
<tr><td>Si</td><td>金刚石</td><td>间接，1.12</td><td>$\Delta$ 线 $0.85\times\frac{2\pi}{a}$</td><td>6</td><td>$0.26$（态密度 1.08）</td><td>0.53/0.16</td></tr>
<tr><td>Ge</td><td>金刚石</td><td>间接，0.67</td><td>$L$ 点</td><td>8 个半椭球</td><td>$0.12$（态密度 0.56）</td><td>0.36/0.043</td></tr>
<tr><td>GaAs</td><td>闪锌矿</td><td>直接，1.42</td><td>$\Gamma$</td><td>1</td><td>$0.067$</td><td>0.45/0.082</td></tr>
</tbody></table>`,
kp:['间接带隙与直接带隙','导带底位置','旋转椭球等能面','重/轻空穴与自旋—轨道分裂','Gunn 效应'],
comment:String.raw`这题的评分点是<b>「三要素」：带隙类型、导带底位置、等能面形状</b>，而多数人只写 $E_g$ 的数值。要能顺口说出因果链：<b>导带底不在 $\Gamma$ → 间接 → 需要声子 → 发光效率低 → Si 做不了 LED</b>；以及 <b>GaAs 的 $L$ 谷只比 $\Gamma$ 谷高 0.29 eV → 强场下电子能"跳谷" → 负微分电导</b>。这两条链是本章的"为什么"，比表格本身更重要。`
});

A.push({
pid:P(), sec:4, secTitle:S2,
label:'作业二 · 2', title:'一维能带的带宽与电子速度',
statement:String.raw`
<p>已知一维晶体的电子能带可写成</p>
<p>$$E(k)=\frac{\hbar^2}{ma^2}\left(\frac78-\cos ka+\frac18\cos 2ka\right)$$</p>
<p>式中 $a$ 是晶格常数。试求：(1) 能带宽度的表达式；(2) 电子在波矢 $k$ 状态时的速度表达式。</p>`,
answer:String.raw`<p>(1) $\Delta E=E\left(\frac\pi a\right)-E(0)=\dfrac{2\hbar^2}{ma^2}$；(2) $v(k)=\dfrac{\hbar}{ma}\sin(ka)\left[1-\dfrac12\cos(ka)\right]$。</p>`,
solution:String.raw`
<p class="lead"><b>一、先看单调性</b> 令 $x=ka$，$f(x)=\frac78-\cos x+\frac18\cos2x$，则</p>
<p>$$f'(x)=\sin x-\frac14\cdot2\sin2x=\sin x\left(1-\frac12\cos x\right)$$</p>
<p>在 $x\in[0,\pi]$ 上 $\sin x\ge0$、$1-\frac12\cos x>0$，故 <b>$f$ 单调递增</b>：极小在 $x=0$，极大在 $x=\pi$，没有内部极值。</p>
<p class="lead"><b>二、带底与带顶</b></p>
<p>$$f(0)=\frac78-1+\frac18=0,\qquad f(\pi)=\frac78+1+\frac18=2$$</p>
<p>$$E_{\min}=E(0)=0,\qquad E_{\max}=E\left(\frac\pi a\right)=\frac{2\hbar^2}{ma^2}$$</p>
<p class="lead"><b>三、带宽</b></p>
<p>$$\boxed{\Delta E=E_{\max}-E_{\min}=\frac{2\hbar^2}{ma^2}}$$</p>
<p><b>与 $a^2$ 成反比</b>——晶格常数越大，允带越窄（电子越"局域"）。</p>
<p class="lead"><b>四、电子速度</b></p>
<p>由 $v=\dfrac1\hbar\dfrac{\mathrm dE}{\mathrm dk}$，而 $\dfrac{\mathrm dE}{\mathrm dk}=\dfrac{\hbar^2}{ma^2}\cdot a\,f'(x)=\dfrac{\hbar^2}{ma}f'(x)$，故</p>
<p>$$\boxed{v(k)=\frac{\hbar}{ma}\sin(ka)\left[1-\frac12\cos(ka)\right]}$$</p>
<p>校验：$k=0$ 与 $k=\frac\pi a$ 处 $\sin(ka)=0$，$v=0$，正对应带底与带顶（带顶带底电子不输运），符合物理要求。</p>
<p class="lead"><b>五、附带：该能带的有效质量</b></p>
<p>$f''(x)=\cos x-\frac12\cos^2x+\frac12\sin^2x$，故 $f''(0)=\frac12$、$f''(\pi)=-\frac32$：</p>
<p>$$m^*(0)=\frac{m}{1/2}=2m,\qquad m^*\left(\frac\pi a\right)=\frac{m}{-3/2}=-\frac{2m}{3}$$</p>`,
kp: ['能带宽度＝带顶－带底',String.raw`群速度 $v=\frac1\hbar\frac{\mathrm dE}{\mathrm dk}$`,'有效质量与曲率','带顶/带底电子不输运'],
comment:String.raw`本题有两个「暗坑」：① <b>带宽不是 $E(0)$</b>，必须比较带顶与带底；② <b>带底有效质量是 $2m$ 而不是 $m$</b>——因为 $f''(0)=\frac12$，很多同学看到 $\frac{\hbar^2}{ma^2}$ 就以为 $m^*=m$。判断极值位置的正规做法是令 $f'=0$，得到 $x=0,\pi$ 后逐个验算；本页还额外验证了 $f'$ 在区间内不变号，避免漏掉内部极值。`
});

A.push({
pid:P(), sec:4, secTitle:S2,
label:'作业二 · 3', title:'由一维能带图判断有效质量的大小与符号',
statement:String.raw`
<p>右图为一维晶体能带图，试回答：</p>
<p>(1) 在 Ⅰ、Ⅱ、Ⅲ 三个能带中，哪一个带的电子有效质量最小？哪一个带的电子有效质量为负？</p>
<p>(2) 考虑 Ⅰ、Ⅱ 两个带充满电子、第 Ⅲ 个带全空的情况，如果少量电子进入第 Ⅲ 个带，在 Ⅱ 带中产生同样数目的空穴，试比较 Ⅱ 带中的空穴有效质量与 Ⅲ 带中的电子有效质量。</p>`,
answer:String.raw`<p>(1) <b>Ⅲ 带</b>电子有效质量最小；<b>Ⅱ 带</b>电子有效质量为负。</p>
<p>(2) Ⅱ 带空穴的有效质量 <b>大于</b> Ⅲ 带电子的有效质量（$|m_p^*(Ⅱ)|>|m_n^*(Ⅲ)|$），且两者符号相反。</p>`,
solution:String.raw`
<p class="lead"><b>一、判据</b> 有效质量由曲率决定</p>
<p>$$\frac{1}{m^*}=\frac{1}{\hbar^2}\frac{\mathrm d^2E}{\mathrm dk^2}$$</p>
<p>曲线<b>开口向上</b>（带底）处 $m^*>0$，且<b>曲率越大 $|m^*|$ 越小</b>；曲线<b>开口向下</b>（带顶）处 $m^*&lt;0$。</p>
<p class="lead"><b>二、第 (1) 问</b></p>
<ul>
<li><b>Ⅲ 带</b>在 $k=0$ 处是带底（开口向上），而且谷底最"尖"（曲率最大）→ <b>有效质量最小</b>。</li>
<li><b>Ⅱ 带</b>在 $k=0$ 处是带顶（开口向下，$\frac{\mathrm d^2E}{\mathrm dk^2}&lt;0$）→ <b>有效质量为负</b>。（因 Ⅰ、Ⅱ 带被电子充满，真正参与导电的是 Ⅱ 带顶附近的电子。）</li>
<li>Ⅰ 带在 $k=0$ 处也是带底，但曲率比 Ⅲ 带小，其正质量是三者中较大的；不过与 Ⅱ 带的负质量相比，<b>$|m^*|$ 最小的仍是 Ⅲ 带</b>。</li>
</ul>
<p class="lead"><b>三、第 (2) 问</b></p>
<p>少量电子由 Ⅱ 带顶激发到 Ⅲ 带底：</p>
<ul>
<li>Ⅲ 带中的电子位于带底，有效质量 $m_n^*(Ⅲ)>0$；</li>
<li>Ⅱ 带中的空穴位于带顶附近，<b>空穴有效质量与同一点电子有效质量大小相等、符号相反</b>：$m_p^*(Ⅱ)=-m_n^*(Ⅱ\text{ 带顶})>0$。</li>
</ul>
<p>从图中看，Ⅱ 带顶比较平缓（曲率小），Ⅲ 带底比较陡（曲率大），即</p>
<p>$$\left|\frac{\mathrm d^2E}{\mathrm dk^2}\right|_{\text{Ⅱ带顶}}&lt;\left|\frac{\mathrm d^2E}{\mathrm dk^2}\right|_{\text{Ⅲ带底}}$$</p>
<p>由 $m^*\propto1/(\text{曲率})$ 得</p>
<p>$$\boxed{\,m_p^*(Ⅱ)>m_n^*(Ⅲ)\,}$$</p>
<p>即 Ⅱ 带的空穴"更重"。</p>`,
kp:['有效质量与能带曲率','带底正质量/带顶负质量','空穴有效质量＝负的电子有效质量','读图比曲率'],
comment:String.raw`这题只考一件事：<b>「比较有效质量」就是「比较曲率」，与能带的高低、宽窄都无关</b>。常见错误有三个：① 把 Ⅱ 带的负质量当成"最小"（负值当然比正值小，但题目问的是 $|m^*|$）；② 用"能带越宽质量越小"这种半对的说法去解释；③ 忘记空穴质量与电子质量符号相反，导致第 (2) 问结论写成"小于"。`
});

A.push({
pid:P(), sec:4, secTitle:S2,
label:'作业二 · 4', title:'价带中 A、B 两种空穴：谁是重空穴？有效质量比？',
statement:String.raw`
<p>下图为某半导体价带中 A、B 两种空穴的 $E\!-\!k$ 关系图，哪个是重空穴？两种空穴的有效质量比是多少？</p>`,
answer:String.raw`<p><b>A 是重空穴</b>（曲线平缓、曲率小）；$m_A^*/m_B^*=5$。</p>`,
solution:String.raw`
<p class="lead"><b>一、空穴能量与曲率</b></p>
<p>价带顶附近，空穴能量 $E_h=-E_e$（以价带顶为零点），故</p>
<p>$$E_h(k)=\frac{\hbar^2k^2}{2m_p^*}=\frac{\hbar^2k^2}{2|m_n^*|}$$</p>
<p>即<b>空穴有效质量与曲率系数成反比：曲线越"陡"（曲率大），有效质量越小</b>。</p>
<p class="lead"><b>二、读图</b></p>
<p>在 $k=0.1\ \mathrm{\mathring{A}^{-1}}$ 处读两条曲线的能量：</p>
<table class="qa">
<thead><tr><th>曲线</th><th>$k/\mathrm{\mathring{A}^{-1}}$</th><th>$E/\mathrm{eV}$</th><th>曲率系数 $a$（$E=ak^2$）</th><th>相对有效质量</th></tr></thead>
<tbody>
<tr><td>A</td><td>0.1</td><td>$-0.1$</td><td>10</td><td>较大（<b>重</b>）</td></tr>
<tr><td>B</td><td>0.1</td><td>$-0.5$</td><td>50</td><td>较小（轻）</td></tr>
</tbody></table>
<p>A 曲线在同一 $k$ 处下落得少（<b>曲率小、曲线平缓</b>）→ 有效质量大 → <b>A 是重空穴</b>；B 曲线下落得多（曲率大）→ 有效质量小 → B 是轻空穴。</p>
<p class="lead"><b>三、质量比</b></p>
<p>由 $m^*=\dfrac{\hbar^2}{2a}$，</p>
<p>$$\frac{m_A^*}{m_B^*}=\frac{a_B}{a_A}=\frac{50}{10}=5$$</p>
<p>即 A（重空穴）的有效质量是 B（轻空穴）的 <b>5 倍</b>。</p>
<p>若代入 $\hbar^2/m_0=7.62\ \mathrm{eV\cdot\mathring{A}^2}$，可得 $m_A^*\approx0.38m_0$、$m_B^*\approx0.076m_0$。绝对数值偏大是因为原图数据本身是示意性的，<b>题目要的是比值</b>（$=5$）。</p>`,
kp: ['空穴能量与电子能量符号相反',String.raw`$m^*\propto1/$曲率`,'重空穴/轻空穴',String.raw`由 $E\!-\!k$ 图读有效质量`],
comment:String.raw`这道题唯一的技巧是<b>「$E_h=-E_e$」</b>：图中画的是价带电子能量（向下弯），读出的"下落量"就是空穴能量。若忘记这一步，会得出"A 轻 B 重"的相反结论。另外要注意<b>比值只与曲率系数有关，与 $\hbar^2/2m_0$ 的取值无关</b>，所以即使读数粗糙，比值仍然可靠——这正是题目只要比值的原因。`
});

A.push({
pid:P(), sec:4, secTitle:S2,
label:'作业二 · 5', title:'Si 导带底（[100] 方向）电子的有效质量',
statement:String.raw`
<p>硅的能带如图所示，导带的最小能量出现在 $[100]$ 方向上。最小值附近一维方向上的能量可近似为</p>
<p>$$E(k)=E_0-E_1\cos\left[a(k-k_0)\right]$$</p>
<p>其中 $k_0$ 是最小能量的 $k$ 值。试确定 $k=k_0$ 时电子的有效质量。</p>`,
answer:String.raw`<p>$m^*=\dfrac{\hbar^2}{E_1a^2}$；写成相对质量 $\dfrac{m^*}{m_0}=\dfrac{7.62}{E_1a^2}$（$a$ 以 $\mathrm{\mathring{A}}$、$E_1$ 以 $\mathrm{eV}$ 计）。</p>`,
solution:String.raw`
<p class="lead"><b>一、求导</b></p>
<p>$$\frac{\mathrm dE}{\mathrm dk}=E_1a\sin\left[a(k-k_0)\right]$$</p>
<p>$$\frac{\mathrm d^2E}{\mathrm dk^2}=E_1a^2\cos\left[a(k-k_0)\right]$$</p>
<p class="lead"><b>二、在 $k=k_0$ 处取值</b></p>
<p>一阶导 $=0$，说明 $k_0$ 确为极值点；二阶导 $=E_1a^2>0$，说明是<b>极小</b>（导带底）。于是</p>
<p>$$m^*=\frac{\hbar^2}{\left.\dfrac{\mathrm d^2E}{\mathrm dk^2}\right|_{k=k_0}}=\boxed{\frac{\hbar^2}{E_1a^2}}$$</p>
<p>写成相对质量（用 $\hbar^2/m_0=7.62\ \mathrm{eV\cdot\mathring{A}^2}$）：</p>
<p>$$\frac{m^*}{m_0}=\frac{7.62}{E_1a^2}$$</p>
<p class="lead"><b>三、讨论</b></p>
<ul>
<li>$m^*$ 与曲率 $E_1a^2$ 成反比：<b>曲率越大（带底越尖）电子越"轻"、迁移率越高</b>。</li>
<li>Si 沿 $[100]$ 共有 <b>6 个等价</b>的导带极小，其附近等能面是沿 $\langle100\rangle$ 拉长的<b>旋转椭球</b>，所以纵向与横向有效质量不同（$m_l=0.98$、$m_t=0.19$）；本题求的是"某一维方向"上的有效质量，对应椭球的主轴方向。</li>
<li>若取 $E_1=1\ \mathrm{eV}$、$a=5.43\ \mathrm{\mathring{A}}$，得 $m^*/m_0=7.62/(1\times29.5)=0.26$，与 Si 的电导有效质量一致——可作数量级自检。</li>
</ul>`,
kp:['有效质量定义','余弦型能带的抛物线近似','Si 的 6 个等价谷','纵向/横向有效质量'],
comment:String.raw`把余弦"在极值附近展开成抛物线"是能带题的标准动作：$E_0-E_1\cos[a(k-k_0)]\approx E_0-E_1+\frac12E_1a^2(k-k_0)^2$，一眼就能读出 $m^*=\hbar^2/(E_1a^2)$。<b>注意 $a$ 的量纲</b>：这里 $a$ 是晶格常数（有单位），$ak$ 必须是无量纲的，所以 $E_1a^2$ 的单位是 $\mathrm{eV\cdot\mathring{A}^2}$，与 $\hbar^2/m_0$ 同量纲。`
});
})();
