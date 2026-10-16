/* Deterministic SVG sigils: stable across reloads, no image downloads. */
(()=>{'use strict';const cache=new Map();function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0}
function svg(name){if(cache.has(name))return cache.get(name);const e=GAME.elements[name],mutation=e.category==='Mutation',h=hash(name),h2=hash(name+'::sigil'),hue=mutation?300+(h%35):h%360,color=`hsl(${hue} 72% 72%)`,accent=`hsl(${(hue+65)%360} 82% 80%)`;let parts=[];
 parts.push(`<rect x="1" y="1" width="38" height="38" rx="${mutation?12:8}" fill="hsl(${hue} 40% 15%)" stroke="${color}" stroke-opacity=".45"/>`);
 const sides=3+h%6,r=10+h2%4,rotation=(h2%360)*Math.PI/180,points=[];for(let i=0;i<sides;i++){const a=rotation+i*2*Math.PI/sides;points.push((20+Math.cos(a)*r).toFixed(2)+','+(20+Math.sin(a)*r).toFixed(2))}
 parts.push(`<polygon points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="1.5"/>`);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,x=20+16*Math.cos(a),y=20+16*Math.sin(a);if((h>>>i)&1)parts.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${1+(h2>>>i&1)*.6}" fill="${accent}"/>`)}
 for(let i=0;i<5;i++){const x=12+i*4,y=13+((h2>>>(i*4))&15);parts.push(`<path d="M${x} ${y}L${40-x} ${40-y}" stroke="${accent}" stroke-width="1.3" stroke-linecap="round"/>`)}
 if(mutation)parts.push(`<path d="M18 13L22 13L20 19L25 19L17 29L19 22L15 22Z" fill="${accent}" stroke="#38203e" stroke-width="1"/>`);else parts.push(`<circle cx="20" cy="20" r="${2+h%3}" fill="${color}"/>`);
 const out=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${parts.join('')}</svg>`;if(cache.size>=1200)cache.delete(cache.keys().next().value);cache.set(name,out);return out}
window.CRAFT_GLYPHS={svg,url:name=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(name))};
})();
