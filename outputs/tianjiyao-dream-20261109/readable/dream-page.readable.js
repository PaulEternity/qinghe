// 来源：REA 导出的公开生产脚本。仅格式化，保留打包模块与混淆变量；不是可独立运行的源码工程。
(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[1317],{
  8078:(e,r,t)=>{
    "use strict";
    t.d(r,{
      A:()=>c,AuthProvider:()=>m}
    );
    var a=t(38942),s=t(14502),n=t(42062),i=t(86503),o=t(69395);
    let l=(0,s.default)(()=>Promise.all([t.e(692),t.e(6470)]).then(t.bind(t,14089)).then(e=>e.AuthModal),{
      loadableGenerated:{
        webpack:()=>[14089]}
      ,ssr:!1,loading:()=>null}
    ),d=(0,n.createContext)(void 0);
    function c(){
      let e=(0,n.useContext)(d);
      if(!e)throw Error("useAuth must be used within an AuthProvider");
      return e}
    function m(e){
      let{
        children:r}
      =e,[t,s]=(0,n.useState)(!1),[c,m]=(0,n.useState)("login"),u=(0,n.useCallback)(function(){
        let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"login";
        (!o.authClient.isAuthenticated()||o.authClient.isTokenExpired())&&(m(e),s(!0))}
      ,[]),p=(0,n.useCallback)(()=>{
        s(!1)}
      ,[]);
      return(0,n.useEffect)(()=>o.authClient.onAuthStateChange(e=>{
        e&&s(!1)}
      ),[]),(0,n.useEffect)(()=>((0,i.Kq)(u),()=>{
        (0,i.Kq)(()=>{
          }
        )}
      ),[u]),(0,a.jsxs)(d.Provider,{
        value:{
          showLoginModal:u,hideLoginModal:p,isLoginModalOpen:t}
        ,children:[r,t?(0,a.jsx)(l,{
          isOpen:t,onCloseAction:p,defaultMode:c}
        ):null]}
      )}
    }
  ,12514:(e,r,t)=>{
    Promise.resolve().then(t.bind(t,49442)),Promise.resolve().then(t.bind(t,37398)),Promise.resolve().then(t.t.bind(t,20692,23))}
  ,28698:(e,r,t)=>{
    "use strict";
    t.d(r,{
      AM:()=>o,Wv:()=>l,hl:()=>d}
    );
    var a=t(38942),s=t(42062),n=t(10559),i=t(85832);
    let o=n.bL,l=n.l9,d=s.forwardRef((e,r)=>{
      let{
        className:t,align:s="center",sideOffset:o=4,...l}
      =e;
      return(0,a.jsx)(n.ZL,{
        children:(0,a.jsx)(n.UC,{
          ref:r,align:s,sideOffset:o,className:(0,i.cn)("z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",t),...l}
        )}
      )}
    );
    d.displayName=n.UC.displayName}
  ,37398:(e,r,t)=>{
    "use strict";
    t.d(r,{
      CollapsibleSEOSection:()=>i,SEOContentBlock:()=>o}
    );
    var a=t(38942),s=t(15672),n=t(97745);
    function i(e){
      let{
        title:r="了解更多详情",defaultExpanded:t=!1,children:i,className:o="",variant:l="default"}
      =e;
      return(0,a.jsxs)("details",{
        className:"group w-full ".concat(o),open:t,children:[(0,a.jsxs)("summary",{
          className:"flex w-full list-none items-center justify-between gap-4 ".concat("compact"===l?"px-1 py-3":"px-1 py-4"," cursor-pointer border-y border-border/65 transition-colors duration-300 hover:border-primary/35 [&::-webkit-details-marker]:hidden"),children:[(0,a.jsx)("span",{
            className:"display-serif font-normal tracking-[0.08em] text-foreground/80 ".concat("compact"===l?"text-sm":"text-base md:text-lg"," "),children:r}
          ),(0,a.jsx)(s.A,{
            className:" ".concat("compact"===l?"h-4 w-4":"h-5 w-5"," text-primary/65 transition-transform duration-300 group-open:hidden")}
          ),(0,a.jsx)(n.A,{
            className:"hidden ".concat("compact"===l?"h-4 w-4":"h-5 w-5"," text-primary/65 transition-transform duration-300 group-open:block")}
          )]}
        ),(0,a.jsx)("div",{
          className:"mt-6 space-y-6",children:i}
        )]}
      )}
    function o(e){
      let{
        children:r,className:t=""}
      =e;
      return(0,a.jsx)("div",{
        className:"border-l border-border/70 px-5 py-2 ".concat(t),children:r}
      )}
    }
  ,39985:(e,r,t)=>{
    "use strict";
    t.d(r,{
      G:()=>n}
    );
    var a=t(42062);
    let s={
      }
    ;
    function n(){
      let[e,r]=(0,a.useState)(s),t=(0,a.useRef)(s),[n,i]=(0,a.useState)(!1),[o,l]=(0,a.useState)(null),d=(0,a.useCallback)(async e=>{
        if(t.current[e])return t.current[e];
        i(!0),l(null);
        try{
          let a=await fetch("/api/credits/cost?service=".concat(e)),n=await a.json();
          if(n.success){
            let a={
              credits_required:n.credits_required,rule_name:n.rule_name,description:n.description,is_default:n.is_default}
            ;
            return t.current={
              ...t.current,[e]:a}
            ,Object.assign(s,t.current),r({
              ...t.current}
            ),a}
          throw Error(n.error||"获取积分消耗失败")}
        catch(r){
          return l(r.message),{
            credits_required:100,rule_name:e,is_default:!0}
          }
        finally{
          i(!1)}
        }
      ,[]),c=(0,a.useCallback)(e=>t.current[e]?t.current[e].credits_required:null,[]);
      return{
        getCreditCost:c,getCreditCostInfo:(0,a.useCallback)(e=>t.current[e]||null,[]),fetchCreditCost:d,fetchMultipleCreditCosts:(0,a.useCallback)(async e=>{
          let a=e.filter(e=>!t.current[e]);
          if(0!==a.length){
            i(!0),l(null);
            try{
              let e=await fetch("/api/credits/cost?services=".concat(a.join(","))),n=await e.json();
              if(n.success){
                let e={
                  ...t.current}
                ;
                Object.keys(n.costs).forEach(r=>{
                  e[r]=n.costs[r]}
                ),t.current=e,Object.assign(s,t.current),r({
                  ...t.current}
                )}
              else throw Error(n.error||"批量获取积分消耗失败")}
            catch(e){
              l(e.message)}
            finally{
              i(!1)}
            }
          }
        ,[]),isLoading:n,error:o,cache:e}
      }
    }
  ,40317:(e,r,t)=>{
    "use strict";
    t.d(r,{
      V:()=>c}
    );
    var a=t(38942),s=t(42062),n=t(98457),i=t(8162),o=t(42655),l=t(85832),d=t(2299);
    function c(e){
      let{
        className:r,classNames:t,showOutsideDays:c=!0,...m}
      =e;
      return(0,a.jsx)(o.hv,{
        showOutsideDays:c,className:(0,l.cn)("p-3",r),classNames:{
          months:"flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",month:"space-y-4",caption:"flex justify-center pt-1 relative items-center",caption_label:"hidden",caption_dropdowns:"flex justify-center gap-1",nav:"space-x-1 flex items-center",nav_button:(0,l.cn)((0,d.r)({
            variant:"outline"}
          ),"h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"),nav_button_previous:"absolute left-1",nav_button_next:"absolute right-1",table:"w-full border-collapse space-y-1",head_row:"flex",head_cell:"text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",row:"flex w-full mt-2",cell:"h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",day:(0,l.cn)((0,d.r)({
            variant:"ghost"}
          ),"h-9 w-9 p-0 font-normal aria-selected:opacity-100"),day_range_end:"day-range-end",day_selected:"bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",day_today:"bg-accent text-accent-foreground",day_outside:"day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",day_disabled:"text-muted-foreground opacity-50",day_range_middle:"aria-selected:bg-accent aria-selected:text-accent-foreground",day_hidden:"invisible",dropdown:"px-2 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring",dropdown_month:"mr-1",dropdown_year:"ml-1",...t}
        ,components:{
          IconLeft:e=>{
            let{
              ...r}
            =e;
            return(0,a.jsx)(n.A,{
              className:"h-4 w-4"}
            )}
          ,IconRight:e=>{
            let{
              ...r}
            =e;
            return(0,a.jsx)(i.A,{
              className:"h-4 w-4"}
            )}
          ,Dropdown:e=>{
            let{
              value:r,onChange:t,children:n,...i}
            =e,o=s.Children.toArray(n);
            return o.find(e=>e.props.value===r),(0,a.jsx)("select",{
              value:r,onChange:e=>{
                let r={
                  target:{
                    value:e.target.value}
                  }
                ;
                null==t||t(r)}
              ,className:(0,l.cn)("rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"),...i,children:o}
            )}
          }
        ,...m}
      )}
    c.displayName="Calendar"}
  ,49442:(e,r,t)=>{
    "use strict";
    t.d(r,{
      default:()=>W}
    );
    var a=t(38942),s=t(42062),n=t(88523),i=t(6713),o=t(96371),l=t(80988),d=t(36640),c=t(8464),m=t(94970),u=t(70693),p=t(39985),x=t(2299),h=t(91577),g=t(79476),f=t(31708),b=t(85832),y=t(40317),v=t(28698);
    function j(e){
      let{
        id:r,date:t,onDateChange:n,placeholder:i="请选择日期",className:d,locale:c=l.g}
      =e,[m,u]=s.useState(!1);
      return(0,a.jsxs)(v.AM,{
        open:m,onOpenChange:u,children:[(0,a.jsx)(v.Wv,{
          asChild:!0,children:(0,a.jsxs)(x.$,{
            id:r,variant:"outline",className:(0,b.cn)("w-full justify-start text-left font-normal border-2 border-amber-400/80 hover:border-amber-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-amber-500/80 dark:hover:border-amber-400 dark:focus:ring-amber-800/50",!t&&"text-muted-foreground",d),children:[(0,a.jsx)(f.A,{
              className:"mr-2 h-4 w-4"}
            ),t?(0,o.GP)(t,"PPP",{
              locale:c}
            ):(0,a.jsx)("span",{
              children:i}
            )]}
          )}
        ),(0,a.jsx)(v.hl,{
          className:"w-auto p-0",align:"start",children:(0,a.jsx)(y.V,{
            mode:"single",selected:t,onSelect:e=>{
              null==n||n(e),u(!1)}
            ,initialFocus:!0,locale:c,defaultMonth:t}
          )}
        )]}
      )}
    var N=t(92265),w=t(76343),k=t(51065),C=t(94016),A=t(85814),_=t(91803),z=t(36975),D=t(54509),E=t(92360),S=t(36709),Z=t(76092),B=t(30968),P=t(86503),F=t(8078),O=t(20692),T=t.n(O),H=t(60272);
    function I(e){
      let{
        title:r,className:t="",locale:s,cluster:n="general"}
      =e,i="zh-TW"===s,o="zh"===s||i,l=(e,r)=>i?(0,H.bb)(e):o?e:r,d={
        general:[{
          title:l("免费在线算命大全","Free Fortune Telling Hub"),href:"/".concat(s,"/free-fortune"),description:l("一站式体验生辰八字排盘、周易占卦与紫微命盘在线测算","Explore free BaZi charting, I Ching divination, and Ziwei astrology.")}
        ,{
          title:l("周公解梦与潜意识分析","Dream Interpretation"),href:"/".concat(s,"/dream"),description:l("从梦境意象中寻找心理线索、情绪隐喻与吉凶提示","Explore dream symbols, psychological cues, and traditional omens.")}
        ,{
          title:l("64卦在线详解指南","Online 64 Hexagrams Guide"),href:"/".concat(s,"/64-gua"),description:l("深入查阅64卦卦象符号、卦序口诀与白话爻辞速查","Deep dive into the meanings of 64 hexagrams online.")}
        ,{
          title:l("免费塔罗牌在线占卜","Free Tarot Reading Online"),href:"/".concat(s,"/free-tarot-online"),description:l("在线抽牌解读爱情复合、事业抉择与运势推演","Draw tarot cards online for love, career, and timing guidance.")}
        ,{
          title:l("今日运签与每日一签","Daily Fortune Sign"),href:"/".concat(s,"/daily-sign"),description:l("每天抽取一支专属指引签，分析今日运势吉凶与行事建议","Draw your daily sign for quick guidance and mindfulness.")}
        ,{
          title:l("八字排盘（在线排盘系统）","BaZi Charting and Reading"),href:"/".concat(s,"/bazi"),description:l("输入生辰四柱，深度测算五行旺衰与大运流年","Calculate Four Pillars and explore long-term life cycles.")}
        ],bazi:[{
          title:l("AI八字延伸分析","AI BaZi Follow-up"),href:"/".concat(s,"/ai-bazi"),description:l("补充查看 AI 八字问题整理、四柱分析与结构化延伸解读入口","Continue into AI-assisted BaZi framing, Four Pillars notes and structured follow-up reading.")}
        ,{
          title:l("八字合盘与关系匹配","BaZi Compatibility Analysis"),href:"/".concat(s,"/hepan/bazi"),description:l("查看双人八字合盘、婚恋匹配与关系走势分析","Explore BaZi compatibility, relationship matching and long-term dynamics.")}
        ,{
          title:l("八字事业财运延伸阅读","BaZi Career and Wealth Follow-up"),href:"/".concat(s,"/online-bazi-consulting"),description:l("继续看事业、财运和关系主题下的八字延伸分析。","Continue into BaZi follow-up reading for career, wealth and relationship themes.")}
        ,{
          title:l("今日运签与每日一签","Daily Fortune Sign"),href:"/".concat(s,"/daily-sign"),description:l("抽取今日运签，获取日常行事宜忌与吉凶提醒","Draw your daily sign for quick guidance and mindfulness.")}
        ,{
          title:l("紫微斗数命盘分析","Ziwei Astrology Analysis"),href:"/".concat(s,"/ziwei"),description:l("补充查看紫微斗数排盘与命盘结构解读","Explore Ziwei charting and astrology structure interpretation.")}
        ,{
          title:l("周公解梦与梦境分析","Dream Interpretation"),href:"/".concat(s,"/dream"),description:l("从梦境意象中寻找心理线索与吉凶隐喻","Explore dream symbols, psychological cues, and traditional omens.")}
        ],hepan:[{
          title:l("八字合盘深度分析","Deep BaZi Compatibility"),href:"/".concat(s,"/hepan/bazi"),description:l("查看八字配对、五行匹配与关系节奏分析","Review BaZi pairing, Five Elements match and relationship pacing")}
        ,{
          title:l("恋爱合盘入口","Love Compatibility Entry"),href:"/".concat(s,"/hepan/love"),description:l("恋爱、婚姻与暗昧关系配对分析","Handle love, marriage and dating-related compatibility intent")}
        ,{
          title:l("合作合盘与事业配对","Business Compatibility"),href:"/".concat(s,"/hepan/business"),description:l("查看合作关系、工作伙伴和利益匹配分析","Explore business partnership, colleague and interest alignment analysis")}
        ,{
          title:l("亲子与家庭关系合盘","Family Compatibility"),href:"/".concat(s,"/hepan/general/parent-child"),description:l("补充查看亲子、家人和长期相处模式分析","Expand into parent-child, family and long-term interaction analysis")}
        ,{
          title:l("八字排盘（在线排盘系统）","BaZi Fortune Hub"),href:"/".concat(s,"/bazi"),description:l("从关系配对回到单人命盘，继续查看四柱、五行、十神与大运流年。","Return from compatibility to the main BaZi chart page for Four Pillars, Five Elements and timing-cycle reading.")}
        ,{
          title:l("紫微双人关系视角","Ziwei Compatibility Perspective"),href:"/".concat(s,"/hepan/ziwei"),description:l("从紫微视角补充观察双人关系与命盘互动","Add a Ziwei-based perspective to relationship and chart interaction analysis")}
        ]}
      [n],c="general"===n?"/".concat(s,"/blog"):"/".concat(s,"/").concat("bazi"===n?"bazi":"hepan"),m="general"===n?l("查看更多内容","View More Content"):"bazi"===n?l("查看更多八字入口","Explore More BaZi Pages"):l("查看更多合盘入口","Explore More Compatibility Pages"),u="general"===n?l("深入了解占卜知识和技巧，提升您的占卜体验","Deep dive into divination knowledge and techniques to enhance your experience"):"bazi"===n?l("继续围绕八字算命、命盘结构与主题延伸阅读收拢站内入口。","Continue around BaZi reading, chart structure and scenario-based follow-up pages."):l("继续了解关系配对、八字合盘与场景化分析。","Expand around relationship matching, BaZi compatibility and scenario analysis to strengthen the compatibility cluster.");
      return(0,a.jsx)("section",{
        className:"py-8 ".concat(t),children:(0,a.jsxs)("div",{
          className:"max-w-6xl mx-auto px-4",children:[r&&(0,a.jsxs)("div",{
            className:"text-center mb-8",children:[(0,a.jsx)("h2",{
              className:"text-2xl font-bold text-gray-900 dark:text-white mb-4",children:r}
            ),(0,a.jsx)("p",{
              className:"text-gray-600 dark:text-gray-300",children:u}
            )]}
          ),(0,a.jsx)("div",{
            className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",children:d.map((e,r)=>(0,a.jsxs)(T(),{
              href:e.href,className:"group bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 dark:border-gray-700",children:[(0,a.jsx)("h3",{
                className:"text-lg font-semibold text-gray-900 dark:text-white mb-3 group-hover:text-primary transition-colors",children:e.title}
              ),(0,a.jsx)("p",{
                className:"text-gray-600 dark:text-gray-300 text-sm leading-relaxed",children:e.description}
              ),(0,a.jsxs)("div",{
                className:"mt-4 flex items-center text-primary text-sm font-medium group-hover:underline",children:[l("阅读更多","Read More"),(0,a.jsx)("svg",{
                  className:"w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:(0,a.jsx)("path",{
                    strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M9 5l7 7-7 7"}
                  )}
                )]}
              )]}
            ,r))}
          ),(0,a.jsx)("div",{
            className:"text-center mt-8",children:(0,a.jsxs)(T(),{
              href:c,className:"inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors",children:[m,(0,a.jsx)("svg",{
                className:"w-4 h-4 ml-2",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:(0,a.jsx)("path",{
                  strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M9 5l7 7-7 7"}
                )}
              )]}
            )}
          )]}
        )}
      )}
    var M=t(86680),R=t(55636);
    function L(){
      return(0,a.jsxs)("div",{
        className:"flex flex-col items-center justify-center space-y-6 py-12",children:[(0,a.jsxs)("div",{
          className:"relative",children:[(0,a.jsx)("div",{
            className:"flex h-16 w-16 items-center justify-center rounded-full border border-indigo-500/30 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-indigo-200 shadow-lg shadow-indigo-500/20",children:(0,a.jsx)(w.A,{
              className:"h-8 w-8 text-indigo-300 animate-pulse"}
            )}
          ,"ai-brain"),(0,a.jsx)("div",{
            className:"absolute inset-0 h-16 w-16 animate-ping rounded-full border border-indigo-400/30 opacity-60"}
          ,"ai-ping-1"),(0,a.jsx)("div",{
            className:"absolute -inset-2 h-20 w-20 animate-pulse rounded-full border border-amber-500/20 opacity-40",style:{
              animationDuration:"3s"}
            }
          ,"ai-ping-2")]}
        ),(0,a.jsxs)("div",{
          className:"space-y-2 text-center",children:[(0,a.jsxs)("div",{
            className:"flex items-center justify-center space-x-2",children:[(0,a.jsx)("span",{
              className:"display-serif text-lg font-medium text-foreground tracking-wider",children:"正在演释梦象灵犀"}
            ),(0,a.jsxs)("div",{
              className:"flex space-x-1",children:[(0,a.jsx)("div",{
                className:"h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500",style:{
                  animationDelay:"0ms"}
                }
              ,"bounce-1"),(0,a.jsx)("div",{
                className:"h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500",style:{
                  animationDelay:"150ms"}
                }
              ,"bounce-2"),(0,a.jsx)("div",{
                className:"h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500",style:{
                  animationDelay:"300ms"}
                }
              ,"bounce-3")]}
            )]}
          ),(0,a.jsx)("p",{
            className:"text-xs text-muted-foreground",children:"融合《周公解梦》传统物象本义与深层心理投射，深度梳理心境潜流..."}
          )]}
        ),(0,a.jsx)("div",{
          className:"h-1.5 w-64 overflow-hidden rounded-full bg-secondary/80",children:(0,a.jsx)("div",{
            className:"h-full rounded-full bg-gradient-to-r from-indigo-600 via-amber-500/70 to-indigo-400 animate-pulse",style:{
              width:"70%"}
            }
          ,"progress-bar")}
        )]}
      )}
    function q(){
      return(0,a.jsxs)("div",{
        className:"flex items-center justify-center gap-3 py-2 text-xs text-muted-foreground/80",children:[(0,a.jsx)("span",{
          className:"h-px w-8 bg-gradient-to-r from-transparent to-indigo-500/40"}
        ),(0,a.jsx)("span",{
          className:"display-serif tracking-[0.18em] text-foreground/75",children:"神遇为梦 \xb7 物象通灵 \xb7 潜识投射"}
        ),(0,a.jsx)("span",{
          className:"h-px w-8 bg-gradient-to-l from-transparent to-indigo-500/40"}
        )]}
      )}
    let W=function(){
      let e=(0,c.useTranslations)("dream"),r=(0,c.useTranslations)("dream.validation");
      (0,c.useTranslations)("common");
      let t=(0,c.useTranslations)("sidebar"),b=(0,c.useLocale)(),{
        user:y}
      =(0,m.A)(),{
        showLoginModal:v}
      =(0,F.A)(),{
        fetchBalance:O}
      =(0,u.I)(),{
        getCreditCost:T,fetchCreditCost:H}
      =(0,p.G)(),W=[{
        value:"yes",label:e("form.recurringOptions.yes")}
      ,{
        value:"no",label:e("form.recurringOptions.no")}
      ],V=[{
        value:"sleep_deprived",label:e("form.physiologyOptions.sleepDeprived")}
      ,{
        value:"light_sleep",label:e("form.physiologyOptions.lightSleep")}
      ,{
        value:"fatigue",label:e("form.physiologyOptions.fatigue")}
      ,{
        value:"alcohol",label:e("form.physiologyOptions.alcohol")}
      ,{
        value:"discomfort",label:e("form.physiologyOptions.discomfort")}
      ,{
        value:"sleep_pressure",label:e("form.physiologyOptions.sleepPressure")}
      ],[$,G]=(0,s.useState)({
        dreamContent:"",dreamDate:"",emotions:"",context:"",recurringDream:"",physiologySignals:[],structureHint:""}
      ),K=function(e){
        if(!e)return;
        let r=(0,n.H)(e);
        return(0,i.f)(r)?r:void 0}
      ($.dreamDate),U=b.startsWith("zh")?l.g:d.c,[J,Q]=(0,s.useState)(!1),[X,Y]=(0,s.useState)(""),[ee,er]=(0,s.useState)(""),[et,ea]=(0,s.useState)(!1),[es,en]=(0,s.useState)(!1),[ei,eo]=(0,s.useState)(null),[el,ed]=(0,s.useState)(!1),[ec,em]=(0,s.useState)(null),eu=(0,s.useRef)(null);
      (0,s.useEffect)(()=>{
        (async()=>{
          let e=T("divination_dream");
          null!==e?eo(e):eo((await H("divination_dream")).credits_required)}
        )()}
      ,[T,H]);
      let ep=()=>{
        ea(!1),er(""),Y(""),em(null)}
      ,ex=(e,r)=>{
        G(t=>({
          ...t,[e]:r}
        )),ep()}
      ,eh=async()=>{
        var e,t;
        let a=null==(e=$.dreamContent)?void 0:e.trim();
        if(!a)return!1;
        ed(!0),em(null);
        try{
          let e=await (0,P.$0)({
            question:a,locale:b}
          );
          if(!e.success||null==(t=e.data)||!t.data)return!0;
          {
            let t=e.data.data;
            if(!t.isValid)return em({
              isValid:!1,reason:t.reason||r("questionInvalid"),suggestion:t.suggestion||""}
            ),!1;
            return!0}
          }
        catch(e){
          return!0}
        finally{
          ed(!1)}
        }
      ,eg=async()=>{
        if(!y)return void v();
        if(($.dreamContent&&!($.dreamContent.trim().length<5)||(Y(e("validation.incomplete")),0))&&await eh()){
          Q(!0),Y(""),er(""),ea(!0),en(!1);
          try{
            await (0,B.hL)({
              ...$,locale:b,userId:null==y?void 0:y.id}
            ,{
              onChunk:e=>{
                er(r=>r+e),en(!0),Q(!1)}
              ,onCompleted:e=>{
                er(e),en(!1)}
              ,onError:r=>{
                Y(r||e("aiError")),en(!1)}
              }
            )}
          catch(e){
            var r;
            Y(null!=(r=e.message)?r:e),en(!1)}
          finally{
            Q(!1)}
          }
        }
      ,ef=()=>{
        G({
          dreamContent:"",dreamDate:"",emotions:"",context:"",recurringDream:"",physiologySignals:[],structureHint:""}
        ),er(""),ea(!1),Y(""),en(!1),em(null)}
      ;
      return(0,s.useEffect)(()=>{
        et&&eu.current&&setTimeout(()=>{
          eu.current&&eu.current.scrollIntoView({
            behavior:"smooth",block:"center",inline:"center"}
          )}
        ,200)}
      ,[et]),(0,a.jsxs)("div",{
        className:"mx-auto max-w-4xl space-y-8 px-4 py-8",children:[(0,a.jsxs)("div",{
          className:"space-y-4 text-center",children:[(0,a.jsx)("h2",{
            className:"display-serif text-4xl text-foreground",children:e("title")}
          ),(0,a.jsx)("p",{
            className:"mx-auto max-w-2xl text-lg text-muted-foreground",children:e("description")}
          ),(0,a.jsx)(q,{
            }
          )]}
        ),X&&(0,a.jsx)(h.Zp,{
          className:"border-red-200 bg-red-50 dark:bg-red-900/20",children:(0,a.jsx)(h.Wu,{
            className:"pt-6",children:(0,a.jsxs)("div",{
              className:"flex items-center gap-2 text-red-600 dark:text-red-400",children:[(0,a.jsx)(k.A,{
                className:"h-5 w-5"}
              ),(0,a.jsx)("span",{
                children:X}
              )]}
            )}
          )}
        ),ec&&!ec.isValid&&(0,a.jsx)(h.Zp,{
          className:"border-red-200 bg-red-50 dark:bg-red-900/20",children:(0,a.jsxs)(h.Wu,{
            className:"p-4",children:[(0,a.jsxs)("div",{
              className:"flex items-start gap-2 text-red-800 dark:text-red-200",children:[(0,a.jsx)(k.A,{
                className:"mt-0.5 h-5 w-5 flex-shrink-0"}
              ),(0,a.jsxs)("div",{
                className:"flex-1",children:[(0,a.jsx)("p",{
                  className:"font-medium",children:r("invalid")}
                ),(0,a.jsx)("p",{
                  className:"mt-1 text-sm text-red-600 dark:text-red-300",children:ec.reason}
                ),ec.suggestion&&(0,a.jsx)("div",{
                  className:"mt-2 rounded-md bg-red-100 p-2 dark:bg-red-800/30",children:(0,a.jsxs)("p",{
                    className:"text-sm text-red-700 dark:text-red-300",children:[(0,a.jsxs)("strong",{
                      children:[r("suggestion"),"："]}
                    ),ec.suggestion]}
                  )}
                )]}
              )]}
            ),(0,a.jsx)("div",{
              className:"mt-3 flex flex-wrap gap-2",children:(0,a.jsx)(x.$,{
                size:"sm",variant:"outline",onClick:()=>{
                  em(null),ef()}
                ,className:"flex items-center gap-2 border-red-300/50 hover:border-red-400/70 hover:bg-red-50/50 dark:border-red-700/50 dark:hover:border-red-600/70 dark:hover:bg-red-900/30",children:r("tryAgain")}
              )}
            )]}
          )}
        ),(0,a.jsxs)(h.Zp,{
          className:"module-panel relative overflow-hidden border border-indigo-500/30 bg-card/90 shadow-md backdrop-blur-sm dark:bg-[#070814]/90",children:[(0,a.jsx)("span",{
            className:"pointer-events-none absolute left-2 top-2 h-2.5 w-2.5 border-l border-t border-indigo-500/50"}
          ),(0,a.jsx)("span",{
            className:"pointer-events-none absolute right-2 top-2 h-2.5 w-2.5 border-r border-t border-indigo-500/50"}
          ),(0,a.jsx)("span",{
            className:"pointer-events-none absolute bottom-2 left-2 h-2.5 w-2.5 border-b border-l border-indigo-500/50"}
          ),(0,a.jsx)("span",{
            className:"pointer-events-none absolute bottom-2 right-2 h-2.5 w-2.5 border-b border-r border-indigo-500/50"}
          ),(0,a.jsx)("div",{
            className:"absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent"}
          ),(0,a.jsxs)(h.aR,{
            children:[(0,a.jsxs)("div",{
              className:"flex items-center justify-between",children:[(0,a.jsxs)(h.ZB,{
                className:"display-serif flex items-center gap-2 text-xl font-normal tracking-[0.06em] text-foreground sm:text-2xl",children:[(0,a.jsx)(w.A,{
                  className:"h-5 w-5 text-indigo-500 dark:text-indigo-400"}
                ),e("form.title")]}
              ),(0,a.jsx)(R.e,{
                type:"dream",variant:"outline",size:"sm"}
              )]}
            ),(0,a.jsx)(h.BT,{
              className:"text-xs text-muted-foreground sm:text-sm",children:e("form.description")}
            )]}
          ),(0,a.jsxs)(h.Wu,{
            className:"space-y-6",children:[(0,a.jsxs)("div",{
              className:"space-y-2",children:[(0,a.jsxs)("label",{
                htmlFor:"dreamContent",className:"flex items-center gap-2 text-sm font-medium",children:[(0,a.jsx)(C.A,{
                  className:"h-4 w-4"}
                ),e("form.dreamContent")]}
              ),(0,a.jsx)(N.T,{
                id:"dreamContent",placeholder:e("form.dreamContentPlaceholder"),value:$.dreamContent,onChange:e=>ex("dreamContent",e.target.value),rows:6,className:"resize-none",required:!0,maxLength:2e3}
              )]}
            ),(0,a.jsxs)("div",{
              className:"grid grid-cols-1 gap-6 md:grid-cols-2",children:[(0,a.jsxs)("div",{
                className:"space-y-2",children:[(0,a.jsxs)("label",{
                  htmlFor:"dreamDate",className:"flex items-center gap-2 text-sm font-medium",children:[(0,a.jsx)(f.A,{
                    className:"h-4 w-4"}
                  ),e("form.dreamDate")]}
                ),(0,a.jsx)(j,{
                  id:"dreamDate",date:K,onDateChange:e=>ex("dreamDate",e?(0,o.GP)(e,"yyyy-MM-dd"):""),placeholder:e("form.dreamDate"),locale:U}
                )]}
              ),(0,a.jsxs)("div",{
                className:"space-y-2",children:[(0,a.jsxs)("label",{
                  htmlFor:"emotions",className:"flex items-center gap-2 text-sm font-medium",children:[(0,a.jsx)(A.A,{
                    className:"h-4 w-4"}
                  ),e("form.emotions")]}
                ),(0,a.jsx)("input",{
                  id:"emotions",type:"text",placeholder:e("form.emotionsPlaceholder"),value:$.emotions,onChange:e=>ex("emotions",e.target.value),className:"w-full rounded-md border-2 border-amber-400/80 bg-background px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-amber-500/80 dark:focus:border-amber-400 dark:focus:ring-amber-800/50"}
                )]}
              )]}
            ),(0,a.jsxs)("div",{
              className:"space-y-2",children:[(0,a.jsxs)("label",{
                htmlFor:"context",className:"flex items-center gap-2 text-sm font-medium",children:[(0,a.jsx)(_.A,{
                  className:"h-4 w-4"}
                ),e("form.context")]}
              ),(0,a.jsx)(N.T,{
                id:"context",placeholder:e("form.contextPlaceholder"),value:$.context,onChange:e=>ex("context",e.target.value),rows:3,className:"resize-none"}
              )]}
            ),(0,a.jsxs)("div",{
              className:"space-y-4 rounded-xl border border-amber-200/70 bg-amber-50/40 p-4 dark:border-amber-900/60 dark:bg-amber-950/10",children:[(0,a.jsxs)("div",{
                className:"space-y-2",children:[(0,a.jsxs)("div",{
                  className:"flex items-center gap-2",children:[(0,a.jsx)(z.A,{
                    className:"h-4 w-4"}
                  ),(0,a.jsx)("span",{
                    className:"text-sm font-medium",children:e("form.signalTitle")}
                  ),(0,a.jsx)(g.E,{
                    variant:"secondary",children:e("form.optional")}
                  )]}
                ),(0,a.jsx)("p",{
                  className:"text-sm text-muted-foreground",children:e("form.signalDescription")}
                )]}
              ),(0,a.jsxs)("div",{
                className:"space-y-2",children:[(0,a.jsxs)("div",{
                  className:"flex items-center gap-2 text-sm font-medium",children:[(0,a.jsx)(D.A,{
                    className:"h-4 w-4"}
                  ),(0,a.jsx)("span",{
                    children:e("form.recurringDream")}
                  )]}
                ),(0,a.jsx)("div",{
                  className:"flex flex-wrap gap-2",children:W.map(e=>{
                    let r=$.recurringDream===e.value;
                    return(0,a.jsx)(x.$,{
                      type:"button",size:"sm",variant:r?"default":"outline",onClick:()=>{
                        var r;
                        return r=e.value,void(G(e=>({
                          ...e,recurringDream:r}
                        )),ep())}
                      ,className:r?"shadow":"border-amber-300/70 hover:bg-amber-100/70 dark:border-amber-800/70 dark:hover:bg-amber-900/30",children:e.label}
                    ,e.value)}
                  )}
                ),(0,a.jsx)("p",{
                  className:"text-xs text-muted-foreground",children:e("form.recurringDreamHint")}
                )]}
              ),(0,a.jsxs)("div",{
                className:"space-y-2",children:[(0,a.jsxs)("div",{
                  className:"flex items-center gap-2 text-sm font-medium",children:[(0,a.jsx)(A.A,{
                    className:"h-4 w-4"}
                  ),(0,a.jsx)("span",{
                    children:e("form.physiologySignals")}
                  )]}
                ),(0,a.jsx)("div",{
                  className:"flex flex-wrap gap-2",children:V.map(e=>{
                    var r;
                    let t=null==(r=$.physiologySignals)?void 0:r.includes(e.value);
                    return(0,a.jsx)(x.$,{
                      type:"button",size:"sm",variant:t?"default":"outline",onClick:()=>{
                        var r;
                        return r=e.value,void(G(e=>{
                          let t=e.physiologySignals||[],a=t.includes(r)?t.filter(e=>e!==r):[...t,r];
                          return{
                            ...e,physiologySignals:a}
                          }
                        ),ep())}
                      ,className:t?"shadow":"border-amber-300/70 hover:bg-amber-100/70 dark:border-amber-800/70 dark:hover:bg-amber-900/30",children:e.label}
                    ,e.value)}
                  )}
                ),(0,a.jsx)("p",{
                  className:"text-xs text-muted-foreground",children:e("form.physiologySignalsHint")}
                )]}
              ),(0,a.jsxs)("div",{
                className:"space-y-2",children:[(0,a.jsxs)("label",{
                  htmlFor:"structureHint",className:"flex items-center gap-2 text-sm font-medium",children:[(0,a.jsx)(z.A,{
                    className:"h-4 w-4"}
                  ),e("form.structureHint")]}
                ),(0,a.jsx)(N.T,{
                  id:"structureHint",placeholder:e("form.structureHintPlaceholder"),value:$.structureHint,onChange:e=>ex("structureHint",e.target.value),rows:3,className:"resize-none"}
                ),(0,a.jsx)("p",{
                  className:"text-xs text-muted-foreground",children:e("form.structureHintDescription")}
                )]}
              )]}
            ),(0,a.jsxs)("div",{
              className:"flex flex-col gap-3 sm:flex-row sm:items-center",children:[(0,a.jsxs)(x.$,{
                onClick:eg,disabled:J,size:"lg",className:"w-full rounded-xl bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 dark:from-indigo-950 dark:via-[#111228] dark:to-slate-950 px-5 py-3 font-medium text-indigo-100 border border-indigo-500/40 shadow-md hover:border-indigo-400 hover:text-white active:scale-[0.98] sm:flex-[2] transition-all duration-300 ".concat(J?"":"apple-cta-attention"),children:[J?(0,a.jsx)(E.A,{
                  className:"mr-2 h-4 w-4 animate-spin text-indigo-400"}
                ):(0,a.jsx)(S.A,{
                  className:"mr-2 h-4 w-4 text-indigo-400"}
                ),(0,a.jsx)("span",{
                  className:"display-serif tracking-wider",children:J?e("analyzing"):e("analyze")}
                ),null!==ei&&!J&&(0,a.jsxs)("span",{
                  className:"ml-2 rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-normal text-indigo-200 border border-indigo-500/30",children:[ei," ",e("credits",{
                    default:"积分"}
                  )]}
                )]}
              ),(0,a.jsxs)(x.$,{
                onClick:ef,variant:"outline",size:"lg",className:"w-full sm:flex-1",children:[(0,a.jsx)(Z.A,{
                  className:"mr-2 h-4 w-4"}
                ),e("reset")]}
              )]}
            )]}
          )]}
        ),(0,a.jsx)("div",{
          ref:eu,className:"transform transition-all duration-500 ".concat(et?"translate-y-0 opacity-100":"pointer-events-none translate-y-4 opacity-0"),children:et&&(0,a.jsxs)(h.Zp,{
            className:"module-panel relative overflow-hidden border border-indigo-500/35 bg-card/95 shadow-lg backdrop-blur-sm dark:bg-[#070814]/95",children:[(0,a.jsx)("span",{
              className:"pointer-events-none absolute left-2 top-2 h-2.5 w-2.5 border-l border-t border-indigo-500/60"}
            ),(0,a.jsx)("span",{
              className:"pointer-events-none absolute right-2 top-2 h-2.5 w-2.5 border-r border-t border-indigo-500/60"}
            ),(0,a.jsx)("span",{
              className:"pointer-events-none absolute bottom-2 left-2 h-2.5 w-2.5 border-b border-l border-indigo-500/60"}
            ),(0,a.jsx)("span",{
              className:"pointer-events-none absolute bottom-2 right-2 h-2.5 w-2.5 border-b border-r border-indigo-500/60"}
            ),(0,a.jsx)("div",{
              className:"absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r from-transparent via-indigo-500/80 to-transparent"}
            ),(0,a.jsxs)(h.aR,{
              className:"border-b border-border/50 px-4 py-4 sm:px-6 sm:py-5",children:[(0,a.jsxs)(h.ZB,{
                className:"display-serif flex items-center gap-2 text-xl font-normal text-foreground sm:text-2xl",children:[(0,a.jsx)(w.A,{
                  className:"h-5 w-5 text-indigo-500 dark:text-indigo-400"}
                ),e("interpretation.title")]}
              ),(0,a.jsx)(h.BT,{
                className:"text-xs text-muted-foreground sm:text-sm",children:e("interpretation.description")}
              )]}
            ),(0,a.jsx)(h.Wu,{
              className:"p-2 sm:p-5",children:J?(0,a.jsx)(L,{
                }
              ):(0,a.jsx)(a.Fragment,{
                children:(0,a.jsxs)("div",{
                  className:"prose prose-gray max-w-none dark:prose-invert",children:[(0,a.jsx)(M.A,{
                    completion:ee,isLoading:J,onCompletion:()=>{
                      }
                    ,error:X,onRestart:()=>{
                      }
                    }
                  ),es&&(0,a.jsx)("span",{
                    className:"ml-1 inline-block h-4 w-2 animate-pulse bg-primary"}
                  )]}
                )}
              )}
            )]}
          )}
        ),(0,a.jsx)(I,{
          locale:b,title:t("relatedServices"),className:"mt-12"}
        )]}
      )}
    }
  ,55636:(e,r,t)=>{
    "use strict";
    t.d(r,{
      e:()=>l}
    );
    var a=t(38942),s=t(2299),n=t(54509),i=t(96793),o=t(8464);
    function l(e){
      let{
        type:r,variant:t="outline",size:l="default",className:d="",showIcon:c=!0,children:m}
      =e,u=(0,i.useRouter)(),p=(0,o.useLocale)();
      return(0,a.jsxs)(s.$,{
        variant:t,size:l,onClick:()=>{
          u.push("/".concat(p,"/history?type=").concat(r))}
        ,className:"flex items-center gap-2 ".concat(d),children:[c&&(0,a.jsx)(n.A,{
          className:"h-4 w-4"}
        ),m||("zh-TW"===p?"查看歷史":"zh"===p?"查看历史":"View History")]}
      )}
    }
  ,79476:(e,r,t)=>{
    "use strict";
    t.d(r,{
      E:()=>i}
    );
    var a=t(38942);
    t(42062);
    var s=t(85832);
    let n={
      default:"border-transparent bg-primary text-primary-foreground hover:bg-primary/80",secondary:"border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",destructive:"border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",outline:"text-foreground"}
    ;
    function i(e){
      let{
        className:r,variant:t="default",...i}
      =e;
      return(0,a.jsx)("div",{
        className:(0,s.cn)("inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",n[t],r),...i}
      )}
    }
  ,92265:(e,r,t)=>{
    "use strict";
    t.d(r,{
      T:()=>i}
    );
    var a=t(38942),s=t(42062),n=t(85832);
    let i=s.forwardRef((e,r)=>{
      let{
        className:t,...s}
      =e;
      return(0,a.jsx)("textarea",{
        className:(0,n.cn)("flex min-h-[96px] w-full rounded-xl border border-input bg-card/55 px-3.5 py-3 text-base leading-7 shadow-sm placeholder:text-muted-foreground/80 focus-visible:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",t),ref:r,...s}
      )}
    );
    i.displayName="Textarea"}
  }
,e=>{
  e.O(0,[692,4221,8464,3578,4190,4316,7658,5833,7271,5873,1393,6872,2485,1366,8128,272,9395,4782,6680,5289,2685,7358],()=>e(e.s=12514)),_N_E=e.O()}
]);
