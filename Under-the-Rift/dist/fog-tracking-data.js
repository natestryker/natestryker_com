// Shared by the display and the engine so the route and scored answer agree.
export const FOG_REGIONS={
 top:{label:'Top lane',point:[40,64]},
 mid:{label:'Mid lane',point:[160,150]},
 bot:{label:'Bot lane',point:[268,238]},
 baron:{label:'Baron pit',point:[105,100]},
 dragon:{label:'Dragon pit',point:[218,205]},
 upper:{label:'Upper jungle',point:[211,77]},
 lower:{label:'Lower jungle',point:[106,225]}
};

export const FOG_SCENARIOS=[
 {target:'top',path:[[172,136],[130,115],[94,96],[68,79]],choices:['mid','top','baron','upper'],explanation:'J kept moving northwest past the river entrance toward top lane.'},
 {target:'bot',path:[[150,155],[183,178],[213,202],[241,225]],choices:['dragon','lower','bot','mid'],explanation:'J crossed the lower river and continued southeast toward bot lane.'},
 {target:'mid',path:[[76,80],[98,93],[121,111],[141,132]],choices:['top','baron','upper','mid'],explanation:'J turned away from the upper river and approached mid from the northwest.'},
 {target:'baron',path:[[218,222],[178,187],[148,151],[125,124]],choices:['baron','top','dragon','mid'],explanation:'J followed the river northwest toward the Baron pit, without turning toward a lane.'},
 {target:'dragon',path:[[94,85],[126,111],[162,145],[192,177]],choices:['bot','mid','dragon','lower'],explanation:'J followed the river southeast toward the Dragon pit.'},
 {target:'upper',path:[[113,167],[142,140],[173,112],[192,92]],choices:['baron','upper','mid','top'],explanation:'J left the river to the northeast, heading into the upper jungle.'},
 {target:'lower',path:[[219,111],[187,146],[156,175],[127,204]],choices:['dragon','bot','mid','lower'],explanation:'J crossed southwest out of the river into the lower jungle.'},
 {target:'top',path:[[168,62],[132,57],[99,60],[71,62]],choices:['top','upper','mid','baron'],explanation:'After moving along the upper jungle edge, J continued west toward top lane.'},
 {target:'bot',path:[[260,118],[263,151],[266,184],[267,210]],choices:['mid','dragon','bot','upper'],explanation:'J stayed on the eastern flank and continued south toward bot lane.'},
 {target:'mid',path:[[251,237],[227,216],[203,191],[181,169]],choices:['dragon','mid','bot','lower'],explanation:'J moved northwest away from the lower river and toward mid lane.'},
 {target:'baron',path:[[213,66],[183,75],[154,85],[128,93]],choices:['upper','top','mid','baron'],explanation:'J moved west out of the upper jungle directly toward the Baron pit.'},
 {target:'dragon',path:[[87,241],[121,232],[157,223],[192,212]],choices:['dragon','lower','bot','mid'],explanation:'J left the lower jungle to the east and approached the Dragon pit.'}
];

export const FOG_OBSERVE_MS=4200;
export const FOG_LOST_MS=3200;
export const FOG_ANSWER_MS=8000;
export const fogScenario=c=>Number.isInteger(c.scenario)?FOG_SCENARIOS[c.scenario]:undefined;
export function fogChoices(c){
 const choices=fogScenario(c)?.choices||[];
 const offset=Number.isInteger(c.variant)?((c.variant%4)+4)%4:0;
 return choices.slice(offset).concat(choices.slice(0,offset));
}

export function fogPosition(path,progress){
 const step=Math.max(0,Math.min(1,progress))*(path.length-1);
 const i=Math.min(path.length-2,Math.floor(step)),t=step-i;
 return path[i].map((v,axis)=>v+(path[i+1][axis]-v)*t);
}
export const fogVisible=elapsed=>elapsed<FOG_LOST_MS&&!(elapsed>=1200&&elapsed<1800);
