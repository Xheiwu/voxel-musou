"""Layout/input test, not a WebGL battle test. Real HTML/CSS/viewport/touch code.
Injects source into an in-memory page (static imports expanded); no HTTP/module-loading claims.
Uses a small event-bus double and fixture inventory/HUD text, not the progression engine.
"""
import argparse, base64, json, pathlib, re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]

def source(path):
    s=(ROOT/path).read_text()
    s=re.sub(r'^import .*?;\s*$', '', s, flags=re.M)
    return re.sub(r'\bexport\s+(?=(?:function|const|let|class|async)\b)', '', s)

FIXTURE=r'''
const $=id=>document.getElementById(id);
const vp=initWarViewport();
const bus=new Map(); function on(n,f){if(!bus.has(n))bus.set(n,[]);bus.get(n).push(f);} function emit(n,e){for(const f of bus.get(n)||[])f(e);}
const touch=createTouchControls($('c'),$('menu'));
window.testState={paused:false,resizes:[],resets:0,pauses:0};
bindWarViewport({resize(w,h){testState.resizes.push([w,h]);},resetInput(){testState.resets++;touch.reset();},pause(){testState.paused=true;testState.pauses++;$('menu').hidden=false;emit('flow',{state:'pause'});}});
for(const [id,text] of Object.entries({'hud-name':'无名战神','hud-level':'Lv.10','hud-rank':'万人敌','hp-text':'480 / 580','hud-count':'击破 110 · 先锋 1/2 · 3:25','objective-text':'击破敌军，夺取装备','objective-sub':'目标 110/180 击破 · 先锋 1/2 · Lv.8','boss-name':'赤甲统帅','bag-count':'16','stat-line':'Lv.10 万人敌 · 伤害 ×2.40 · 生命 580 · 防御 ×1.30 · 距离 ×1.45','scrap-line':'装备 16/48 · 碎铁 128 · 暂存奖励 0'}))$(id).textContent=text;
$('origin-options').innerHTML=['破阵先锋','铁衣卫士','追魂游将'].map((n,i)=>`<label class="origin-card"><input type="radio" name="origin" ${i?'':'checked'}><b>${n}</b><small>选择出身，开始你的成长战场。</small></label>`).join('');
$('build-tags').innerHTML=['旋锋','引雷','饮血'].map(t=>`<span>${t}</span>`).join('');
$('slot-bar').innerHTML=['兵器','战甲','头盔','战靴','兵符','战旗'].map(t=>`<span>${t}：已穿戴</span>`).join('');
$('bag-list').innerHTML=Array.from({length:16},(_,i)=>`<button type="button" class="item-row" style="--rarity:#a77b3d"><b>${i?'精铁战甲':'破军长枪'}</b><small>传奇 · Lv.10 · ${i?'战甲':'兵器'}</small></button>`).join('');
$('item-detail').innerHTML='<div class="detail-scroll"><h3>破军长枪</h3><small>传奇 · 兵器 · Lv.10</small><p class="stat">伤害系数 +70%<br>攻击距离 +25%</p><p class="trait">旋锋 · 命中积累释放旋风<br>追加伤害不会再次触发装备效果。</p><p class="positive">对比：伤害 +12% · 距离 +10%</p><p>保留你自己的装备组合。</p></div><div class="detail-buttons"><button id="equip-item" class="primary">穿上装备</button><button id="temper-item">淬炼 · 38 碎铁</button><button id="salvage-item">分解</button></div>';
const watermark=document.createElement('div');watermark.textContent='界面适配测试 · 非战斗实机';watermark.style.cssText='position:fixed;pointer-events:none;z-index:31;left:50%;top:50%;transform:translate(-50%,-50%);color:#757f77;font:14px sans-serif;';document.body.append(watermark);
$('c').style.background='#e8e4d7';
window.showBattle=()=>{$('lobby').hidden=true;$('menu').hidden=true;$('war-hud').hidden=false;$('boss-status').hidden=false;$('challenge-button').hidden=false;testState.paused=false;emit('flow',{state:'battle'});};
window.showMenu=()=>{$('menu').hidden=false;emit('flow',{state:'pause'});};
window.sample=()=>JSON.parse(JSON.stringify(touch.sample()));
window.layoutReady=true;
'''

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--chromium',default='/usr/bin/chromium');ap.add_argument('--out',default='landscape-results');args=ap.parse_args()
    out=pathlib.Path(args.out);out.mkdir(parents=True,exist_ok=True)
    html=(ROOT/'war.html').read_text();html=re.sub(r'<script.*?</script>','',html,flags=re.S);html=re.sub(r'<link[^>]*rel="stylesheet"[^>]*>','',html)
    styles='\n'.join((ROOT/x).read_text() for x in ['src/war/style.css','src/war/landscape.css'])
    touch=source('src/ui/touch.js').replace("new URL('./touch.css', import.meta.url).href",repr('data:text/css;base64,'+base64.b64encode((ROOT/'src/ui/touch.css').read_bytes()).decode()))
    code='\n'.join([source('src/war/viewport-math.js'),source('src/war/viewport.js'),source('src/core/action-intent.js'),touch,FIXTURE])
    results=[]
    def check(name,ok,extra=None):
        results.append({'name':name,'pass':bool(ok),'detail':extra})
        if not ok: print('FAIL',name,extra)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1000,'height':450},has_touch=True)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(html);page.add_style_tag(content=styles);page.add_script_tag(content=code)
        page.wait_for_function('window.layoutReady');page.wait_for_timeout(150)
        for w,h in [(2000,900),(1000,450),(844,390),(667,375),(568,320),(1280,720),(1024,768),(960,360)]:
            page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(130)
            page.evaluate("document.getElementById('lobby').hidden=false;document.getElementById('menu').hidden=true;document.getElementById('war-hud').hidden=true;emit('flow',{state:'pause'});")
            camp=page.evaluate("""()=>{const f=getWarViewport(),r=document.querySelector('.camp-card').getBoundingClientRect(),b=document.getElementById('deploy').getBoundingClientRect();return {fits:r.left>=f.x-1&&r.right<=f.x+f.width+1&&r.top>=f.y-1&&r.bottom<=f.y+f.height+1,button:b.bottom<=r.bottom+1&&b.height>=44};}""")
            check(f'{w}x{h} camp contained and deploy accessible',all(camp.values()),camp)
            if (w,h)==(1000,450):page.screenshot(path=str(out/'camp-20x9.png'))
            page.evaluate('showBattle()');page.wait_for_timeout(60)
            data=page.evaluate("""()=>{const f=getWarViewport(),canvas=document.getElementById('c').getBoundingClientRect(),selectors=['.hero-status','.objective','.boss-status','.battle-tools','#war-map','.mt-stick','.mt-actions','#challenge-button'];const boxes=selectors.map(s=>({s,r:document.querySelector(s).getBoundingClientRect().toJSON()}));return {ratio:canvas.width/canvas.height,boxes,frame:{...f},buttons:[...document.querySelectorAll('.mt-actions button,.battle-tools button,#challenge-button')].map(e=>({s:e.textContent,r:e.getBoundingClientRect().toJSON(),hit:document.elementFromPoint(e.getBoundingClientRect().x+e.getBoundingClientRect().width/2,e.getBoundingClientRect().y+e.getBoundingClientRect().height/2)?.closest('button')===e}))};}""")
            f=data['frame']; check(f'{w}x{h} 20:9 canvas',abs(data['ratio']-20/9)<.001)
            fits=all(b['r']['x']>=f['x']-1 and b['r']['right']<=f['x']+f['width']+1 and b['r']['y']>=f['y']-1 and b['r']['bottom']<=f['y']+f['height']+1 for b in data['boxes'])
            check(f'{w}x{h} HUD and controls inside frame',fits,data['boxes'] if not fits else None)
            check(f'{w}x{h} all action targets visible >=44px',all(b['r']['width']>=44 and b['r']['height']>=44 and b['hit'] for b in data['buttons']),data['buttons'])
            overlaps=[]
            for i,a in enumerate(data['boxes']):
                for b in data['boxes'][i+1:]:
                    x,y=a['r'],b['r']
                    if min(x['right'],y['right'])-max(x['x'],y['x'])>1 and min(x['bottom'],y['bottom'])-max(x['y'],y['y'])>1:overlaps.append([a['s'],b['s']])
            check(f'{w}x{h} important regions do not overlap',not overlaps,overlaps)
            if (w,h) in [(1000,450),(844,390),(1280,720)]:page.screenshot(path=str(out/f'hud-{w}x{h}.png'))
            page.evaluate('showMenu()');page.wait_for_timeout(30)
            menu=page.evaluate("""()=>{const f=getWarViewport(),r=document.querySelector('.inventory-sheet').getBoundingClientRect();return {fits:r.x>=f.x-1&&r.right<=f.x+f.width+1&&r.y>=f.y-1&&r.bottom<=f.y+f.height+1,scroll:document.querySelector('.detail-scroll').clientHeight,buttons:[...document.querySelectorAll('.detail-buttons button,#go,#quit')].map(e=>{let b=e.getBoundingClientRect();return b.y>=r.y&&b.bottom<=r.bottom+1&&b.x>=r.x&&b.right<=r.right+1&&b.height>=44&&document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('button')===e;})};}""")
            check(f'{w}x{h} equipment layout and sticky actions',menu['fits'] and menu['scroll']>20 and all(menu['buttons']),menu)
            if (w,h)==(844,390):page.screenshot(path=str(out/'inventory-844x390.png'))
        # Real CDP touch coordinates on a letterboxed screen; never CSS-rotate the input system.
        page.set_viewport_size({'width':1280,'height':720});page.wait_for_timeout(150);page.evaluate('showBattle()')
        stick=page.locator('.mt-stick').bounding_box();atk=page.locator('[data-action="attack"]').bounding_box()
        a={'x':stick['x']+stick['width']*.77,'y':stick['y']+stick['height']*.5,'id':1}
        b={'x':atk['x']+atk['width']*.5,'y':atk['y']+atk['height']*.5,'id':2}
        cdp=page.context.new_cdp_session(page);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a,b]})
        sample=page.evaluate('sample()');check('CDP move and attack aligned inside 16:9 letterbox',sample['mx']>.5 and sample['held']['attack'],sample)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        check('released touch resets movement',page.evaluate('sample().mx===0&&!sample().held.attack'))
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
        check('portrait pauses and blocks background input',page.evaluate("testState.paused&&!document.getElementById('war-rotate').hidden&&document.getElementById('menu').inert&&!sample().held.attack"))
        page.screenshot(path=str(out/'portrait-gate.png'))
        page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(150)
        check('return to landscape stays paused',page.evaluate("testState.paused&&!document.getElementById('menu').hidden&&!document.getElementById('menu').inert&&document.getElementById('war-rotate').hidden"))
        # Simulated VisualViewport and safe area, tested independently of physical phone support.
        simulated=page.evaluate("""()=>{let probe=[...document.body.children].find(e=>e.style.visibility==='hidden'&&e.style.position==='fixed');probe.style.padding='0px 44px 21px 44px';getWarViewport().refresh();const f=getWarViewport();return f.x>=44&&f.x+f.width<=800.1&&f.y+f.height<=369.1;}""")
        check('notch/home-indicator insets contained once',simulated)
        check('no browser JavaScript errors',not errors,errors)
        browser.close()
    (out/'layout-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
    passed=sum(x['pass'] for x in results);print(f'{passed}/{len(results)} layout/input checks passed')
    if passed!=len(results):raise SystemExit(1)
if __name__=='__main__':main()
