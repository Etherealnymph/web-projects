import re, json, math, hashlib, sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv)>1 else r'C:\Users\21154\Desktop\rf018.scs')
text = SRC.read_text(errors='ignore')
raw_bytes = SRC.read_bytes()
sha = hashlib.sha256(raw_bytes).hexdigest()

# Remove // comments, preserving line count
lines = text.splitlines()
clean=[]
for ln in lines:
    # naive strip // (no strings containing //)
    i=ln.find('//')
    if i>=0: ln=ln[:i]
    clean.append(ln)
text='\n'.join(clean)

# Join continuation lines for statements: a line starting with '+' continues previous
joined=[]
for ln in text.splitlines():
    if re.match(r'^\s*\+', ln) and joined:
        joined[-1] += ' ' + re.sub(r'^\s*\+\s*','',ln)
    else:
        joined.append(ln.rstrip())

def parse_sections(lines):
    secs={}; cur=None; buf=[]
    for ln in lines:
        m=re.match(r'^\s*section\s+([A-Za-z0-9_]+)',ln)
        if m:
            if cur is not None:
                secs[cur]='\n'.join(buf)
            cur=m.group(1); buf=[]; continue
        m=re.match(r'^\s*endsection(?:\s+([A-Za-z0-9_]+))?',ln)
        if m:
            if cur is not None:
                secs[cur]='\n'.join(buf)
            cur=None; buf=[]; continue
        if cur is not None:
            buf.append(ln)
    if cur is not None: secs[cur]='\n'.join(buf)
    return secs
secs=parse_sections(joined)
print('sections',len(secs))

def ev(expr, env):
    s=expr.strip()
    if s=='' : return 0.0
    s=s.replace('^','**')
    s=re.sub(r'\b(sqrt|exp|ln|log|abs|min|max|pow)\b', lambda m: {'ln':'log'}.get(m.group(1),m.group(1)), s)
    # Replace variables not function names
    def repl(m):
        name=m.group(0)
        if name in ('e','E'): return name
        if name in env: return repr(float(env[name]))
        if name in ('sqrt','exp','log','abs','min','max','pow','pi'): return name
        return '0.0'
    s=re.sub(r'\b[A-Za-z_][A-Za-z0-9_]*\b',repl,s)
    try:
        return float(eval(s,{'__builtins__':{}},{'sqrt':math.sqrt,'exp':math.exp,'log':math.log,'abs':abs,'min':min,'max':max,'pow':pow,'pi':math.pi}))
    except Exception as ex:
        print('EVAL FAIL',expr,'->',s,ex)
        return 0.0

def parse_params(sec_text, env=None, stop_at_include=True):
    env={} if env is None else dict(env)
    for ln in sec_text.splitlines():
        m=re.match(r'^\s*parameters\s+(.+)$',ln)
        if not m: continue
        stmt=m.group(1).strip()
        # one parameter per line typically; may be multiple? split on spaces followed by name=
        # handle name=expression; expression ends at next name= (not inside parentheses)
        # token scanner
        i=0; n=len(stmt)
        while i<n:
            m2=re.match(r'\s*([A-Za-z_][A-Za-z0-9_]*)\s*=',stmt[i:])
            if not m2:
                i+=1; continue
            name=m2.group(1); i+=m2.end()
            start=i; depth=0
            while i<n:
                c=stmt[i]
                if c=='(': depth+=1
                elif c==')': depth=max(0,depth-1)
                elif depth==0:
                    m3=re.match(r'\s+([A-Za-z_][A-Za-z0-9_]*)\s*=',stmt[i:])
                    if m3: break
                i+=1
            expr=stmt[start:i].strip()
            env[name]=ev(expr,env)
    return env

