export function stackSlots(entries){const slots=[];for(const [block,count]of entries){for(let left=count;left>0;left-=64)slots.push({block,count:Math.min(64,left)})}return slots}
