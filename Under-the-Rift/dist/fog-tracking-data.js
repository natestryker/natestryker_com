// Shared by the display and the engine so the route and scored answer agree.
export const FOG_REGIONS={
 top:{label:'Top lane',point:[40,64]},
 mid:{label:'Mid lane',point:[160,150]},
 bot:{label:'Bot lane',point:[268,238]},
 baron:{label:'Baron pit',point:[105,100]},
 dragon:{label:'Dragon pit',point:[218,205]},
 upper:{label:'Upper jungle',point:[211,77]},
 lower:{label:'Lower jungle',point:[106,225]},
 blue:{label:'Blue buff',short:'BLUE',point:[228,112]},
 gromp:{label:'Gromp',short:'GROMP',point:[270,85]},
 wolves:{label:'Wolves',short:'WOLVES',point:[183,108]},
 red:{label:'Red buff',short:'RED',point:[92,186]},
 raptors:{label:'Raptors',short:'RAPTORS',point:[132,188]},
 krugs:{label:'Krugs',short:'KRUGS',point:[68,235]},
 scuttle:{label:'River scuttle',short:'SCUTTLE',point:[176,188]},
 base:{label:'Base / reset',short:'RESET',point:[288,32]}
};

export const FOG_OUTCOMES={
 top:'Your warning lets top lane back away from the gank.',
 mid:'Your mid laner holds an escape route and avoids the collapse.',
 bot:'Your duo lane respects the timing and keeps its summoner spells.',
 baron:'Your team covers the Baron entrance before J can take control.',
 dragon:'Your team sets river vision before the Dragon contest.',
 upper:'You track the upper-jungle rotation and protect the nearby entrance.',
 lower:'You cover the lower-jungle entrance before the invade arrives.',
 blue:'You track the blue-buff clear and find a window on the opposite side.',
 gromp:'You identify the Gromp clear and warn the nearby lane about the next timing.',
 wolves:'You track the Wolves rotation and keep mid covered.',
 red:'You identify the red-buff timing and deny an uncontested invade.',
 raptors:'You track the Raptors clear and keep your mid laner safe.',
 krugs:'You track the Krugs detour and claim space on the opposite side.',
 scuttle:'You reach the river contest with the jungler accounted for.',
 base:'You recognize the reset and take the free river-vision window.'
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
 {target:'dragon',path:[[87,241],[121,232],[157,223],[192,212]],choices:['dragon','lower','bot','mid'],explanation:'J left the lower jungle to the east and approached the Dragon pit.'},
 {target:'upper',path:[[280,175],[254,138],[236,110],[223,94]],choices:['upper','blue','mid','base'],explanation:'J moved northwest past the blue-buff entrance, continuing toward the upper jungle.'},
 {target:'lower',path:[[35,141],[57,167],[76,190],[92,209]],choices:['red','lower','krugs','raptors'],explanation:'J continued southeast beyond red buff, into the lower-jungle corridor.'},
 {target:'blue',path:[[131,201],[163,173],[192,144],[213,125]],choices:['blue','gromp','wolves','upper'],explanation:'J moved northeast from river and kept its final heading toward blue buff.'},
 {target:'blue',path:[[173,47],[190,66],[203,83],[215,99]],choices:['upper','wolves','blue','mid'],explanation:'J turned southeast through the upper-jungle corridor toward blue buff.'},
 {target:'gromp',path:[[235,198],[244,166],[252,135],[262,105]],choices:['blue','base','gromp','bot'],explanation:'J stayed near the eastern wall and continued north toward Gromp.'},
 {target:'gromp',path:[[155,38],[188,49],[220,63],[249,76]],choices:['gromp','base','upper','blue'],explanation:'J crossed east along the top edge of the jungle toward Gromp.'},
 {target:'wolves',path:[[250,210],[228,177],[208,147],[195,126]],choices:['mid','wolves','blue','baron'],explanation:'J headed northwest out of the lower river, then approached Wolves from the southeast.'},
 {target:'wolves',path:[[70,49],[100,62],[129,77],[158,94]],choices:['upper','baron','wolves','blue'],explanation:'J left the Baron side and continued east-southeast toward Wolves.'},
 {target:'red',path:[[211,202],[178,198],[146,194],[116,190]],choices:['red','raptors','lower','krugs'],explanation:'J moved west from river, passing Raptors and continuing toward red buff.'},
 {target:'red',path:[[50,94],[63,120],[75,145],[84,166]],choices:['baron','red','raptors','lower'],explanation:'J followed the western jungle corridor south-southeast toward red buff.'},
 {target:'raptors',path:[[225,100],[200,123],[176,147],[151,170]],choices:['mid','red','raptors','scuttle'],explanation:'J cut southwest out of river toward the Raptors camp.'},
 {target:'raptors',path:[[45,239],[69,225],[92,212],[112,200]],choices:['lower','red','krugs','raptors'],explanation:'J left the lower wall and continued northeast toward Raptors.'},
 {target:'krugs',path:[[166,178],[137,194],[113,208],[89,222]],choices:['krugs','red','lower','raptors'],explanation:'J moved southwest past the lower-jungle corridor toward Krugs.'},
 {target:'krugs',path:[[45,103],[51,141],[57,177],[63,211]],choices:['red','krugs','lower','top'],explanation:'J stayed beside the western wall and continued south toward Krugs.'},
 {target:'scuttle',path:[[259,112],[237,131],[217,151],[194,172]],choices:['dragon','mid','scuttle','raptors'],explanation:'J moved southwest along the riverbank toward the Scuttle contest.'},
 {target:'scuttle',path:[[78,249],[105,232],[131,216],[155,201]],choices:['lower','raptors','dragon','scuttle'],explanation:'J left the lower jungle and headed northeast into the river toward Scuttle.'},
 {target:'base',path:[[186,128],[215,100],[242,75],[269,49]],choices:['base','gromp','upper','blue'],explanation:'J continued northeast past the jungle camps toward the base entrance.'},
 {target:'base',path:[[275,183],[279,142],[282,102],[285,65]],choices:['gromp','blue','base','bot'],explanation:'J followed the eastern wall north, continuing beyond Gromp toward base for a reset.'}
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
