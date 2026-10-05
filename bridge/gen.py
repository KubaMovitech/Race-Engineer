import re
src=open('/tmp/lmu-pitwall/bridge/src/shared_memory/types.rs').read()
sz={'f64':8,'i32':4,'u32':4,'f32':4,'u8':1,'i8':1,'i16':2,'u16':2}
def parse(name):
    m=re.search(r'pub struct '+name+r'\s*\{(.*?)\n\}',src,re.S);fields=[]
    for line in m.group(1).split('\n'):
        line=line.split('//')[0].strip()
        mm=re.match(r'pub (\w+):\s*(.+?),?$',line)
        if mm: fields.append((mm.group(1),mm.group(2).rstrip(',')))
    return fields
S={}
def size(t):
    t=t.strip()
    a=re.match(r'\[(.+);\s*(\w+)\]',t)
    if a: return size(a.group(1))*int(a.group(2))
    if t in sz: return sz[t]
    return S[t][0]
def align(t):
    t=t.strip();a=re.match(r'\[(.+);\s*(\w+)\]',t)
    if a: return align(a.group(1))
    if t in sz: return min(sz[t],4)
    return 4
def layout(name):
    off=0;offs={}
    for f,t in parse(name):
        al=align(t);off=(off+al-1)//al*al;offs[f]=(off,t);off+=size(t)
    off=(off+3)//4*4;S[name]=(off,offs);return off
for n in ['rF2Vec3','rF2Wheel','rF2VehicleTelemetry','rF2VehicleScoring','rF2ScoringInfo']:print(n,layout(n))
out=['package main','// generated from LMU SharedMemoryInterface layout (via lmu-pitwall, MIT)']
pre={'rF2Wheel':'W','rF2VehicleTelemetry':'T','rF2VehicleScoring':'V','rF2ScoringInfo':'I'}
for n,p in pre.items():
    out.append(f'const {p}_SIZE = {S[n][0]}')
    for f,(o,t) in S[n][1].items(): out.append(f'const {p}_{f} = {o} // {t}')
open('offsets.go','w').write('\n'.join(out)+'\n')
