import urllib.request,json,concurrent.futures,io,time,pathlib
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parent; OUT=ROOT/'dist'; BASE='https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/90d256dfee7b6fd8014e1bc3b107e64a530c5f9b/assets/minecraft/'
(OUT/'textures').mkdir(parents=True,exist_ok=True)
colors='white orange magenta light_blue yellow lime pink gray light_gray cyan purple blue brown green red black'.split()
items=[]
def add(id,cat,texture=None,survival=True,properties=None,notes=''):
 items.append(dict(id='minecraft:'+id,name=id.replace('_',' ').title(),category=cat,color=[],texture='textures/'+(texture or id)+'.png',survival=survival,properties=properties or {},notes=notes,version='1.20.4'))
for family in ['concrete','wool','terracotta','glazed_terracotta']:
 for color in colors: add(color+'_'+family,family.replace('_',' ').title(),properties={'facing':'east'} if family=='glazed_terracotta' else {},notes='Place facing east. Unrotated west template face becomes the south-facing wall face; other faces have rotated patterns.' if family=='glazed_terracotta' else '')
add('terracotta','Terracotta')
for wood in 'oak spruce birch jungle acacia dark_oak mangrove cherry bamboo crimson warped'.split():add(wood+'_planks','Wood')
add('bamboo_mosaic','Wood')
for id in 'stone cobblestone mossy_cobblestone granite polished_granite diorite polished_diorite andesite polished_andesite stone_bricks mossy_stone_bricks cracked_stone_bricks chiseled_stone_bricks deepslate cobbled_deepslate polished_deepslate deepslate_bricks cracked_deepslate_bricks deepslate_tiles cracked_deepslate_tiles chiseled_deepslate tuff calcite smooth_basalt obsidian netherrack nether_bricks red_nether_bricks cracked_nether_bricks chiseled_nether_bricks blackstone polished_blackstone polished_blackstone_bricks cracked_polished_blackstone_bricks chiseled_polished_blackstone end_stone end_stone_bricks purpur_block bricks mud packed_mud mud_bricks dirt coarse_dirt rooted_dirt'.split():
 add(id,'Stone',survival=id not in ['obsidian'],properties={'axis':'y'} if id=='deepslate' else {},notes='Top and bottom use a different face texture; south face used for this wall.' if id in ['deepslate','blackstone'] else '')
for id in 'iron_block gold_block diamond_block emerald_block lapis_block redstone_block coal_block netherite_block raw_iron_block raw_gold_block raw_copper_block copper_block exposed_copper weathered_copper oxidized_copper cut_copper exposed_cut_copper weathered_cut_copper oxidized_cut_copper'.split():
 tid=id
 if 'copper' in id and not id.startswith('raw_'):id='waxed_'+id
 add(id,'Metal',texture=tid,survival=False,notes='Waxed to preserve this color.' if id.startswith('waxed_') else '')
for id in ['sandstone','red_sandstone','cut_sandstone','cut_red_sandstone','chiseled_sandstone','chiseled_red_sandstone']:add(id,'Sandstone',notes='South face used for wall; top/bottom differ from preview.')
add('smooth_sandstone','Sandstone',texture='sandstone_top'); add('smooth_red_sandstone','Sandstone',texture='red_sandstone_top')
for id,tex in [('quartz_block','quartz_block_side'),('smooth_quartz','quartz_block_bottom'),('quartz_bricks',None),('snow_block','snow'),('clay',None),('moss_block',None),('sponge',None),('wet_sponge',None),('dried_kelp_block','dried_kelp_side'),('honeycomb_block',None),('shroomlight',None),('glowstone',None),('melon','melon_side')]:add(id,'Other',texture=tex,notes='South face used for wall; other faces may differ.' if id in ['quartz_block','dried_kelp_block','melon'] else '')
def get(path):
 for n in range(3):
  try:return urllib.request.urlopen(BASE+path,timeout=25).read()
  except Exception:
   if n==2:raise
   time.sleep(.3)
def task(b):
 name=b['id'].split(':')[1]; state=json.loads(get('blockstates/'+name+'.json'))
 raw=get('textures/block/'+b['texture'].split('/')[-1]); image=Image.open(io.BytesIO(raw)).convert('RGBA')
 assert image.size==(16,16),(name,image.size)
 pix=list(image.getdata()); assert all(p[3]==255 for p in pix),name+' alpha'
 b['color']=[round(sum(p[i] for p in pix)/len(pix)) for i in range(3)]
 b['textureVariance']=round(sum(sum((p[i]-b['color'][i])**2 for i in range(3)) for p in pix)/len(pix)/3,2)
 b['hex']='#'+''.join(f'{c:02x}' for c in b['color']); (OUT/b['texture']).write_bytes(raw); return b
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=24) as pool:
 futs={pool.submit(task,b):b for b in items}
 for f in concurrent.futures.as_completed(futs):
  b=futs[f]
  try:results.append(f.result())
  except Exception as e: print('FAILED',b['id'],e,flush=True)
byid={b['id']:b for b in results};results=[byid[b['id']] for b in items if b['id'] in byid]
(OUT/'blocks.json').write_text(json.dumps(results,indent=2)+'\n'); print('WROTE',len(results),'of',len(items),flush=True)
