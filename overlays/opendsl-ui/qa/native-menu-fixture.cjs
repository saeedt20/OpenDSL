// Host-only execution of the shipped menu generator with explicit fixture
// capabilities. No page scripts, modem backend, network, timers or submissions.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
module.exports=function nativeMenu(root,dict,url,opts){
 const options=Object.assign({rc_support:'2.4G dsl mssid PARENTAL iptv wds',product:'DSL-N12E C1'},opts);
 const slots={};const node=id=>slots[id]||(slots[id]={innerHTML:'',style:{}});
 const noop=()=>{};
 const context={location:{pathname:url,hostname:'192.168.1.1'},navigator:{userAgent:'Host fixture',appName:'Netscape'},
 document:{write:noop,getElementById:node,body:{addEventListener:noop}},$:node,
 show_loading_obj:noop,show_top_status:noop,set_Dr_work:noop,updateStatus:noop,isIE8:false};
 let source=fs.readFileSync(path.join(root,'overlays/native-english/boaroot/html/state.js'),'utf8');
 source=source.slice(0,source.indexOf('function get_helplink()'));
 source=source.replace(/<%[\s\S]*?%>/g,tag=>{
  const m=tag.match(/String_Entry"\s*,\s*"([^"]+)"/i);
  if(m)return (dict[m[1]]||m[1]).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/[\r\n]/g,' ');
  if(/wl_get_[25]G_guestnetwork/.test(tag))return '[]';
  if(/available_disk|disk_pool/.test(tag))return '';
  if(/wl_nband_info/.test(tag))return "[2]";
  if(/rc_support/.test(tag))return options.rc_support;
  if(/ProductName|ej_get_productid/.test(tag))return options.product;
  if(/hideQIS/.test(tag))return 'NO';
  if(/wans_dualwan/.test(tag))return 'adsl none';
  if(/get_wan_unit/.test(tag))return '0';
  if(/wl0_auth_mode/.test(tag))return 'WPA2PSK';
  return '0';
 });
 vm.createContext(context);
 // Native help.js (loaded by the pages that include it) defines Untranslated,
 // which show_menu reads once rc_support carries the feedback capability.
 const helpCandidates=[
  path.join(root,'analysis/recheck-015-image/candidate-tree/boaroot/html/help.js'),
  path.join(root,'analysis/verified/rootfs/boaroot/html/help.js'),
  path.join(root,'analysis/rootfs/boaroot/html/help.js'),
 ];
 const helpSource=helpCandidates.find(file=>fs.existsSync(file));
 if(helpSource){
  // help.js continues into ASP template branches and a timer-driven helper
  // loader; only its shipped Untranslated table belongs in this host context.
  let helpJs=fs.readFileSync(helpSource,'utf8');
  const cut=helpJs.indexOf('// init Helper');
  if(cut>0)helpJs=helpJs.slice(0,cut);
  vm.runInContext(helpJs,context,{timeout:1000});
 }
 vm.runInContext(source,context,{timeout:1000});
 Object.assign(context,{show_footer:noop,browser_compatibility:noop,show_selected_language:noop,cal_height:noop,isNewFW:()=>false,
 notification:{array:[],desc:[],action_desc:[],clickCallBack:[],run:noop}});
 vm.runInContext('show_menu()',context,{timeout:1000});
 return {banner:node('TopBanner').innerHTML,main:node('mainMenu').innerHTML,sub:node('subMenu').innerHTML,tabs:node('tabMenu').innerHTML,
  tabLinks:JSON.parse(JSON.stringify(context.tablink)),menuLinks:JSON.parse(JSON.stringify([context.menuL1_link,context.menuL2_link])),
  scope:'Actual state.js menu renderer, synthetic DSL/2.4GHz/IPTV profile; not device execution'};
};
