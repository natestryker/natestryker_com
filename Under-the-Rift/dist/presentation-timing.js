// UI timing never consumes the seeded career simulation RNG.
export function transitionDelay(drafting=false,random=Math.random){return Math.floor((drafting?775:400)+random()*(drafting?126:351));}
