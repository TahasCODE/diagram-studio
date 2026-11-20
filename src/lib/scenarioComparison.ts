import type {Scenario} from './model';
export function compareScenarios(left:Scenario,right:Scenario){
  let prefix=0;
  while(prefix<Math.min(left.steps.length,right.steps.length)&&left.steps[prefix]===right.steps[prefix])prefix++;
  const a=new Set(left.steps),b=new Set(right.steps);
  return {prefix,identical:prefix===left.steps.length&&prefix===right.steps.length,
    shared:new Set([...a].filter(id=>b.has(id))),leftOnly:new Set([...a].filter(id=>!b.has(id))),rightOnly:new Set([...b].filter(id=>!a.has(id)))};
}
