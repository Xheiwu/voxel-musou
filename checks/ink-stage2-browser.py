"""Offline INPUT/UI regression harness. Not a WebGL or full-game test.
Run: python checks/ink-stage2-browser.py --chromium /usr/bin/chromium
Requires Python playwright and Chromium. All code/CSS are loaded from this checkout.
"""
from pathlib import Path
import argparse, json, re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--chromium',default='/usr/bin/chromium');parser.add_argument('--output',default='ink-test-results/stage2');args=parser.parse_args()
OUT=Path(args.output);OUT.mkdir(parents=True,exist_ok=True)
parts=[]
for file in ['src/core/events.js','src/core/action-intent.js','src/ui/touch.js','src/core/input.js']:
    s=(ROOT/file).read_text()
    s=re.sub(r'^import .*?;\s*$', '', s, flags=re.M)
    s=re.sub(r'\bexport\s+(?=(?:function|const|let|class)\b)', '', s)
    s=s.replace('import.meta.url',json.dumps('https://test.invalid/src/ui/touch.js'))
    s=s.replace('document.head.append(css);','/* exact stylesheet preloaded by harness */')
    parts.append(s)
boot='''
const qaInput=createInput();const menu=document.getElementById('menu');
on('flow',e=>{document.getElementById('hud').hidden=e.state!=='battle';});
addEventListener('blur',()=>{menu.hidden=false;});
window.qa={sample:()=>JSON.parse(JSON.stringify(qaInput.sample())),
 battle:()=>{menu.hidden=true;emit('flow',{state:'battle'});},
 pause:()=>{menu.hidden=false;},resume:()=>{menu.hidden=true;},
 title:()=>{emit('flow',{state:'title'});}};
window.qa.battle();
'''
script='(()=>{\n'+'\n'.join(parts)+'\n'+boot+'\n})();'
html='''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<canvas id="c"></canvas><div id="menu" hidden><button id="go">继续</button></div>
<div id="hud"><div class="h-player"><div class="badge"><canvas></canvas></div><div class="name">赵云</div><div class="bar hp"><em></em><i></i></div><div class="mu"><div><i></i></div><div><i></i></div><div><i></i></div><span>无双</span></div></div>
<div class="h-map"><div class="morale"><i></i></div><canvas></canvas></div><div class="h-obj"><b>突破营门</b></div></div>
<div class="fixture-label">输入 / UI 测试页<br><small>此页不包含战场渲染</small></div></body></html>'''
base='''html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#ede9df}canvas#c{width:100vw;height:100vh;display:block}#hud{position:fixed;inset:0;pointer-events:none;color:#eee}#hud>*{position:absolute}#hud .badge,#hud .name,#hud .hp,#hud .mu{position:absolute}#hud .bar{background:#1118}#hud .bar i{position:absolute;inset:0;background:#549d90;transform-origin:left;transform:scaleX(.82)}#menu:not([hidden]){position:fixed;z-index:200;inset:25%;background:#ddd}.fixture-label{position:fixed;left:30%;right:30%;top:46%;text-align:center;font:17px/1.6 sans-serif;color:#69695e;pointer-events:none}'''
results=[]
def check(name,ok):
    results.append({'name':name,'passed':bool(ok)})
    if not ok:raise AssertionError(name)
def sample(page,n=1):
    return page.evaluate('(n)=>{let s;for(let i=0;i<n;i++)s=qa.sample();return s;}',n)
