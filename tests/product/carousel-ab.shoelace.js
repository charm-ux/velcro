// Temporary A/B diagnostic build, not part of Velcro: Shoelace 2.20.1's own sl-carousel, sl-carousel-item and sl-icon, bundled
// unmodified from Shoelace's source with esbuild (only @shoelace-style/localize replaced by a minimal stand-in) together with lit.
// Shoelace: Copyright (c) 2020 A Beautiful Site, LLC, MIT License. Lit: Copyright 2017 Google LLC, BSD-3-Clause.
// See THIRD_PARTY_NOTICES.md. Used only by tests/product/carousel-ab.spec.mjs and removed after the run.
var __defProp=Object.defineProperty;var __getOwnPropDesc=Object.getOwnPropertyDescriptor;var __typeError=msg=>{throw TypeError(msg)};var __decorateClass=(decorators,target,key,kind)=>{for(var result=kind>1?void 0:kind?__getOwnPropDesc(target,key):target,i6=decorators.length-1,decorator;i6>=0;i6--)(decorator=decorators[i6])&&(result=(kind?decorator(target,key,result):decorator(result))||result);return kind&&result&&__defProp(target,key,result),result};var __accessCheck=(obj,member,msg)=>member.has(obj)||__typeError("Cannot "+msg);var __privateGet=(obj,member,getter)=>(__accessCheck(obj,member,"read from private field"),getter?getter.call(obj):member.get(obj)),__privateAdd=(obj,member,value)=>member.has(obj)?__typeError("Cannot add the same private member more than once"):member instanceof WeakSet?member.add(obj):member.set(obj,value),__privateSet=(obj,member,value,setter)=>(__accessCheck(obj,member,"write to private field"),setter?setter.call(obj,value):member.set(obj,value),value);var debounce=(fn,delay)=>{let timerId=0;return function(...args){window.clearTimeout(timerId),timerId=window.setTimeout(()=>{fn.call(this,...args)},delay)}},decorate=(proto,method,decorateFn)=>{let superFn=proto[method];proto[method]=function(...args){superFn.call(this,...args),decorateFn.call(this,superFn,...args)}};(()=>{if(typeof window>"u")return;if(!("onscrollend"in window)){let pointers=new Set,scrollHandlers=new WeakMap,handlePointerDown=event=>{for(let touch of event.changedTouches)pointers.add(touch.identifier)},handlePointerUp=event=>{for(let touch of event.changedTouches)pointers.delete(touch.identifier)};document.addEventListener("touchstart",handlePointerDown,!0),document.addEventListener("touchend",handlePointerUp,!0),document.addEventListener("touchcancel",handlePointerUp,!0),decorate(EventTarget.prototype,"addEventListener",function(addEventListener,type){if(type!=="scrollend")return;let handleScrollEnd=debounce(()=>{pointers.size?handleScrollEnd():this.dispatchEvent(new Event("scrollend"))},100);addEventListener.call(this,"scroll",handleScrollEnd,{passive:!0}),scrollHandlers.set(this,handleScrollEnd)}),decorate(EventTarget.prototype,"removeEventListener",function(removeEventListener,type){if(type!=="scrollend")return;let scrollHandler=scrollHandlers.get(this);scrollHandler&&removeEventListener.call(this,"scroll",scrollHandler,{passive:!0})})}})();var AutoplayController=class{constructor(host,tickCallback){this.timerId=0;this.activeInteractions=0;this.paused=!1;this.stopped=!0;this.pause=()=>{this.activeInteractions++||(this.paused=!0,this.host.requestUpdate())};this.resume=()=>{--this.activeInteractions||(this.paused=!1,this.host.requestUpdate())};host.addController(this),this.host=host,this.tickCallback=tickCallback}hostConnected(){this.host.addEventListener("mouseenter",this.pause),this.host.addEventListener("mouseleave",this.resume),this.host.addEventListener("focusin",this.pause),this.host.addEventListener("focusout",this.resume),this.host.addEventListener("touchstart",this.pause,{passive:!0}),this.host.addEventListener("touchend",this.resume)}hostDisconnected(){this.stop(),this.host.removeEventListener("mouseenter",this.pause),this.host.removeEventListener("mouseleave",this.resume),this.host.removeEventListener("focusin",this.pause),this.host.removeEventListener("focusout",this.resume),this.host.removeEventListener("touchstart",this.pause),this.host.removeEventListener("touchend",this.resume)}start(interval){this.stop(),this.stopped=!1,this.timerId=window.setInterval(()=>{this.paused||this.tickCallback()},interval)}stop(){clearInterval(this.timerId),this.stopped=!0,this.host.requestUpdate()}};function clamp(value,min,max){let noNegativeZero=n5=>Object.is(n5,-0)?0:n5;return value<min?noNegativeZero(min):value>max?noNegativeZero(max):noNegativeZero(value)}var t=globalThis,i=t6=>t6,s=t.trustedTypes,e=s?s.createPolicy("lit-html",{createHTML:t6=>t6}):void 0,h="$lit$",o=`lit$${Math.random().toFixed(9).slice(2)}$`,n="?"+o,r=`<${n}>`,l=document,c=()=>l.createComment(""),a=t6=>t6===null||typeof t6!="object"&&typeof t6!="function",u=Array.isArray,d=t6=>u(t6)||typeof t6?.[Symbol.iterator]=="function",f=`[ 	
\f\r]`,v=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,_=/-->/g,m=/>/g,p=RegExp(`>|${f}(?:([^\\s"'>=/]+)(${f}*=${f}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),g=/'/g,$=/"/g,y=/^(?:script|style|textarea|title)$/i,x=t6=>(i6,...s4)=>({_$litType$:t6,strings:i6,values:s4}),b=x(1),w=x(2),T=x(3),E=Symbol.for("lit-noChange"),A=Symbol.for("lit-nothing"),C=new WeakMap,P=l.createTreeWalker(l,129);function V(t6,i6){if(!u(t6)||!t6.hasOwnProperty("raw"))throw Error("invalid template strings array");return e!==void 0?e.createHTML(i6):i6}var N=(t6,i6)=>{let s4=t6.length-1,e8=[],n5,l4=i6===2?"<svg>":i6===3?"<math>":"",c4=v;for(let i7=0;i7<s4;i7++){let s5=t6[i7],a3,u3,d3=-1,f3=0;for(;f3<s5.length&&(c4.lastIndex=f3,u3=c4.exec(s5),u3!==null);)f3=c4.lastIndex,c4===v?u3[1]==="!--"?c4=_:u3[1]!==void 0?c4=m:u3[2]!==void 0?(y.test(u3[2])&&(n5=RegExp("</"+u3[2],"g")),c4=p):u3[3]!==void 0&&(c4=p):c4===p?u3[0]===">"?(c4=n5??v,d3=-1):u3[1]===void 0?d3=-2:(d3=c4.lastIndex-u3[2].length,a3=u3[1],c4=u3[3]===void 0?p:u3[3]==='"'?$:g):c4===$||c4===g?c4=p:c4===_||c4===m?c4=v:(c4=p,n5=void 0);let x2=c4===p&&t6[i7+1].startsWith("/>")?" ":"";l4+=c4===v?s5+r:d3>=0?(e8.push(a3),s5.slice(0,d3)+h+s5.slice(d3)+o+x2):s5+o+(d3===-2?i7:x2)}return[V(t6,l4+(t6[s4]||"<?>")+(i6===2?"</svg>":i6===3?"</math>":"")),e8]},S=class _S{constructor({strings:t6,_$litType$:i6},e8){let r6;this.parts=[];let l4=0,a3=0,u3=t6.length-1,d3=this.parts,[f3,v2]=N(t6,i6);if(this.el=_S.createElement(f3,e8),P.currentNode=this.el.content,i6===2||i6===3){let t7=this.el.content.firstChild;t7.replaceWith(...t7.childNodes)}for(;(r6=P.nextNode())!==null&&d3.length<u3;){if(r6.nodeType===1){if(r6.hasAttributes())for(let t7 of r6.getAttributeNames())if(t7.endsWith(h)){let i7=v2[a3++],s4=r6.getAttribute(t7).split(o),e9=/([.?@])?(.*)/.exec(i7);d3.push({type:1,index:l4,name:e9[2],strings:s4,ctor:e9[1]==="."?I:e9[1]==="?"?L:e9[1]==="@"?z:H}),r6.removeAttribute(t7)}else t7.startsWith(o)&&(d3.push({type:6,index:l4}),r6.removeAttribute(t7));if(y.test(r6.tagName)){let t7=r6.textContent.split(o),i7=t7.length-1;if(i7>0){r6.textContent=s?s.emptyScript:"";for(let s4=0;s4<i7;s4++)r6.append(t7[s4],c()),P.nextNode(),d3.push({type:2,index:++l4});r6.append(t7[i7],c())}}}else if(r6.nodeType===8)if(r6.data===n)d3.push({type:2,index:l4});else{let t7=-1;for(;(t7=r6.data.indexOf(o,t7+1))!==-1;)d3.push({type:7,index:l4}),t7+=o.length-1}l4++}}static createElement(t6,i6){let s4=l.createElement("template");return s4.innerHTML=t6,s4}};function M(t6,i6,s4=t6,e8){if(i6===E)return i6;let h3=e8!==void 0?s4._$Co?.[e8]:s4._$Cl,o8=a(i6)?void 0:i6._$litDirective$;return h3?.constructor!==o8&&(h3?._$AO?.(!1),o8===void 0?h3=void 0:(h3=new o8(t6),h3._$AT(t6,s4,e8)),e8!==void 0?(s4._$Co??(s4._$Co=[]))[e8]=h3:s4._$Cl=h3),h3!==void 0&&(i6=M(t6,h3._$AS(t6,i6.values),h3,e8)),i6}var R=class{constructor(t6,i6){this._$AV=[],this._$AN=void 0,this._$AD=t6,this._$AM=i6}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t6){let{el:{content:i6},parts:s4}=this._$AD,e8=(t6?.creationScope??l).importNode(i6,!0);P.currentNode=e8;let h3=P.nextNode(),o8=0,n5=0,r6=s4[0];for(;r6!==void 0;){if(o8===r6.index){let i7;r6.type===2?i7=new k(h3,h3.nextSibling,this,t6):r6.type===1?i7=new r6.ctor(h3,r6.name,r6.strings,this,t6):r6.type===6&&(i7=new Z(h3,this,t6)),this._$AV.push(i7),r6=s4[++n5]}o8!==r6?.index&&(h3=P.nextNode(),o8++)}return P.currentNode=l,e8}p(t6){let i6=0;for(let s4 of this._$AV)s4!==void 0&&(s4.strings!==void 0?(s4._$AI(t6,s4,i6),i6+=s4.strings.length-2):s4._$AI(t6[i6])),i6++}},k=class _k{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t6,i6,s4,e8){this.type=2,this._$AH=A,this._$AN=void 0,this._$AA=t6,this._$AB=i6,this._$AM=s4,this.options=e8,this._$Cv=e8?.isConnected??!0}get parentNode(){let t6=this._$AA.parentNode,i6=this._$AM;return i6!==void 0&&t6?.nodeType===11&&(t6=i6.parentNode),t6}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t6,i6=this){t6=M(this,t6,i6),a(t6)?t6===A||t6==null||t6===""?(this._$AH!==A&&this._$AR(),this._$AH=A):t6!==this._$AH&&t6!==E&&this._(t6):t6._$litType$!==void 0?this.$(t6):t6.nodeType!==void 0?this.T(t6):d(t6)?this.k(t6):this._(t6)}O(t6){return this._$AA.parentNode.insertBefore(t6,this._$AB)}T(t6){this._$AH!==t6&&(this._$AR(),this._$AH=this.O(t6))}_(t6){this._$AH!==A&&a(this._$AH)?this._$AA.nextSibling.data=t6:this.T(l.createTextNode(t6)),this._$AH=t6}$(t6){let{values:i6,_$litType$:s4}=t6,e8=typeof s4=="number"?this._$AC(t6):(s4.el===void 0&&(s4.el=S.createElement(V(s4.h,s4.h[0]),this.options)),s4);if(this._$AH?._$AD===e8)this._$AH.p(i6);else{let t7=new R(e8,this),s5=t7.u(this.options);t7.p(i6),this.T(s5),this._$AH=t7}}_$AC(t6){let i6=C.get(t6.strings);return i6===void 0&&C.set(t6.strings,i6=new S(t6)),i6}k(t6){u(this._$AH)||(this._$AH=[],this._$AR());let i6=this._$AH,s4,e8=0;for(let h3 of t6)e8===i6.length?i6.push(s4=new _k(this.O(c()),this.O(c()),this,this.options)):s4=i6[e8],s4._$AI(h3),e8++;e8<i6.length&&(this._$AR(s4&&s4._$AB.nextSibling,e8),i6.length=e8)}_$AR(t6=this._$AA.nextSibling,s4){for(this._$AP?.(!1,!0,s4);t6!==this._$AB;){let s5=i(t6).nextSibling;i(t6).remove(),t6=s5}}setConnected(t6){this._$AM===void 0&&(this._$Cv=t6,this._$AP?.(t6))}},H=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t6,i6,s4,e8,h3){this.type=1,this._$AH=A,this._$AN=void 0,this.element=t6,this.name=i6,this._$AM=e8,this.options=h3,s4.length>2||s4[0]!==""||s4[1]!==""?(this._$AH=Array(s4.length-1).fill(new String),this.strings=s4):this._$AH=A}_$AI(t6,i6=this,s4,e8){let h3=this.strings,o8=!1;if(h3===void 0)t6=M(this,t6,i6,0),o8=!a(t6)||t6!==this._$AH&&t6!==E,o8&&(this._$AH=t6);else{let e9=t6,n5,r6;for(t6=h3[0],n5=0;n5<h3.length-1;n5++)r6=M(this,e9[s4+n5],i6,n5),r6===E&&(r6=this._$AH[n5]),o8||(o8=!a(r6)||r6!==this._$AH[n5]),r6===A?t6=A:t6!==A&&(t6+=(r6??"")+h3[n5+1]),this._$AH[n5]=r6}o8&&!e8&&this.j(t6)}j(t6){t6===A?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t6??"")}},I=class extends H{constructor(){super(...arguments),this.type=3}j(t6){this.element[this.name]=t6===A?void 0:t6}},L=class extends H{constructor(){super(...arguments),this.type=4}j(t6){this.element.toggleAttribute(this.name,!!t6&&t6!==A)}},z=class extends H{constructor(t6,i6,s4,e8,h3){super(t6,i6,s4,e8,h3),this.type=5}_$AI(t6,i6=this){if((t6=M(this,t6,i6,0)??A)===E)return;let s4=this._$AH,e8=t6===A&&s4!==A||t6.capture!==s4.capture||t6.once!==s4.once||t6.passive!==s4.passive,h3=t6!==A&&(s4===A||e8);e8&&this.element.removeEventListener(this.name,this,s4),h3&&this.element.addEventListener(this.name,this,t6),this._$AH=t6}handleEvent(t6){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t6):this._$AH.handleEvent(t6)}},Z=class{constructor(t6,i6,s4){this.element=t6,this.type=6,this._$AN=void 0,this._$AM=i6,this.options=s4}get _$AU(){return this._$AM._$AU}_$AI(t6){M(this,t6)}},j={M:h,P:o,A:n,C:1,L:N,R,D:d,V:M,I:k,H,N:L,U:z,B:I,F:Z},B=t.litHtmlPolyfillSupport;B?.(S,k),(t.litHtmlVersions??(t.litHtmlVersions=[])).push("3.3.3");var D=(t6,i6,s4)=>{let e8=s4?.renderBefore??i6,h3=e8._$litPart$;if(h3===void 0){let t7=s4?.renderBefore??null;e8._$litPart$=h3=new k(i6.insertBefore(c(),t7),t7,void 0,s4??{})}return h3._$AI(t6),h3};var t2={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},e2=t6=>(...e8)=>({_$litDirective$:t6,values:e8}),i2=class{constructor(t6){}get _$AU(){return this._$AM._$AU}_$AT(t6,e8,i6){this._$Ct=t6,this._$AM=e8,this._$Ci=i6}_$AS(t6,e8){return this.update(t6,e8)}update(t6,e8){return this.render(...e8)}};var e3=e2(class extends i2{constructor(t6){if(super(t6),t6.type!==t2.ATTRIBUTE||t6.name!=="class"||t6.strings?.length>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(t6){return" "+Object.keys(t6).filter(s4=>t6[s4]).join(" ")+" "}update(s4,[i6]){if(this.st===void 0){this.st=new Set,s4.strings!==void 0&&(this.nt=new Set(s4.strings.join(" ").split(/\s/).filter(t6=>t6!=="")));for(let t6 in i6)i6[t6]&&!this.nt?.has(t6)&&this.st.add(t6);return this.render(i6)}let r6=s4.element.classList;for(let t6 of this.st)t6 in i6||(r6.remove(t6),this.st.delete(t6));for(let t6 in i6){let s5=!!i6[t6];s5===this.st.has(t6)||this.nt?.has(t6)||(s5?(r6.add(t6),this.st.add(t6)):(r6.remove(t6),this.st.delete(t6)))}return E}});var t3=globalThis,e4=t3.ShadowRoot&&(t3.ShadyCSS===void 0||t3.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s2=Symbol(),o2=new WeakMap,n2=class{constructor(t6,e8,o8){if(this._$cssResult$=!0,o8!==s2)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t6,this.t=e8}get styleSheet(){let t6=this.o,s4=this.t;if(e4&&t6===void 0){let e8=s4!==void 0&&s4.length===1;e8&&(t6=o2.get(s4)),t6===void 0&&((this.o=t6=new CSSStyleSheet).replaceSync(this.cssText),e8&&o2.set(s4,t6))}return t6}toString(){return this.cssText}},r2=t6=>new n2(typeof t6=="string"?t6:t6+"",void 0,s2),i3=(t6,...e8)=>{let o8=t6.length===1?t6[0]:e8.reduce((e9,s4,o9)=>e9+(t7=>{if(t7._$cssResult$===!0)return t7.cssText;if(typeof t7=="number")return t7;throw Error("Value passed to 'css' function must be a 'css' function result: "+t7+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s4)+t6[o9+1],t6[0]);return new n2(o8,t6,s2)},S2=(s4,o8)=>{if(e4)s4.adoptedStyleSheets=o8.map(t6=>t6 instanceof CSSStyleSheet?t6:t6.styleSheet);else for(let e8 of o8){let o9=document.createElement("style"),n5=t3.litNonce;n5!==void 0&&o9.setAttribute("nonce",n5),o9.textContent=e8.cssText,s4.appendChild(o9)}},c2=e4?t6=>t6:t6=>t6 instanceof CSSStyleSheet?(t7=>{let e8="";for(let s4 of t7.cssRules)e8+=s4.cssText;return r2(e8)})(t6):t6;var{is:i4,defineProperty:e5,getOwnPropertyDescriptor:h2,getOwnPropertyNames:r3,getOwnPropertySymbols:o3,getPrototypeOf:n3}=Object,a2=globalThis,c3=a2.trustedTypes,l2=c3?c3.emptyScript:"",p2=a2.reactiveElementPolyfillSupport,d2=(t6,s4)=>t6,u2={toAttribute(t6,s4){switch(s4){case Boolean:t6=t6?l2:null;break;case Object:case Array:t6=t6==null?t6:JSON.stringify(t6)}return t6},fromAttribute(t6,s4){let i6=t6;switch(s4){case Boolean:i6=t6!==null;break;case Number:i6=t6===null?null:Number(t6);break;case Object:case Array:try{i6=JSON.parse(t6)}catch{i6=null}}return i6}},f2=(t6,s4)=>!i4(t6,s4),b2={attribute:!0,type:String,converter:u2,reflect:!1,useDefault:!1,hasChanged:f2};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),a2.litPropertyMetadata??(a2.litPropertyMetadata=new WeakMap);var y2=class extends HTMLElement{static addInitializer(t6){this._$Ei(),(this.l??(this.l=[])).push(t6)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t6,s4=b2){if(s4.state&&(s4.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t6)&&((s4=Object.create(s4)).wrapped=!0),this.elementProperties.set(t6,s4),!s4.noAccessor){let i6=Symbol(),h3=this.getPropertyDescriptor(t6,i6,s4);h3!==void 0&&e5(this.prototype,t6,h3)}}static getPropertyDescriptor(t6,s4,i6){let{get:e8,set:r6}=h2(this.prototype,t6)??{get(){return this[s4]},set(t7){this[s4]=t7}};return{get:e8,set(s5){let h3=e8?.call(this);r6?.call(this,s5),this.requestUpdate(t6,h3,i6)},configurable:!0,enumerable:!0}}static getPropertyOptions(t6){return this.elementProperties.get(t6)??b2}static _$Ei(){if(this.hasOwnProperty(d2("elementProperties")))return;let t6=n3(this);t6.finalize(),t6.l!==void 0&&(this.l=[...t6.l]),this.elementProperties=new Map(t6.elementProperties)}static finalize(){if(this.hasOwnProperty(d2("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(d2("properties"))){let t7=this.properties,s4=[...r3(t7),...o3(t7)];for(let i6 of s4)this.createProperty(i6,t7[i6])}let t6=this[Symbol.metadata];if(t6!==null){let s4=litPropertyMetadata.get(t6);if(s4!==void 0)for(let[t7,i6]of s4)this.elementProperties.set(t7,i6)}this._$Eh=new Map;for(let[t7,s4]of this.elementProperties){let i6=this._$Eu(t7,s4);i6!==void 0&&this._$Eh.set(i6,t7)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(s4){let i6=[];if(Array.isArray(s4)){let e8=new Set(s4.flat(1/0).reverse());for(let s5 of e8)i6.unshift(c2(s5))}else s4!==void 0&&i6.push(c2(s4));return i6}static _$Eu(t6,s4){let i6=s4.attribute;return i6===!1?void 0:typeof i6=="string"?i6:typeof t6=="string"?t6.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t6=>this.enableUpdating=t6),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t6=>t6(this))}addController(t6){(this._$EO??(this._$EO=new Set)).add(t6),this.renderRoot!==void 0&&this.isConnected&&t6.hostConnected?.()}removeController(t6){this._$EO?.delete(t6)}_$E_(){let t6=new Map,s4=this.constructor.elementProperties;for(let i6 of s4.keys())this.hasOwnProperty(i6)&&(t6.set(i6,this[i6]),delete this[i6]);t6.size>0&&(this._$Ep=t6)}createRenderRoot(){let t6=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return S2(t6,this.constructor.elementStyles),t6}connectedCallback(){this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),this._$EO?.forEach(t6=>t6.hostConnected?.())}enableUpdating(t6){}disconnectedCallback(){this._$EO?.forEach(t6=>t6.hostDisconnected?.())}attributeChangedCallback(t6,s4,i6){this._$AK(t6,i6)}_$ET(t6,s4){let i6=this.constructor.elementProperties.get(t6),e8=this.constructor._$Eu(t6,i6);if(e8!==void 0&&i6.reflect===!0){let h3=(i6.converter?.toAttribute!==void 0?i6.converter:u2).toAttribute(s4,i6.type);this._$Em=t6,h3==null?this.removeAttribute(e8):this.setAttribute(e8,h3),this._$Em=null}}_$AK(t6,s4){let i6=this.constructor,e8=i6._$Eh.get(t6);if(e8!==void 0&&this._$Em!==e8){let t7=i6.getPropertyOptions(e8),h3=typeof t7.converter=="function"?{fromAttribute:t7.converter}:t7.converter?.fromAttribute!==void 0?t7.converter:u2;this._$Em=e8;let r6=h3.fromAttribute(s4,t7.type);this[e8]=r6??this._$Ej?.get(e8)??r6,this._$Em=null}}requestUpdate(t6,s4,i6,e8=!1,h3){if(t6!==void 0){let r6=this.constructor;if(e8===!1&&(h3=this[t6]),i6??(i6=r6.getPropertyOptions(t6)),!((i6.hasChanged??f2)(h3,s4)||i6.useDefault&&i6.reflect&&h3===this._$Ej?.get(t6)&&!this.hasAttribute(r6._$Eu(t6,i6))))return;this.C(t6,s4,i6)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t6,s4,{useDefault:i6,reflect:e8,wrapped:h3},r6){i6&&!(this._$Ej??(this._$Ej=new Map)).has(t6)&&(this._$Ej.set(t6,r6??s4??this[t6]),h3!==!0||r6!==void 0)||(this._$AL.has(t6)||(this.hasUpdated||i6||(s4=void 0),this._$AL.set(t6,s4)),e8===!0&&this._$Em!==t6&&(this._$Eq??(this._$Eq=new Set)).add(t6))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t7){Promise.reject(t7)}let t6=this.scheduleUpdate();return t6!=null&&await t6,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(let[t8,s5]of this._$Ep)this[t8]=s5;this._$Ep=void 0}let t7=this.constructor.elementProperties;if(t7.size>0)for(let[s5,i6]of t7){let{wrapped:t8}=i6,e8=this[s5];t8!==!0||this._$AL.has(s5)||e8===void 0||this.C(s5,void 0,i6,e8)}}let t6=!1,s4=this._$AL;try{t6=this.shouldUpdate(s4),t6?(this.willUpdate(s4),this._$EO?.forEach(t7=>t7.hostUpdate?.()),this.update(s4)):this._$EM()}catch(s5){throw t6=!1,this._$EM(),s5}t6&&this._$AE(s4)}willUpdate(t6){}_$AE(t6){this._$EO?.forEach(t7=>t7.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t6)),this.updated(t6)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t6){return!0}update(t6){this._$Eq&&(this._$Eq=this._$Eq.forEach(t7=>this._$ET(t7,this[t7]))),this._$EM()}updated(t6){}firstUpdated(t6){}};y2.elementStyles=[],y2.shadowRootOptions={mode:"open"},y2[d2("elementProperties")]=new Map,y2[d2("finalized")]=new Map,p2?.({ReactiveElement:y2}),(a2.reactiveElementVersions??(a2.reactiveElementVersions=[])).push("2.1.2");var o4={attribute:!0,type:String,converter:u2,reflect:!1,hasChanged:f2},r4=(t6=o4,e8,r6)=>{let{kind:n5,metadata:i6}=r6,s4=globalThis.litPropertyMetadata.get(i6);if(s4===void 0&&globalThis.litPropertyMetadata.set(i6,s4=new Map),n5==="setter"&&((t6=Object.create(t6)).wrapped=!0),s4.set(r6.name,t6),n5==="accessor"){let{name:o8}=r6;return{set(r7){let n6=e8.get.call(this);e8.set.call(this,r7),this.requestUpdate(o8,n6,t6,!0,r7)},init(e9){return e9!==void 0&&this.C(o8,void 0,t6,e9),e9}}}if(n5==="setter"){let{name:o8}=r6;return function(r7){let n6=this[o8];e8.call(this,r7),this.requestUpdate(o8,n6,t6,!0,r7)}}throw Error("Unsupported decorator location: "+n5)};function n4(t6){return(e8,o8)=>typeof o8=="object"?r4(t6,e8,o8):((t7,e9,o9)=>{let r6=e9.hasOwnProperty(o9);return e9.constructor.createProperty(o9,t7),r6?Object.getOwnPropertyDescriptor(e9,o9):void 0})(t6,e8,o8)}function r5(r6){return n4({...r6,state:!0,attribute:!1})}function t4(t6){return(n5,o8)=>{let c4=typeof n5=="function"?n5:n5[o8];Object.assign(c4,t6)}}var e6=(e8,t6,c4)=>(c4.configurable=!0,c4.enumerable=!0,Reflect.decorate&&typeof t6!="object"&&Object.defineProperty(e8,t6,c4),c4);function e7(e8,r6){return(n5,s4,i6)=>{let o8=t6=>t6.renderRoot?.querySelector(e8)??null;if(r6){let{get:e9,set:r7}=typeof s4=="object"?n5:i6??(()=>{let t6=Symbol();return{get(){return this[t6]},set(e10){this[t6]=e10}}})();return e6(n5,s4,{get(){let t6=e9.call(this);return t6===void 0&&(t6=o8(this),(t6!==null||this.hasUpdated)&&r7.call(this,t6)),t6}})}return e6(n5,s4,{get(){return o8(this)}})}}var s3=globalThis,i5=class extends y2{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var _a;let t6=super.createRenderRoot();return(_a=this.renderOptions).renderBefore??(_a.renderBefore=t6.firstChild),t6}update(t6){let r6=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t6),this._$Do=D(r6,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return E}};i5._$litElement$=!0,i5.finalized=!0,s3.litElementHydrateSupport?.({LitElement:i5});var o5=s3.litElementPolyfillSupport;o5?.({LitElement:i5});(s3.litElementVersions??(s3.litElementVersions=[])).push("4.2.2");var translations=new Map,fallback;function registerTranslation(...list){for(let t6 of list)translations.set(t6.$code.toLowerCase(),t6),fallback??(fallback=t6)}var LocalizeController=class{constructor(host){this.host=host,this.host.addController(this)}hostConnected(){}hostDisconnected(){}dir(){return`${this.host.dir||document.documentElement.dir||"ltr"}`.toLowerCase()}lang(){return`${this.host.lang||document.documentElement.lang||""}`.toLowerCase()}term(key,...args){let code=this.lang(),v2=(translations.get(code)??translations.get(code.split("-")[0])??fallback)?.[key];return typeof v2=="function"?v2(...args):v2??String(key)}};var translation={$code:"en",$name:"English",$dir:"ltr",carousel:"Carousel",clearEntry:"Clear entry",close:"Close",copied:"Copied",copy:"Copy",currentValue:"Current value",error:"Error",goToSlide:(slide,count)=>`Go to slide ${slide} of ${count}`,hidePassword:"Hide password",loading:"Loading",nextSlide:"Next slide",numOptionsSelected:num=>num===0?"No options selected":num===1?"1 option selected":`${num} options selected`,previousSlide:"Previous slide",progress:"Progress",remove:"Remove",resize:"Resize",scrollToEnd:"Scroll to end",scrollToStart:"Scroll to start",selectAColorFromTheScreen:"Select a color from the screen",showPassword:"Show password",slideNum:slide=>`Slide ${slide}`,toggleColorFormat:"Toggle color format"};registerTranslation(translation);var en_default=translation;var LocalizeController2=class extends LocalizeController{};registerTranslation(en_default);function*o6(o8,f3){if(o8!==void 0){let i6=0;for(let t6 of o8)yield f3(t6,i6++)}}function prefersReducedMotion(){return window.matchMedia("(prefers-reduced-motion: reduce)").matches}function*o7(o8,t6,e8=1){let i6=t6===void 0?0:o8;t6??(t6=o8);for(let o9=i6;e8>0?o9<t6:t6<o9;o9+=e8)yield o9}function waitForEvent(el,eventName){return new Promise(resolve=>{function done(event){event.target===el&&(el.removeEventListener(eventName,done),resolve())}el.addEventListener(eventName,done)})}function watch(propertyName,options){let resolvedOptions={waitUntilFirstUpdate:!1,...options};return(proto,decoratedFnName)=>{let{update}=proto,watchedProperties=Array.isArray(propertyName)?propertyName:[propertyName];proto.update=function(changedProps){watchedProperties.forEach(property=>{let key=property;if(changedProps.has(key)){let oldValue=changedProps.get(key),newValue=this[key];oldValue!==newValue&&(!resolvedOptions.waitUntilFirstUpdate||this.hasUpdated)&&this[decoratedFnName](oldValue,newValue)}}),update.call(this,changedProps)}}}var component_styles_default=i3`
  :host {
    box-sizing: border-box;
  }

  :host *,
  :host *::before,
  :host *::after {
    box-sizing: inherit;
  }

  [hidden] {
    display: none !important;
  }
`;var _hasRecordedInitialProperties,ShoelaceElement=class extends i5{constructor(){super();__privateAdd(this,_hasRecordedInitialProperties,!1);this.initialReflectedProperties=new Map;Object.entries(this.constructor.dependencies).forEach(([name,component])=>{this.constructor.define(name,component)})}emit(name,options){let event=new CustomEvent(name,{bubbles:!0,cancelable:!1,composed:!0,detail:{},...options});return this.dispatchEvent(event),event}static define(name,elementConstructor=this,options={}){let currentlyRegisteredConstructor=customElements.get(name);if(!currentlyRegisteredConstructor){try{customElements.define(name,elementConstructor,options)}catch{customElements.define(name,class extends elementConstructor{},options)}return}let newVersion=" (unknown version)",existingVersion=newVersion;"version"in elementConstructor&&elementConstructor.version&&(newVersion=" v"+elementConstructor.version),"version"in currentlyRegisteredConstructor&&currentlyRegisteredConstructor.version&&(existingVersion=" v"+currentlyRegisteredConstructor.version),!(newVersion&&existingVersion&&newVersion===existingVersion)&&console.warn(`Attempted to register <${name}>${newVersion}, but <${name}>${existingVersion} has already been registered.`)}attributeChangedCallback(name,oldValue,newValue){__privateGet(this,_hasRecordedInitialProperties)||(this.constructor.elementProperties.forEach((obj,prop)=>{obj.reflect&&this[prop]!=null&&this.initialReflectedProperties.set(prop,this[prop])}),__privateSet(this,_hasRecordedInitialProperties,!0)),super.attributeChangedCallback(name,oldValue,newValue)}willUpdate(changedProperties){super.willUpdate(changedProperties),this.initialReflectedProperties.forEach((value,prop)=>{changedProperties.has(prop)&&this[prop]==null&&(this[prop]=value)})}};_hasRecordedInitialProperties=new WeakMap,ShoelaceElement.version="2.20.1",ShoelaceElement.dependencies={},__decorateClass([n4()],ShoelaceElement.prototype,"dir",2),__decorateClass([n4()],ShoelaceElement.prototype,"lang",2);var basePath="";function setBasePath(path){basePath=path}function getBasePath(subpath=""){if(!basePath){let scripts=[...document.getElementsByTagName("script")],configScript=scripts.find(script=>script.hasAttribute("data-shoelace"));if(configScript)setBasePath(configScript.getAttribute("data-shoelace"));else{let fallbackScript=scripts.find(s4=>/shoelace(\.min)?\.js($|\?)/.test(s4.src)||/shoelace-autoloader(\.min)?\.js($|\?)/.test(s4.src)),path="";fallbackScript&&(path=fallbackScript.getAttribute("src")),setBasePath(path.split("/").slice(0,-1).join("/"))}}return basePath.replace(/\/$/,"")+(subpath?`/${subpath.replace(/^\//,"")}`:"")}var library={name:"default",resolver:name=>getBasePath(`assets/icons/${name}.svg`)},library_default_default=library;var icons={caret:`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `,check:`
    <svg part="checked-icon" class="checkbox__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round">
        <g stroke="currentColor">
          <g transform="translate(3.428571, 3.428571)">
            <path d="M0,5.71428571 L3.42857143,9.14285714"></path>
            <path d="M9.14285714,0 L3.42857143,9.14285714"></path>
          </g>
        </g>
      </g>
    </svg>
  `,"chevron-down":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-down" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
    </svg>
  `,"chevron-left":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
    </svg>
  `,"chevron-right":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
    </svg>
  `,copy:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-copy" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6ZM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z"/>
    </svg>
  `,eye:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye" viewBox="0 0 16 16">
      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
      <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
    </svg>
  `,"eye-slash":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye-slash" viewBox="0 0 16 16">
      <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
      <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
      <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
    </svg>
  `,eyedropper:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eyedropper" viewBox="0 0 16 16">
      <path d="M13.354.646a1.207 1.207 0 0 0-1.708 0L8.5 3.793l-.646-.647a.5.5 0 1 0-.708.708L8.293 5l-7.147 7.146A.5.5 0 0 0 1 12.5v1.793l-.854.853a.5.5 0 1 0 .708.707L1.707 15H3.5a.5.5 0 0 0 .354-.146L11 7.707l1.146 1.147a.5.5 0 0 0 .708-.708l-.647-.646 3.147-3.146a1.207 1.207 0 0 0 0-1.708l-2-2zM2 12.707l7-7L10.293 7l-7 7H2v-1.293z"></path>
    </svg>
  `,"grip-vertical":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16">
      <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"></path>
    </svg>
  `,indeterminate:`
    <svg part="indeterminate-icon" class="checkbox__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round">
        <g stroke="currentColor" stroke-width="2">
          <g transform="translate(2.285714, 6.857143)">
            <path d="M10.2857143,1.14285714 L1.14285714,1.14285714"></path>
          </g>
        </g>
      </g>
    </svg>
  `,"person-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-person-fill" viewBox="0 0 16 16">
      <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
    </svg>
  `,"play-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
      <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"></path>
    </svg>
  `,"pause-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pause-fill" viewBox="0 0 16 16">
      <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"></path>
    </svg>
  `,radio:`
    <svg part="checked-icon" class="radio__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g fill="currentColor">
          <circle cx="8" cy="8" r="3.42857143"></circle>
        </g>
      </g>
    </svg>
  `,"star-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-star-fill" viewBox="0 0 16 16">
      <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
    </svg>
  `,"x-lg":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16">
      <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
    </svg>
  `,"x-circle-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle-fill" viewBox="0 0 16 16">
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path>
    </svg>
  `},systemLibrary={name:"system",resolver:name=>name in icons?`data:image/svg+xml,${encodeURIComponent(icons[name])}`:""},library_system_default=systemLibrary;var registry=[library_default_default,library_system_default],watchedIcons=[];function watchIcon(icon){watchedIcons.push(icon)}function unwatchIcon(icon){watchedIcons=watchedIcons.filter(el=>el!==icon)}function getIconLibrary(name){return registry.find(lib=>lib.name===name)}var{I:t5}=j;var l3=(o8,t6)=>t6===void 0?o8?._$litType$!==void 0:o8?._$litType$===t6;var icon_styles_default=i3`
  :host {
    display: inline-block;
    width: 1em;
    height: 1em;
    box-sizing: content-box !important;
  }

  svg {
    display: block;
    height: 100%;
    width: 100%;
  }
`;var CACHEABLE_ERROR=Symbol(),RETRYABLE_ERROR=Symbol(),parser,iconCache=new Map,SlIcon=class extends ShoelaceElement{constructor(){super(...arguments);this.initialRender=!1;this.svg=null;this.label="";this.library="default"}async resolveIcon(url,library2){let fileData;if(library2?.spriteSheet)return this.svg=b`<svg part="svg">
        <use part="use" href="${url}"></use>
      </svg>`,this.svg;try{if(fileData=await fetch(url,{mode:"cors"}),!fileData.ok)return fileData.status===410?CACHEABLE_ERROR:RETRYABLE_ERROR}catch{return RETRYABLE_ERROR}try{let div=document.createElement("div");div.innerHTML=await fileData.text();let svg=div.firstElementChild;if(svg?.tagName?.toLowerCase()!=="svg")return CACHEABLE_ERROR;parser||(parser=new DOMParser);let svgEl=parser.parseFromString(svg.outerHTML,"text/html").body.querySelector("svg");return svgEl?(svgEl.part.add("svg"),document.adoptNode(svgEl)):CACHEABLE_ERROR}catch{return CACHEABLE_ERROR}}connectedCallback(){super.connectedCallback(),watchIcon(this)}firstUpdated(){this.initialRender=!0,this.setIcon()}disconnectedCallback(){super.disconnectedCallback(),unwatchIcon(this)}getIconSource(){let library2=getIconLibrary(this.library);return this.name&&library2?{url:library2.resolver(this.name),fromLibrary:!0}:{url:this.src,fromLibrary:!1}}handleLabelChange(){typeof this.label=="string"&&this.label.length>0?(this.setAttribute("role","img"),this.setAttribute("aria-label",this.label),this.removeAttribute("aria-hidden")):(this.removeAttribute("role"),this.removeAttribute("aria-label"),this.setAttribute("aria-hidden","true"))}async setIcon(){let{url,fromLibrary}=this.getIconSource(),library2=fromLibrary?getIconLibrary(this.library):void 0;if(!url){this.svg=null;return}let iconResolver=iconCache.get(url);if(iconResolver||(iconResolver=this.resolveIcon(url,library2),iconCache.set(url,iconResolver)),!this.initialRender)return;let svg=await iconResolver;if(svg===RETRYABLE_ERROR&&iconCache.delete(url),url===this.getIconSource().url){if(l3(svg)){if(this.svg=svg,library2){await this.updateComplete;let shadowSVG=this.shadowRoot.querySelector("[part='svg']");typeof library2.mutator=="function"&&shadowSVG&&library2.mutator(shadowSVG)}return}switch(svg){case RETRYABLE_ERROR:case CACHEABLE_ERROR:this.svg=null,this.emit("sl-error");break;default:this.svg=svg.cloneNode(!0),library2?.mutator?.(this.svg),this.emit("sl-load")}}}render(){return this.svg}};SlIcon.styles=[component_styles_default,icon_styles_default],__decorateClass([r5()],SlIcon.prototype,"svg",2),__decorateClass([n4({reflect:!0})],SlIcon.prototype,"name",2),__decorateClass([n4()],SlIcon.prototype,"src",2),__decorateClass([n4()],SlIcon.prototype,"label",2),__decorateClass([n4({reflect:!0})],SlIcon.prototype,"library",2),__decorateClass([watch("label")],SlIcon.prototype,"handleLabelChange",1),__decorateClass([watch(["name","src","library"])],SlIcon.prototype,"setIcon",1);var carousel_styles_default=i3`
  :host {
    --slide-gap: var(--sl-spacing-medium, 1rem);
    --aspect-ratio: 16 / 9;
    --scroll-hint: 0px;

    display: flex;
  }

  .carousel {
    display: grid;
    grid-template-columns: min-content 1fr min-content;
    grid-template-rows: 1fr min-content;
    grid-template-areas:
      '. slides .'
      '. pagination .';
    gap: var(--sl-spacing-medium);
    align-items: center;
    min-height: 100%;
    min-width: 100%;
    position: relative;
  }

  .carousel__pagination {
    grid-area: pagination;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--sl-spacing-small);
  }

  .carousel__slides {
    grid-area: slides;

    display: grid;
    height: 100%;
    width: 100%;
    align-items: center;
    justify-items: center;
    overflow: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    aspect-ratio: calc(var(--aspect-ratio) * var(--slides-per-page));
    border-radius: var(--sl-border-radius-small);

    --slide-size: calc((100% - (var(--slides-per-page) - 1) * var(--slide-gap)) / var(--slides-per-page));
  }

  @media (prefers-reduced-motion) {
    :where(.carousel__slides) {
      scroll-behavior: auto;
    }
  }

  .carousel__slides--horizontal {
    grid-auto-flow: column;
    grid-auto-columns: var(--slide-size);
    grid-auto-rows: 100%;
    column-gap: var(--slide-gap);
    scroll-snap-type: x mandatory;
    scroll-padding-inline: var(--scroll-hint);
    padding-inline: var(--scroll-hint);
    overflow-y: hidden;
  }

  .carousel__slides--vertical {
    grid-auto-flow: row;
    grid-auto-columns: 100%;
    grid-auto-rows: var(--slide-size);
    row-gap: var(--slide-gap);
    scroll-snap-type: y mandatory;
    scroll-padding-block: var(--scroll-hint);
    padding-block: var(--scroll-hint);
    overflow-x: hidden;
  }

  .carousel__slides--dragging {
  }

  :host([vertical]) ::slotted(sl-carousel-item) {
    height: 100%;
  }

  .carousel__slides::-webkit-scrollbar {
    display: none;
  }

  .carousel__navigation {
    grid-area: navigation;
    display: contents;
    font-size: var(--sl-font-size-x-large);
  }

  .carousel__navigation-button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    border-radius: var(--sl-border-radius-small);
    font-size: inherit;
    color: var(--sl-color-neutral-600);
    padding: var(--sl-spacing-x-small);
    cursor: pointer;
    transition: var(--sl-transition-medium) color;
    appearance: none;
  }

  .carousel__navigation-button--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .carousel__navigation-button--disabled::part(base) {
    pointer-events: none;
  }

  .carousel__navigation-button--previous {
    grid-column: 1;
    grid-row: 1;
  }

  .carousel__navigation-button--next {
    grid-column: 3;
    grid-row: 1;
  }

  .carousel__pagination-item {
    display: block;
    cursor: pointer;
    background: none;
    border: 0;
    border-radius: var(--sl-border-radius-circle);
    width: var(--sl-spacing-small);
    height: var(--sl-spacing-small);
    background-color: var(--sl-color-neutral-300);
    padding: 0;
    margin: 0;
  }

  .carousel__pagination-item--active {
    background-color: var(--sl-color-neutral-700);
    transform: scale(1.2);
  }

  /* Focus styles */
  .carousel__slides:focus-visible,
  .carousel__navigation-button:focus-visible,
  .carousel__pagination-item:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }
