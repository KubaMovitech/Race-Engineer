// ================= I18N (IT → EN) =================
const LANG=LS.get('lang','it')==='en'?'en':'it';
const I18N=(()=>{
  const NUM='[+\\u2212-]?\\d+(?:[.,:]\\d+)*';
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const seen=new Set(),list=[];
  I18N_EN.forEach(([it,en])=>{if(!en||it===en)return;const k=it.toLowerCase();if(seen.has(k))return;seen.add(k);list.push([it,en]);});
  list.sort((a,b)=>b[0].length-a[0].length);
  let g=1;const meta=[];
  const alts=list.map(([it,en])=>{const parts=it.split('#');const n=parts.length-1;meta.push({g,n,en});g+=1+n;
    return '('+parts.map(esc).join('('+NUM+')')+')';});
  const re=new RegExp('(?<![\\p{L}\\p{N}_])(?:'+alts.join('|')+')(?![\\p{L}])','giu');
  const cache=new Map();
  function fit(src,en){const a=src[0],b=en[0];if(!a||!b)return en;
    if(a===a.toUpperCase()&&a!==a.toLowerCase())return b.toUpperCase()+en.slice(1);
    if(a===a.toLowerCase()&&a!==a.toUpperCase()&&src.length>1&&src[1]===src[1].toLowerCase())return b.toLowerCase()+en.slice(1);return en;}
  function tr(s){if(LANG!=='en'||s==null)return s;s=String(s);if(!/\p{L}/u.test(s))return s;
    const c=cache.get(s);if(c!==undefined)return c;
    const out=s.replace(re,(...args)=>{const m=args[0];
      for(const e of meta){if(args[e.g]!==undefined){let i=0;const nums=[];for(let j=1;j<=e.n;j++)nums.push(args[e.g+j]);
        return fit(m,e.en.replace(/#/g,()=>nums[i++]??'#'));}}return m;});
    if(cache.size>20000)cache.clear();cache.set(s,out);return out;}
  return {tr};
})();
const tr=I18N.tr;
(function(){
  document.documentElement.lang=LANG;
  document.querySelectorAll('.seg.lang button[data-lang]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.lang===LANG));
    b.onclick=()=>{if(b.dataset.lang===LANG)return;LS.set('lang',b.dataset.lang);location.reload();};});
  if(LANG!=='en')return;
  // canvas labels
  const P=CanvasRenderingContext2D.prototype,ft=P.fillText,mt=P.measureText;
  P.fillText=function(t,...a){return ft.call(this,typeof t==='string'?tr(t):t,...a);};
  P.measureText=function(t){return mt.call(this,typeof t==='string'?tr(t):t);};
  const SKIP='script,style,textarea,code,pre,.answer,[data-noi18n]';
  const done=new WeakMap(),ATTR=['placeholder','title','aria-label'];
  function txt(n){const p=n.parentElement;if(!p||p.closest(SKIP))return;const v=n.nodeValue;if(done.get(n)===v)return;const t=tr(v);done.set(n,t);if(t!==v)n.nodeValue=t;}
  function attrs(el){if(el.closest&&el.closest('.answer,[data-noi18n]'))return;ATTR.forEach(a=>{const v=el.getAttribute(a);if(v){const t=tr(v);if(t!==v)el.setAttribute(a,t);}});}
  function walk(root){if(root.nodeType===3){txt(root);return;}if(root.nodeType!==1)return;
    if(root.closest(SKIP)){if(root.matches('textarea'))attrs(root);return;}attrs(root);
    root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(attrs);
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))txt(n);}
  walk(document.body);document.title=tr(document.title);
  new MutationObserver(ms=>{for(const m of ms){
    if(m.type==='childList')m.addedNodes.forEach(walk);
    else if(m.type==='characterData')txt(m.target);
    else if(m.type==='attributes'&&ATTR.includes(m.attributeName))attrs(m.target);}})
  .observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTR});
})();
const AI_LANG=()=>LANG==='en'?'\n\nIMPORTANT: write your whole answer in English (the instructions above are in Italian, but the driver reads English).':'';
