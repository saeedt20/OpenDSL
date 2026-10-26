// Host-only execution of the shipped footer generator (state.js) with explicit
// fixture capabilities. No backend, timers, navigation or submissions.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
module.exports=function nativeFooter(root,dict,opts){
 const options=Object.assign({feedback:true,country:'',product:'DSL-N12E_C1',model:'DSL-N12E_C1'},opts);
 const slot={innerHTML:''};
 const opened=[];
 const context={
  $:id=>id==='footer'?slot:{innerHTML:''},
  document:{getElementById:id=>id==='FAQ_input'?{value:options.faqValue||''}:null},
  navigator:{userAgent:'Host fixture',appName:'Netscape'},
  supportsite_model:(country,product)=>options.model,
  country_code:options.country,
  odm_productid:options.product,
  feedback_support:options.feedback?1:-1,
  get_selected_language:()=>'/',
  window:{open:url=>opened.push(url)}
 };
 let source=fs.readFileSync(path.join(root,'overlays/native-english/boaroot/html/state.js'),'utf8');
 const start=source.indexOf('function show_footer(){');
 const end=source.indexOf('var isFirefox =');
 if(start<0||end<0)throw new Error('footer generator not found in state.js');
 source=source.slice(start,end);
 source=source.replace(/<%[\s\S]*?%>/g,tag=>{
  const m=tag.match(/String_Entry"\s*,\s*"([^"]+)"/i);
  if(m)return dict[m[1]]||m[1];
  return '';
 });
 vm.createContext(context);vm.runInContext(source,context,{timeout:1000});
 vm.runInContext('show_footer()',context,{timeout:1000});
 const html=slot.innerHTML;
 const links=[...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(m=>({attrs:m[1].replace(/\s+/g,' ').trim(),label:m[2].replace(/<[^>]*>/g,'').trim(),href:(/href="([^"]*)"/i.exec(m[1])||[])[1]||''}));
 const faq=(/id="FAQ_input"[^>]*maxlength="(\d+)"/i.exec(html)||[])[1]||null;
 return {html,links,faqMaxlength:faq,hasCopyright:/class="copyright"/.test(html),title:((/id="bottom_help_title"[^>]*>([\s\S]*?)<\/td>/i.exec(html)||[])[1]||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),
  opened,search:(value)=>{vm.runInContext('search_supportsite()',context,{timeout:1000});return opened.slice();},
  scope:'Actual state.js show_footer()/search_supportsite() with synthetic dictionary and capability fixture; not device execution'};
};