def pointer(page,sel,kind,pid=31):
    page.eval_on_selector(sel,'(el,a)=>{const r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent(a.kind,{bubbles:true,pointerId:a.id,pointerType:"touch",clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}));}',{'kind':kind,'id':pid})
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':844,'height':390},has_touch=True)
    page=context.new_page();page.goto('about:blank?touch=1');page.set_content(html)
    page.add_style_tag(content=base+'\n'+(ROOT/'src/ui/touch.css').read_text());page.add_script_tag(content=script)
    check('touch controls mounted',page.locator('.musou-touch').is_visible())
    pointer(page,'[data-action="attack"]','pointerdown');s=sample(page)
    check('attack down held and edge',s['pressed']['attack'] and s['held']['attack'])
    pointer(page,'[data-action="charge"]','pointerdown',32);pointer(page,'[data-action="charge"]','pointerup',32);s=sample(page)
    check('same-step quick heavy beats ordinary repeat',s['pressed']['charge'] and not s['pressed']['attack'])
    check('queued heavy protected for next 40 samples',all(not sample(page)['pressed']['attack'] for _ in range(40)))
    pointer(page,'[data-action="attack"]','pointerup');page.evaluate('qa.battle()')
    pointer(page,'[data-action="attack"]','pointerdown');pointer(page,'[data-action="attack"]','pointerup');s=sample(page)
    check('completed quick tap retained once',s['pressed']['attack'] and not s['held']['attack']);check('tap not repeated',not sample(page)['pressed']['attack'])
    pointer(page,'[data-action="charge"]','pointerdown');pointer(page,'[data-action="charge"]','pointercancel');s=sample(page)
    check('cancel drops phantom action',not s['pressed']['charge'] and not s['held']['charge'])
    pointer(page,'[data-action="attack"]','pointerdown');page.evaluate('qa.pause()');page.wait_for_timeout(20);s=sample(page)
    check('pause clears held and edge',not any(s['held'].values()) and not any(s['pressed'].values()))
    check('pause hides touch UI',page.locator('.musou-touch').is_hidden());page.evaluate('qa.resume()');page.wait_for_timeout(20)
    check('resume no stuck attack',not sample(page)['held']['attack'])
    page.keyboard.down('j');page.keyboard.down('k');s=sample(page)
    check('keyboard heavy priority',s['pressed']['charge'] and not s['pressed']['attack']);page.keyboard.up('j');page.keyboard.up('k')
    page.keyboard.down('ShiftLeft');page.keyboard.down('l');sample(page);page.keyboard.up('l')
    check('duplicate dodge bindings independent',sample(page)['held']['dodge']);page.keyboard.up('ShiftLeft')
    page.keyboard.down('w');page.keyboard.down('d');s=sample(page)
    check('diagonal movement normalized',abs(s['mx']**2+s['my']**2-1)<1e-6);page.keyboard.up('w');page.keyboard.up('d')
    # Real multi-touch events via Chrome DevTools, not synthetic MouseEvent.
    cdp=context.new_cdp_session(page)
    def center(sel):
        r=page.locator(sel).bounding_box();return r['x']+r['width']/2,r['y']+r['height']/2
    sx,sy=center('.mt-stick');ax,ay=center('[data-action="attack"]')
    points=[{'x':sx+25,'y':sy-10,'id':11},{'x':ax,'y':ay,'id':12}]
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':points});s=sample(page)
    check('real simultaneous move+attack',s['mx']>0 and s['my']>0 and s['held']['attack'])
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});s=sample(page)
    check('multi-touch release neutral',s['mx']==0 and not s['held']['attack'])
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':420,'y':180,'id':13}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':450,'y':190,'id':13}]});s=sample(page)
    check('world drag orbits but never attacks',s['orbit']<0 and not s['pressed']['attack'])
    cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});s=sample(page)
    check('look cancelled without drift',s['orbit']==0 and s['tilt']==0)
    page.evaluate('''()=>{window.pad={axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[pad],configurable:true});pad.buttons[2].pressed=true;}''');s=sample(page)
    check('gamepad held and pressed',s['held']['attack'] and s['pressed']['attack']);check('gamepad press not spammed',not sample(page)['pressed']['attack'])
    page.evaluate('pad.buttons[2].pressed=false');sample(page)
    for width,height in [(844,390),(667,375),(390,844),(320,568)]:
        page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(20)
        rects=page.evaluate('''()=>Object.fromEntries(['.mt-stick','.mt-actions','.mt-pause','#hud .h-player','#hud .h-map'].map(s=>{let r=document.querySelector(s).getBoundingClientRect();return[s,{x:r.x,y:r.y,right:r.right,bottom:r.bottom}]}))''')
        check(f'{width}x{height} controls/HUD stay in viewport',all(r['x']>=0 and r['y']>=0 and r['right']<=width+.1 and r['bottom']<=height+.1 for r in rects.values()))
        a=rects['.mt-stick'];b=rects['.mt-actions'];check(f'{width}x{height} sticks/actions do not overlap',a['right']<=b['x'] or a['bottom']<=b['y'])
        a=rects['#hud .h-player'];b=rects['#hud .h-map'];check(f'{width}x{height} health/map do not overlap',a['right']<=b['x'] or a['bottom']<=b['y'])
        page.screenshot(path=str(OUT/f'input-{width}x{height}.png'))
    page.evaluate('qa.title()');check('title hides combat controls',page.locator('.musou-touch').is_hidden())
    desktop=browser.new_page(viewport={'width':1280,'height':720});desktop.goto('about:blank?touch=0');desktop.set_content(html);desktop.add_style_tag(content=base);desktop.add_script_tag(content=script)
    check('desktop touch=0 does not create overlay',desktop.locator('.musou-touch').count()==0)
    browser.close()
report={'scope':'offline input/UI harness; no WebGL, full campaign, deployment or real-phone FPS validation','passed':len(results),'tests':results}
(OUT/'browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
