import {makeModel,runComparison} from './decision.mjs?v=settle1';
self.onmessage=({data})=>{try{const model=Number.isFinite(data.km)?{cargo:data.cargo,km:data.km}:makeModel(data.cargo);const results=['none','rule','predictive'].map(mode=>runComparison(model,data.queue,data.cfg,mode));self.postMessage({results});}catch(error){self.postMessage({error:error.message});}};
