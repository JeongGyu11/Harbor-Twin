import {makeModel,runComparison} from './decision.mjs?v=env2';
self.onmessage=({data})=>{try{const model=makeModel(data.cargo);const results=['none','rule','predictive'].map(mode=>runComparison(model,data.queue,data.cfg,mode));self.postMessage({results});}catch(error){self.postMessage({error:error.message});}};
