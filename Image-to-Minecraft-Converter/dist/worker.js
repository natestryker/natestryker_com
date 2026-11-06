import {convert} from './engine.js';self.onmessage=e=>{try{postMessage({cells:convert(e.data)})}catch(error){postMessage({error:error.message})}};