`;var SlCarousel=class extends ShoelaceElement{constructor(){super(...arguments);this.loop=!1;this.navigation=!1;this.pagination=!1;this.autoplay=!1;this.autoplayInterval=3e3;this.slidesPerPage=1;this.slidesPerMove=1;this.orientation="horizontal";this.mouseDragging=!1;this.activeSlide=0;this.scrolling=!1;this.dragging=!1;this.autoplayController=new AutoplayController(this,()=>this.next());this.dragStartPosition=[-1,-1];this.localize=new LocalizeController2(this);this.pendingSlideChange=!1;this.handleMouseDrag=event=>{this.dragging||(this.scrollContainer.style.setProperty("scroll-snap-type","none"),this.dragging=!0,this.dragStartPosition=[event.clientX,event.clientY]),this.scrollContainer.scrollBy({left:-event.movementX,top:-event.movementY,behavior:"instant"})};this.handleMouseDragEnd=()=>{let scrollContainer=this.scrollContainer;document.removeEventListener("pointermove",this.handleMouseDrag,{capture:!0});let startLeft=scrollContainer.scrollLeft,startTop=scrollContainer.scrollTop;scrollContainer.style.removeProperty("scroll-snap-type"),scrollContainer.style.setProperty("overflow","hidden");let finalLeft=scrollContainer.scrollLeft,finalTop=scrollContainer.scrollTop;scrollContainer.style.removeProperty("overflow"),scrollContainer.style.setProperty("scroll-snap-type","none"),scrollContainer.scrollTo({left:startLeft,top:startTop,behavior:"instant"}),requestAnimationFrame(async()=>{(startLeft!==finalLeft||startTop!==finalTop)&&(scrollContainer.scrollTo({left:finalLeft,top:finalTop,behavior:prefersReducedMotion()?"auto":"smooth"}),await waitForEvent(scrollContainer,"scrollend")),scrollContainer.style.removeProperty("scroll-snap-type"),this.dragging=!1,this.dragStartPosition=[-1,-1],this.handleScrollEnd()})};this.handleSlotChange=mutations=>{mutations.some(mutation=>[...mutation.addedNodes,...mutation.removedNodes].some(el=>this.isCarouselItem(el)&&!el.hasAttribute("data-clone")))&&this.initializeSlides(),this.requestUpdate()}}connectedCallback(){super.connectedCallback(),this.setAttribute("role","region"),this.setAttribute("aria-label",this.localize.term("carousel"))}disconnectedCallback(){super.disconnectedCallback(),this.mutationObserver?.disconnect()}firstUpdated(){this.initializeSlides(),this.mutationObserver=new MutationObserver(this.handleSlotChange),this.mutationObserver.observe(this,{childList:!0,subtree:!0})}willUpdate(changedProperties){(changedProperties.has("slidesPerMove")||changedProperties.has("slidesPerPage"))&&(this.slidesPerMove=Math.min(this.slidesPerMove,this.slidesPerPage))}getPageCount(){let slidesCount=this.getSlides().length,{slidesPerPage,slidesPerMove,loop}=this,pages=loop?slidesCount/slidesPerMove:(slidesCount-slidesPerPage)/slidesPerMove+1;return Math.ceil(pages)}getCurrentPage(){return Math.ceil(this.activeSlide/this.slidesPerMove)}canScrollNext(){return this.loop||this.getCurrentPage()<this.getPageCount()-1}canScrollPrev(){return this.loop||this.getCurrentPage()>0}getSlides({excludeClones=!0}={}){return[...this.children].filter(el=>this.isCarouselItem(el)&&(!excludeClones||!el.hasAttribute("data-clone")))}handleClick(event){if(this.dragging&&this.dragStartPosition[0]>0&&this.dragStartPosition[1]>0){let deltaX=Math.abs(this.dragStartPosition[0]-event.clientX),deltaY=Math.abs(this.dragStartPosition[1]-event.clientY);Math.sqrt(deltaX*deltaX+deltaY*deltaY)>=10&&event.preventDefault()}}handleKeyDown(event){if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(event.key)){let target=event.target,isRtl=this.localize.dir()==="rtl",isFocusInPagination=target.closest('[part~="pagination-item"]')!==null,isNext=event.key==="ArrowDown"||!isRtl&&event.key==="ArrowRight"||isRtl&&event.key==="ArrowLeft",isPrevious=event.key==="ArrowUp"||!isRtl&&event.key==="ArrowLeft"||isRtl&&event.key==="ArrowRight";event.preventDefault(),isPrevious&&this.previous(),isNext&&this.next(),event.key==="Home"&&this.goToSlide(0),event.key==="End"&&this.goToSlide(this.getSlides().length-1),isFocusInPagination&&this.updateComplete.then(()=>{let activePaginationItem=this.shadowRoot?.querySelector('[part~="pagination-item--active"]');activePaginationItem&&activePaginationItem.focus()})}}handleMouseDragStart(event){this.mouseDragging&&event.button===0&&(event.preventDefault(),document.addEventListener("pointermove",this.handleMouseDrag,{capture:!0,passive:!0}),document.addEventListener("pointerup",this.handleMouseDragEnd,{capture:!0,once:!0}))}handleScroll(){this.scrolling=!0,this.pendingSlideChange||this.synchronizeSlides()}synchronizeSlides(){let io=new IntersectionObserver(entries=>{io.disconnect();for(let entry of entries){let slide=entry.target;slide.toggleAttribute("inert",!entry.isIntersecting),slide.classList.toggle("--in-view",entry.isIntersecting),slide.setAttribute("aria-hidden",entry.isIntersecting?"false":"true")}let firstIntersecting=entries.find(entry=>entry.isIntersecting);if(!firstIntersecting)return;let slidesWithClones=this.getSlides({excludeClones:!1}),slidesCount=this.getSlides().length,slideIndex=slidesWithClones.indexOf(firstIntersecting.target),normalizedIndex=this.loop?slideIndex-this.slidesPerPage:slideIndex;if(this.activeSlide=(Math.ceil(normalizedIndex/this.slidesPerMove)*this.slidesPerMove+slidesCount)%slidesCount,!this.scrolling&&this.loop&&firstIntersecting.target.hasAttribute("data-clone")){let clonePosition=Number(firstIntersecting.target.getAttribute("data-clone"));this.goToSlide(clonePosition,"instant")}},{root:this.scrollContainer,threshold:.6});this.getSlides({excludeClones:!1}).forEach(slide=>{io.observe(slide)})}handleScrollEnd(){!this.scrolling||this.dragging||(this.scrolling=!1,this.pendingSlideChange=!1,this.synchronizeSlides())}isCarouselItem(node){return node instanceof Element&&node.tagName.toLowerCase()==="sl-carousel-item"}initializeSlides(){this.getSlides({excludeClones:!1}).forEach((slide,index)=>{slide.classList.remove("--in-view"),slide.classList.remove("--is-active"),slide.setAttribute("role","group"),slide.setAttribute("aria-label",this.localize.term("slideNum",index+1)),this.pagination&&(slide.setAttribute("id",`slide-${index+1}`),slide.setAttribute("role","tabpanel"),slide.removeAttribute("aria-label"),slide.setAttribute("aria-labelledby",`tab-${index+1}`)),slide.hasAttribute("data-clone")&&slide.remove()}),this.updateSlidesSnap(),this.loop&&this.createClones(),this.goToSlide(this.activeSlide,"auto"),this.synchronizeSlides()}createClones(){let slides=this.getSlides(),slidesPerPage=this.slidesPerPage,lastSlides=slides.slice(-slidesPerPage),firstSlides=slides.slice(0,slidesPerPage);lastSlides.reverse().forEach((slide,i6)=>{let clone=slide.cloneNode(!0);clone.setAttribute("data-clone",String(slides.length-i6-1)),this.prepend(clone)}),firstSlides.forEach((slide,i6)=>{let clone=slide.cloneNode(!0);clone.setAttribute("data-clone",String(i6)),this.append(clone)})}handleSlideChange(){let slides=this.getSlides();slides.forEach((slide,i6)=>{slide.classList.toggle("--is-active",i6===this.activeSlide)}),this.hasUpdated&&this.emit("sl-slide-change",{detail:{index:this.activeSlide,slide:slides[this.activeSlide]}})}updateSlidesSnap(){let slides=this.getSlides(),slidesPerMove=this.slidesPerMove;slides.forEach((slide,i6)=>{(i6+slidesPerMove)%slidesPerMove===0?slide.style.removeProperty("scroll-snap-align"):slide.style.setProperty("scroll-snap-align","none")})}handleAutoplayChange(){this.autoplayController.stop(),this.autoplay&&this.autoplayController.start(this.autoplayInterval)}previous(behavior="smooth"){this.goToSlide(this.activeSlide-this.slidesPerMove,behavior)}next(behavior="smooth"){this.goToSlide(this.activeSlide+this.slidesPerMove,behavior)}goToSlide(index,behavior="smooth"){let{slidesPerPage,loop}=this,slides=this.getSlides(),slidesWithClones=this.getSlides({excludeClones:!1});if(!slides.length)return;let newActiveSlide=loop?(index+slides.length)%slides.length:clamp(index,0,slides.length-slidesPerPage);this.activeSlide=newActiveSlide;let isRtl=this.localize.dir()==="rtl",nextSlideIndex=clamp(index+(loop?slidesPerPage:0)+(isRtl?slidesPerPage-1:0),0,slidesWithClones.length-1),nextSlide=slidesWithClones[nextSlideIndex];this.scrollToSlide(nextSlide,prefersReducedMotion()?"auto":behavior)}scrollToSlide(slide,behavior="smooth"){this.pendingSlideChange=!0,window.requestAnimationFrame(()=>{if(!this.scrollContainer)return;let scrollContainer=this.scrollContainer,scrollContainerRect=scrollContainer.getBoundingClientRect(),nextSlideRect=slide.getBoundingClientRect(),nextLeft=nextSlideRect.left-scrollContainerRect.left,nextTop=nextSlideRect.top-scrollContainerRect.top;nextLeft||nextTop?(this.pendingSlideChange=!0,scrollContainer.scrollTo({left:nextLeft+scrollContainer.scrollLeft,top:nextTop+scrollContainer.scrollTop,behavior})):this.pendingSlideChange=!1})}render(){let{slidesPerMove,scrolling}=this,pagesCount=this.getPageCount(),currentPage=this.getCurrentPage(),prevEnabled=this.canScrollPrev(),nextEnabled=this.canScrollNext(),isLtr=this.localize.dir()==="ltr";return b`
      <div part="base" class="carousel">
        <div
          id="scroll-container"
          part="scroll-container"
          class="${e3({carousel__slides:!0,"carousel__slides--horizontal":this.orientation==="horizontal","carousel__slides--vertical":this.orientation==="vertical","carousel__slides--dragging":this.dragging})}"
          style="--slides-per-page: ${this.slidesPerPage};"
          aria-busy="${scrolling?"true":"false"}"
          aria-atomic="true"
          tabindex="0"
          @keydown=${this.handleKeyDown}
          @mousedown="${this.handleMouseDragStart}"
          @scroll="${this.handleScroll}"
          @scrollend=${this.handleScrollEnd}
          @click=${this.handleClick}
        >
          <slot></slot>
        </div>

        ${this.navigation?b`
              <div part="navigation" class="carousel__navigation">
                <button
                  part="navigation-button navigation-button--previous"
                  class="${e3({"carousel__navigation-button":!0,"carousel__navigation-button--previous":!0,"carousel__navigation-button--disabled":!prevEnabled})}"
                  aria-label="${this.localize.term("previousSlide")}"
                  aria-controls="scroll-container"
                  aria-disabled="${prevEnabled?"false":"true"}"
                  @click=${prevEnabled?()=>this.previous():null}
                >
                  <slot name="previous-icon">
                    <sl-icon library="system" name="${isLtr?"chevron-left":"chevron-right"}"></sl-icon>
                  </slot>
                </button>

                <button
                  part="navigation-button navigation-button--next"
                  class=${e3({"carousel__navigation-button":!0,"carousel__navigation-button--next":!0,"carousel__navigation-button--disabled":!nextEnabled})}
                  aria-label="${this.localize.term("nextSlide")}"
                  aria-controls="scroll-container"
                  aria-disabled="${nextEnabled?"false":"true"}"
                  @click=${nextEnabled?()=>this.next():null}
                >
                  <slot name="next-icon">
                    <sl-icon library="system" name="${isLtr?"chevron-right":"chevron-left"}"></sl-icon>
                  </slot>
                </button>
              </div>
            `:""}
        ${this.pagination?b`
              <div part="pagination" role="tablist" class="carousel__pagination">
                ${o6(o7(pagesCount),index=>{let isActive=index===currentPage;return b`
                    <button
                      part="pagination-item ${isActive?"pagination-item--active":""}"
                      class="${e3({"carousel__pagination-item":!0,"carousel__pagination-item--active":isActive})}"
                      role="tab"
                      id="tab-${index+1}"
                      aria-controls="slide-${index+1}"
                      aria-selected="${isActive?"true":"false"}"
                      aria-label="${isActive?this.localize.term("slideNum",index+1):this.localize.term("goToSlide",index+1,pagesCount)}"
                      tabindex=${isActive?"0":"-1"}
                      @click=${()=>this.goToSlide(index*slidesPerMove)}
                      @keydown=${this.handleKeyDown}
                    ></button>
                  `})}
              </div>
            `:""}
      </div>
    `}};SlCarousel.styles=[component_styles_default,carousel_styles_default],SlCarousel.dependencies={"sl-icon":SlIcon},__decorateClass([n4({type:Boolean,reflect:!0})],SlCarousel.prototype,"loop",2),__decorateClass([n4({type:Boolean,reflect:!0})],SlCarousel.prototype,"navigation",2),__decorateClass([n4({type:Boolean,reflect:!0})],SlCarousel.prototype,"pagination",2),__decorateClass([n4({type:Boolean,reflect:!0})],SlCarousel.prototype,"autoplay",2),__decorateClass([n4({type:Number,attribute:"autoplay-interval"})],SlCarousel.prototype,"autoplayInterval",2),__decorateClass([n4({type:Number,attribute:"slides-per-page"})],SlCarousel.prototype,"slidesPerPage",2),__decorateClass([n4({type:Number,attribute:"slides-per-move"})],SlCarousel.prototype,"slidesPerMove",2),__decorateClass([n4()],SlCarousel.prototype,"orientation",2),__decorateClass([n4({type:Boolean,reflect:!0,attribute:"mouse-dragging"})],SlCarousel.prototype,"mouseDragging",2),__decorateClass([e7(".carousel__slides")],SlCarousel.prototype,"scrollContainer",2),__decorateClass([e7(".carousel__pagination")],SlCarousel.prototype,"paginationContainer",2),__decorateClass([r5()],SlCarousel.prototype,"activeSlide",2),__decorateClass([r5()],SlCarousel.prototype,"scrolling",2),__decorateClass([r5()],SlCarousel.prototype,"dragging",2),__decorateClass([t4({passive:!0})],SlCarousel.prototype,"handleScroll",1),__decorateClass([watch("loop",{waitUntilFirstUpdate:!0}),watch("slidesPerPage",{waitUntilFirstUpdate:!0})],SlCarousel.prototype,"initializeSlides",1),__decorateClass([watch("activeSlide")],SlCarousel.prototype,"handleSlideChange",1),__decorateClass([watch("slidesPerMove")],SlCarousel.prototype,"updateSlidesSnap",1),__decorateClass([watch("autoplay")],SlCarousel.prototype,"handleAutoplayChange",1);SlCarousel.define("sl-carousel");var carousel_item_styles_default=i3`
  :host {
    --aspect-ratio: inherit;

    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    width: 100%;
    max-height: 100%;
    aspect-ratio: var(--aspect-ratio);
    scroll-snap-align: start;
    scroll-snap-stop: always;
  }

  ::slotted(img) {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover;
  }
`;var SlCarouselItem=class extends ShoelaceElement{connectedCallback(){super.connectedCallback()}render(){return b` <slot></slot> `}};SlCarouselItem.styles=[component_styles_default,carousel_item_styles_default];SlCarouselItem.define("sl-carousel-item");window.abLibrary="shoelace";
