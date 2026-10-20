(function(){
var s=document.querySelector('.sv-services');if(!s)return;
var st=document.createElement('style');
st.textContent='.sv-track .w-dyn-list,.sv-track .w-dyn-items{display:contents}.sv-track .w-dyn-item{flex:0 0 auto;scroll-snap-align:start}.sv-track .w-dyn-empty{display:none}.sv-viewport{scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain}.sv-viewport::-webkit-scrollbar{display:none}.sv-tab{transition:opacity .3s,background-color .3s,color .3s}.sv-tab:hover,.sv-tab:focus-visible{opacity:1}.sv-tab.is-active{opacity:1;background:var(--_v2-theme---v2-ink,#e6ebf2);color:var(--_v2-theme---v2-bg,#0b0f14);border-color:transparent}.sv-btn{transition:opacity .3s}.sv-btn[aria-disabled=true]{opacity:.3;pointer-events:none}.sv-card{--sv-c:#e6ebf2;--sv-t:#fff;--sv-b:#ff5a5f;transition:border-color .5s}[data-brand=scaffolding]{--sv-c:#ed1c24;--sv-b:#ff5a5f}[data-brand=roofing]{--sv-c:#2f3bff;--sv-b:#8a93ff}[data-brand=environmental]{--sv-c:#ffb800;--sv-b:#ffb800;--sv-t:#0b0b0c}[data-brand=compliance]{--sv-c:#00ad0d;--sv-b:#3ad452}.sv-card:hover{border-color:var(--sv-c)}.sv-card-body{isolation:isolate}.sv-card-body:before{content:"";position:absolute;inset:0;z-index:-1;background:var(--sv-c);transform:scaleY(0);transform-origin:50% 100%;transition:transform .6s cubic-bezier(.22,1,.36,1)}.sv-card:hover .sv-card-body:before{transform:scaleY(1)}.sv-card-brand{color:var(--sv-b)}.sv-card-brand,.sv-card-name,.sv-card-excerpt,.sv-card-more{transition:color .4s,opacity .4s,transform .4s}.sv-card:hover .sv-card-brand,.sv-card:hover .sv-card-name,.sv-card:hover .sv-card-excerpt,.sv-card:hover .sv-card-more{color:var(--sv-t);opacity:1}.sv-card:hover .sv-card-more{transform:translateX(6px)}@media (prefers-reduced-motion:reduce){.sv-card-body:before{transition:none}}';
document.head.appendChild(st);
var q=function(x){return s.querySelector(x)},vp=q('.sv-viewport'),cnt=q('.sv-count'),pv=q('.sv-prev'),nx=q('.sv-next');
var items=[].slice.call(s.querySelectorAll('.sv-track .w-dyn-item')),tabs=[].slice.call(s.querySelectorAll('.sv-tab'));
var pad=function(n){return(n<10?'0':'')+n};
var vis=function(){return items.filter(function(i){return i.style.display!=='none'})};
var step=function(){var v=vis();return v[0]?v[0].getBoundingClientRect().width+20:1};
function upd(){var v=vis(),i=Math.round(vp.scrollLeft/step());cnt.textContent=pad(Math.min(i+1,v.length||1))+' / '+pad(v.length);
pv.setAttribute('aria-disabled',vp.scrollLeft<=2);nx.setAttribute('aria-disabled',vp.scrollLeft+vp.clientWidth>=vp.scrollWidth-2)}
function filter(f){items.forEach(function(i){var c=i.querySelector('[data-brand]'),b=c&&c.getAttribute('data-brand');i.style.display=f==='all'||b===f?'':'none'});
tabs.forEach(function(t){var on=t.getAttribute('data-filter')===f;t.classList.toggle('is-active',on);t.setAttribute('aria-selected',on)});vp.scrollLeft=0;upd()}
function go(d){vp.scrollBy({left:d*step(),behavior:'smooth'})}
function key(el,fn){el.addEventListener('click',fn);el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}})}
tabs.forEach(function(t){key(t,function(){filter(t.getAttribute('data-filter'))})});
key(pv,function(){go(-1)});key(nx,function(){go(1)});
var raf=0;vp.addEventListener('scroll',function(){cancelAnimationFrame(raf);raf=requestAnimationFrame(upd)},{passive:true});
addEventListener('resize',upd);filter('all');
})();
