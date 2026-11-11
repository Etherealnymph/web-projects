import json, math
from pathlib import Path
D=json.loads(Path(r'C:\Users\21154\Desktop\1101\GmIdStudio\model-data.json').read_text())
VT=0.025852; EPSOX=3.453e-11

def pick(corner,dev,L,W):
    bins=D['corners'][corner]['devices'][dev]
    cand=[b for b in bins if b['lmin']<=L<=b['lmax'] and b['wmin']<=W<=b['wmax']]
    if not cand:
        def dist(b):
            lc=min(max(L,b['lmin']),b['lmax']); wc=min(max(W,b['wmin']),b['wmax'])
            return abs(math.log(lc/L))+abs(math.log(wc/W))
        cand=[min(bins,key=dist)]
    return cand[0]

def sim(corner='TT',dev='nch',L=0.18e-6,W=10e-6,Vgs=0.9,Vds=0.9,Vbs=0.0):
    b=pick(corner,dev,L,W)
    tox=b['tox'] or D['corners'][corner]['params'].get('toxn',4.08e-9)
    Cox=EPSOX/tox
    phi=0.7 if '3' not in dev else 0.75
    k1=b['k1']; k2=b['k2']; vth0=abs(b['vth0'])
    n=1+k1/(2*math.sqrt(phi+Vbs))
    u0=b['u0']; vsat=b['vsat']
    Leff=max(L-2*b['dlc'],0.05e-6); Weff=max(W-2*b['wint'],0.05e-6)
    ueff=u0
    Esat=2*vsat/ueff
    Is=2*n*ueff*Cox*VT*VT*(Weff/Leff)
    Rds=b['rdsw']/(W*1e6)
    Rs=Rds/2; Rd=Rds-Rs
    Lref=0.35e-6 if '3' in dev else 0.18e-6
    dibl0=(0.025 if '3' in dev else 0.035)*(Lref/max(L,0.05e-6))**0.7
    def vth_of(vd):
        return vth0 + k1*(math.sqrt(phi+Vbs)-math.sqrt(phi)) + k2*Vbs - dibl0*max(0,vd)
    def intrinsic(vg,vd):
        vth=vth_of(vd)
        vov=vg-vth
        vdsat=max(0.02, vov/(1+vov/(Esat*Leff))) if vov>0 else 3*VT
        zf=(vg-vth)/(2*n*VT)
        def soft(z):
            if z>40: return z
            if z<-40: return math.exp(z)
            return math.log1p(math.exp(z))
        Ff=soft(zf)
        idd=Is*Ff*Ff
        idd=idd/(1+max(vov,0)/(Esat*Leff))
        x=vd/vdsat
        if x<1:
            idd*=x*(2-x)
        else:
            lam=0.004*(Lref/max(L,0.05e-6))**0.7*(b['pclm']/1.1)
            idd*=1+lam*(vd-vdsat)
        return max(0,idd),vdsat,vth
    def I(vg,vd):
        x=0
        for _ in range(4):
            x,_,_=intrinsic(vg-x*Rs,vd-x*Rds)
        return x
    Id,_,_=intrinsic(Vgs,Vds)
    for _ in range(4):
        Id,_,_=intrinsic(Vgs-Id*Rs,Vds-Id*Rds)
    h=1e-3
    gm=(I(Vgs+h,Vds)-I(Vgs-h,Vds))/(2*h)
    gds=(I(Vgs,Vds+h)-I(Vgs,Vds-h))/(2*h)
    _,vdsat,vth=intrinsic(Vgs,Vds)
    vov=Vgs-vth
    Cgg=Cox*Weff*Leff+(b['cgdo']+b['cgso'])*Weff
    fT=gm/(2*math.pi*Cgg) if Cgg else 0
    return dict(vth=vth,vov=vov,n=n,ss=n*VT*math.log(10)*1e3,Id=Id,IdW=Id/Weff,fT=fT/1e9,Cgg=Cgg*1e15,vdsat=vdsat,dibl=dibl0,bin=b,Leff=Leff,Weff=Weff,tox=tox,Cox=Cox,gm=gm,gds=gds,gmid=gm/Id if Id else 0,gmro=gm/gds if gds else 0,ro=1/gds if gds else 0)

for dev in ['nch','pch']:
    print('\n',dev)
    for Vgs in [0.0,0.4,0.5,0.6,0.8,1.0,1.2,1.5,1.8]:
        r=sim(dev=dev,Vgs=Vgs,Vds=0.9)
        print(f'Vgs={Vgs:.2f} Vth={r["vth"]:.3f} Id={r["Id"]*1e6:9.3f}uA gm/Id={r["gmid"]:6.2f} gmro={r["gmro"]:7.1f} Id/W={r["IdW"]:7.3f}uA/um fT={r["fT"]:6.2f}GHz SS={r["ss"]:.1f} gds={r["gds"]*1e6:.3f}uS')
