"""UI-only checks: serve the actual new UI/state sources from memory. No GPU claims."""
import argparse, json, pathlib, time, mimetypes
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--out',default='war-results');parser.add_argument('--chromium',default='/usr/bin/chromium');args=parser.parse_args();out=pathlib.Path(args.out);out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1280,'height':800},device_scale_factor=1)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    # No network navigation: actual UI/source bytes in a memory page; storage is a test double.
    # This does not validate HTTP imports, engine loading, GPU shaders or real-browser save persistence.
    import re
    html=(ROOT/'war.html').read_text()
    html=re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S)
    html=re.sub(r'<link[^>]*>','',html)
    html=html.replace('</head>','<style>'+(ROOT/'src/war/style.css').read_text()+'</style></head>')
    page.set_content(html)
    page.evaluate("""()=>{const data=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v))},configurable:true});}""")
    bundle=''
    for file in ['data.js','progression.js','store.js','ui.js','boot.js']:
        source=(ROOT/'src/war'/file).read_text()
        source=re.sub(r'^import .*?;\n','',source,flags=re.M)
        source=re.sub(r'\bexport (?=(?:const|function|class))','',source)
        bundle+=source+'\n'
    bundle+="window.__warHarness={createProfile,createItem,receiveItem,saveProfile,loadProfile,setProfile(p){profile=p;ui.setProfile(p);},ui};"
    page.add_script_tag(type='module',content=bundle)
    page.wait_for_selector('.origin-card',timeout=8000)
    results.append('actual-HTML-and-UI-sources-memory-bootstrap')
    assert page.locator('.origin-card').count()==3;results.append('three-origin-choices')
    assert page.locator('#camp-bag').is_disabled();results.append('empty-save-no-inventory')
    page.screenshot(path=str(out/'camp-desktop.png'))
    # Exercise production state serialization against an explicitly in-memory storage double.
    page.evaluate("""()=>{const m=window.__warHarness;const p=m.createProfile({name:'岚',origin:'vanguard'});p.level=12;p.scrap=120;for(const [j,id] of ['iron-armor','storm-spear','dash-boots','soul-charm','fire-banner','guard-helm'].entries())m.receiveItem(p,m.createItem(id,8,2+(j%2),.5,'item-'+(j+2)));m.saveProfile(localStorage,p);m.setProfile(m.loadProfile(localStorage).profile);}""")
    assert page.locator('#player-name').input_value()=='岚';results.append('save-serialization-restores-profile-with-storage-double')
    page.locator('#camp-bag').click();assert page.locator('#menu').is_visible();assert page.locator('.item-row').count()==7;results.append('inventory-real-data')
    page.locator('[data-uid="item-3"]').click();assert page.locator('#equip-item').is_enabled();page.locator('#equip-item').click();assert page.locator('#equip-item').is_disabled();results.append('equip-updates-live-detail')
    assert page.locator('#salvage-item').is_disabled();results.append('equipped-item-salvage-protected')
    page.locator('#temper-item').click();assert 'Lv.9' in page.locator('#item-detail').inner_text();results.append('temper-uses-real-currency-and-level')
    page.screenshot(path=str(out/'equipment-desktop.png'))
    for width,height in [(844,390),(667,375),(390,844),(320,568)]:
        page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(100)
        boxes=page.evaluate('''()=>['go','item-detail','bag-list','quit'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height};})''')
        for box in boxes:
            assert box['x']>=0 and box['y']>=0 and box['x']+box['w']<=width+1 and box['y']+box['h']<=height+1,(width,height,box)
        results.append(f'inventory-bounds-{width}x{height}')
        if width==844:page.screenshot(path=str(out/'equipment-mobile.png'))
    page.locator('#go').click();assert page.locator('#menu').is_hidden();results.append('close-camp-inventory')
    page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(80);page.screenshot(path=str(out/'camp-mobile.png'))
    page.set_viewport_size({'width':1280,'height':800});page.locator('#camp-bag').click();page.locator('[data-uid="item-1"]').click();assert page.locator('#salvage-item').is_enabled();page.locator('#salvage-item').click();assert page.locator('.item-row').count()==6;results.append('salvage-unequipped-item')
    assert not errors,errors
    results.append('no-ui-javascript-exceptions')
    browser.close()
(out/'browser-tests.json').write_text(json.dumps({'scope':'Actual HTML/CSS/UI/progression source in memory; static imports flattened; storage double. No HTTP, engine, WebGL or real storage persistence test.','passed':results},ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
