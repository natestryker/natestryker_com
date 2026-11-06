import json
from pathlib import Path
import nbtlib
from litemapy import Schematic
for name in ['small','crossword','wide']:
 p=json.loads(Path(f'test-output/{name}.json').read_text())
 region=Schematic.load(f'test-output/{name}.litematic').regions['Build']
 assert (region.width,region.height,region.length)==(p['width'],p['height'],1)
 n=nbtlib.load(f'test-output/{name}.schem')
 assert int(n['Version'])==2 and int(n['DataVersion'])==3700
 assert (int(n['Width']),int(n['Height']),int(n['Length']))==(p['width'],p['height'],1)
 pal={int(v):str(k) for k,v in n['Palette'].items()}
 ids=[];value=0;shift=0
 for byte in n['BlockData']:
  byte=int(byte)&255;value|=(byte&127)<<shift
  if byte&128:shift+=7
  else:ids.append(value);value=0;shift=0
 assert shift==0 and len(ids)==len(p['cells'])
 for i,b in enumerate(p['cells']):
  x,y=i%p['width'],p['height']-1-i//p['width'];expected='minecraft:air' if b<0 else p['palette'][b]['id']
  assert region[x,y,0].id==expected
  state=pal[ids[y*p['width']+x]];assert state.split('[')[0]==expected
  if b>=0:
   for k,v in p['palette'][b].get('properties',{}).items():
    assert region[x,y,0][k]==v and f'{k}={v}' in state
 assert region.count_blocks()==sum(b>=0 for b in p['cells'])
 print('PASS independent readers:',name,'Litematica and Sponge, all coordinates and properties')
