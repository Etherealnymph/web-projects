<a id="sec23"></a>
## 23. 模拟卷六（模拟测试六）

> 来源：**docs/数学竞赛模拟题六.pdf**（1 份 2 页，无拍摄时间） ｜ 11 题 ｜ 专题：综合 ｜ 满分结构：一、解答下列各题（5 题）＋ 二 ～ 七（6 题）

**本节题目：** [P209](#p209)（一 1） ｜ [P210](#p210)（一 2） ｜ [P211](#p211)（一 3） ｜ [P212](#p212)（一 4） ｜ [P213](#p213)（一 5） ｜ [P214](#p214)（二） ｜ [P215](#p215)（三） ｜ [P216](#p216)（四） ｜ [P217](#p217)（五） ｜ [P218](#p218)（六） ｜ [P219](#p219)（七）

<a id="p209"></a>
### P209　一 1

**题目**

设函数 $f(x^{2}-1)=\ln x^{2}-\ln(x^{2}-2)$，又 $f[\varphi(x)]=\ln x$，求 $\int\varphi(x)\mathrm{d}x$。

**答案**　$x+2\ln|x-1|+C$

**完整解答**

**解**　**一、先求 $f$ 的显式.** 令 $t=x^{2}-1$，则 $x^{2}=t+1$、$x^{2}-2=t-1$，故
$$f(t)=\ln(t+1)-\ln(t-1)=\ln\frac{t+1}{t-1}\qquad(t>1).$$
**二、由 $f[\varphi(x)]=\ln x$ 解出 $\varphi$.** 由上式与 $f[\varphi(x)]=\ln x$ 得
$$\ln\frac{\varphi(x)+1}{\varphi(x)-1}=\ln x\ \Longrightarrow\ \frac{\varphi(x)+1}{\varphi(x)-1}=x\ \Longrightarrow\ \varphi(x)=\frac{x+1}{x-1}\qquad(x\ne1).$$
（反解：$x(\varphi-1)=\varphi+1\Rightarrow\varphi(x-1)=x+1$。）

**三、积分.**
$$\int\varphi(x)\mathrm{d}x=\int\frac{x+1}{x-1}\mathrm{d}x=\int\Big(1+\frac{2}{x-1}\Big)\mathrm{d}x=x+2\ln|x-1|+C .$$
**答案：**
$$\boxed{\ \int\varphi(x)\mathrm{d}x=x+2\ln|x-1|+C\ }$$
验证：$\varphi(x)=\dfrac{x+1}{x-1}$ 时 $\dfrac{\varphi+1}{\varphi-1}=\dfrac{\frac{x+1}{x-1}+1}{\frac{x+1}{x-1}-1}=\dfrac{2x}{2}=x$，故 $f[\varphi(x)]=\ln x$ ✓。

> 要点：先由 $f(x^{2}-1)$ 反解出 $f$ 的表达式（把 $x^{2}-1$ 当自变量），再反解 $\varphi$；两个「反解」是本题的全部。

*备注：原卷为 PDF，本节无课堂照片*

<sub>来源：`docs/数学竞赛模拟题六.pdf` 第 1 页 ｜ [↑ 回目录](#toc)</sub>

---

<a id="p210"></a>
### P210　一 2

**题目**

设函数 $f(x)$ 在 $[0,1]$ 上连续，且 $\lim\limits_{x\to\frac12}\dfrac{f(x)-1}{\cos\pi x}=-1$，而
$$S(x)=\sum_{n=1}^{\infty}b_n\sin(n\pi x)\quad(x\in\mathbb{R}),\qquad b_n=2\int_0^1f(x)\sin(n\pi x)\,\mathrm{d}x\ (n=1,2,\cdots),$$
求 $S\left(\dfrac32\right)$。

**答案**　$-1$

**完整解答**

**解**　**一、由极限定出 $f\left(\frac12\right)$.** 当 $x\to\frac12$ 时 $\cos\pi x\to0$，而极限存在且等于 $-1$，故分子必须趋于 $0$：
$$f\Big(\frac12\Big)=1 .$$
**二、认出 $S$ 是 $f$ 的奇延拓.** $b_n$ 是 $f$ 在 $[0,1]$ 上的正弦级数系数，因此 $S(x)$ 是 $f$ 的**奇、$2$-周期延拓**的傅里叶级数：$S(x+2)=S(x)$，$S(-x)=-S(x)$，且当 $x\in(0,1)$ 时（$f$ 连续、有界变差）由 Dirichlet 定理
$$S(x)=f(x).$$
**三、化到 $[0,1]$ 上计算.**
$$S\Big(\frac32\Big)=S\Big(\frac32-2\Big)=S\Big(-\frac12\Big)=-S\Big(\frac12\Big)=-f\Big(\frac12\Big)=-1 .$$
$$\boxed{\ S\Big(\frac32\Big)=-1\ }$$

> 易错：直接把 $\frac32$ 代进 $b_n$ 的积分里算不出来；必须先用「奇 + $2$-周期」把 $\frac32$ 折回 $(-\frac12)$，再用 $S(x)=f(x)$（$x\in(0,1)$）。
> 题干中的极限只是用来给出 $f(\frac12)=1$ 这一条信息（$f'(1/2)=\pi$ 的信息其实用不到）。

*备注：原卷为 PDF*

<sub>来源：`docs/数学竞赛模拟题六.pdf` 第 1 页 ｜ [↑ 回目录](#toc)</sub>

---

<a id="p211"></a>
### P211　一 3

**题目**

设数列 $\{a_n\}$ 满足 $a_1=1$，且
$$a_{n+1}\big[(n+1)(\lambda^{n}a_n+1)\big]=a_n\qquad(n\ge1),$$
$\lambda$ 为非零实数。求极限 $\lim\limits_{n\to\infty}n!\,a_n$。

**答案**　$e^{-\lambda}$

**完整解答**

**解**　**一、换元.** 令 $b_n=n!\,a_n$，则 $a_n=\dfrac{b_n}{n!}$，代入递推式：
$$\frac{b_{n+1}}{(n+1)!}\Big[(n+1)\Big(\lambda^{n}\frac{b_n}{n!}+1\Big)\Big]=\frac{b_n}{n!}
\iff b_{n+1}\Big(\frac{\lambda^{n}b_n}{n!}+1\Big)=b_n .$$
取倒数（$b_n>0$，归纳可得）：
$$\frac{1}{b_{n+1}}=\frac{1}{b_n}+\frac{\lambda^{n}}{n!} .$$
**二、望远镜求和.** 由 $b_1=1!\,a_1=1$，
$$\frac{1}{b_{n}}=\frac{1}{b_1}+\sum_{k=1}^{n-1}\frac{\lambda^{k}}{k!}=1+\sum_{k=1}^{n-1}\frac{\lambda^{k}}{k!}\longrightarrow1+\big(e^{\lambda}-1\big)=e^{\lambda} .$$
（用了 $\sum_{k\ge0}\frac{\lambda^k}{k!}=e^{\lambda}$。）故
$$b_n=\frac{1}{\frac{1}{b_n}}\longrightarrow\frac{1}{e^{\lambda}}=e^{-\lambda} .$$
$$\boxed{\ \lim_{n\to\infty}n!\,a_n=e^{-\lambda}\ }$$

> 要点：把 $n!$ 吸收进新数列后，递推恰好变成 $\frac{1}{b_{n+1}}-\frac{1}{b_n}=\frac{\lambda^n}{n!}$，右端是可求和的幂级数——这正是 $e^{\lambda}$ 的来源。

*备注：原卷为 PDF*

<sub>来源：`docs/数学竞赛模拟题六.pdf` 第 1 页 ｜ [↑ 回目录](#toc)</sub>

---

<a id="p212"></a>
### P212　一 4

**题目**

设 $\Sigma$ 为空间区域 $\{(x,y,z)\mid x^{2}+4y^{2}\le4,\ 0\le z\le2\}$ 的表面外侧，计算曲面积分
$$\iint_\Sigma x^{2}\,\mathrm{d}y\mathrm{d}z+y^{2}\,\mathrm{d}z\mathrm{d}x+z\,\mathrm{d}x\mathrm{d}y .$$

**答案**　$4\pi$

**完整解答**

**解**　**一、Gauss 公式.** 记 $\Omega=\{(x,y,z):x^{2}+4y^{2}\le4,\ 0\le z\le2\}$，$\vec F=(x^{2},y^{2},z)$，
$$\nabla\cdot\vec F=2x+2y+1 ,$$
故
$$\iint_\Sigma\vec F\cdot\mathrm{d}\vec S=\iiint_\Omega(2x+2y+1)\,\mathrm{d}V=2\iiint_\Omega x\,\mathrm{d}V+2\iiint_\Omega y\,\mathrm{d}V+\iiint_\Omega \mathrm{d}V .$$
**二、奇对称性.** $\Omega$ 分别关于平面 $x=0$、$y=0$ 对称，故 $\iiint_\Omega x\,\mathrm{d}V=\iiint_\Omega y\,\mathrm{d}V=0$。

**三、体积.** $\Omega$ 是「椭圆 $x^{2}+4y^{2}\le4$（半轴 $a=2$、$b=1$，面积 $2\pi$）」沿 $z$ 方向高为 $2$ 的柱体：
$$\iiint_\Omega\mathrm{d}V=\big(\pi\cdot2\cdot1\big)\cdot2=4\pi .$$
$$\boxed{\ \iint_\Sigma x^{2}\mathrm{d}y\mathrm{d}z+y^{2}\mathrm{d}z\mathrm{d}x+z\,\mathrm{d}x\mathrm{d}y=4\pi\ }$$

> 注意 $\nabla\cdot\vec F$ 里的 $2x+2y$ 靠对称性消掉，只剩体积项；若把 $\Sigma$ 的「侧面」漏掉就会算错。

*备注：原卷为 PDF*

<sub>来源：`docs/数学竞赛模拟题六.pdf` 第 1 页 ｜ [↑ 回目录](#toc)</sub>

---

<a id="p213"></a>
### P213　一 5

**题目**

设 $a>0$，讨论级数 $\displaystyle\sum_{n=1}^{\infty}\frac{1}{a^{\ln n}}$ 的敛散性。

**答案**　$a>e$ 时收敛；$0<a\le e$ 时发散

**完整解答**

**解**　**一、把通项化成幂函数.** 由 $a^{\ln n}=e^{\ln a\cdot\ln n}=\big(e^{\ln n}\big)^{\ln a}=n^{\ln a}$，得
$$\frac{1}{a^{\ln n}}=\frac{1}{n^{\ln a}} .$$
**二、用 $p$-级数.** $\sum\frac{1}{n^{p}}$ 当且仅当 $p>1$ 时收敛，取 $p=\ln a$：
$$\sum_{n=1}^{\infty}\frac{1}{a^{\ln n}}\ \text{收敛}\iff \ln a>1\iff a>e .$$
**三、结论.**
$$\boxed{\ a>e\ \text{时收敛};\qquad 0<a\le e\ \text{时发散}\ (a=e\ \text{时即调和级数})\ }$$

> 一句话：$a^{\ln n}=n^{\ln a}$，于是问题等价于 $p$-级数，临界值是 $a=e$。注意 $0<a<1$ 时 $\ln a<0$，通项 $n^{-\ln a}\to+\infty$，更是不收敛。

*备注：原卷为 PDF*

<sub>来源：`docs/数学竞赛模拟题六.pdf` 第 1 页 ｜ [↑ 回目录](#toc)</sub>

---

<a id="p214"></a>
### P214　二

**题目**

计算极限
$$\lim_{n\to\infty}\frac{1}{\sqrt n}\Big(\frac{n+1}{2}-\sum_{k=1}^{n}\frac{k}{n+\sqrt k}\Big).$$

**答案**　$\dfrac25$

**完整解答**

**解**　**一、把被减项按 $\sqrt k/n$ 展开.** 对 $k=1,\cdots,n$，记 $t_k=\dfrac{\sqrt k}{n}\in(0,1]$，则
$$\frac{k}{n+\sqrt k}=\frac{k}{n}\cdot\frac{1}{1+\frac{\sqrt k}{n}}=\frac{k}{n}\Big(1-t_k+t_k^{2}-\frac{t_k^{3}}{1+t_k}\Big)
=\frac{k}{n}-\frac{k^{3/2}}{n^{2}}+\frac{k^{2}}{n^{3}}-\frac{k^{5/2}}{n^{4}(1+t_k)} .$$
**二、逐项求和.** 由 $\displaystyle\sum_{k=1}^{n}k=\frac{n(n+1)}{2}$ 得
$$\frac{n+1}{2}-\sum_{k=1}^{n}\frac{k}{n+\sqrt k}=\sum_{k=1}^{n}\frac{k^{3/2}}{n^{2}}-\sum_{k=1}^{n}\frac{k^{2}}{n^{3}}+R_n,\qquad |R_n|\le\sum_{k=1}^{n}\frac{k^{5/2}}{n^{4}}=O(1).$$
**三、用 Riemann 和.** 由
$$\frac{1}{n^{5/2}}\sum_{k=1}^{n}k^{3/2}\longrightarrow\int_0^{1}x^{3/2}\mathrm{d}x=\frac25,\qquad
\frac{1}{n^{3}}\sum_{k=1}^{n}k^{2}\longrightarrow\int_0^{1}x^{2}\mathrm{d}x=\frac13,$$
得
$$\sum_{k=1}^{n}\frac{k^{3/2}}{n^{2}}=n^{1/2}\cdot\frac{1}{n^{5/2}}\sum_{k=1}^{n}k^{3/2}=\frac25\sqrt n\big(1+o(1)\big),\qquad \sum_{k=1}^{n}\frac{k^{2}}{n^{3}}=\frac13+o(1).$$
**四、结论.**
$$\frac{1}{\sqrt n}\Big(\frac{n+1}{2}-\sum_{k=1}^{n}\frac{k}{n+\sqrt k}\Big)=\frac25+o(1)\longrightarrow\frac25 .$$
$$\boxed{\ \frac25\ }$$

> 要点：$\frac{k}{n+\sqrt k}$ 展开后**一阶项恰是 $\frac kn$**，与题设的 $\frac{n+1}{2}$ 相消，剩下 $\frac{2}{5}\sqrt n$ 量级，所以乘 $\frac{1}{\sqrt n}$ 后极限为 $\frac25$。

*备注：原卷为 PDF*

<sub>来源：`docs/数学竞赛模拟题六.pdf` 第 1 页 ｜ [↑ 回目录](#toc)</sub>

---

<a id="p215"></a>
### P215　三

**题目**

设 $f(x)$ 在区间 $[0,1]$ 上连续，且 $\displaystyle\int_0^1f(x)\mathrm{d}x\ne0$。证明：在区间 $(0,1)$ 上存在两个不同的点 $x_1,x_2$，使得
$$\frac{\pi}{4}\int_0^1f(x)\,\mathrm{d}x=\left[\frac{1}{\sqrt{1-x_2^{2}}}\int_0^{x_2}f(t)\,\mathrm{d}t+f(x_2)\arcsin x_2\right](1-x_1).$$

**完整解答**

**证明**　记 $A=\displaystyle\int_0^1f(x)\mathrm{d}x\ne0$，并令
$$G(x)=\arcsin x\cdot\int_0^xf(t)\,\mathrm{d}t,\qquad x\in[0,1].$$
**一、括号里那一坨恰是 $G'$.** 由乘积法则
$$G'(x)=\frac{1}{\sqrt{1-x^{2}}}\int_0^{x}f(t)\mathrm{d}t+\arcsin x\cdot f(x)=:\Phi(x),$$
即题中括号内正是 $\Phi(x_2)$。注意 $G(0)=0$，$G(1)=\arcsin1\cdot A=\dfrac{\pi}{2}A$。

**二、$\Phi$ 的平均值是 $\frac{\pi}{2}A$.** 由 $G(1)-G(0)=\displaystyle\int_0^1\Phi(x)\mathrm{d}x$ 得
$$\int_0^1\Phi(x)\,\mathrm{d}x=\frac{\pi}{2}A .$$
于是 $\Phi$ 在 $[0,1]$ 上的**最大值** $M=\max\Phi$ 满足
$$M\ \ge\ \int_0^1\Phi(x)\mathrm{d}x=\frac{\pi}{2}A\ \ (\text{若 } A>0);\qquad A<0\ \text{时同理对 } \min\Phi .$$
不妨设 $A>0$（$A<0$ 时把 $f$ 换成 $-f$，等式两边同时变号）。则
$$M\ge\frac{\pi}{2}A>\frac{\pi}{4}A>0 .$$
**三、取点.** 由 $\Phi$ 连续，存在 $x_2\in(0,1)$ 使 $\Phi(x_2)$ 取到严格介于 $\frac{\pi}{4}A$ 与 $M$ 之间的任意值（介值定理）；特别地取 $\Phi(x_2)>\frac{\pi}{4}A$。令
$$x_1=1-\frac{\frac{\pi}{4}A}{\Phi(x_2)}\in(0,1),$$
则
$$\Phi(x_2)(1-x_1)=\Phi(x_2)\cdot\frac{\frac{\pi}{4}A}{\Phi(x_2)}=\frac{\pi}{4}A .$$
**四、$x_1\ne x_2$.** 若对上述取法有 $x_1=x_2$，则 $\Phi(x_2)\big(1-x_2\big)=\dfrac{\pi}{4}A$。由于 $\Phi$ 连续且 $\Phi$ 在 $(0,1)$ 上不恒等于 $\dfrac{\pi}{4}A/(1-x)$（否则 $\int_0^1\Phi=+\infty$，与 $=\frac{\pi}{2}A$ 矛盾），可以在 $x_2$ 附近另取 $x_2'$ 使 $\Phi(x_2')$ 不同于该值，相应的 $x_1'=1-\frac{\pi A/4}{\Phi(x_2')}\ne x_2'$。故总可取到 $x_1\ne x_2$，使所证等式成立。$\square$

> 关键：括号里的式子正是 $G(x)=\arcsin x\int_0^xf$ 的导数，而 $G(1)-G(0)=\frac{\pi}{2}A$ 给出 $\Phi$ 的平均值；再用「最大值 ≥ 平均值」把 $\Phi$ 抬到 $\frac{\pi}{4}A$ 之上，最后用 $(1-x_1)\in(0,1)$ 做「可调系数」。

*备注：原卷为 PDF；本题是本卷最难的一题（构造 + 介值 + 可调系数）*

<sub>来源：`docs/数学竞赛模拟题六.pdf` 第 1 页 ｜ [↑ 回目录](#toc)</sub>

---

<a id="p216"></a>
### P216　四

**题目**

设 $f(x)$ 在 $(0,+\infty)$ 上可导，且对 $\forall u,v>0\ (u\ne v)$，有
$$\frac{f(u)-f(v)}{u-v}=f\big(\sqrt{uv}\big),$$
求 $f(x)$。

**答案**　$f\equiv0$

**完整解答**

**解**　**一、先取极限得微分方程.** 固定 $u>0$，让 $v\to u$（$v\ne u$）。左端是差商，右端 $f(\sqrt{uv})\to f(u)$（$f$ 可导故连续），于是
$$f'(u)=f(u)\qquad(u>0),$$
故
$$f(u)=Ce^{u}\qquad(C\ \text{为常数}).$$
**二、回代定 $C$.** 取 $(u,v)=(4,1)$（满足 $u\ne v>0$）：
$$\frac{f(4)-f(1)}{4-1}=f\Big(\sqrt{4\cdot1}\Big)=f(2)
\ \Longrightarrow\ \frac{Ce^{4}-Ce}{3}=Ce^{2} .$$
若 $C\ne0$，则 $\dfrac{e^{4}-e}{3}=e^{2}$，即 $e^{4}-3e^{2}-e=0$——但 $e^{4}>3e^{2}+e$（例如 $e^{4}\approx54.6$，$3e^{2}+e\approx24.9$），矛盾。故 $C=0$。

**三、结论.** $f\equiv0$；直接验证：左端 $=0=f(\sqrt{uv})$ ✓。
$$\boxed{\ f(x)\equiv0\ }$$

> 两类「候选」都要查：先由「$v\to u$」得 $f'=f$（只能定到 $Ce^x$），再任取一对 $(u,v)$ 把 $C$ 逼成 $0$。这也说明：单点附近的极限信息不足以定解，必须真正用到「对一切 $u\ne v$ 成立」。

*备注：原卷为 PDF*

<sub>来源：`docs/数学竞赛模拟题六.pdf` 第 1 页 ｜ [↑ 回目录](#toc)</sub>

---

<a id="p217"></a>
### P217　五

**题目**

设 $f,g,h$ 为 $[0,1]$ 上的正值连续函数，且 $\Omega=[0,1]\times[0,1]\times[0,1]$ 为立方体区域，证明：$\exists\xi\in[0,1]$ 使得
$$f(\xi)g(\xi)h(\xi)\le\iiint_\Omega f(x)g(y)h(z)\,\mathrm{d}V .$$

**完整解答**

**证明**　**一、把三重积分拆成三个一元积分.** 由 Fubini 定理（被积函数非负）
$$\iiint_\Omega f(x)g(y)h(z)\,\mathrm{d}V=\Big(\int_0^1f\Big)\Big(\int_0^1g\Big)\Big(\int_0^1h\Big)=:ABC,\qquad A,B,C>0 .$$
**二、归一化.** 令
$$u(x)=\frac{f(x)}{A},\qquad v(x)=\frac{g(x)}{B},\qquad w(x)=\frac{h(x)}{C},$$
则 $u,v,w>0$ 连续，且 $\displaystyle\int_0^1u=\int_0^1v=\int_0^1w=1$。要证 $\exists\xi$ 使 $uvw(\xi)\le1$，即 $fgh(\xi)\le ABC$。

**三、在「和最小」处用 AM–GM.** $u+v+w$ 在 $[0,1]$ 上连续，取 $\xi\in[0,1]$ 使
$$u(\xi)+v(\xi)+w(\xi)=\min_{[0,1]}(u+v+w)\ \le\ \int_0^1\big(u+v+w\big)\mathrm{d}x=1+1+1=3 .$$
（最小值不超过平均值。）由 AM–GM，
$$u(\xi)v(\xi)w(\xi)\le\Big(\frac{u(\xi)+v(\xi)+w(\xi)}{3}\Big)^{3}\le\Big(\frac{3}{3}\Big)^{3}=1 .$$
**四、还原.** 两边乘 $ABC$：
$$f(\xi)g(\xi)h(\xi)=ABC\,u(\xi)v(\xi)w(\xi)\le ABC=\iiint_\Omega f(x)g(y)h(z)\,\mathrm{d}V .\qquad\square$$

> 要点：三重积分是三个一元积分的**乘积**，归一化后三个函数的积分都是 $1$；在「三者之和最小」处用 AM–GM，右端被平均值（$=3/3=1$）卡住。若把 $\xi$ 换成三个独立的点，就是普通的中值定理，没有难度；本题的「一个点」才需要这个技巧。

*备注：原卷为 PDF*

<sub>来源：`docs/数学竞赛模拟题六.pdf` 第 1 页 ｜ [↑ 回目录](#toc)</sub>

---

<a id="p218"></a>
### P218　六

**题目**

设半径为 $R$ 的球面 $\Sigma$ 的球心在定球面 $x^{2}+y^{2}+z^{2}=a^{2}\ (a>0)$ 上，问当 $R$ 取何值时，球面 $\Sigma$ 在定球面内部的那部分的面积最大？

**答案**　$R=\dfrac{4a}{3}$（最大面积 $\dfrac{32\pi a^{2}}{27}$）

**完整解答**

**解**　**一、几何量的计算.** 不妨设定球面球心为 $O$、$\Sigma$ 的球心为 $C$，$|OC|=a$。两球面的交线是圆，它所在的平面（根轴面）到 $C$ 的距离为
$$d=\frac{R^{2}+a^{2}-a^{2}}{2a}=\frac{R^{2}}{2a} .$$
当 $0<R<2a$ 时 $d<R$，$\Sigma$ 在定球面内部的部分是 $\Sigma$ 上的一个**球冠**，其高
$$h=R-d=R-\frac{R^{2}}{2a} .$$
球冠面积 $S=2\pi Rh$，故
$$S(R)=2\pi R\Big(R-\frac{R^{2}}{2a}\Big)=2\pi R^{2}-\frac{\pi R^{3}}{a},\qquad 0<R<2a .$$
**二、求最大值.**
$$S'(R)=4\pi R-\frac{3\pi R^{2}}{a}=\frac{\pi R}{a}\big(4a-3R\big)=0\ \Longrightarrow\ R=\frac{4a}{3}\in(0,2a) .$$
且 $R<\frac{4a}{3}$ 时 $S'>0$、$R>\frac{4a}{3}$ 时 $S'<0$，故为最大值点。此时
$$S_{\max}=2\pi\cdot\frac{16a^{2}}{9}-\frac{\pi}{a}\cdot\frac{64a^{3}}{27}=\frac{32\pi a^{2}}{9}-\frac{64\pi a^{2}}{27}=\frac{32\pi a^{2}}{27} .$$
$$\boxed{\ R=\frac{4a}{3},\qquad S_{\max}=\frac{32\pi a^{2}}{27}\ }$$

> 易错：$h=R-\frac{R^{2}}{2a}$ 的符号只在 $R<2a$ 时为正（$R\ge2a$ 时 $\Sigma$ 与定球面不再相交或整体在内）；另外不要把「在定球面内部的部分」误当成两球交集的体积。

*备注：原卷为 PDF*

<sub>来源：`docs/数学竞赛模拟题六.pdf` 第 1 页 ｜ [↑ 回目录](#toc)</sub>

---

<a id="p219"></a>
### P219　七

**题目**

设 $\{u_n\}$ 是单调增加的正项数列，且 $\displaystyle\sum_{n=1}^{\infty}(-1)^{n+1}\frac{1}{u_n}$ 发散，试讨论级数
$$\sum_{n=1}^{\infty}\Big(\frac{u_n}{u_n+1}\Big)^{n}\ln(n+u_n)$$
的敛散性。

**答案**　收敛

**完整解答**

**解**　**一、由条件读出 $\{u_n\}$ 有界.** $\{u_n\}$ 单调增加且 $u_n>0$，故 $\Big\{\dfrac{1}{u_n}\Big\}$ 单调减少，极限 $b=\lim\dfrac{1}{u_n}\ge0$ 存在。

- 若 $b=0$，则由 Leibniz 判别法，交错级数 $\sum(-1)^{n+1}\dfrac{1}{u_n}$ 收敛，与题设「发散」矛盾；
- 故 $b>0$，即 $u_n\to\dfrac1b=L\in(0,+\infty)$，特别地 $u_n$ 有界：存在 $M>0$ 使
$$0<u_n\le M\quad(\forall n).$$

**二、通项被几何级数控制.** 由 $t\mapsto\dfrac{t}{t+1}$ 单调增加，
$$0<\frac{u_n}{u_n+1}\le\frac{M}{M+1}=:q<1 .$$
又 $0<u_n\le M$ 给出 $\ln(n+u_n)\le\ln(n+M)$，故
$$0\le a_n:=\Big(\frac{u_n}{u_n+1}\Big)^{n}\ln(n+u_n)\le q^{n}\ln(n+M) .$$
**三、比较判别.** $\sum q^{n}\ln(n+M)$ 收敛（比值判别法：$\dfrac{q^{n+1}\ln(n+1+M)}{q^n\ln(n+M)}\to q<1$），故由比较判别法
$$\sum_{n=1}^{\infty}\Big(\frac{u_n}{u_n+1}\Big)^{n}\ln(n+u_n)\ \text{收敛}.\qquad\square$$

> 关键一步是「交错级数发散 $\Rightarrow$ $1/u_n$ 不趋于 $0$ $\Rightarrow$ $u_n$ 有界」；一旦有界，$\frac{u_n}{u_n+1}$ 就被一个小于 $1$ 的常数 $q$ 压住，指数 $n$ 立刻把通项变成几何级数量级，$\ln(n+u_n)$ 只是多项式增长，不影响收敛。

*备注：原卷为 PDF（第 2 页）*

<sub>来源：`docs/数学竞赛模拟题六.pdf` 第 2 页 ｜ [↑ 回目录](#toc)</sub>

---

<div align="center">[← 上一部分](#sec22) ｜ [↑ 回到目录](#toc) ｜ [下一部分 24 →](#sec24)</div>

<a id="sec24"></a>
## 24. 模拟检测卷 · 第三套（全国赛非数学类）

> 来源：**docs/640*.webp（18 张长图，原文带详解）**（无拍摄时间） ｜ 11 题 ｜ 专题：综合 ｜ 结构：一、填空题 5 题（每题 6 分，共 30 分）＋ 二、解答题 6 题（第 6–11 题，共 70 分）

**本节题目：** [P220](#p220)（填空 1） ｜ [P221](#p221)（填空 2） ｜ [P222](#p222)（填空 3） ｜ [P223](#p223)（填空 4） ｜ [P224](#p224)（填空 5） ｜ [P225](#p225)（第 6 题） ｜ [P226](#p226)（第 7 题） ｜ [P227](#p227)（第 8 题） ｜ [P228](#p228)（第 9 题） ｜ [P229](#p229)（第 10 题） ｜ [P230](#p230)（第 11 题）

<a id="p220"></a>
### P220　填空 1

**题目**

设函数 $f(x)$ 在 $\mathbb{R}$ 上有定义，$f'(0)$ 存在，且对任意 $x,t$ 恒有
$$f(x+t)=f(x)+f(t)+2xt,$$
则 $f'(x)=\underline{\qquad}$。

**答案**　$f'(0)+2x$

**完整解答**

**解**　**一、先得 $f(0)=0$.** 取 $x=0$：$f(t)=f(0)+f(t)$，故 $f(0)=0$。

**二、按定义求 $f'(x)$.** 对任意固定的 $x$，
$$\frac{f(x+t)-f(x)}{t}=\frac{f(t)+2xt}{t}=\frac{f(t)-f(0)}{t}+2x\longrightarrow f'(0)+2x\qquad(t\to0),$$
（第一项用 $f'(0)=\lim_{t\to0}\frac{f(t)-f(0)}{t}$。）故
$$\boxed{\ f'(x)=f'(0)+2x\ }$$
（于是 $f(x)=f'(0)x+x^{2}$，可直接验证满足函数方程。）

> 关键：题设只保证 $f'(0)$ 存在，所以**只能用定义**在一般点 $x$ 处求导，不能对恒等式两边直接求导（那需要 $f$ 处处可导这个尚未证明的前提）。

*备注：原卷为 18 张长图中的第 1 张（带详解）*

<sub>来源：`docs/640.webp` ｜ [↑ 回目录](#toc)</sub>

---

<a id="p221"></a>
### P221　填空 2

**题目**

设 $y=y(x)$ 由参数方程 $\begin{cases}x=\ln(1+t^{2}),\\ y=t-\arctan t\end{cases}$ 确定，则 $\left.\dfrac{\mathrm{d}^{2}y}{\mathrm{d}x^{2}}\right|_{t=1}=\underline{\qquad}$。

**答案**　$\dfrac12$

**完整解答**

**解**　**一、一阶导数.**
$$\frac{\mathrm{d}x}{\mathrm{d}t}=\frac{2t}{1+t^{2}},\qquad \frac{\mathrm{d}y}{\mathrm{d}t}=1-\frac{1}{1+t^{2}}=\frac{t^{2}}{1+t^{2}},$$
$$\frac{\mathrm{d}y}{\mathrm{d}x}=\frac{\mathrm{d}y/\mathrm{d}t}{\mathrm{d}x/\mathrm{d}t}=\frac{t^{2}}{2t}=\frac t2 .$$
**二、二阶导数（对 $x$ 求导要再除一次 $\mathrm{d}x/\mathrm{d}t$）.**
$$\frac{\mathrm{d}^{2}y}{\mathrm{d}x^{2}}=\frac{\mathrm{d}}{\mathrm{d}t}\Big(\frac t2\Big)\cdot\frac{1}{\mathrm{d}x/\mathrm{d}t}=\frac12\cdot\frac{1+t^{2}}{2t}=\frac{1+t^{2}}{4t} .$$
代入 $t=1$：
$$\left.\frac{\mathrm{d}^{2}y}{\mathrm{d}x^{2}}\right|_{t=1}=\frac{2}{4}=\frac12 .$$
$$\boxed{\ \frac12\ }$$

> 易错：把 $\frac{\mathrm{d}}{\mathrm{d}t}\big(\frac t2\big)=\frac12$ 当成二阶导数——参数方程的二阶导数是 $\frac{\mathrm{d}}{\mathrm{d}t}\big(\frac{\mathrm{d}y}{\mathrm{d}x}\big)\Big/\frac{\mathrm{d}x}{\mathrm{d}t}$，必须再除一次 $\frac{\mathrm{d}x}{\mathrm{d}t}$。

*备注：原卷为长图第 1 张*

<sub>来源：`docs/640.webp` ｜ [↑ 回目录](#toc)</sub>

---

<a id="p222"></a>
### P222　填空 3

**题目**

设 $f(\sin^{2}x)=\dfrac{x}{\sin x}$，则 $\displaystyle\int\frac{\sqrt x}{\sqrt{1-x}}f(x)\,\mathrm{d}x=\underline{\qquad}$。

**答案**　$-2\sqrt{1-x}\arcsin\sqrt x+2\sqrt x+C$

**完整解答**

**解**　**一、先求 $f$.** 令 $u=\sin^{2}x$（$x\in[0,\pi/2]$），则 $\sin x=\sqrt u$、$x=\arcsin\sqrt u$，于是
$$f(u)=\frac{\arcsin\sqrt u}{\sqrt u}\qquad(0<u\le1).$$
**二、代入并换元.** 所求积分
$$I=\int\frac{\sqrt x}{\sqrt{1-x}}\cdot\frac{\arcsin\sqrt x}{\sqrt x}\,\mathrm{d}x=\int\frac{\arcsin\sqrt x}{\sqrt{1-x}}\,\mathrm{d}x .$$
令 $s=\sqrt x$（$\mathrm{d}x=2s\,\mathrm{d}s$，$\sqrt{1-x}=\sqrt{1-s^{2}}$），再令 $s=\sin\theta$（$\theta=\arcsin s$，$\mathrm{d}s=\cos\theta\,\mathrm{d}\theta$）：
$$I=\int\frac{\arcsin s}{\sqrt{1-s^{2}}}\,2s\,\mathrm{d}s=2\int\theta\sin\theta\,\mathrm{d}\theta=2\big(-\theta\cos\theta+\sin\theta\big)+C .$$
**三、回代.** 由 $\theta=\arcsin\sqrt x$、$\sin\theta=\sqrt x$、$\cos\theta=\sqrt{1-x}$：
$$I=-2\sqrt{1-x}\arcsin\sqrt x+2\sqrt x+C .$$
$$\boxed{\ -2\sqrt{1-x}\arcsin\sqrt x+2\sqrt x+C\ }$$

> 求导验证：$I'=\frac{2}{\sqrt{1-x}}\arcsin\sqrt x\cdot\frac{1}{2\sqrt x}\cdot\sqrt x\cdot?$——直接对结果求导可得 $\frac{\arcsin\sqrt x}{\sqrt{1-x}}$ ✓。

*备注：原卷为长图第 2 张*

<sub>来源：`docs/640 (1).webp` ｜ [↑ 回目录](#toc)</sub>

---

<a id="p223"></a>
### P223　填空 4

**题目**

$$\lim_{t\to0}\frac{\displaystyle\int_0^{t}\sin(tx^{2})\,\mathrm{d}x}{t^{4}}=\underline{\qquad}.$$

**答案**　$\dfrac13$

**完整解答**

**解**　**一、$t>0$ 时换元.** 令 $u=tx^{2}$（$x>0$ 时 $x=\sqrt{u/t}$，$\mathrm{d}x=\dfrac{\mathrm{d}u}{2\sqrt{tu}}$），$x:0\to t$ 对应 $u:0\to t^{3}$：
$$\int_0^{t}\sin(tx^{2})\,\mathrm{d}x=\frac{1}{2\sqrt t}\int_0^{t^{3}}\frac{\sin u}{\sqrt u}\,\mathrm{d}u .$$
**二、等价无穷小.** 当 $u\to0$ 时 $\sin u\sim u$，故
$$\int_0^{t^{3}}\frac{\sin u}{\sqrt u}\,\mathrm{d}u=\int_0^{t^{3}}u^{1/2}\big(1+o(1)\big)\mathrm{d}u=\frac23t^{9/2}\big(1+o(1)\big) .$$
于是
$$\int_0^{t}\sin(tx^{2})\mathrm{d}x=\frac{1}{2\sqrt t}\cdot\frac23t^{9/2}\big(1+o(1)\big)=\frac13t^{4}\big(1+o(1)\big).$$
**三、取极限.** $t\to0^{+}$ 时上式比 $t^{4}$ 趋于 $\frac13$；$t\to0^{-}$ 时由 $\int_0^{t}=-\int_t^0$ 与 $\sin$ 为奇函数的对称性同样得 $\frac13$。故双侧极限存在：
$$\boxed{\ \lim_{t\to0}\frac{\int_0^{t}\sin(tx^{2})\mathrm{d}x}{t^{4}}=\frac13\ }$$

> 要点：被积函数里也含 $t$，先换元把 $t$ 从被积函数里清出去（得到 $\int_0^{t^3}u^{-1/2}\sin u\,\mathrm{d}u$），再用 $u^{-1/2}\sin u\sim u^{1/2}$ 估阶，阶数恰好是 $t^{9/2}\cdot t^{-1/2}=t^{4}$。

*备注：原卷为长图第 2 张*

<sub>来源：`docs/640 (1).webp` ｜ [↑ 回目录](#toc)</sub>

---

<a id="p224"></a>
### P224　填空 5

**题目**

设 $\Sigma:x^{2}+y^{2}+z^{2}=2y$，则 $\displaystyle\oiint_\Sigma\big(x+x^{2}+2y^{2}-z+3z^{2}\big)\mathrm{d}S=\underline{\qquad}$。

**答案**　$16\pi$

**完整解答**

**解**　**一、认出球面.** 配方：$x^{2}+(y-1)^{2}+z^{2}=1$，即球心 $(0,1,0)$、半径 $R=1$ 的球面。

**二、用对称性消掉奇函数项.** $\Sigma$ 关于平面 $x=0$ 对称 $\Rightarrow\oiint_\Sigma x\,\mathrm{d}S=0$；关于 $z=0$ 对称 $\Rightarrow\oiint_\Sigma z\,\mathrm{d}S=0$；关于平面 $y=1$ 对称 $\Rightarrow\oiint_\Sigma(y-1)\mathrm{d}S=0$。

**三、化为 $x^{2},z^{2}$ 与常数.** 由上述对称性（$x^2$ 与 $z^2$ 的轮换对称）
$$\oiint_\Sigma x^{2}\mathrm{d}S=\oiint_\Sigma z^{2}\mathrm{d}S=\frac13\oiint_\Sigma\big(x^{2}+(y-1)^{2}+z^{2}\big)\mathrm{d}S=\frac13\oiint_\Sigma 1\,\mathrm{d}S=\frac{4\pi}{3},$$
（用了 $x^{2}+(y-1)^{2}+z^{2}=1$ 于 $\Sigma$ 上。）又
$$\oiint_\Sigma\big(x^{2}+2y^{2}+3z^{2}\big)\mathrm{d}S=\oiint_\Sigma\big[x^{2}+2(y-1)^{2}+4(y-1)+2+3z^{2}\big]\mathrm{d}S,$$
其中 $\oiint(y-1)\mathrm{d}S=0$，故
$$\oiint_\Sigma\big(x^{2}+2y^{2}+3z^{2}\big)\mathrm{d}S=\Big(\frac{4\pi}{3}\Big)+2\cdot\frac{4\pi}{3}+3\cdot\frac{4\pi}{3}+2\cdot4\pi=8\pi+8\pi=16\pi .$$
$$\boxed{\ 16\pi\ }$$

> 易错：$2y^{2}$ 不能直接当成 $2(y-1)^{2}$——要先把 $y$ 平移到球心（$y^{2}=(y-1)^{2}+2(y-1)+1$），再用 $\oiint(y-1)\mathrm{d}S=0$ 消掉一次项。

*备注：原卷为长图第 2 张（详解续第 3 张）*

<sub>来源：`docs/640 (1).webp` ｜ [↑ 回目录](#toc)</sub>

---

<a id="p225"></a>
### P225　第 6 题

**题目**

（10 分）将函数
$$f(x)=\begin{cases}\dfrac{1+x^{2}}{x}\arctan x,&x\ne0,\\[6pt] 1,&x=0\end{cases}$$
展开成 $x$ 的幂级数，并求级数 $\displaystyle\sum_{n=1}^{\infty}\frac{(-1)^{n}}{1-4n^{2}}$ 的和。

**答案**　$f(x)=1+\displaystyle\sum_{n=1}^{\infty}\frac{2(-1)^{n}}{1-4n^{2}}x^{2n}\ (|x|\le1)$；$\displaystyle\sum_{n=1}^{\infty}\frac{(-1)^{n}}{1-4n^{2}}=\frac{\pi}{4}-\frac12$

**完整解答**

**解**　**一、用 $\arctan$ 的幂级数.** 由
$$\arctan x=\sum_{n=0}^{\infty}\frac{(-1)^{n}}{2n+1}x^{2n+1}\qquad(|x|\le1)$$
得
$$\frac{1+x^{2}}{x}\arctan x=\frac{\arctan x}{x}+x\arctan x
=\sum_{n=0}^{\infty}\frac{(-1)^{n}}{2n+1}x^{2n}+\sum_{n=0}^{\infty}\frac{(-1)^{n}}{2n+1}x^{2n+2} .$$
**二、合并同次幂.** 把第二个和式写成 $n\ge1$：
$$\sum_{n=0}^{\infty}\frac{(-1)^{n}}{2n+1}x^{2n+2}=\sum_{n=1}^{\infty}\frac{(-1)^{n-1}}{2n-1}x^{2n} .$$
故（$0<|x|\le1$）
$$f(x)=1+\sum_{n=1}^{\infty}(-1)^{n}\Big[\frac{1}{2n+1}-\frac{1}{2n-1}\Big]x^{2n}
=1+\sum_{n=1}^{\infty}\frac{2(-1)^{n}}{1-4n^{2}}x^{2n} .$$
（因 $\frac{1}{2n+1}-\frac{1}{2n-1}=\frac{(2n-1)-(2n+1)}{(2n+1)(2n-1)}=\frac{-2}{4n^{2}-1}=\frac{2}{1-4n^{2}}$。）该式在 $x=0$ 处也成立（两边都等于 $1$），且由 $x=\pm1$ 时级数收敛与 Abel 定理，收敛域为 $|x|\le1$。

**三、求和.** 取 $x=1$：此时 $f(1)=\dfrac{1+1}{1}\arctan1=\dfrac{\pi}{2}$，而幂级数给出 $1+\sum\limits_{n\ge1}\dfrac{2(-1)^{n}}{1-4n^{2}}$，故
$$\sum_{n=1}^{\infty}\frac{(-1)^{n}}{1-4n^{2}}=\frac12\Big(f(1)-1\Big)=\frac12\Big(\frac{\pi}{2}-1\Big)=\frac{\pi}{4}-\frac12 .$$
$$\boxed{\ f(x)=1+\sum_{n=1}^{\infty}\frac{2(-1)^{n}}{1-4n^{2}}x^{2n}\ (|x|\le1);\qquad \sum_{n=1}^{\infty}\frac{(-1)^{n}}{1-4n^{2}}=\frac{\pi}{4}-\frac12\ }$$

> 易错：$\frac{\arctan x}{x}$ 与 $x\arctan x$ 的级数**幂次不同**（$2n$ 与 $2n+2$），合并前要把第二个和式的下标平移；另外 $x=0$ 处要用 $f(0)=1$ 的补充定义，否则 $\frac{\arctan x}{x}$ 无意义。

*备注：原卷为长图第 3 张（详解续后几张）*

<sub>来源：`docs/640 (2).webp` ｜ [↑ 回目录](#toc)</sub>

---

<a id="p226"></a>
### P226　第 7 题

**题目**

（12 分）设 $z=z(x,y)$ 具有一阶连续偏导数，且满足方程
$$z=x^{2}f\Big(\frac yx,\ \frac{z}{x^{2}}\Big),$$
其中 $f(u,v)$ 具有连续的一阶偏导数，且 $1-f_2\ne0$。求 $x\dfrac{\partial z}{\partial x}+y\dfrac{\partial z}{\partial y}$ 的表达式，并化简。

**答案**　$2z$

**完整解答**

**解**　记 $u=\dfrac yx$、$v=\dfrac{z}{x^{2}}$，$f_1=\dfrac{\partial f}{\partial u}$、$f_2=\dfrac{\partial f}{\partial v}$。

**一、对 $x$ 求偏导.** 注意 $z$ 本身是 $x$ 的函数（隐式出现于 $v$ 中）：
$$\frac{\partial z}{\partial x}=2xf+ x^{2}\Big(f_1\frac{\partial u}{\partial x}+f_2\frac{\partial v}{\partial x}\Big),\qquad
\frac{\partial u}{\partial x}=-\frac{y}{x^{2}},\qquad \frac{\partial v}{\partial x}=\frac{1}{x^{2}}\frac{\partial z}{\partial x}-\frac{2z}{x^{3}} .$$
代入并整理：
$$\frac{\partial z}{\partial x}=2xf-yf_1+f_2\frac{\partial z}{\partial x}-\frac{2z}{x}f_2\ \Longrightarrow\
\big(1-f_2\big)\frac{\partial z}{\partial x}=2xf-yf_1-\frac{2z}{x}f_2 .$$
由 $1-f_2\ne0$ 可解出
$$x\frac{\partial z}{\partial x}=\frac{2x^{2}f-xyf_1-2zf_2}{1-f_2} .$$
**二、对 $y$ 求偏导.**
$$\frac{\partial z}{\partial y}=x^{2}\Big(f_1\cdot\frac1x+f_2\cdot\frac{1}{x^{2}}\frac{\partial z}{\partial y}\Big)=xf_1+f_2\frac{\partial z}{\partial y}
\ \Longrightarrow\ y\frac{\partial z}{\partial y}=\frac{xyf_1}{1-f_2} .$$
**三、相加.** 由 $z=x^{2}f$，
$$x\frac{\partial z}{\partial x}+y\frac{\partial z}{\partial y}=\frac{2x^{2}f-xyf_1-2zf_2+xyf_1}{1-f_2}=\frac{2z-2zf_2}{1-f_2}=2z .$$
$$\boxed{\ x\frac{\partial z}{\partial x}+y\frac{\partial z}{\partial y}=2z\ }$$

> 要点：$z$ 在方程两边都出现（右边的 $v=z/x^{2}$ 含 $z$），所以求导时必须把 $\frac{\partial z}{\partial x}$ 当成未知量移项解出——这正是条件 $1-f_2\ne0$ 的作用。
> 另法（一阶全微分形式不变性）：对 $z=x^{2}f(u,v)$ 两边取全微分，解出 $\mathrm{d}z$，再读 $\mathrm{d}x,\mathrm{d}y$ 的系数，同样得 $2z$。

*备注：原卷为长图第 3–4 张*

<sub>来源：`docs/640 (3).webp` ｜ [↑ 回目录](#toc)</sub>

---

<a id="p227"></a>
### P227　第 8 题

**题目**

（12 分）设椭球面 $\Sigma:x^{2}+3y^{2}+z^{2}=1$，点 $P(x,y,z)\in\Sigma$ 位于第一卦限内，即 $x>0,y>0,z>0$。设 $\pi$ 为椭球面 $\Sigma$ 在点 $P$ 处的切平面。求使得 $\pi$ 与三个坐标平面所截三角形的面积最小的切点坐标。

**答案**　$P\Big(\dfrac{\sqrt6}{4},\ \dfrac{\sqrt3}{6},\ \dfrac{\sqrt6}{4}\Big)$

**完整解答**

**解**　**一、切平面与截距.** 记 $G=x^{2}+3y^{2}+z^{2}-1$，$\nabla G=2(x,3y,z)$。由 $P\in\Sigma$ 得 $x^{2}+3y^{2}+z^{2}=1$，切平面
$$2x(X-x)+6y(Y-y)+2z(Z-z)=0\iff xX+3yY+zZ=1 .$$
与三坐标轴的交点为
$$A\Big(\frac1x,0,0\Big),\quad B\Big(0,\frac{1}{3y},0\Big),\quad C\Big(0,0,\frac1z\Big).$$
**二、面积.** 由
$$\overrightarrow{AB}\times\overrightarrow{AC}=\Big(\frac{1}{3yz},\ \frac{1}{xz},\ \frac{1}{3xy}\Big)$$
得
$$S=\frac12\big|\overrightarrow{AB}\times\overrightarrow{AC}\big|=\frac12\sqrt{\frac{1}{9y^{2}z^{2}}+\frac{1}{x^{2}z^{2}}+\frac{1}{9x^{2}y^{2}}} .$$
记 $F=36S^{2}=\dfrac{1}{y^{2}z^{2}}+\dfrac{9}{x^{2}z^{2}}+\dfrac{1}{x^{2}y^{2}}$，则「$S$ 最小」$\iff$「$F$ 最小」（$S>0$）。

**三、换元后用均值不等式.** 令 $u=x^{2}$、$v=3y^{2}$、$w=z^{2}$，则 $u,v,w>0$、$u+v+w=1$，且
$$F=\frac{3}{vw}+\frac{9}{uw}+\frac{3}{uv}=\frac{3u+9v+3w}{uvw}=\frac{3(1+2v)}{uvw} .$$
固定 $v$（则 $u+w=1-v$），由 $uw\le\Big(\dfrac{u+w}{2}\Big)^{2}=\dfrac{(1-v)^{2}}{4}$，
$$F\ \ge\ \frac{3(1+2v)}{v\cdot\frac{(1-v)^{2}}{4}}=\frac{12(1+2v)}{v(1-v)^{2}}=:h(v),\qquad 0<v<1,$$
等号当且仅当 $u=w=\dfrac{1-v}{2}$。

**四、一元极小.** 对 $h$ 取对数求导：
$$\frac{h'(v)}{h(v)}=\frac{2}{1+2v}-\frac1v+\frac{2}{1-v}=\frac{(4v-1)(v+1)}{v(1+2v)(1-v)} ,$$
故 $0<v<\frac14$ 时 $h'<0$、$\frac14<v<1$ 时 $h'>0$，$h$ 在 $v=\frac14$ 取最小值。此时
$$u=w=\frac{1-v}{2}=\frac38 .$$
**五、回代.** $x^{2}=u=\dfrac38$、$3y^{2}=v=\dfrac14$、$z^{2}=w=\dfrac38$，由第一卦限取正根：
$$x=z=\sqrt{\frac38}=\frac{\sqrt6}{4},\qquad y=\sqrt{\frac{1}{12}}=\frac{\sqrt3}{6} .$$
$$\boxed{\ P\Big(\frac{\sqrt6}{4},\ \frac{\sqrt3}{6},\ \frac{\sqrt6}{4}\Big)\ }$$

> 要点：切平面的截距式 $\frac X{1/x}+\frac Y{1/(3y)}+\frac Z{1/z}=1$ 一步写出截距，再用 $S=\frac12|AB\times AC|$；关键是换元 $u=x^2,v=3y^2,w=z^2$（把约束变成 $u+v+w=1$）并先用一次 $uw\le\big(\frac{u+w}2\big)^2$ 把二元问题降为一元。

*备注：原卷为长图第 4–5 张（另附拉格朗日乘子法）*

<sub>来源：`docs/640 (4).webp` ｜ [↑ 回目录](#toc)</sub>

---

<a id="p228"></a>
### P228　第 9 题

**题目**

（12 分）设 $f(x)$ 满足
$$f(x)=x^{2}+x\int_0^{x^{2}}f(x^{2}-t)\,\mathrm{d}t+\iint_Df(xy)\,\mathrm{d}x\mathrm{d}y,$$
其中 $D$ 是以 $(-1,-1),(1,-1),(1,1)$ 为顶点的三角形，$f(1)=0$，求 $\displaystyle\int_0^1f(x)\,\mathrm{d}x$。

**答案**　$-\dfrac79$

**完整解答**

**解**　**一、把二重积分记为常数.** 令 $A=\displaystyle\iint_Df(xy)\,\mathrm{d}x\mathrm{d}y$（与 $x$ 无关）。把原等式中的 $x$ 换成 $xy$：
$$f(xy)=x^{2}y^{2}+xy\int_0^{x^{2}y^{2}}f(x^{2}y^{2}-t)\,\mathrm{d}t+A .$$
**二、换元.** 令 $u=x^{2}y^{2}-t$，则 $\displaystyle\int_0^{x^2y^2}f(x^{2}y^{2}-t)\mathrm{d}t=\int_0^{x^{2}y^{2}}f(u)\,\mathrm{d}u$。在 $D$ 上对两边积分：
$$A=\iint_Dx^{2}y^{2}\,\mathrm{d}x\mathrm{d}y+\iint_D\Big(xy\int_0^{x^{2}y^{2}}f(u)\,\mathrm{d}u\Big)\mathrm{d}x\mathrm{d}y+A\iint_D\mathrm{d}x\mathrm{d}y .$$
**三、三个积分.** $\displaystyle|D|=\frac12\cdot2\cdot2=2$。又 $D=\{(x,y):-1\le x\le1,\ -1\le y\le x\}$，
$$\iint_Dx^{2}y^{2}\mathrm{d}x\mathrm{d}y=\int_{-1}^{1}x^{2}\mathrm{d}x\int_{-1}^{x}y^{2}\mathrm{d}y=\int_{-1}^{1}x^{2}\cdot\frac{x^{3}+1}{3}\mathrm{d}x=\frac13\int_{-1}^{1}\big(x^{5}+x^{2}\big)\mathrm{d}x=\frac13\cdot\frac23=\frac29 .$$
第三项：记 $g(x,y)=xy\int_0^{x^{2}y^{2}}f(u)\mathrm{d}u$，则 $g(-x,y)=-g(x,y)$、$g(x,-y)=-g(x,y)$。用直线 $y=-x$ 把 $D$ 分成 $D_1$（顶点 $(-1,-1),(1,-1),(0,0)$，关于 $y$ 轴对称）与 $D_2$（顶点 $(0,0),(1,-1),(1,1)$，关于 $x$ 轴对称），由奇偶对称性
$$\iint_Dg\,\mathrm{d}x\mathrm{d}y=\iint_{D_1}g+\iint_{D_2}g=0+0=0 .$$
**四、解出 $A$.** 代入得 $A=\dfrac29+0+2A$，故 $A=-\dfrac29$。

**五、求 $\int_0^1f$.** 在原等式中取 $x=1$，并令 $u=1-t$：
$$0=f(1)=1+\int_0^1f(1-t)\,\mathrm{d}t+A=1+\int_0^1f(u)\,\mathrm{d}u-\frac29 .$$
故
$$\int_0^1f(x)\,\mathrm{d}x=-\Big(1-\frac{2}{9}\Big)=-\frac79 .$$
$$\boxed{\ \int_0^1f(x)\mathrm{d}x=-\frac79\ }$$

> 要点：①二重积分是常数，先记作 $A$；②把 $x$ 换成 $xy$ 才能让 $A$ 与 $f(xy)$ 对上；③$g$ 关于两个变量都是奇函数，用 $y=-x$ 把 $D$ 拆成两个对称区域，积分恰好抵消。

*备注：原卷为长图第 5–6 张*

<sub>来源：`docs/640 (5).webp` ｜ [↑ 回目录](#toc)</sub>

---

<a id="p229"></a>
### P229　第 10 题

**题目**

（12 分）设 $f(x),g'(x)$ 在 $[a,b]$ 上连续，且 $g(a)=0$。若存在实数 $\lambda\ne0$，使得
$$\big|g(x)f(x)+\lambda g'(x)\big|\le|g(x)|$$
成立，证明：$g(x)\equiv0,\ x\in[a,b]$。

**完整解答**

**证明**　**一、把 $|g'|$ 分离出来.** 由 $f$ 在 $[a,b]$ 上连续，$M=\max\limits_{a\le x\le b}|f(x)|$ 存在。由三角不等式与题设，
$$|\lambda g'(x)|=\big|(g f+\lambda g')-gf\big|\le|gf+\lambda g'|+|g||f|\le|g|+M|g|=(1+M)|g(x)| .$$
故
$$|g'(x)|\le\frac{1+M}{|\lambda|}|g(x)|=:k\,|g(x)|,\qquad k=\frac{1+M}{|\lambda|}>0 .$$
**二、用 $G$ 与积分因子.** 令 $G(x)=\displaystyle\int_a^{x}|g(t)|\,\mathrm{d}t\ge0$，则 $G(a)=0$、$G'(x)=|g(x)|$。由 $g(a)=0$ 与 Newton–Leibniz 公式，
$$|g(x)|=\Big|\int_a^{x}g'(t)\mathrm{d}t\Big|\le\int_a^{x}|g'(t)|\mathrm{d}t\le k\int_a^{x}|g(t)|\mathrm{d}t=k\,G(x) .$$
即 $G'(x)\le k\,G(x)$。乘以 $e^{-kx}$：
$$\frac{\mathrm{d}}{\mathrm{d}x}\Big(G(x)e^{-kx}\Big)=e^{-kx}\big(G'-kG\big)\le0 ,$$
故 $G(x)e^{-kx}$ 在 $[a,b]$ 上单调递减，于是
$$G(x)e^{-kx}\le G(a)e^{-ka}=0\ \Longrightarrow\ G(x)\le0 .$$
又 $G\ge0$，故 $G\equiv0$，从而 $G'=|g|\equiv0$，即 $g\equiv0$。$\square$

> 这一步等价于 Gronwall 引理。注意条件是 $|gf+\lambda g'|\le|g|$：把 $gf$ 挪到右边、用 $|f|\le M$ 放大，就得到 $|g'|\le k|g|$——这是全题的枢纽。

*备注：原卷为长图第 6–7 张；与 P010 同类（那道题条件里漏了 $|g'|$ 项，见 P010 的题面核订）*

<sub>来源：`docs/640 (6).webp` ｜ [↑ 回目录](#toc)</sub>

---

<a id="p230"></a>
### P230　第 11 题

**题目**

（12 分）设 $F_n$ 为斐波那契数列，满足 $F_0=1,\ F_1=1,\ F_n=F_{n-1}+F_{n-2}\ (n>1,n\in\mathbb{N}^{+})$。

(1) 证明：当 $n\ge1$ 时，有 $\Big(\dfrac32\Big)^{n-1}\le F_n\le2^{n-1}$；

(2) 问级数 $\displaystyle\sum_{n=0}^{\infty}\frac{1}{F_n}$ 和 $\displaystyle\sum_{n=2}^{\infty}\frac{1}{\ln F_n}$ 是否收敛？为什么？

(3) 求级数 $\displaystyle\sum_{n=1}^{\infty}\frac{1}{F_nF_{n+2}F_{n+3}}$ 的和。

**答案**　(2) 前者收敛、后者发散；(3) $\dfrac1{12}$

**完整解答**

**(1) 证明**　对 $n$ 归纳（或直接用递推放大）。

- 上界：由 $F_k=F_{k-1}+F_{k-2}\le2F_{k-1}$（$k\ge2$，因 $F_{k-2}\le F_{k-1}$）与 $F_1=1$ 得
$$F_n\le2F_{n-1}\le2^{2}F_{n-2}\le\cdots\le2^{n-1}F_1=2^{n-1} .$$
- 下界：由 $F_{k-1}\le F_{k-2}+F_{k-2}=2F_{k-2}$ 得 $F_{k-2}\ge\dfrac12F_{k-1}$，故
$$F_k=F_{k-1}+F_{k-2}\ge F_{k-1}+\frac12F_{k-1}=\frac32F_{k-1} .$$
迭代：
$$F_n\ge\frac32F_{n-1}\ge\Big(\frac32\Big)^{2}F_{n-2}\ge\cdots\ge\Big(\frac32\Big)^{n-1}F_1=\Big(\frac32\Big)^{n-1} .$$
故 $\Big(\dfrac32\Big)^{n-1}\le F_n\le2^{n-1}$（$n\ge1$）。$\square$

**(2) 解**　**① $\sum\dfrac{1}{F_n}$ 收敛.** 由 (1)，$0<\dfrac{1}{F_n}\le\Big(\dfrac23\Big)^{n-1}$，而等比级数 $\sum\Big(\dfrac23\Big)^{n-1}$ 收敛，由比较判别法 $\sum\dfrac{1}{F_n}$ 收敛。

**② $\sum\dfrac{1}{\ln F_n}$ 发散.** 由 (1)，$F_n\le2^{n-1}\Rightarrow\ln F_n\le(n-1)\ln2$，故（$n\ge2$）
$$\frac{1}{\ln F_n}\ge\frac{1}{(n-1)\ln2},\qquad \sum_{n\ge2}\frac{1}{(n-1)\ln2}=\frac{1}{\ln2}\sum_{k\ge1}\frac1k=+\infty .$$
故 $\sum\dfrac{1}{\ln F_n}$ 发散。

**(3) 解**　记 $S_N=\sum\limits_{n=1}^{N}\dfrac{1}{F_nF_{n+2}F_{n+3}}$。由 $F_{n+1}=F_{n+2}-F_n$，
$$\frac{1}{F_nF_{n+2}F_{n+3}}=\frac{F_{n+2}-F_n}{F_nF_{n+1}F_{n+2}F_{n+3}}
=\frac{1}{F_nF_{n+1}F_{n+3}}-\frac{1}{F_{n+1}F_{n+2}F_{n+3}} .$$
再用 $F_{n+2}=F_{n+3}-F_{n+1}$ 处理第一项：
$$\frac{1}{F_nF_{n+1}F_{n+3}}=\frac{F_{n+3}-F_{n+1}}{F_nF_{n+1}F_{n+2}F_{n+3}}=\frac{1}{F_nF_{n+1}F_{n+2}}-\frac{1}{F_nF_{n+2}F_{n+3}} .$$
代回并把「自身」移到左边：
$$2\cdot\frac{1}{F_nF_{n+2}F_{n+3}}=\frac{1}{F_nF_{n+1}F_{n+2}}-\frac{1}{F_{n+1}F_{n+2}F_{n+3}} .$$
对 $n=1,\cdots,N$ 求和，右端望远镜相消：
$$2S_N=\frac{1}{F_1F_2F_3}-\frac{1}{F_{N+1}F_{N+2}F_{N+3}}\longrightarrow\frac{1}{1\cdot2\cdot3}=\frac16\qquad(N\to\infty),$$
故
$$S=\frac12\cdot\frac16=\frac{1}{12} .$$
$$\boxed{\ (1)\ \Big(\tfrac32\Big)^{n-1}\le F_n\le2^{n-1};\qquad (2)\ \sum\frac{1}{F_n}\ \text{收敛},\ \sum\frac{1}{\ln F_n}\ \text{发散};\qquad (3)\ \frac1{12}\ }$$

> 要点：(1) 的两个不等式一上一下，正好给 (2) 的两问用：上界给「通项 $\ge\frac{1}{(n-1)\ln2}$」（发散），下界给「通项 $\le(\frac23)^{n-1}$」（收敛）。(3) 用两次 $F_{k+2}-F_{k}=\pm F_{k+1}$ 造出 $2a_n=b_n-b_{n+1}$ 的望远镜结构——分子里那个 $F_{n+1}$ 是被"凑"出来的。

*备注：原卷为长图第 7–18 张（此题为全卷压轴，原文给出两种解法）*

<sub>来源：`docs/640 (7).webp` ｜ [↑ 回目录](#toc)</sub>

---

<div align="center">[← 上一部分](#sec23) ｜ [↑ 回到目录](#toc) ｜ [完]</div>