# Corner sections mapping
corner_sections = {
 'TT':('tt','mos'), 'FF':('ff','mos'), 'SS':('ss','mos'), 'SF':('sf','mos'), 'FS':('fs','mos'),
 'TT_3V':('tt_3v','mos_3v'), 'FF_3V':('ff_3v','mos_3v'), 'SS_3V':('ss_3v','mos_3v'), 'SF_3V':('sf_3v','mos_3v'), 'FS_3V':('fs_3v','mos_3v'),
}

def parse_model_bins(sec_name, env):
    txt=secs[sec_name]
    out={}
    # find model lines and their bodies
    # use regex for 'model name bsim3v3 {' then scan balanced braces (only one level)
    for m in re.finditer(r'^\s*model\s+([A-Za-z0-9_]+)\s+bsim3v3\s*\{', txt, re.M):
        name=m.group(1)
        start=m.end(); depth=1; i=start
        while i<len(txt) and depth>0:
            if txt[i]=='{': depth+=1
            elif txt[i]=='}': depth-=1
            i+=1
        body=txt[start:i-1]
        # split into numbered bins
        parts=re.split(r'^\s*(\d+)\s*:\s*', body, flags=re.M)
        bins=[]
        # parts: pre, num, chunk, num, chunk...
        if len(parts)>=3:
            for k in range(1,len(parts),2):
                num=int(parts[k]); chunk=parts[k+1]
                # parse key=value, value spans until next key=
                pairs={}
                mtype=re.search(r'type\s*=\s*([np])', chunk)
                pairs['__type__']=1.0 if (mtype and mtype.group(1)=='p') else 0.0
                pos=0
                matches=list(re.finditer(r'([A-Za-z_][A-Za-z0-9_]*)\s*=', chunk))
                for j,mm in enumerate(matches):
                    key=mm.group(1)
                    a=mm.end(); b=matches[j+1].start() if j+1<len(matches) else len(chunk)
                    val=chunk[a:b].strip()
                    # trim trailing '+' remnants
                    val=val.rstrip('+ ').strip()
                    pairs[key]=ev(val, env)
                bins.append(pairs)
        out[name]=bins
    return out

def slim(bin):
    keys=['type','lmin','lmax','wmin','wmax','vth0','k1','k2','tox','u0','ua','ub','uc','vsat','rdsw','pclm','pdiblc1','pdiblc2','eta0','etab','nfactor','cit','cgdo','cgso','cj','cjsw','dlc','dwc','wint','lint','xl','xw','phi','binunit']
    d={k:bin.get(k,0.0) for k in keys}
    d['type']='p' if bin.get('__type__',0)==1 else 'n'
    return d

all_data={'source':{'file':SRC.name,'bytes':len(raw_bytes),'lines':len(lines),'sha256':sha},'corners':{}}
for label,(sec,modelsec) in corner_sections.items():
    env=parse_params(secs[sec])
    models=parse_model_bins(modelsec, env)
    print(label, {k:len(v) for k,v in models.items()}, 'tox', env.get('toxn',env.get('toxp')))
    cd={}
    for dev,bins in models.items():
        cd[dev]=[slim(b) for b in bins]
    all_data['corners'][label]={'section':sec,'model_section':modelsec,'params':{k:env[k] for k in ['toxn','toxp','toxn3','toxp3','dxln','dxlp','dxln3','dxlp3','dxwn','dxwp','dxwn3','dxwp3','hdifn','hdifp','rshn','rshp','cgon','cgop','cjn','cjp','cjswn','cjswp','cjswgn','cjswgp','vthnmis','vthpmis','dlnmis','dlpmis'] if k in env},'devices':cd}

out=Path(__file__).parent.parent/'model-data.json'
out.write_text(json.dumps(all_data,indent=1,ensure_ascii=False))
print('wrote',out,out.stat().st_size)
# Print summary of nch bins TT
for b in all_data['corners']['TT']['devices']['nch']:
    print('NCH',b['lmin'],b['lmax'],b['wmin'],b['wmax'],b['vth0'],b['u0'],b['vsat'],b['rdsw'],b['pclm'],b['pdiblc2'])
