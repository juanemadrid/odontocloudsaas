const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/pdf-utils-kdeBq5B8.js","assets/vendor-4foCZWy0.js"])))=>i.map(i=>d[i]);
import{_ as Se}from"./pdf-utils-kdeBq5B8.js";import{j as e,R as ft,r as F}from"./vendor-4foCZWy0.js";import{a as tt,u as st,d as se,B as gt}from"./module-agenda-CoXt7S15.js";import{f as Ee,k as ht,q as ut,j as bt,m as ie,r as ze,s as ue,e as Be,n as vt,l as Ze,u as jt}from"./firebase-vendor-gB1gGoJy.js";import{F as wt,q as yt,i as Nt,c as Me,a9 as kt,C as $t,G as Ct,p as Ae,z as Fe,f as Lt,aa as Te,R as ot,E as Qe,D as Oe,ab as rt,ac as lt,ad as St,l as Et}from"./icons-vendor-CFjkKfLY.js";const be=(t,s,o,d,x,m)=>{const a=(x-90)*Math.PI/180,v=(m-90)*Math.PI/180,M=t+d*Math.cos(a),p=s+d*Math.sin(a),$=t+d*Math.cos(v),f=s+d*Math.sin(v),C=t+o*Math.cos(v),y=s+o*Math.sin(v),w=t+o*Math.cos(a),E=s+o*Math.sin(a),B=m-x<=180?0:1;return`M ${M} ${p} A ${d} ${d} 0 ${B} 1 ${$} ${f} L ${C} ${y} A ${o} ${o} 0 ${B} 0 ${w} ${E} Z`};function Re({activeToothId:t,toothData:s,onZoneClick:o,isReadOnly:d,isUpper:x,isRightSide:m}){const a=y=>{var E;const w=(E=s==null?void 0:s[y])==null?void 0:E.id;return w?w.includes("caries")?"#EF4444":w.includes("amalgama")?"#2563EB":w.includes("resina")||w.includes("rest_")?"#34D399":w.includes("sellante")?"#A855F7":s[y].color||"#94A3B8":"transparent"},v=y=>!!(s!=null&&s[y]),M=y=>{var w,E;return{fill:a(y),stroke:"#1e293b",strokeWidth:"2.5",opacity:v(y)&&((E=(w=s==null?void 0:s[y])==null?void 0:w.id)!=null&&E.includes("malo"))?.7:1,className:`transition-all duration-300 ${d?"":"cursor-pointer hover:fill-slate-200"} origin-center`,onClick:()=>!d&&o(t,y)}};return e.jsx("div",{className:"w-full aspect-square",children:e.jsxs("svg",{viewBox:"0 0 100 100",className:"w-full h-full overflow-visible",children:[e.jsx("path",{d:be(50,50,18,44,-45,45),...M("top")}),e.jsx("path",{d:be(50,50,18,44,45,135),...M("right")}),e.jsx("path",{d:be(50,50,18,44,135,225),...M("bottom")}),e.jsx("path",{d:be(50,50,18,44,225,315),...M("left")}),e.jsx("circle",{cx:50,cy:50,r:18,...M("center")})]})})}const ve="/odontocloudsaas/",oe={permSup:{img:`${ve}assets/dontograma/permanente/superior.png`,numCols:16,posY:"100%"},permInf:{img:`${ve}assets/dontograma/permanente/inferior.png`,numCols:16,posY:"0%"},tempSup:{img:`${ve}assets/dontograma/temporal/superior.png`,numCols:10,posY:"100%"},tempInf:{img:`${ve}assets/dontograma/temporal/inferior.png`,numCols:10,posY:"0%"}};function Mt(t){const s=parseInt(t,10);return s>=11&&s<=18?{...oe.permSup,col:18-s}:s>=21&&s<=28?{...oe.permSup,col:8+(s-21)}:s>=41&&s<=48?{...oe.permInf,col:48-s}:s>=31&&s<=38?{...oe.permInf,col:8+(s-31)}:s>=51&&s<=55?{...oe.tempSup,col:55-s}:s>=61&&s<=65?{...oe.tempSup,col:5+(s-61)}:s>=81&&s<=85?{...oe.tempInf,col:85-s}:s>=71&&s<=75?{...oe.tempInf,col:5+(s-71)}:null}const We={55:0,54:10,53:19,52:29,51:38,61:48,62:57,63:67,64:76,65:85,85:0,84:11,83:22,82:33,81:44,71:55,72:67,73:78,74:89,75:100},He={18:-1.08,17:5.66,16:12.41,15:19.16,14:25.91,13:32.66,12:39.4,11:46.15,21:53.14,22:59.89,23:66.63,24:73.38,25:80.13,26:86.88,27:93.63,28:100.37,48:-1.21,47:5.53,46:12.26,45:18.99,44:25.73,43:32.46,42:39.19,41:45.92,31:52.89,32:59.63,33:66.36,34:73.09,35:79.83,36:86.56,37:93.29,38:100.03},It=.85;function Z(t){return t!=null&&t.id?t.color||"#ef4444":"transparent"}function Q(t){return t!=null&&t.id?It:0}function O(t){return t!=null&&t.id?t.color||"#ef4444":"transparent"}function At({data:t,onClick:s}){return e.jsxs("g",{children:[e.jsx("path",{d:"M 22,5 Q 50,0 78,5 Q 50,35 22,5 Z",fill:Z(t==null?void 0:t.top),opacity:Q(t==null?void 0:t.top),stroke:O(t==null?void 0:t.top),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 22,95 Q 50,100 78,95 Q 50,65 22,95 Z",fill:Z(t==null?void 0:t.bottom),opacity:Q(t==null?void 0:t.bottom),stroke:O(t==null?void 0:t.bottom),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 22,5 Q 12,50 22,95 Q 38,50 22,5 Z",fill:Z(t==null?void 0:t.left),opacity:Q(t==null?void 0:t.left),stroke:O(t==null?void 0:t.left),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 78,5 Q 88,50 78,95 Q 62,50 78,5 Z",fill:Z(t==null?void 0:t.right),opacity:Q(t==null?void 0:t.right),stroke:O(t==null?void 0:t.right),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 32,50 Q 50,32 68,50 Q 50,68 32,50 Z",fill:Z(t==null?void 0:t.center),opacity:Q(t==null?void 0:t.center),stroke:O(t==null?void 0:t.center),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 22,5 Q 50,0 78,5 L 68,45 Q 50,35 32,45 Z",fill:"transparent",onClick:()=>s("top"),className:"cursor-pointer"}),e.jsx("path",{d:"M 22,95 Q 50,100 78,95 L 68,55 Q 50,65 32,55 Z",fill:"transparent",onClick:()=>s("bottom"),className:"cursor-pointer"}),e.jsx("path",{d:"M 22,5 L 32,45 L 32,55 L 22,95 Q 12,50 22,5 Z",fill:"transparent",onClick:()=>s("left"),className:"cursor-pointer"}),e.jsx("path",{d:"M 78,5 L 68,45 L 68,55 L 78,95 Q 88,50 78,5 Z",fill:"transparent",onClick:()=>s("right"),className:"cursor-pointer"}),e.jsx("path",{d:"M 32,45 Q 50,35 68,45 L 68,55 Q 50,65 32,55 Z",fill:"transparent",onClick:()=>s("center"),className:"cursor-pointer"})]})}function Ft({data:t,onClick:s}){return e.jsxs("g",{children:[e.jsx("path",{d:"M 28,5 Q 50,0 72,5 Q 50,30 28,5 Z",fill:Z(t==null?void 0:t.top),opacity:Q(t==null?void 0:t.top),stroke:O(t==null?void 0:t.top),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 28,95 Q 50,100 72,95 Q 50,70 28,95 Z",fill:Z(t==null?void 0:t.bottom),opacity:Q(t==null?void 0:t.bottom),stroke:O(t==null?void 0:t.bottom),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 28,5 Q 18,50 28,95 Q 42,50 28,5 Z",fill:Z(t==null?void 0:t.left),opacity:Q(t==null?void 0:t.left),stroke:O(t==null?void 0:t.left),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 72,5 Q 82,50 72,95 Q 58,50 72,5 Z",fill:Z(t==null?void 0:t.right),opacity:Q(t==null?void 0:t.right),stroke:O(t==null?void 0:t.right),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 34,50 Q 50,32 66,50 Q 50,68 34,50 Z",fill:Z(t==null?void 0:t.center),opacity:Q(t==null?void 0:t.center),stroke:O(t==null?void 0:t.center),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 28,5 Q 50,0 72,5 L 64,45 Q 50,35 36,45 Z",fill:"transparent",onClick:()=>s("top"),className:"cursor-pointer"}),e.jsx("path",{d:"M 28,95 Q 50,100 72,95 L 64,55 Q 50,65 36,55 Z",fill:"transparent",onClick:()=>s("bottom"),className:"cursor-pointer"}),e.jsx("path",{d:"M 28,5 L 36,45 L 36,55 L 28,95 Q 18,50 28,5 Z",fill:"transparent",onClick:()=>s("left"),className:"cursor-pointer"}),e.jsx("path",{d:"M 72,5 L 64,45 L 64,55 L 72,95 Q 82,50 72,5 Z",fill:"transparent",onClick:()=>s("right"),className:"cursor-pointer"}),e.jsx("path",{d:"M 36,45 Q 50,35 64,45 L 64,55 Q 50,65 36,55 Z",fill:"transparent",onClick:()=>s("center"),className:"cursor-pointer"})]})}function Tt({data:t,onClick:s}){return e.jsxs("g",{children:[e.jsx("path",{d:"M 33,8 Q 50,0 67,8 Q 50,32 33,8 Z",fill:Z(t==null?void 0:t.top),opacity:Q(t==null?void 0:t.top),stroke:O(t==null?void 0:t.top),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 30,95 Q 50,100 70,95 Q 50,68 30,95 Z",fill:Z(t==null?void 0:t.bottom),opacity:Q(t==null?void 0:t.bottom),stroke:O(t==null?void 0:t.bottom),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 33,8 Q 22,50 30,95 Q 45,50 33,8 Z",fill:Z(t==null?void 0:t.left),opacity:Q(t==null?void 0:t.left),stroke:O(t==null?void 0:t.left),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 67,8 Q 78,50 70,95 Q 55,50 67,8 Z",fill:Z(t==null?void 0:t.right),opacity:Q(t==null?void 0:t.right),stroke:O(t==null?void 0:t.right),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 38,52 L 50,32 L 62,52 Q 50,68 38,52 Z",fill:Z(t==null?void 0:t.center),opacity:Q(t==null?void 0:t.center),stroke:O(t==null?void 0:t.center),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 33,8 Q 50,0 67,8 L 62,49 L 50,38 L 38,49 Z",fill:"transparent",onClick:()=>s("top"),className:"cursor-pointer"}),e.jsx("path",{d:"M 30,95 Q 50,100 70,95 L 62,60 Q 50,71 38,60 Z",fill:"transparent",onClick:()=>s("bottom"),className:"cursor-pointer"}),e.jsx("path",{d:"M 33,8 L 38,49 L 38,60 L 30,95 Q 22,50 33,8 Z",fill:"transparent",onClick:()=>s("left"),className:"cursor-pointer"}),e.jsx("path",{d:"M 67,8 L 62,49 L 62,60 L 70,95 Q 78,50 67,8 Z",fill:"transparent",onClick:()=>s("right"),className:"cursor-pointer"}),e.jsx("path",{d:"M 38,49 L 50,38 L 62,49 L 62,60 Q 50,71 38,60 Z",fill:"transparent",onClick:()=>s("center"),className:"cursor-pointer"})]})}function _t({data:t,onClick:s}){return e.jsxs("g",{children:[e.jsx("path",{d:"M 25,4 L 75,4 L 75,32 Q 50,38 25,32 Z",fill:Z(t==null?void 0:t.top),opacity:Q(t==null?void 0:t.top),stroke:O(t==null?void 0:t.top),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 28,96 Q 50,100 72,96 Q 50,68 28,96 Z",fill:Z(t==null?void 0:t.bottom),opacity:Q(t==null?void 0:t.bottom),stroke:O(t==null?void 0:t.bottom),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 25,4 Q 17,50 28,96 Q 40,50 25,4 Z",fill:Z(t==null?void 0:t.left),opacity:Q(t==null?void 0:t.left),stroke:O(t==null?void 0:t.left),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 75,4 Q 83,50 72,96 Q 60,50 75,4 Z",fill:Z(t==null?void 0:t.right),opacity:Q(t==null?void 0:t.right),stroke:O(t==null?void 0:t.right),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 33,50 Q 50,32 67,50 Q 50,68 33,50 Z",fill:Z(t==null?void 0:t.center),opacity:Q(t==null?void 0:t.center),stroke:O(t==null?void 0:t.center),strokeWidth:"1",className:"pointer-events-none"}),e.jsx("path",{d:"M 25,4 L 75,4 L 67,46 Q 50,35 33,46 Z",fill:"transparent",onClick:()=>s("top"),className:"cursor-pointer"}),e.jsx("path",{d:"M 28,96 Q 50,100 72,96 L 67,54 Q 50,65 33,54 Z",fill:"transparent",onClick:()=>s("bottom"),className:"cursor-pointer"}),e.jsx("path",{d:"M 25,4 L 33,46 L 33,54 L 28,96 Q 17,50 25,4 Z",fill:"transparent",onClick:()=>s("left"),className:"cursor-pointer"}),e.jsx("path",{d:"M 75,4 L 67,46 L 67,54 L 72,96 Q 83,50 75,4 Z",fill:"transparent",onClick:()=>s("right"),className:"cursor-pointer"}),e.jsx("path",{d:"M 33,46 Q 50,35 67,46 L 67,54 Q 50,65 33,54 Z",fill:"transparent",onClick:()=>s("center"),className:"cursor-pointer"})]})}function Dt(t){const s=parseInt(t,10),o=s%10,d=s>=51&&s<=65||s>=71&&s<=85;return o===1||o===2?"incisor":o===3?"canine":(o===4||o===5)&&!d?"premolar":"molar"}function zt({numero:t,data:s={},onZoneClick:o,isReadOnly:d}){const x=Mt(t),m=Dt(t);if(!x)return e.jsx("div",{className:"w-full h-full flex items-center justify-center text-slate-300 text-[10px] font-bold",children:t});const a=x.numCols*100,v=We[t]!==void 0?We[t]:He[t]!==void 0?He[t]:x.numCols>1?x.col/(x.numCols-1)*100:0,M=C=>{d||o(t,C)},p=m==="molar"?At:m==="premolar"?Ft:m==="canine"?Tt:_t,$=parseInt(t,10),f=$>=11&&$<=28||$>=51&&$<=65;return e.jsxs("div",{className:"relative w-full h-full overflow-hidden select-none",style:{transform:"none"},children:[e.jsx("div",{className:"absolute inset-0",style:{backgroundImage:`url('${x.img}')`,backgroundSize:`${a}% auto`,backgroundRepeat:"no-repeat",backgroundPosition:`${v.toFixed(2)}% ${x.posY}`}}),!d&&e.jsx("svg",{viewBox:"0 0 100 100",xmlns:"http://www.w3.org/2000/svg",className:`absolute ${f?"bottom-0":"top-0"} left-0 right-0 w-full h-[35%]`,preserveAspectRatio:"xMidYMid meet",onClick:C=>C.stopPropagation(),children:e.jsx(p,{data:s,onClick:M})}),d&&e.jsx("svg",{viewBox:"0 0 100 100",xmlns:"http://www.w3.org/2000/svg",className:`absolute ${f?"bottom-0":"top-0"} left-0 right-0 w-full h-[35%]`,preserveAspectRatio:"xMidYMid meet",style:{pointerEvents:"none"},children:e.jsx(p,{data:s,onClick:()=>{}})})]})}const Bt=()=>e.jsx("svg",{viewBox:"0 0 24 24",fill:"currentColor",className:"w-full h-full drop-shadow-sm",children:e.jsx("path",{d:"M12.9 4.3C15 4.8 17 6 18.5 7.8C19.7 9.4 20 11.5 19.4 13.5C18.8 15.6 17 17.5 14.8 18.3C12.5 19.3 10 18.8 8 17.5C5.8 16.1 4.5 13.7 4 11.2C3.5 8.7 4.2 6 6.1 4.3C8.1 2.5 10.7 2.3 12.9 4.3Z",opacity:"0.9"})}),Zt=()=>e.jsx("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"4",className:"w-full h-full",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("polyline",{points:"20 6 9 17 4 12"})}),Qt=()=>e.jsx("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"3",strokeLinecap:"round",strokeLinejoin:"round",className:"w-full h-full",children:e.jsx("polyline",{points:"4 2 8 8 5 13 10 18 8 22"})}),Ge=()=>e.jsx("svg",{viewBox:"0 0 24 24",fill:"transparent",stroke:"currentColor",strokeWidth:"2.5",strokeLinejoin:"round",className:"w-full h-full",children:e.jsx("path",{d:"M3 13C3 13 5 3 12 3C19 3 21 13 21 13C21 13 18 16 12 16C6 16 3 13 3 13Z"})}),Ue=()=>e.jsxs("svg",{viewBox:"0 0 24 24",fill:"currentColor",className:"w-full h-full",children:[e.jsx("path",{d:"M10 2L14 2L13 18L11 18Z"}),e.jsx("path",{d:"M8 18L16 18L15 22L9 22Z"})]}),Ve=()=>e.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"4",className:"w-full h-full",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),e.jsx("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]}),qe=()=>e.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",className:"w-full h-full",strokeLinecap:"round",children:[e.jsx("line",{x1:"12",y1:"2",x2:"12",y2:"22"}),e.jsx("line",{x1:"8",y1:"4",x2:"8",y2:"18"}),e.jsx("line",{x1:"16",y1:"4",x2:"16",y2:"18"})]}),Ye=()=>e.jsx("svg",{viewBox:"0 0 24 24",fill:"currentColor",className:"w-full h-full",children:e.jsx("path",{d:"M8 2H16V5H8V2ZM9 6H15V8H9V6ZM7 9H17V11H7V9ZM9 12H15V14H9V12ZM8 15H16V17H8V15ZM10 18H14V22H10V18Z"})}),Ie=()=>e.jsx("svg",{viewBox:"0 0 24 24",fill:"currentColor",className:"w-full h-full opacity-90",children:e.jsx("path",{d:"M12 2C16 2 18 5 21 8C22.5 9.5 21 14 19 16C16.5 18.5 13 21 9 20C4.5 18.8 2 13.5 3 9C4 5 7.5 2 12 2Z"})}),Je=()=>e.jsx("svg",{viewBox:"0 0 24 24",fill:"currentColor",stroke:"#EF4444",strokeWidth:"2",strokeDasharray:"2",className:"w-full h-full opacity-90",children:e.jsx("path",{d:"M12 2C16 2 18 5 21 8C22.5 9.5 21 14 19 16C16.5 18.5 13 21 9 20C4.5 18.8 2 13.5 3 9C4 5 7.5 2 12 2Z"})}),Xe=()=>e.jsx("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"3",strokeLinecap:"round",strokeLinejoin:"round",className:"w-full h-full opacity-80",children:e.jsx("path",{d:"M3 12 Q 8 2 12 12 T 21 12"})}),Ot=()=>e.jsx("svg",{viewBox:"0 0 24 24",fill:"currentColor",className:"w-full h-full",children:e.jsx("path",{d:"M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"})}),_e=[{id:"caries",label:"Caries",color:"#EF4444",icon:e.jsx(Bt,{})},{id:"amalgama_des",label:"Amalgama desadaptada",color:"#3B82F6",icon:e.jsx(Je,{})},{id:"fractura",label:"Fractura",color:"#EF4444",icon:e.jsx(Qt,{})},{id:"corona_buena",label:"Corona buena",color:"#3B82F6",icon:e.jsx(Ge,{})},{id:"perno_bueno",label:"Perno bueno",color:"#3B82F6",icon:e.jsx(Ue,{})},{id:"plomba",label:"Plomba",color:"#8B5CF6",icon:e.jsx(Ie,{})},{id:"rest_adaptado",label:"Rest. adaptado",color:"#22C55E",icon:e.jsx(Ie,{})},{id:"diente_sano",label:"Diente sano",color:"#10B981",icon:e.jsx(Zt,{})},{id:"corona_des",label:"Corona desadaptada",color:"#EF4444",icon:e.jsx(Ge,{})},{id:"ausente",label:"Diente ausente",color:"#EF4444",icon:e.jsx(Ve,{})},{id:"perno_malo",label:"Perno malo",color:"#F43F5E",icon:e.jsx(Ue,{})},{id:"otras",label:"Otras",color:"#94A3B8",icon:e.jsx(Ot,{})},{id:"rest_desadaptado",label:"Rest. desadaptado",color:"#EF4444",icon:e.jsx(Je,{})},{id:"sellante_bueno",label:"Sellante bueno",color:"#10B981",icon:e.jsx(Xe,{})},{id:"endodoncia_buena",label:"Endodoncia buena",color:"#3B82F6",icon:e.jsx(qe,{})},{id:"extraccion",label:"Extracción indicada",color:"#DC2626",icon:e.jsx(Ve,{})},{id:"implante_bueno",label:"Implante bueno",color:"#3B82F6",icon:e.jsx(Ye,{})},{id:"amalgama_ok",label:"Amalgama adaptada",color:"#3B82F6",icon:e.jsx(Ie,{})},{id:"sellante_des",label:"Sellante desadaptado",color:"#EF4444",icon:e.jsx(Xe,{})},{id:"endodoncia_mala",label:"Endodoncia mala",color:"#EF4444",icon:e.jsx(qe,{})},{id:"implante_malo",label:"Implante malo",color:"#E11D48",icon:e.jsx(Ye,{})},{id:"borrador",label:"Borrador",color:"#CBD5E1",icon:e.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",className:"w-5 h-5",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("path",{d:"M20 20H7L3 16C2 15 2 13 3 12L13 2C14 1 16 1 17 2L21 6C22 7 22 9 21 10L11 20"}),e.jsx("path",{d:"m17 2 4 4"})]})}];function Rt({numero:t,data:s={},onZoneClick:o,isReadOnly:d,activeToothId:x}){var q;const m=parseInt(t,10),a=m>=11&&m<=28||m>=51&&m<=65,v=m>=11&&m<=18||m>=41&&m<=48||m>=51&&m<=55||m>=81&&m<=85,M=x===String(t),p=(q=s==null?void 0:s.general)==null?void 0:q.id,$=p==="ausente",f=p==="extraccion",C=p==null?void 0:p.includes("corona"),y=p==null?void 0:p.includes("implante"),w=$?.18:1,E=()=>{if($)return e.jsx("div",{className:"absolute inset-0 flex items-center justify-center pointer-events-none z-20",children:e.jsxs("svg",{viewBox:"0 0 24 24",className:"w-[85%] h-[85%] text-slate-400 drop-shadow-md",fill:"none",stroke:"currentColor",strokeWidth:"4",strokeLinecap:"round",children:[e.jsx("line",{x1:"4",y1:"4",x2:"20",y2:"20"}),e.jsx("line",{x1:"20",y1:"4",x2:"4",y2:"20"})]})});if(f)return e.jsx("div",{className:"absolute inset-0 flex items-center justify-center pointer-events-none z-20",children:e.jsxs("svg",{viewBox:"0 0 24 24",className:"w-[85%] h-[85%] text-red-500 drop-shadow-md",fill:"none",stroke:"currentColor",strokeWidth:"4",strokeLinecap:"round",children:[e.jsx("line",{x1:"4",y1:"4",x2:"20",y2:"20"}),e.jsx("line",{x1:"20",y1:"4",x2:"4",y2:"20"})]})});if(C)return e.jsx("div",{className:"absolute inset-0 rounded-md border-[3px] border-indigo-500 opacity-60 pointer-events-none z-20 mix-blend-multiply"});if(p==="fractura")return e.jsx("div",{className:"absolute inset-0 flex items-center justify-center pointer-events-none z-20",children:e.jsx("svg",{viewBox:"0 0 24 24",className:"w-[85%] h-[85%] text-purple-500 drop-shadow-md",fill:"currentColor",children:e.jsx("path",{d:"M13,2L3,14H10l-1,8L21,10H14Z"})})});if(p!=null&&p.includes("endodoncia")){const i=p.includes("buena")?"#3B82F6":"#EF4444";return e.jsx("div",{className:"absolute inset-0 flex items-center justify-center pointer-events-none z-20",style:{color:i},children:e.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"4",className:"w-[85%] h-[85%] drop-shadow-md",strokeLinecap:"round",children:[e.jsx("line",{x1:"12",y1:"2",x2:"12",y2:"22"}),e.jsx("line",{x1:"8",y1:"4",x2:"8",y2:"18"}),e.jsx("line",{x1:"16",y1:"4",x2:"16",y2:"18"})]})})}if(p!=null&&p.includes("perno")){const i=p.includes("bueno")?"#3B82F6":"#F43F5E";return e.jsx("div",{className:"absolute inset-0 flex items-center justify-center pointer-events-none z-20",style:{color:i},children:e.jsxs("svg",{viewBox:"0 0 24 24",fill:"currentColor",className:"w-[85%] h-[85%] drop-shadow-md",children:[e.jsx("path",{d:"M10 2L14 2L13 18L11 18Z"}),e.jsx("path",{d:"M8 18L16 18L15 22L9 22Z"})]})})}if(y){const i=_e.find(l=>l.id===p),k=p.includes("bueno")?"#3B82F6":"#EF4444";return i?e.jsx("div",{className:"absolute inset-0 flex items-center justify-center pointer-events-none z-20",style:{color:k},children:e.jsx("div",{className:"w-[85%] h-[85%] flex items-center justify-center",children:i.icon})}):null}return null},B=(i=!1)=>e.jsxs("div",{className:`relative w-full ${d?"":"cursor-pointer"} overflow-hidden`,style:{opacity:w,height:"clamp(26px, 3.8vw, 56px)",transform:i?"scaleY(-1)":"none"},children:[e.jsx(zt,{numero:t,data:s,onZoneClick:d?()=>{}:o,isReadOnly:d}),E()]}),J=M?"bg-indigo-50/50 ring-2 ring-indigo-200 shadow-lg shadow-indigo-100/50 scale-105 z-10":"hover:bg-slate-50";return e.jsx("div",{className:`flex flex-col items-center w-full rounded-lg p-0.5 transition-all duration-200 ${d?"":"hover:bg-[#e2e8f0] hover:scale-[1.06]"}`,children:a?e.jsxs(e.Fragment,{children:[e.jsxs("div",{onClick:()=>{d||o(String(t),"Completo")},className:`flex flex-col items-center w-full rounded-[16px] transition-all duration-300 ${J} cursor-pointer`,children:[B(!1),e.jsx("div",{className:"text-[9px] xl:text-[11px] font-black text-slate-600 tracking-tighter my-0.5 leading-none",children:t})]}),e.jsx(Re,{activeToothId:t,toothData:s,onZoneClick:o,isReadOnly:d,isUpper:a,isRightSide:v})]}):e.jsxs(e.Fragment,{children:[e.jsx(Re,{activeToothId:t,toothData:s,onZoneClick:o,isReadOnly:d,isUpper:a,isRightSide:v}),e.jsxs("div",{onClick:()=>{d||o(String(t),"Completo")},className:`flex flex-col items-center w-full rounded-[16px] transition-all duration-300 ${J} cursor-pointer`,children:[e.jsx("div",{className:"text-[9px] xl:text-[11px] font-black text-slate-600 tracking-tighter my-0.5 leading-none",children:t}),B(!1)]})]})})}const Wt="clamp(18px, 2.5vw, 40px)";function Ke({odontogramaData:t,onToothClick:s,tipoDenticion:o="completo",activeToothId:d,surfaceFilter:x}){const m=[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28],a=[55,54,53,52,51,61,62,63,64,65],v=[85,84,83,82,81,71,72,73,74,75],M=[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38],p=o==="adulto"||o==="completo",$=o==="nino"||o==="completo",f=C=>{const y=Math.floor(C.length/2);return e.jsx("div",{className:"flex justify-center flex-nowrap my-1 px-1 w-full max-w-full",style:{gap:"1px"},children:C.map((w,E)=>{const B=E===y&&C.length%2===0;return e.jsxs(ft.Fragment,{children:[B&&e.jsx("div",{style:{width:"10px",flexShrink:0}}),e.jsx("div",{style:{width:Wt,flexShrink:0},children:e.jsx(Rt,{numero:String(w),data:t[String(w)]||{},onZoneClick:s,isReadOnly:!s,activeToothId:d})})]},w)})})};return e.jsx("div",{className:"w-full h-auto min-h-[360px] bg-white pb-6 overflow-x-auto",children:e.jsxs("div",{className:"flex flex-col items-center mx-auto p-1 lg:p-2 w-full min-w-fit",children:[e.jsxs("div",{className:"flex flex-col items-center w-full",children:[p&&f(m),$&&f(a)]}),e.jsxs("div",{className:"w-full flex items-center gap-2 my-1 px-4",children:[e.jsx("div",{className:"flex-1 border-t border-dashed border-slate-200"}),e.jsx("span",{className:"text-[8px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap",children:"Plano oclusal"}),e.jsx("div",{className:"flex-1 border-t border-dashed border-slate-200"})]}),e.jsxs("div",{className:"flex flex-col items-center w-full",children:[$&&f(v),p&&f(M)]})]})})}const Pe=t=>{let s=document.getElementById("oc-print-iframe");s||(s=document.createElement("iframe"),s.id="oc-print-iframe",s.style.position="fixed",s.style.right="0",s.style.bottom="0",s.style.width="0px",s.style.height="0px",s.style.border="none",s.style.visibility="hidden",document.body.appendChild(s));const o=s.contentWindow.document;o.open(),o.write(t),o.close();const d=()=>{setTimeout(()=>{s.contentWindow.focus(),s.contentWindow.print()},150)},x=o.querySelector(".odontogram-image");x?x.complete?d():x.onload=d:d()};function Jt({embeddedPatient:t}){const s=tt(),{userProfile:o}=st(),[d,x]=F.useState("LIST"),[m,a]=F.useState([]),[v,M]=F.useState(null),[p,$]=F.useState("caries"),[f,C]=F.useState({}),[y,w]=F.useState([]),[E,B]=F.useState("completo"),[J,q]=F.useState(""),[i,k]=F.useState(!1),[l,H]=F.useState(!1),[n,c]=F.useState(""),[u,j]=F.useState(null),[b,T]=F.useState(null),N=F.useRef(null);F.useEffect(()=>{if(!b)return;(async()=>{var h,S,z,W,X,re,V,te,le;const g=s!=null&&s.loading?s.loading("Generando vista de impresión..."):null;try{await new Promise(Le=>setTimeout(Le,150));const{default:ce}=await Se(async()=>{const{default:Le}=await import("./pdf-utils-kdeBq5B8.js").then(mt=>mt.a);return{default:Le}},__vite__mapDeps([0,1])),me=N.current;if(!me){g&&(s!=null&&s.dismiss)&&s.dismiss(g),T(null);return}const fe=(await ce(me,{backgroundColor:"#ffffff",scale:2,logging:!1,useCORS:!0})).toDataURL("image/png"),ge=((h=o==null?void 0:o.tenant)==null?void 0:h.logo)||"",he=((S=o==null?void 0:o.tenant)==null?void 0:S.nombreComercial)||((z=o==null?void 0:o.tenant)==null?void 0:z.nombre)||((W=o==null?void 0:o.tenant)==null?void 0:W.name)||"Clínica Dental",ke=((X=o==null?void 0:o.tenant)==null?void 0:X.nit)||"—",$e=((re=o==null?void 0:o.tenant)==null?void 0:re.direccion)||"—",Ce=((V=o==null?void 0:o.tenant)==null?void 0:V.telefono)||"—",pe=((te=o==null?void 0:o.tenant)==null?void 0:te.email)||"",dt=((le=b.creado)!=null&&le.seconds?new Date(b.creado.seconds*1e3):new Date).toLocaleDateString("es-CO"),xt=`
                <html>
                <head>
                    <title>Odontograma Clínico - ${t==null?void 0:t.nombreCompleto}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            margin: 0;
                            padding: 40px;
                            color: #334155;
                            background-color: #ffffff;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            border-bottom: 4px solid #2563eb;
                            padding-bottom: 25px;
                            margin-bottom: 30px;
                            gap: 20px;
                        }
                        .logo-container {
                            display: flex;
                            gap: 25px;
                            align-items: center;
                        }
                        .logo-text-placeholder {
                            width: 80px;
                            height: 80px;
                            background: #2563eb;
                            border-radius: 16px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 36px;
                            font-weight: 900;
                            text-transform: uppercase;
                        }
                        .clinic-title {
                            margin: 0;
                            font-size: 24px;
                            font-weight: 900;
                            color: #0f172a;
                            text-transform: uppercase;
                            letter-spacing: -1px;
                        }
                        .clinic-meta {
                            margin: 2px 0;
                            font-size: 12px;
                            color: #64748b;
                            font-weight: 500;
                        }
                        .doc-info {
                            text-align: right;
                        }
                        .doc-badge {
                            background: #eff6ff;
                            padding: 12px 20px;
                            border-radius: 16px;
                            border: 2px solid #dbeafe;
                            margin-bottom: 8px;
                            display: inline-block;
                        }
                        .doc-badge span {
                            font-size: 16px;
                            font-weight: 900;
                            color: #1d4ed8;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        .doc-meta {
                            margin: 0;
                            font-size: 11px;
                            color: #94a3b8;
                            font-weight: 900;
                            text-transform: uppercase;
                        }
                        .patient-info {
                            font-size: 13px;
                            margin-bottom: 24px;
                            background: #f8fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 12px;
                            padding: 16px;
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 8px;
                        }
                        .patient-info div span {
                            font-weight: bold;
                            color: #475569;
                            margin-right: 4px;
                        }
                        .odontogram-image-container {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            margin-top: 10px;
                        }
                        .odontogram-image {
                            max-width: 100%;
                            height: auto;
                            border: 1px solid #cbd5e1;
                            border-radius: 16px;
                            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
                        }
                        @media print {
                            body {
                                padding: 20px;
                            }
                            .odontogram-image {
                                border: none;
                                box-shadow: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="logo-container">
                            ${ge?`<img src="${ge}" style="max-height: 75px; max-width: 150px; object-fit: contain;" />`:`<div class="logo-text-placeholder">${he.substring(0,1)||"O"}</div>`}
                            <div>
                                <h1 class="clinic-title">${he}</h1>
                                <p class="clinic-meta" style="font-weight: 800;">NIT: ${ke}</p>
                                <p class="clinic-meta">${$e}</p>
                                <p class="clinic-meta">TEL: ${Ce} | ${pe}</p>
                            </div>
                        </div>
                        <div class="doc-info">
                            <div class="doc-badge">
                                <span>Odontograma Clínico</span>
                            </div>
                            <p class="doc-meta">FECHA SESIÓN: ${dt}</p>
                        </div>
                    </div>
                    <div class="patient-info">
                        <div><span>Paciente:</span> ${t==null?void 0:t.nombreCompleto}</div>
                        <div><span>Doc. Identidad:</span> ${(t==null?void 0:t.nroDocumento)||"—"}</div>
                        <div><span>Historia Clínica:</span> ${(t==null?void 0:t.nroHistoria)||"—"}</div>
                        <div><span>Edad:</span> ${(t==null?void 0:t.edad)||"—"}</div>
                    </div>
                    <div class="odontogram-image-container">
                        <img src="${fe}" class="odontogram-image" />
                    </div>
                    <div style="margin-top: 50px; display: flex; justify-content: space-between; gap: 60px; padding: 0 20px;">
                        <div style="flex: 1; text-align: center;">
                            <div style="height: 85px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 6px;">
                                ${o!=null&&o.firmaElectronica||o!=null&&o.firma?`<img src="${o.firmaElectronica||o.firma}" style="max-height: 80px; max-width: 280px; object-fit: contain;" />`:""}
                            </div>
                            <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                                <p style="margin: 0; font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">Firma del Especialista / Odontólogo</p>
                                <p style="margin: 3px 0 0 0; font-size: 9.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${o!=null&&o.registroMedico?`TP: ${o.registroMedico}`:"Sello y Registro Médico"}</p>
                            </div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="height: 85px;"></div>
                            <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                                <p style="margin: 0; font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">Responsable de Registro</p>
                                <p style="margin: 3px 0 0 0; font-size: 9.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Generado por: ${((o==null?void 0:o.nombreCompleto)||(o==null?void 0:o.nombre)||(o==null?void 0:o.email)||"Administrador").toUpperCase()}</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;Pe(xt),g&&(s!=null&&s.dismiss)&&s.dismiss(g),s!=null&&s.success&&s.success("Vista previa de impresión generada")}catch(ce){console.error(ce),g&&(s!=null&&s.dismiss)&&s.dismiss(g),s!=null&&s.error&&s.error("Error al generar vista de impresión")}finally{T(null)}})()},[b]),F.useEffect(()=>{t!=null&&t.id&&_()},[t==null?void 0:t.id]);const _=async()=>{k(!0);try{const r=Ee(se,"pacientes",t.id,"odontogramas"),g=await ht(ut(r,bt("creado","desc")));a(g.docs.map(h=>({id:h.id,...h.data()})))}catch{s==null||s.error("Error al cargar historial")}finally{k(!1)}},I=async()=>{k(!0);try{const r=Ee(se,"pacientes",t.id,"odontogramas"),g=await Be(r,{creado:ue(),creadoPor:t.creadorEmail||"usuario@sistema.com",profesional:t.dentistaResponsable||"Profesional",estado:"Abierto",data:{},plan:[],observaciones:""});R({id:g.id,data:{},plan:[],observaciones:"",estado:"Abierto"})}catch{s==null||s.error("Error al crear sesión")}finally{k(!1)}},R=r=>{M(r),C(r.data||{}),w(r.plan||[]),q(r.observaciones||""),x("EDITOR")},L=async r=>{if(window.confirm("¿Eliminar este odontograma permanentemente?"))try{await vt(ie(se,"pacientes",t.id,"odontogramas",r)),s==null||s.success("Eliminado correctamente"),_()}catch{s==null||s.error("Error al eliminar")}},G=(r,g)=>{if(g==="center")return"Oclusal/Incisal";if(g==="Completo")return"Pieza Completa";const h=parseInt(r),S=h>=11&&h<=28||h>=51&&h<=65;if(g==="top")return"Vestibular";if(g==="bottom")return S?"Palatina":"Lingual";const z=h>=11&&h<=18||h>=41&&h<=48||h>=51&&h<=55||h>=81&&h<=85;return g==="left"?z?"Distal":"Mesial":g==="right"?z?"Mesial":"Distal":g},[D,A]=F.useState(null),[U,ae]=F.useState("todas"),we=F.useRef(null),nt=async()=>{try{const{default:r}=await Se(async()=>{const{default:z}=await import("./pdf-utils-kdeBq5B8.js").then(W=>W.a);return{default:z}},__vite__mapDeps([0,1])),g=we.current;if(!g)return;const h=await r(g,{backgroundColor:"#ffffff",scale:2}),S=document.createElement("a");S.download=`odontograma_${(t==null?void 0:t.nombreCompleto)||"paciente"}_${new Date().toLocaleDateString("es-ES").replace(/\//g,"-")}.png`,S.href=h.toDataURL("image/png"),S.click(),s==null||s.success("📸 Imagen guardada")}catch{s==null||s.error("Error al capturar imagen")}},it=async()=>{var r,g,h,S,z,W,X,re;k(!0);try{const{default:V}=await Se(async()=>{const{default:pe}=await import("./pdf-utils-kdeBq5B8.js").then(De=>De.a);return{default:pe}},__vite__mapDeps([0,1])),te=we.current;if(!te)return;const le=D;A(null),await new Promise(pe=>setTimeout(pe,100));const ce=await V(te,{backgroundColor:"#ffffff",scale:2,logging:!1,useCORS:!0});A(le);const me=ce.toDataURL("image/png"),Ne=((r=o==null?void 0:o.tenant)==null?void 0:r.logo)||"",fe=((g=o==null?void 0:o.tenant)==null?void 0:g.nombreComercial)||((h=o==null?void 0:o.tenant)==null?void 0:h.nombre)||((S=o==null?void 0:o.tenant)==null?void 0:S.name)||"Clínica Dental",ge=((z=o==null?void 0:o.tenant)==null?void 0:z.nit)||"—",he=((W=o==null?void 0:o.tenant)==null?void 0:W.direccion)||"—",ke=((X=o==null?void 0:o.tenant)==null?void 0:X.telefono)||"—",$e=((re=o==null?void 0:o.tenant)==null?void 0:re.email)||"",Ce=`
                <html>
                <head>
                    <title>Odontograma Clínico - ${t==null?void 0:t.nombreCompleto}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            margin: 0;
                            padding: 40px;
                            color: #334155;
                            background-color: #ffffff;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            border-bottom: 4px solid #2563eb;
                            padding-bottom: 25px;
                            margin-bottom: 30px;
                            gap: 20px;
                        }
                        .logo-container {
                            display: flex;
                            gap: 25px;
                            align-items: center;
                        }
                        .logo-text-placeholder {
                            width: 80px;
                            height: 80px;
                            background: #2563eb;
                            border-radius: 16px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 36px;
                            font-weight: 900;
                            text-transform: uppercase;
                        }
                        .clinic-title {
                            margin: 0;
                            font-size: 24px;
                            font-weight: 900;
                            color: #0f172a;
                            text-transform: uppercase;
                            letter-spacing: -1px;
                        }
                        .clinic-meta {
                            margin: 2px 0;
                            font-size: 12px;
                            color: #64748b;
                            font-weight: 500;
                        }
                        .doc-info {
                            text-align: right;
                        }
                        .doc-badge {
                            background: #eff6ff;
                            padding: 12px 20px;
                            border-radius: 16px;
                            border: 2px solid #dbeafe;
                            margin-bottom: 8px;
                            display: inline-block;
                        }
                        .doc-badge span {
                            font-size: 16px;
                            font-weight: 900;
                            color: #1d4ed8;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        .doc-meta {
                            margin: 0;
                            font-size: 11px;
                            color: #94a3b8;
                            font-weight: 900;
                            text-transform: uppercase;
                        }
                        .patient-info {
                            font-size: 13px;
                            margin-bottom: 24px;
                            background: #f8fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 12px;
                            padding: 16px;
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 8px;
                        }
                        .patient-info div span {
                            font-weight: bold;
                            color: #475569;
                            margin-right: 4px;
                        }
                        .odontogram-image-container {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            margin-top: 10px;
                        }
                        .odontogram-image {
                            max-width: 100%;
                            height: auto;
                            border: 1px solid #cbd5e1;
                            border-radius: 16px;
                            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
                        }
                        @media print {
                            body {
                                padding: 20px;
                            }
                            .odontogram-image {
                                border: none;
                                box-shadow: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="logo-container">
                            ${Ne?`<img src="${Ne}" style="max-height: 75px; max-width: 150px; object-fit: contain;" />`:`<div class="logo-text-placeholder">${fe.substring(0,1)||"O"}</div>`}
                            <div>
                                <h1 class="clinic-title">${fe}</h1>
                                <p class="clinic-meta" style="font-weight: 800;">NIT: ${ge}</p>
                                <p class="clinic-meta">${he}</p>
                                <p class="clinic-meta">TEL: ${ke} | ${$e}</p>
                            </div>
                        </div>
                        <div class="doc-info">
                            <div class="doc-badge">
                                <span>Odontograma Clínico</span>
                            </div>
                            <p class="doc-meta">FECHA IMPRESIÓN: ${new Date().toLocaleDateString("es-ES")}</p>
                        </div>
                    </div>
                    <div class="patient-info">
                        <div><span>Paciente:</span> ${t==null?void 0:t.nombreCompleto}</div>
                        <div><span>Doc. Identidad:</span> ${(t==null?void 0:t.nroDocumento)||"—"}</div>
                        <div><span>Historia Clínica:</span> ${(t==null?void 0:t.nroHistoria)||"—"}</div>
                        <div><span>Edad:</span> ${(t==null?void 0:t.edad)||"—"}</div>
                    </div>
                    <div class="odontogram-image-container">
                        <img src="${me}" class="odontogram-image" />
                    </div>
                    <div style="margin-top: 50px; display: flex; justify-content: space-between; gap: 60px; padding: 0 20px;">
                        <div style="flex: 1; text-align: center;">
                            <div style="height: 85px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 6px;">
                                ${o!=null&&o.firmaElectronica||o!=null&&o.firma?`<img src="${o.firmaElectronica||o.firma}" style="max-height: 80px; max-width: 280px; object-fit: contain;" />`:""}
                            </div>
                            <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                                <p style="margin: 0; font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">Firma del Especialista / Odontólogo</p>
                                <p style="margin: 3px 0 0 0; font-size: 9.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${o!=null&&o.registroMedico?`TP: ${o.registroMedico}`:"Sello y Registro Médico"}</p>
                            </div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="height: 85px;"></div>
                            <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                                <p style="margin: 0; font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">Responsable de Registro</p>
                                <p style="margin: 3px 0 0 0; font-size: 9.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Generado por: ${((o==null?void 0:o.nombreCompleto)||(o==null?void 0:o.nombre)||(o==null?void 0:o.email)||"Administrador").toUpperCase()}</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;Pe(Ce)}catch{s==null||s.error("Error al generar impresión del odontograma")}finally{k(!1)}},at=(r,g)=>{if(A(r),!U)return;let h=g;U!=="todas"&&(h={vestibular:"top",oclusal:"center",lingual:"bottom",mesial:parseInt(r)>=11&&parseInt(r)<=18||parseInt(r)>=41&&parseInt(r)<=48||parseInt(r)>=51&&parseInt(r)<=55||parseInt(r)>=81&&parseInt(r)<=85?"right":"left",distal:parseInt(r)>=11&&parseInt(r)<=18||parseInt(r)>=41&&parseInt(r)<=48||parseInt(r)>=51&&parseInt(r)<=55||parseInt(r)>=81&&parseInt(r)<=85?"left":"right"}[U]||g);const S=_e.find(V=>V.id===p);if(!S)return;const z=["ausente","extraccion","implante_bueno","implante_malo","corona_buena","corona_des","perno_bueno","perno_malo","diente_sano","fractura","endodoncia_buena","endodoncia_mala"].includes(p);if(C(V=>{const te={...V[r]||{}};if(p==="borrador"){if(h==="Completo"||z)return{...V,[r]:{}};const le={...te};return delete le[h],{...V,[r]:le}}return z||h==="Completo"?{...V,[r]:{...te,general:{id:S.id,color:S.color}}}:{...V,[r]:{...te,[h]:{id:S.id,color:S.color}}}}),p==="borrador")return;const W=S.label,X=z?"Pieza Completa":G(r,h),re=z?W:`${W} - ${X}`;w(V=>[...V,{diente:r,zona:z||h==="Completo"?"Completo":h,zonaLabel:X,tratamiento:re,color:S.color,estado:"Planificado",fechaISO:new Date().toISOString(),toolId:S.id}])},ct=r=>{ae(U===r?null:r),A(null)},ye=async(r=!1)=>{if(v!=null&&v.id){H(!0);try{const g=ie(se,"pacientes",t.id,"odontogramas",v.id);if(await ze(g,{data:f,plan:y,observaciones:J,updatedAt:ue(),...r?{estado:"Finalizado"}:{}},{merge:!0}),r&&y.length>0){const h=Ee(se,"pacientes",t.id,"tratamientos_pendientes");for(const S of y)await Be(h,{...S,odontogramaId:v.id,fechaFinalizacion:ue(),estado:"Pendiente",valor:0,creadoPor:t.creadorEmail||"Doctor"})}s==null||s.success(r?"✅ Sesión finalizada y sincronizada con el Plan":"✅ Guardado correctamente"),r&&(x("LIST"),_())}catch(g){console.error(g),s==null||s.error("Error al guardar")}finally{H(!1)}}},pt=r=>{const g=y[r];w(h=>h.filter((S,z)=>z!==r)),C(h=>{const S={...h[g.diente]||{}},z=["ausente","extraccion","implante_bueno","implante_malo","corona_buena","corona_des","perno_bueno","perno_malo","diente_sano","fractura","endodoncia_buena","endodoncia_mala"].includes(g.toolId);return g.zona==="Completo"||z||S.general&&S.general.id===g.toolId?delete S.general:delete S[g.zona],{...h,[g.diente]:S}})},ee=(v==null?void 0:v.estado)==="Finalizado",xe=m.filter(r=>!n||(r.creadoPor||"").toLowerCase().includes(n.toLowerCase())||(r.profesional||"").toLowerCase().includes(n.toLowerCase()));return d==="LIST"?e.jsxs("div",{className:"flex flex-col h-full bg-white animate-fadeIn",children:[e.jsxs("header",{className:"px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10",children:[e.jsxs("div",{children:[e.jsxs("h2",{className:"text-xl font-black text-slate-800 uppercase tracking-tight leading-none",children:["Historial de ",e.jsx("span",{className:"text-indigo-600",children:"Odontogramas"})]}),e.jsxs("p",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1",children:[e.jsx(wt,{size:10,className:"text-indigo-400"}),"Registro clínico cronológico — ",t==null?void 0:t.nombreCompleto]})]}),e.jsxs("button",{onClick:I,className:"flex items-center gap-2 px-6 py-3 rounded-[18px] bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 active:scale-95 transition-all",children:[e.jsx(yt,{size:16,strokeWidth:3}),"Nuevo Odontograma"]})]}),e.jsxs("div",{className:"px-8 py-3 border-b border-slate-50 flex items-center gap-3 bg-slate-50/40",children:[e.jsxs("div",{className:"relative flex-1 max-w-xs",children:[e.jsx(Nt,{size:13,className:"absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"}),e.jsx("input",{value:n,onChange:r=>c(r.target.value),placeholder:"Buscar por profesional o usuario...",className:"w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 text-[11px] text-slate-700 bg-white outline-none focus:border-indigo-300 transition-colors"})]}),e.jsxs("span",{className:"text-[9px] font-black text-slate-400 uppercase tracking-widest ml-auto",children:[xe.length," registro",xe.length!==1?"s":""]})]}),e.jsxs("div",{className:"flex-1 overflow-y-auto",children:[e.jsxs("div",{className:"grid grid-cols-12 px-8 py-3 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100",children:[e.jsxs("div",{className:"col-span-3 flex items-center gap-1",children:[e.jsx(Me,{size:10})," Fecha de Sesión"]}),e.jsx("div",{className:"col-span-3",children:"Creado por"}),e.jsx("div",{className:"col-span-3",children:"Profesional a cargo"}),e.jsx("div",{className:"col-span-1",children:"Estado"}),e.jsx("div",{className:"col-span-2 text-right",children:"Acciones"})]}),i?e.jsxs("div",{className:"flex flex-col items-center justify-center h-48 gap-3",children:[e.jsx("div",{className:"w-8 h-8 border-3 border-slate-100 border-t-indigo-600 rounded-full animate-spin",style:{border:"3px solid #f1f5f9",borderTopColor:"#4f46e5"}}),e.jsx("span",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse",children:"Cargando..."})]}):xe.length===0?e.jsxs("div",{className:"flex flex-col items-center justify-center h-64 text-slate-300",children:[e.jsx(Me,{size:40,className:"mb-4 opacity-50"}),e.jsx("div",{className:"text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1",children:"Sin registros clínicos"}),e.jsx("div",{className:"text-[10px] text-slate-300 mb-6",children:"Inicia el primer registro para este paciente"}),e.jsx("button",{onClick:I,className:"text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:underline",children:"+ Crear primer odontograma"})]}):xe.map((r,g)=>{var X;const h=(X=r.creado)!=null&&X.toDate?r.creado.toDate():new Date,S=h.toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"numeric"}),z=h.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}),W=r.estado==="Finalizado";return e.jsxs("div",{className:"grid grid-cols-12 items-center px-8 py-4 border-b border-slate-50 hover:bg-indigo-50/20 transition-colors group",children:[e.jsxs("div",{className:"col-span-3 flex items-center gap-3",children:[e.jsx("div",{className:"w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors border border-slate-100",children:e.jsx(Me,{size:16})}),e.jsxs("div",{children:[e.jsx("div",{className:"text-[11px] font-black text-slate-800 tracking-tight",children:S}),e.jsx("div",{className:"text-[9px] font-bold text-slate-400 uppercase tracking-widest",children:z})]})]}),e.jsx("div",{className:"col-span-3",children:e.jsx("div",{className:"text-[11px] font-semibold text-slate-600 truncate max-w-[180px]",children:r.creadoPor||"usuario@sistema.com"})}),e.jsx("div",{className:"col-span-3",children:e.jsx("div",{className:"text-[11px] font-semibold text-slate-600 truncate max-w-[180px]",children:r.profesional||"Profesional de Planta"})}),e.jsx("div",{className:"col-span-1",children:e.jsxs("span",{className:`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${W?"bg-emerald-50 text-emerald-600 border border-emerald-100":"bg-indigo-50 text-indigo-600 border border-indigo-100"}`,children:[e.jsx("span",{className:`w-1.5 h-1.5 rounded-full ${W?"bg-emerald-500":"bg-indigo-500 animate-pulse"}`}),r.estado||"Abierto"]})}),e.jsxs("div",{className:"col-span-2 flex justify-end gap-2",children:[e.jsx("button",{onClick:()=>j(r),title:"Firma y huella paciente",className:"w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center hover:bg-cyan-100 transition-all",children:e.jsx(kt,{size:14})}),e.jsx("button",{onClick:()=>R(r),title:W?"Ver":"Editar",className:`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${W?"bg-emerald-50 text-emerald-600 hover:bg-emerald-100":"bg-indigo-50 text-indigo-600 hover:bg-indigo-100"}`,children:W?e.jsx($t,{size:14}):e.jsx(Ct,{size:14})}),e.jsx("button",{onClick:()=>T(r),title:"Imprimir / PDF",className:"w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-all",children:e.jsx(Ae,{size:14})}),e.jsx("button",{onClick:()=>L(r.id),title:"Eliminar",className:"w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-all",children:e.jsx(Fe,{size:14})})]})]},r.id)})]}),e.jsxs("footer",{className:"h-10 bg-slate-50 border-t border-slate-100 flex items-center justify-between px-8",children:[e.jsxs("span",{className:"text-[9px] font-black text-slate-400 uppercase tracking-widest",children:[m.length," sesión",m.length!==1?"es":""," clínica",m.length!==1?"s":""]}),e.jsx("span",{className:"text-[9px] font-black text-slate-400 uppercase tracking-widest",children:"Motor Clínico v4.0 Elite"})]}),u&&e.jsx(FirmaHuellaModal,{sesion:u,paciente:t,planTratamiento:u.plan||[],onClose:()=>j(null),onGuardar:async({firmaDataUrl:r,huellaImg:g})=>{try{const h=ie(se,"pacientes",t.id,"odontogramas",u.id);await ze(h,{firmaUrl:r||null,huellaUrl:g||null,firmadoEn:ue()},{merge:!0}),s==null||s.success("✅ Firma y huella guardadas"),j(null),_()}catch{s==null||s.error("Error al guardar firma")}}}),b&&e.jsx("div",{style:{position:"absolute",left:"-9999px",top:"-9999px",width:"900px"},ref:N,children:e.jsx(Ke,{odontogramaData:b.data||{},tipoDenticion:"completo"})})]}):e.jsxs("div",{className:"flex flex-col h-full bg-white overflow-hidden animate-fadeIn",children:[e.jsxs("header",{className:"px-6 py-3 border-b border-slate-100 flex items-center gap-4 bg-white sticky top-0 z-20 flex-wrap",children:[e.jsx("button",{onClick:()=>{x("LIST"),_()},className:"w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all",children:e.jsx(Lt,{size:18})}),e.jsxs("div",{children:[e.jsxs("div",{className:"text-[12px] font-black text-slate-800 uppercase tracking-tight leading-none",children:["Odontograma ",e.jsx("span",{className:"text-indigo-600",children:"Clínico"}),ee&&e.jsx("span",{className:"ml-2 text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full",children:"FINALIZADO"})]}),e.jsxs("div",{className:"text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5",children:[t==null?void 0:t.nombreCompleto," • ",y.length," hallazgo",y.length!==1?"s":""]})]}),e.jsx("div",{className:"flex-1"}),e.jsx("div",{className:"flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner",children:[{id:"adulto",label:"Permanente",icon:"🦷"},{id:"nino",label:"Temporal",icon:"👶"},{id:"completo",label:"Mixta",icon:"🌓"}].map(r=>e.jsxs("button",{onClick:()=>B(r.id),className:`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${E===r.id?"bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200":"text-slate-400 hover:text-slate-600 hover:bg-white/50"}`,children:[e.jsx("span",{children:r.icon}),r.label]},r.id))}),!ee&&e.jsxs(e.Fragment,{children:[e.jsxs("button",{onClick:()=>ye(!1),disabled:l,className:`flex items-center gap-2 px-5 py-2 rounded-[14px] text-[11px] font-black uppercase tracking-widest transition-all ${l?"bg-slate-100 text-slate-400":"bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700"}`,children:[e.jsx(Te,{size:14})," ",l?"...":"Guardar"]}),e.jsxs("button",{onClick:()=>ye(!0),disabled:l,className:"flex items-center gap-2 px-5 py-2 rounded-[14px] bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100",children:[e.jsx(ot,{size:14})," Finalizar"]})]}),e.jsxs("button",{onClick:nt,title:"Guardar como imagen",className:"flex items-center gap-2 px-4 py-2 rounded-[14px] bg-cyan-50 text-cyan-700 border border-cyan-200 text-[11px] font-black uppercase tracking-widest hover:bg-cyan-100 transition-all",children:[e.jsx(Qe,{size:14})," Imp. Foto"]}),e.jsxs("button",{onClick:it,title:"Imprimir",className:"flex items-center gap-2 px-4 py-2 rounded-[14px] bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all",children:[e.jsx(Ae,{size:14})," Imprimir"]})]}),e.jsxs("div",{className:"flex flex-col xl:flex-row flex-1 overflow-hidden",children:[e.jsxs("div",{className:"flex-1 flex flex-col bg-white min-w-0 overflow-y-auto overflow-x-hidden relative custom-scrollbar",children:[e.jsx("div",{className:"w-full flex-shrink-0",ref:we,children:e.jsx(Ke,{odontogramaData:f,onToothClick:ee?void 0:at,tipoDenticion:E,activeToothId:D,surfaceFilter:U})}),e.jsxs("div",{className:"px-8 py-6 border-t border-slate-200 bg-white shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.1)] z-10",children:[e.jsx("div",{className:"flex flex-wrap gap-x-6 gap-y-3 mb-6",children:[{id:"todas",label:"Todas las superficies"},{id:"vestibular",label:"Vestibular"},{id:"oclusal",label:"Oclusal/Incisal"},{id:"lingual",label:"Lingual/Palatina"},{id:"mesial",label:"Mesial"},{id:"distal",label:"Distal"}].map(r=>e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer group",children:[e.jsx("input",{type:"checkbox",checked:U===r.id,onChange:()=>ct(r.id),className:"w-4 h-4 text-indigo-600 bg-slate-50 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"}),e.jsx("span",{className:`text-[12px] font-bold transition-colors ${U===r.id?"text-indigo-700":"text-slate-700 group-hover:text-slate-900"}`,children:r.label})]},r.id))}),e.jsxs("div",{className:"flex flex-col xl:flex-row gap-6 items-start",children:[e.jsxs("div",{className:"flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-2 gap-x-8 gap-y-1 bg-slate-50/50 p-4 rounded-[20px] border border-slate-100 shadow-sm w-full",children:[_e.filter(r=>r.id!=="borrador").map(r=>e.jsxs("button",{onClick:()=>!ee&&$(p===r.id?null:r.id),disabled:ee,className:`flex items-center gap-2 py-1.5 px-2.5 rounded-xl transition-all text-left ${p===r.id?"bg-white shadow-sm ring-1 ring-indigo-200":"hover:bg-white/70 disabled:hover:bg-transparent"}`,children:[e.jsx("div",{className:"w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 shrink-0 shadow-sm overflow-hidden",style:{color:r.color},children:r.icon}),e.jsx("span",{className:`text-[10px] md:text-[11px] font-semibold truncate ${p===r.id?"text-indigo-800 font-bold":"text-slate-600"}`,children:r.label})]},r.id)),e.jsxs("button",{onClick:()=>!ee&&$(p==="borrador"?null:"borrador"),disabled:ee,className:`flex items-center gap-2 py-1.5 px-2.5 rounded-xl transition-all text-left col-span-full mt-2 border-t border-slate-100 pt-3 ${p==="borrador"?"bg-white shadow-sm ring-1 ring-slate-300":"hover:bg-white/70"}`,children:[e.jsx("div",{className:"w-5 h-5 rounded-full bg-slate-300 shrink-0 shadow-sm"}),e.jsx("span",{className:"text-[11px] font-semibold text-slate-600",children:"Borrador General"})]})]}),e.jsxs("div",{className:"w-full xl:w-[260px] flex-shrink-0",children:[e.jsx("label",{className:"text-[12px] font-black text-slate-800 tracking-tight block mb-2",children:"Observaciones Clínicas:"}),e.jsx("textarea",{value:J,onChange:r=>q(r.target.value),disabled:ee,className:"w-full rounded-[14px] border-2 border-slate-200 px-4 py-3 text-[12px] text-slate-700 resize-y min-h-[140px] outline-none focus:border-indigo-400 transition-colors bg-white shadow-inner",placeholder:"Detalles sobre los hallazgos..."})]})]})]})]}),e.jsxs("div",{className:"w-full xl:w-80 flex-shrink-0 border-t xl:border-t-0 xl:border-l border-slate-100 flex flex-col bg-slate-50/30",children:[e.jsxs("div",{className:"px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white",children:[e.jsx(Qe,{size:15,className:"text-indigo-500"}),e.jsx("span",{className:"text-[11px] font-black text-slate-800 uppercase tracking-tight",children:"Plan de Tratamiento"}),e.jsx("span",{className:"ml-auto bg-slate-100 rounded-full px-2 py-0.5 text-[10px] font-black text-slate-500",children:y.length})]}),e.jsx("div",{className:"flex-1 overflow-y-auto p-3 space-y-2",children:y.length===0?e.jsxs("div",{className:"flex flex-col items-center justify-center h-48 text-slate-300",children:[e.jsx("span",{className:"text-3xl mb-3",children:"🦷"}),e.jsx("span",{className:"text-[10px] font-black uppercase tracking-widest",children:"Sin hallazgos"})]}):y.map((r,g)=>e.jsxs("div",{className:"flex items-center gap-2 p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 group hover:border-slate-200 transition-colors",children:[e.jsx("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:r.color||"#94a3b8",flexShrink:0}}),e.jsx("span",{className:"w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-700 flex-shrink-0",children:r.diente}),e.jsx("div",{className:"flex-1 min-w-0",children:e.jsx("div",{className:"text-[10px] font-bold text-slate-800 truncate",children:r.tratamiento})}),!ee&&e.jsx("button",{onClick:()=>pt(g),className:"text-rose-400 hover:text-rose-600 hover:scale-110 active:scale-95 transition-all flex-shrink-0 p-1.5",title:"Eliminar del plan",children:e.jsx(Fe,{size:13})})]},g))}),e.jsxs("div",{className:"p-4 border-t border-slate-100",children:[e.jsx("div",{className:"text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3",children:"Total Presupuesto"}),e.jsx("div",{className:"text-[12px] font-black text-slate-800 mb-4",children:"Por definir"}),!ee&&e.jsxs("button",{onClick:()=>ye(!1),disabled:l,className:`w-full py-3 rounded-[14px] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${l?"bg-slate-100 text-slate-400":"bg-slate-900 text-white hover:bg-black shadow-lg shadow-slate-200"}`,children:[e.jsx(Te,{size:15})," ",l?"Guardando...":"Guardar"]})]})]})]})]})}const K=[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28],P=[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38],de={v:[{},{},{}],l:[{},{},{}],mobility:0,furcation:0},Ht=t=>{let s=document.getElementById("oc-print-iframe");s||(s=document.createElement("iframe"),s.id="oc-print-iframe",s.style.position="fixed",s.style.right="0",s.style.bottom="0",s.style.width="0px",s.style.height="0px",s.style.border="none",s.style.visibility="hidden",document.body.appendChild(s));const o=s.contentWindow.document;o.open(),o.write(t),o.close(),setTimeout(()=>{s.contentWindow.focus(),s.contentWindow.print()},150)},Y=(t,s)=>{const o=Number(t);return o>=11&&o<=18||o>=41&&o<=48?s===0?"D":s===1?"C":"M":s===0?"M":s===1?"C":"D"},je=({teeth:t,face:s,isUpper:o,periodonto:d,faceLabel:x})=>{const m=o?110:50,a=6,v=128,M=10,p=t.length*(v+M),$=i=>{const k=Number(i)||0;return o?m-k*a:m+k*a},f=[];t.forEach((i,k)=>{const H=(d[i]||{})[s]||[{},{},{}];[0,1,2].forEach(n=>{const c=H[n]||{},u=c.pd!==void 0&&c.pd!==""?Number(c.pd):0,j=c.gm!==void 0&&c.gm!==""?Number(c.gm):0,b=c.cal!==void 0&&c.cal!==""?Number(c.cal):u+j,T=k*(v+M)+4+(v-8)/3*(n+.5);f.push({x:T,gm:j,cal:b,pd:u,bleeding:c.bleeding,plaque:c.plaque,tooth:i,siteIndex:n})})});const C=f.map((i,k)=>`${k===0?"M":"L"} ${i.x} ${$(i.gm)}`).join(" "),y=f.map((i,k)=>`${k===0?"M":"L"} ${i.x} ${$(i.cal)}`).join(" "),w=[];f.forEach(i=>{w.push(`${i.x},${$(i.gm)}`)});for(let i=f.length-1;i>=0;i--){const k=f[i];w.push(`${k.x},${$(k.cal)}`)}const E=w.join(" "),B=[-4,-2,0,2,4,6,8,10,12],J=$(0),q=$(4);return e.jsxs("div",{className:"flex flex-col gap-1.5 my-3",children:[e.jsxs("div",{className:"flex items-center justify-between px-2",children:[e.jsxs("span",{className:"text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5",children:[e.jsx("span",{className:`w-2 h-2 rounded-full ${s==="v"?"bg-blue-500":"bg-amber-500"}`}),"Gráfico de Sondaje — Cara ",x," (",o?"Maxilar Superior":"Mandíbula Inferior",")"]}),e.jsxs("div",{className:"flex items-center gap-4 text-[9px] font-bold uppercase tracking-wider",children:[e.jsxs("span",{className:"flex items-center gap-1 text-blue-600",children:[e.jsx("span",{className:"w-2.5 h-0.5 bg-blue-600 rounded"})," Margen Gingival (GM)"]}),e.jsxs("span",{className:"flex items-center gap-1 text-red-600",children:[e.jsx("span",{className:"w-2.5 h-0.5 bg-red-600 rounded"})," Profundidad / NIC (CAL)"]}),e.jsxs("span",{className:"flex items-center gap-1 text-rose-600",children:[e.jsx("span",{className:"w-2 h-2 rounded-full bg-rose-600"})," Sangrado (BOP)"]}),e.jsxs("span",{className:"flex items-center gap-1 text-amber-600",children:[e.jsx("span",{className:"w-2 h-2 rounded-full bg-amber-500"})," Placa"]})]})]}),e.jsx("div",{className:"w-full overflow-x-auto custom-scrollbar pb-2",children:e.jsx("div",{style:{width:`${p}px`},className:"h-[160px] bg-slate-50/70 rounded-2xl relative border border-slate-200/80 shadow-inner select-none shrink-0",children:e.jsxs("svg",{width:p,height:160,viewBox:`0 0 ${p} 160`,className:"absolute inset-0",children:[e.jsx("defs",{children:e.jsxs("linearGradient",{id:`chartGrad-${s}-${o?"u":"l"}`,x1:"0",y1:"0",x2:"0",y2:"1",children:[e.jsx("stop",{offset:"0%",stopColor:"#f8fafc",stopOpacity:"0.9"}),e.jsx("stop",{offset:"100%",stopColor:"#ffffff",stopOpacity:"0.9"})]})}),e.jsx("rect",{width:p,height:160,fill:`url(#chartGrad-${s}-${o?"u":"l"})`}),B.map(i=>{const k=$(i),l=i===0;return e.jsxs("g",{children:[e.jsx("line",{x1:0,y1:k,x2:p,y2:k,stroke:l?"#64748b":"#e2e8f0",strokeWidth:l?1.5:.75,strokeDasharray:l?"":"3,3"}),e.jsx("text",{x:8,y:k+3,className:"text-[8px] font-black fill-slate-400",children:i}),e.jsx("text",{x:p-12,y:k+3,className:"text-[8px] font-black fill-slate-400",textAnchor:"end",children:i})]},i)}),e.jsx("line",{x1:0,y1:q,x2:p,y2:q,stroke:"#f43f5e",strokeWidth:1,strokeDasharray:"4,4",opacity:.85}),e.jsx("text",{x:40,y:o?q+10:q-4,className:"text-[7.5px] font-black fill-rose-500 uppercase tracking-widest",children:"Umbral 4mm"}),e.jsx("text",{x:24,y:o?J+10:J-4,className:"text-[7.5px] font-black fill-slate-500 uppercase tracking-widest",children:"Línea CEJ"}),f.map((i,k)=>e.jsx("line",{x1:i.x,y1:0,x2:i.x,y2:160,stroke:"#e2e8f0",strokeWidth:i.siteIndex===1?1:.5,strokeDasharray:i.siteIndex===1?"4,4":"1,3",opacity:.4},k)),t.map((i,k)=>{const l=k*(v+M)+v/2,H=[18,17,16,26,27,28,48,47,46,36,37,38].includes(i);return o?e.jsx("path",{d:H?`M ${l-18} 110 C ${l-18} 135, ${l+18} 135, ${l+18} 110 L ${l+15} 70 C ${l+15} 30, ${l+7} 20, ${l+9} 25 L ${l} 55 L ${l-9} 25 C ${l-7} 20, ${l-15} 30, ${l-15} 70 Z`:`M ${l-12} 110 C ${l-12} 132, ${l+12} 132, ${l+12} 110 L ${l+9} 70 C ${l+9} 30, ${l} 20, ${l} 20 C ${l} 20, ${l-9} 30, ${l-9} 70 Z`,fill:"#f1f5f9",stroke:"#cbd5e1",strokeWidth:1,fillOpacity:.45,strokeOpacity:.5},i):e.jsx("path",{d:H?`M ${l-18} 50 C ${l-18} 25, ${l+18} 25, ${l+18} 50 L ${l+15} 90 C ${l+15} 130, ${l+7} 140, ${l+9} 135 L ${l} 105 L ${l-9} 135 C ${l-7} 140, ${l-15} 130, ${l-15} 90 Z`:`M ${l-12} 50 C ${l-12} 28, ${l+12} 28, ${l+12} 50 L ${l+9} 90 C ${l+9} 130, ${l} 140, ${l} 140 C ${l} 140, ${l-9} 130, ${l-9} 90 Z`,fill:"#f1f5f9",stroke:"#cbd5e1",strokeWidth:1,fillOpacity:.45,strokeOpacity:.5},i)}),t.map((i,k)=>{const l=k*(v+M)+v/2,H=o?s==="v"?18:148:s==="v"?148:18;return e.jsx("text",{x:l,y:H,className:"text-[9px] font-black fill-slate-400/80 uppercase tracking-widest",textAnchor:"middle",children:i},`num-${i}`)}),f.some(i=>i.pd>0)&&e.jsx("polygon",{points:E,fill:"#ef4444",fillOpacity:.18}),e.jsx("path",{d:C,fill:"none",stroke:"#3b82f6",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"}),e.jsx("path",{d:y,fill:"none",stroke:"#ef4444",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"}),f.map((i,k)=>{const l=$(i.gm),H=$(i.cal);return e.jsxs("g",{children:[e.jsx("circle",{cx:i.x,cy:l,r:3,fill:"#2563eb",stroke:"#ffffff",strokeWidth:1}),e.jsx("circle",{cx:i.x,cy:H,r:3,fill:"#dc2626",stroke:"#ffffff",strokeWidth:1}),i.bleeding&&e.jsx("circle",{cx:i.x,cy:o?l+9:l-9,r:4,fill:"#e11d48",stroke:"#ffffff",strokeWidth:1.2}),i.plaque&&e.jsx("circle",{cx:i.x+(i.bleeding?5:0),cy:o?l+9:l-9,r:4,fill:"#d97706",stroke:"#ffffff",strokeWidth:1.2}),i.pd>0&&e.jsx("text",{x:i.x,y:o?H-8:H+11,className:"text-[8.5px] font-black fill-red-600",textAnchor:"middle",children:i.pd})]},k)})]})})})]})},ne=({tooth:t,face:s,index:o,label:d,isUpper:x,periodonto:m,updateSite:a,handleInputChange:v,handleKeyDown:M})=>{const f=((m[t]||de)[s]||[{},{},{}])[o]||{},C=f.pd!==void 0&&f.pd!==""?Number(f.pd):"",y=f.gm!==void 0&&f.gm!==""?Number(f.gm):"",w=f.cal!==void 0&&f.cal!==""?Number(f.cal):"",E=C!==""&&C>=4;return e.jsxs("div",{className:"flex flex-col items-center p-1 flex-1 border-r last:border-0 border-slate-100 bg-gradient-to-b from-white to-slate-50/30",children:[e.jsx("span",{className:"text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1",children:d}),e.jsx("input",{"data-tooth":t,"data-face":s,"data-index":o,"data-field":"pd","data-upper":x,className:`perio-input w-8 h-8 text-center text-sm font-black border-2 rounded-lg outline-none transition-all shadow-sm
                    ${E?"bg-red-50 text-red-700 border-red-400 ring-2 ring-red-200":"border-slate-300 text-slate-800 bg-white focus:bg-blue-50"} 
                    focus:border-blue-500 focus:ring-2 focus:ring-blue-100 hover:border-slate-400`,type:"text",inputMode:"numeric",placeholder:"-",value:C,onChange:B=>v(B,t,s,o,"pd",B.target.value),onKeyDown:M,title:`Profundidad de Sondaje (mm) - Sitio ${d}`}),e.jsx("input",{"data-tooth":t,"data-face":s,"data-index":o,"data-field":"gm","data-upper":x,className:"perio-input w-8 h-6 text-center text-[11px] font-bold border border-t-0 border-slate-300 rounded-b-md outline-none text-slate-600 bg-slate-50 focus:bg-white focus:border-blue-500 transition-all shadow-sm",type:"text",placeholder:"0",value:y,onChange:B=>v(B,t,s,o,"gm",B.target.value),onKeyDown:M,title:`Margen Gingival (mm) - Sitio ${d}`}),e.jsxs("div",{className:"flex gap-1 mt-1 mb-0.5",children:[e.jsx("button",{type:"button",className:`w-3.5 h-3.5 rounded-full border transition-all flex items-center justify-center shadow-sm
                        ${f.bleeding?"bg-rose-500 border-rose-600 shadow-rose-200 scale-110":"bg-white border-slate-300 hover:border-rose-400"}`,onClick:()=>a(t,s,o,"bleeding",!f.bleeding),title:"Sangrado al Sondaje (BOP)",children:f.bleeding&&e.jsx(rt,{size:7,className:"text-white"})}),e.jsx("button",{type:"button",className:`w-3.5 h-3.5 rounded-full border transition-all flex items-center justify-center shadow-sm
                        ${f.plaque?"bg-amber-500 border-amber-600 shadow-amber-200 scale-110":"bg-white border-slate-300 hover:border-amber-400"}`,onClick:()=>a(t,s,o,"plaque",!f.plaque),title:"Placa Bacteriana (PLA)",children:f.plaque&&e.jsx(Et,{size:7,className:"text-white"})})]}),e.jsx("span",{className:`text-[10px] font-black px-1 rounded ${w>4?"text-indigo-700 bg-indigo-100":w!==""?"text-slate-600 bg-slate-100":"text-slate-300 bg-slate-50"}`,children:w!==""?w:"-"})]})},et=({tooth:t,isUpper:s,periodonto:o,setPeriodonto:d,updateSite:x,handleInputChange:m,handleKeyDown:a})=>{var $,f;const v="v",M="l",p=[18,17,16,26,27,28,48,47,46,36,37,38].includes(t);return e.jsxs("div",{className:"flex flex-col items-center bg-white border-2 border-slate-200 rounded-2xl shadow-sm overflow-hidden w-[128px] shrink-0 hover:border-indigo-300 transition-all hover:shadow-md",children:[e.jsx("div",{className:"w-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-center text-sm font-black py-1.5 text-white uppercase tracking-widest",children:t}),e.jsxs("div",{className:"w-full bg-blue-50/50 border-b border-slate-200 p-1.5",children:[e.jsxs("div",{className:"text-[9px] font-black text-blue-700 uppercase tracking-wider text-center mb-1 flex items-center justify-center gap-1",children:[e.jsx(lt,{size:10})," Vestibular"]}),e.jsxs("div",{className:"flex justify-between w-full",children:[e.jsx(ne,{tooth:t,face:v,index:0,label:Y(t,0),isUpper:s,periodonto:o,updateSite:x,handleInputChange:m,handleKeyDown:a}),e.jsx(ne,{tooth:t,face:v,index:1,label:Y(t,1),isUpper:s,periodonto:o,updateSite:x,handleInputChange:m,handleKeyDown:a}),e.jsx(ne,{tooth:t,face:v,index:2,label:Y(t,2),isUpper:s,periodonto:o,updateSite:x,handleInputChange:m,handleKeyDown:a})]})]}),e.jsxs("div",{className:"w-full bg-amber-50/50 p-1.5 border-b border-slate-200",children:[e.jsxs("div",{className:"text-[9px] font-black text-amber-700 uppercase tracking-wider text-center mb-1 flex items-center justify-center gap-1",children:[e.jsx(St,{size:10})," ",s?"Palatino":"Lingual"]}),e.jsxs("div",{className:"flex justify-between w-full",children:[e.jsx(ne,{tooth:t,face:M,index:0,label:Y(t,0),isUpper:s,periodonto:o,updateSite:x,handleInputChange:m,handleKeyDown:a}),e.jsx(ne,{tooth:t,face:M,index:1,label:Y(t,1),isUpper:s,periodonto:o,updateSite:x,handleInputChange:m,handleKeyDown:a}),e.jsx(ne,{tooth:t,face:M,index:2,label:Y(t,2),isUpper:s,periodonto:o,updateSite:x,handleInputChange:m,handleKeyDown:a})]})]}),e.jsxs("div",{className:"flex flex-col gap-1 p-1.5 w-full bg-slate-50/70 items-center",children:[e.jsxs("div",{className:"flex items-center justify-between w-full px-1",children:[e.jsx("label",{className:"text-[8.5px] font-black text-slate-500 uppercase tracking-wider",children:"Mov"}),e.jsxs("select",{className:"text-[11px] font-black border border-slate-300 rounded bg-white px-1 py-0.5 text-slate-800 outline-none focus:border-indigo-500",value:(($=o[t])==null?void 0:$.mobility)||0,onChange:C=>{const y=Number(C.target.value);d(w=>{const E={...w};return E[t]||(E[t]=JSON.parse(JSON.stringify(de))),E[t].mobility=y,E})},children:[e.jsx("option",{value:"0",children:"0"}),e.jsx("option",{value:"1",children:"I"}),e.jsx("option",{value:"2",children:"II"}),e.jsx("option",{value:"3",children:"III"})]})]}),p&&e.jsxs("div",{className:"flex items-center justify-between w-full pt-1 border-t border-slate-200 px-1",children:[e.jsx("label",{className:"text-[8.5px] font-black text-slate-500 uppercase tracking-wider",children:"Furc"}),e.jsxs("select",{className:"text-[11px] font-black border border-slate-300 rounded bg-white px-1 py-0.5 text-slate-800 outline-none focus:border-indigo-500",value:((f=o[t])==null?void 0:f.furcation)||0,onChange:C=>{const y=Number(C.target.value);d(w=>{const E={...w};return E[t]||(E[t]=JSON.parse(JSON.stringify(de))),E[t].furcation=y,E})},children:[e.jsx("option",{value:"0",children:"0"}),e.jsx("option",{value:"1",children:"I"}),e.jsx("option",{value:"2",children:"II"}),e.jsx("option",{value:"3",children:"III"})]})]})]})]})};function Xt({embeddedPatient:t}){const s=tt(),{userProfile:o}=st(),d=t==null?void 0:t.id,[x,m]=F.useState({}),[a,v]=F.useState(null),[M,p]=F.useState(!1),[$,f]=F.useState(!1),C=F.useRef({});F.useEffect(()=>{var u;const n=(o==null?void 0:o.inquilino)||(o==null?void 0:o.tenantId)||((u=o==null?void 0:o.tenant)==null?void 0:u.id);if(!n)return;(async()=>{try{const j=await Ze(ie(se,"tenants",n));j.exists()&&v(j.data())}catch(j){console.error("Error loading clinic config",j)}})()},[o]),F.useEffect(()=>d?((async()=>{p(!0);try{const c=ie(se,"pacientes",d),u=await Ze(c);u.exists()&&u.data().periodontograma?m(u.data().periodontograma):m({})}catch(c){console.error("Error loading periodontogram",c)}finally{p(!1)}})(),()=>{Object.values(C.current).forEach(clearTimeout)}):void 0,[d]);const y=async()=>{if(d){f(!0);try{await jt(ie(se,"pacientes",d),{periodontograma:x}),s.success("Periodontograma guardado correctamente")}catch(n){console.error("Error saving periodontogram",n),s.error("Error al guardar el periodontograma")}finally{f(!1)}}},w=()=>{m(n=>{const c={...n};return[...K,...P].forEach(j=>{c[j]||(c[j]=JSON.parse(JSON.stringify(de))),["v","l"].forEach(b=>{c[j][b]||(c[j][b]=[{},{},{}]),[0,1,2].forEach(T=>{(c[j][b][T].pd===void 0||c[j][b][T].pd==="")&&(c[j][b][T].pd=2,c[j][b][T].gm=0,c[j][b][T].cal=2)})})}),c}),s.info("Sitios vacíos completados con 2mm (Salud)")},E=()=>{window.confirm("¿Deseas reiniciar todos los valores del periodontograma?")&&(m({}),s.success("Periodontograma limpiado"))},B=(n,c,u,j,b)=>{m(T=>{const N={...T};N[n]||(N[n]=JSON.parse(JSON.stringify(de))),N[n][c]||(N[n][c]=[{},{},{}]),N[n][c][u]||(N[n][c][u]={});const _=b===""?"":Number(b);N[n][c][u][j]=b===""?"":_;const I=N[n][c][u].pd!==void 0&&N[n][c][u].pd!==""?Number(N[n][c][u].pd):0,R=N[n][c][u].gm!==void 0&&N[n][c][u].gm!==""?Number(N[n][c][u].gm):0;return N[n][c][u].cal=I+R,N})},J=n=>{const c=Number(n.getAttribute("data-tooth")),u=n.getAttribute("data-face"),j=Number(n.getAttribute("data-index")),b=n.getAttribute("data-field"),N=n.getAttribute("data-upper")==="true"?K:P,_=N.indexOf(c);let I=c,R=j;if(j<2)R=j+1;else if(_<N.length-1)I=N[_+1],R=0;else return;const L=`input[data-tooth="${I}"][data-face="${u}"][data-index="${R}"][data-field="${b}"]`,G=document.getElementById("periodontograma-form"),D=G==null?void 0:G.querySelector(L);D&&(D.focus(),D.select())},q=(n,c,u,j,b,T)=>{const N=b==="gm"?T.replace(/[^\d-]/g,""):T.replace(/[^\d]/g,"");B(c,u,j,b,N);const _=n.target,I=`${c}-${u}-${j}-${b}`;C.current[I]&&(clearTimeout(C.current[I]),delete C.current[I]),N&&N.length>0&&(N==="1"||N==="-"?C.current[I]=setTimeout(()=>{J(_),delete C.current[I]},350):J(_))},i=n=>{const c=n.target,u=Number(c.getAttribute("data-tooth")),j=c.getAttribute("data-face"),b=Number(c.getAttribute("data-index")),T=c.getAttribute("data-field"),_=c.getAttribute("data-upper")==="true"?K:P,I=_.indexOf(u);if(I===-1)return;let R=u,L=b,G=T,D=j;if(n.key==="ArrowRight"||n.key==="Enter")n.preventDefault(),b<2?L=b+1:I<_.length-1&&(R=_[I+1],L=0);else if(n.key==="ArrowLeft")n.preventDefault(),b>0?L=b-1:I>0&&(R=_[I-1],L=2);else if(n.key==="ArrowDown")n.preventDefault(),T==="pd"&&(G="gm");else if(n.key==="ArrowUp")n.preventDefault(),T==="gm"&&(G="pd");else return;const A=`input[data-tooth="${R}"][data-face="${D}"][data-index="${L}"][data-field="${G}"]`,U=document.getElementById("periodontograma-form"),ae=U==null?void 0:U.querySelector(A);ae&&(ae.focus(),ae.select())},l=(()=>{let n=0,c=0,u=0,j=0,b=0;[...K,...P].forEach(R=>{const L=x[R];L&&["v","l"].forEach(G=>{const D=L[G];D&&D.forEach(A=>{if(A.pd!==void 0&&A.pd!==""){n++;const U=Number(A.pd)||0;U>b&&(b=U),U>=4&&j++,A.bleeding&&c++,A.plaque&&u++}})})});const N=n>0?Math.round(c/n*100):0,_=n>0?Math.round(u/n*100):0;let I={label:"Sin datos",color:"bg-slate-100 text-slate-600"};return n>0&&(j===0&&N<=10?I={label:"Salud Periodontal",color:"bg-emerald-50 text-emerald-700 border-emerald-200"}:j===0&&N>10?I={label:"Gingivitis",color:"bg-amber-50 text-amber-700 border-amber-200"}:b>=6?I={label:"Periodontitis Severa / Avanzada (≥6mm)",color:"bg-rose-50 text-rose-700 border-rose-200"}:b>=4&&(I={label:"Periodontitis Moderada / Leve (4-5mm)",color:"bg-orange-50 text-orange-700 border-orange-200"})),{totalProbed:n,bleedingCount:c,plaqueCount:u,pocketCount:j,bopPercent:N,plaquePercent:_,maxPocketDepth:b,dxBadge:I}})(),H=()=>{var _,I,R;const n=(a==null?void 0:a.logo)||((_=o==null?void 0:o.tenant)==null?void 0:_.logo)||"",c=(a==null?void 0:a.nombreComercial)||(a==null?void 0:a.nombre)||(a==null?void 0:a.name)||((I=o==null?void 0:o.tenant)==null?void 0:I.nombre)||"CLÍNICA DENTAL",u=(a==null?void 0:a.nit)||((R=o==null?void 0:o.tenant)==null?void 0:R.nit)||"—",j=(a==null?void 0:a.direccion)||(a==null?void 0:a.address)||"—",b=(a==null?void 0:a.telefono)||(a==null?void 0:a.phone)||"—",T=(a==null?void 0:a.email)||(a==null?void 0:a.correo)||"—",N=`
            <html>
            <head>
                <title>Periodontograma Clínico - ${(t==null?void 0:t.nombreCompleto)||""}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        color: #1e293b;
                        padding: 30px;
                        max-width: 900px;
                        margin: 0 auto;
                        line-height: 1.4;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 4px solid #2563eb;
                        padding-bottom: 22px;
                        margin-bottom: 25px;
                        gap: 20px;
                    }
                    .logo-container {
                        display: flex;
                        gap: 20px;
                        align-items: center;
                    }
                    .logo-text-placeholder {
                        width: 75px;
                        height: 75px;
                        background: #2563eb;
                        border-radius: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 32px;
                        font-weight: 900;
                        text-transform: uppercase;
                    }
                    .clinic-title {
                        margin: 0;
                        font-size: 22px;
                        font-weight: 900;
                        color: #0f172a;
                        text-transform: uppercase;
                        letter-spacing: -0.5px;
                    }
                    .clinic-meta {
                        margin: 2px 0;
                        font-size: 11.5px;
                        color: #64748b;
                        font-weight: 500;
                    }
                    .doc-info {
                        text-align: right;
                    }
                    .doc-badge {
                        background: #eff6ff;
                        padding: 10px 18px;
                        border-radius: 14px;
                        border: 2px solid #dbeafe;
                        margin-bottom: 6px;
                        display: inline-block;
                    }
                    .doc-badge span {
                        font-size: 15px;
                        font-weight: 900;
                        color: #1d4ed8;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .doc-meta {
                        margin: 0;
                        font-size: 10.5px;
                        color: #94a3b8;
                        font-weight: 900;
                        text-transform: uppercase;
                    }
                    .patient-card {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 14px 18px;
                        margin-bottom: 22px;
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 10px;
                    }
                    .info-group {
                        padding: 6px 10px;
                        background: #ffffff;
                        border-radius: 8px;
                        border: 1px solid #f1f5f9;
                    }
                    .info-label {
                        font-size: 8px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #94a3b8;
                        letter-spacing: 0.05em;
                        margin-bottom: 3px;
                    }
                    .info-value {
                        font-size: 11.5px;
                        font-weight: 700;
                        color: #1e293b;
                    }
                    .stats-card {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 12px;
                        margin-bottom: 22px;
                    }
                    .stat-box {
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 10px 14px;
                        background: #ffffff;
                    }
                    .stat-title { font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
                    .stat-val { font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 3px; }
                    .section-title {
                        font-size: 11px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #1e3a8a;
                        letter-spacing: 0.08em;
                        border-bottom: 2px solid #e2e8f0;
                        padding-bottom: 5px;
                        margin-top: 25px;
                        margin-bottom: 12px;
                    }
                    .table-perio {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 9.5px;
                        margin-bottom: 20px;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        overflow: hidden;
                    }
                    .table-perio th, .table-perio td {
                        border: 1px solid #e2e8f0;
                        padding: 4px 5px;
                        text-align: center;
                    }
                    .table-perio th {
                        background: #f8fafc;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #475569;
                    }
                    .pocket-highlight {
                        background: #fee2e2;
                        color: #991b1b;
                        font-weight: 800;
                    }
                    @media print { body { padding: 15px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-container">
                        ${n?`<img src="${n}" style="max-height: 75px; max-width: 150px; object-fit: contain;" />`:`<div class="logo-text-placeholder">${c.substring(0,1)||"O"}</div>`}
                        <div>
                            <h1 class="clinic-title">${c}</h1>
                            <p class="clinic-meta" style="font-weight: 800;">NIT: ${u}</p>
                            <p class="clinic-meta">${j}</p>
                            <p class="clinic-meta">TEL: ${b} ${T!=="—"?`| ${T}`:""}</p>
                        </div>
                    </div>
                    <div class="doc-info">
                        <div class="doc-badge">
                            <span>Periodontograma Clínico</span>
                        </div>
                        <p class="doc-meta">FECHA IMPRESIÓN: ${new Date().toLocaleDateString("es-CO")}</p>
                    </div>
                </div>

                <div class="patient-card">
                    <div class="info-group">
                        <div class="info-label">Paciente</div>
                        <div class="info-value">${(t==null?void 0:t.nombreCompleto)||"—"}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Documento Identidad</div>
                        <div class="info-value">${(t==null?void 0:t.tipoDocumento)||"C.C."} ${(t==null?void 0:t.nroDocumento)||"—"}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Nro. Historia</div>
                        <div class="info-value">#${(t==null?void 0:t.nroHistoria)||"S/N"}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Edad</div>
                        <div class="info-value">${(t==null?void 0:t.edad)||"—"}</div>
                    </div>
                </div>

                <div class="stats-card">
                    <div class="stat-box">
                        <div class="stat-title">Sitios Evaluados</div>
                        <div class="stat-val">${l.totalProbed}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-title">Sangrado (BOP)</div>
                        <div class="stat-val" style="color: #e11d48;">${l.bopPercent}%</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-title">Placa Bacteriana</div>
                        <div class="stat-val" style="color: #d97706;">${l.plaquePercent}%</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-title">Bolsas ≥ 4mm</div>
                        <div class="stat-val" style="color: #dc2626;">${l.pocketCount}</div>
                    </div>
                </div>

                <div style="margin-bottom: 20px; font-size: 12px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">
                    Diagnóstico Sugerido: <span style="padding: 4px 12px; border-radius: 8px; background: #eff6ff; border: 1.5px solid #bfdbfe; color: #1d4ed8;">${l.dxBadge.label}</span>
                </div>

                <div class="section-title">Matriz de Sondaje — Arcada Superior (Maxilar 18-28)</div>
                <table class="table-perio">
                    <thead>
                        <tr>
                            <th style="width: 100px;">Diente</th>
                            ${K.map(L=>`<th colspan="3">${L}</th>`).join("")}
                        </tr>
                        <tr>
                            <th>Cara</th>
                            ${K.map(L=>`<th>${Y(L,0)}</th><th>${Y(L,1)}</th><th>${Y(L,2)}</th>`).join("")}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Vestibular (PD)</strong></td>
                            ${K.map(L=>{var D;return(((D=x[L])==null?void 0:D.v)||[{},{},{}]).map(A=>`<td class="${A.pd>=4?"pocket-highlight":""}">${A.pd!==void 0?A.pd:"-"}</td>`).join("")}).join("")}
                        </tr>
                        <tr>
                            <td><strong>Palatino (PD)</strong></td>
                            ${K.map(L=>{var D;return(((D=x[L])==null?void 0:D.l)||[{},{},{}]).map(A=>`<td class="${A.pd>=4?"pocket-highlight":""}">${A.pd!==void 0?A.pd:"-"}</td>`).join("")}).join("")}
                        </tr>
                    </tbody>
                </table>

                <div class="section-title">Matriz de Sondaje — Arcada Inferior (Mandíbula 48-38)</div>
                <table class="table-perio">
                    <thead>
                        <tr>
                            <th style="width: 100px;">Diente</th>
                            ${P.map(L=>`<th colspan="3">${L}</th>`).join("")}
                        </tr>
                        <tr>
                            <th>Cara</th>
                            ${P.map(L=>`<th>${Y(L,0)}</th><th>${Y(L,1)}</th><th>${Y(L,2)}</th>`).join("")}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Vestibular (PD)</strong></td>
                            ${P.map(L=>{var D;return(((D=x[L])==null?void 0:D.v)||[{},{},{}]).map(A=>`<td class="${A.pd>=4?"pocket-highlight":""}">${A.pd!==void 0?A.pd:"-"}</td>`).join("")}).join("")}
                        </tr>
                        <tr>
                            <td><strong>Lingual (PD)</strong></td>
                            ${P.map(L=>{var D;return(((D=x[L])==null?void 0:D.l)||[{},{},{}]).map(A=>`<td class="${A.pd>=4?"pocket-highlight":""}">${A.pd!==void 0?A.pd:"-"}</td>`).join("")}).join("")}
                        </tr>
                    </tbody>
                </table>

                <div style="margin-top: 50px; display: flex; justify-content: space-between; gap: 60px; padding: 0 20px; page-break-inside: avoid;">
                    <div style="flex: 1; text-align: center;">
                        <div style="height: 85px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 6px;">
                            ${o!=null&&o.firmaElectronica||o!=null&&o.firma?`<img src="${o.firmaElectronica||o.firma}" style="max-height: 80px; max-width: 280px; object-fit: contain;" />`:""}
                        </div>
                        <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                            <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #0f172a;">${(o==null?void 0:o.nombreCompleto)||(o==null?void 0:o.displayName)||"Odontólogo Responsable"}</div>
                            <div style="font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase;">Especialista / Periodoncista</div>
                            ${o!=null&&o.tarjetaProfesional?`<div style="font-size: 9px; color: #64748b; font-weight: 600;">T.P. ${o.tarjetaProfesional}</div>`:""}
                        </div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="height: 85px;"></div>
                        <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                            <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #0f172a;">${(t==null?void 0:t.nombreCompleto)||"Paciente"}</div>
                            <div style="font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase;">Paciente / Conformidad</div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;Ht(N)};return e.jsxs("div",{className:"flex flex-col h-full bg-slate-50/30 animate-fadeIn min-h-0 relative p-6 md:p-8 overflow-y-auto custom-scrollbar",children:[e.jsxs("div",{className:"flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm shrink-0",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm",children:e.jsx(Oe,{size:22})}),e.jsxs("div",{children:[e.jsx("h3",{className:"text-lg font-black text-slate-800 tracking-tight",children:"Periodontograma Clínico Gráfico"}),e.jsx("p",{className:"text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5",children:"Control gráfico de bolsas, recesión, placa y sangrado (BOP)"})]})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2.5 w-full lg:w-auto",children:[e.jsxs("button",{type:"button",onClick:w,className:"px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-full font-black text-[10.5px] uppercase tracking-wider border border-slate-200 transition-all flex items-center gap-1.5",title:"Rellenar sitios vacíos con 2mm (Salud)",children:[e.jsx(ot,{size:14,className:"text-emerald-500"}),"Completar Salud (2mm)"]}),e.jsxs("button",{type:"button",onClick:E,className:"px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-full font-black text-[10.5px] uppercase tracking-wider border border-rose-100 transition-all flex items-center gap-1.5",title:"Limpiar datos del periodontograma",children:[e.jsx(Fe,{size:14}),"Limpiar"]}),e.jsxs("button",{type:"button",onClick:H,className:"px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-black text-[11px] uppercase tracking-widest transition-all shadow-md shadow-amber-500/20 flex items-center gap-2",children:[e.jsx(Ae,{size:14}),"Imprimir / PDF"]}),e.jsxs(gt,{variant:"primary",onClick:y,disabled:M||$,className:"shadow-lg shadow-blue-500/20 px-8 py-2.5 rounded-full font-black text-[11px] uppercase tracking-widest flex items-center gap-2",children:[e.jsx(Te,{size:14}),$?"Guardando...":"Guardar Cambios"]})]})]}),e.jsxs("div",{className:"grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8 shrink-0",children:[e.jsxs("div",{className:"bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between",children:[e.jsx("span",{className:"text-[9px] font-black text-slate-400 uppercase tracking-widest",children:"Sitios Evaluados"}),e.jsxs("div",{className:"flex items-end justify-between mt-2",children:[e.jsx("span",{className:"text-2xl font-black text-slate-800",children:l.totalProbed}),e.jsx("span",{className:"text-[10px] font-bold text-slate-400",children:"sitios"})]})]}),e.jsxs("div",{className:"bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between",children:[e.jsxs("span",{className:"text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1",children:[e.jsx(rt,{})," Sangrado (BOP)"]}),e.jsxs("div",{className:"flex items-end justify-between mt-2",children:[e.jsxs("span",{className:"text-2xl font-black text-rose-600",children:[l.bopPercent,"%"]}),e.jsx("span",{className:`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${l.bopPercent>25?"bg-red-50 text-red-600":"bg-emerald-50 text-emerald-600"}`,children:l.bopPercent>25?"Alto":"Normal"})]})]}),e.jsxs("div",{className:"bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between",children:[e.jsxs("span",{className:"text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1",children:[e.jsx(lt,{})," Placa Bacteriana"]}),e.jsxs("div",{className:"flex items-end justify-between mt-2",children:[e.jsxs("span",{className:"text-2xl font-black text-amber-600",children:[l.plaquePercent,"%"]}),e.jsx("span",{className:`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${l.plaquePercent>20?"bg-yellow-50 text-yellow-600":"bg-emerald-50 text-emerald-600"}`,children:l.plaquePercent>20?"Alto":"Controlado"})]})]}),e.jsxs("div",{className:"bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between",children:[e.jsxs("span",{className:"text-[9px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1",children:[e.jsx(Oe,{})," Bolsas ≥ 4mm"]}),e.jsxs("div",{className:"flex items-end justify-between mt-2",children:[e.jsx("span",{className:"text-2xl font-black text-red-600",children:l.pocketCount}),e.jsx("span",{className:`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${l.pocketCount>0?"bg-red-50 text-red-600":"bg-emerald-50 text-emerald-600"}`,children:l.pocketCount>0?`${l.pocketCount} Puntos`:"Sano"})]})]}),e.jsxs("div",{className:"col-span-2 lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between",children:[e.jsx("span",{className:"text-[9px] font-black text-indigo-500 uppercase tracking-widest",children:"Diagnóstico Periodontal"}),e.jsx("div",{className:"mt-2",children:e.jsx("span",{className:`inline-block text-[10.5px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-wide ${l.dxBadge.color}`,children:l.dxBadge.label})})]})]}),e.jsxs("form",{id:"periodontograma-form",className:"bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-10 min-h-0 mb-8 shrink-0",children:[e.jsxs("div",{className:"space-y-6",children:[e.jsx("div",{className:"flex items-center justify-between border-b border-slate-100 pb-3",children:e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"w-3 h-3 rounded-full bg-blue-500"}),e.jsx("h4",{className:"text-sm font-black text-slate-800 uppercase tracking-wider",children:"Arcada Superior (Maxilar 18 — 28)"})]})}),e.jsxs("div",{className:"space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100",children:[e.jsx(je,{teeth:K,face:"v",isUpper:!0,periodonto:x,faceLabel:"Vestibular"}),e.jsx(je,{teeth:K,face:"l",isUpper:!0,periodonto:x,faceLabel:"Palatino"})]}),e.jsx("div",{className:"w-full overflow-x-auto custom-scrollbar pb-2",children:e.jsx("div",{className:"flex gap-2.5 min-w-max p-1",children:K.map(n=>e.jsx(et,{tooth:n,isUpper:!0,periodonto:x,setPeriodonto:m,updateSite:B,handleInputChange:q,handleKeyDown:i},n))})})]}),e.jsxs("div",{className:"space-y-6 border-t border-slate-100 pt-8",children:[e.jsx("div",{className:"flex items-center justify-between border-b border-slate-100 pb-3",children:e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"w-3 h-3 rounded-full bg-emerald-500"}),e.jsx("h4",{className:"text-sm font-black text-slate-800 uppercase tracking-wider",children:"Arcada Inferior (Mandíbula 48 — 38)"})]})}),e.jsxs("div",{className:"space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100",children:[e.jsx(je,{teeth:P,face:"l",isUpper:!1,periodonto:x,faceLabel:"Lingual"}),e.jsx(je,{teeth:P,face:"v",isUpper:!1,periodonto:x,faceLabel:"Vestibular"})]}),e.jsx("div",{className:"w-full overflow-x-auto custom-scrollbar pb-2",children:e.jsx("div",{className:"flex gap-2.5 min-w-max p-1",children:P.map(n=>e.jsx(et,{tooth:n,isUpper:!1,periodonto:x,setPeriodonto:m,updateSite:B,handleInputChange:q,handleKeyDown:i},n))})})]})]}),e.jsxs("div",{className:"bg-white p-6 rounded-3xl border border-slate-100 shadow-sm shrink-0",children:[e.jsx("h4",{className:"text-xs font-black text-slate-800 uppercase tracking-widest mb-4",children:"Leyenda & Convenciones Periodontales"}),e.jsxs("div",{className:"grid grid-cols-2 md:grid-cols-4 gap-6 text-xs font-bold text-slate-500 uppercase tracking-wider",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-8 h-8 rounded-lg bg-red-50 border-2 border-red-300 text-red-700 flex items-center justify-center font-black",children:"4"}),e.jsx("span",{children:"Bolsa Profunda (≥ 4mm)"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center shadow-sm text-white text-[8px] font-black",children:"BOP"}),e.jsx("span",{children:"Sangrado al Sondaje"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shadow-sm text-white text-[8px] font-black",children:"PLA"}),e.jsx("span",{children:"Placa Bacteriana"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"text-indigo-650 font-black text-sm",children:"CAL"}),e.jsx("span",{children:"Nivel de inserción clínica (NIC)"})]})]})]})]})}export{Jt as O,Xt as P};
