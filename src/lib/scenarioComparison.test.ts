import {describe,it,expect} from 'vitest';
import {compareScenarios} from './scenarioComparison';
const path=(steps:string[])=>({name:'Path',steps});
describe('scenario comparison',()=>{
 it('separates a common opening from unique outcomes without counting repeated visits twice',()=>{
  const result=compareScenarios(path(['api','cache','db','api']),path(['api','cache','error']));
  expect(result.prefix).toBe(2);expect([...result.shared]).toEqual(['api','cache']);expect([...result.leftOnly]).toEqual(['db']);expect([...result.rightOnly]).toEqual(['error']);expect(result.identical).toBe(false);
 });
 it('recognizes reordered shared nodes and a path ending before another',()=>{
  expect(compareScenarios(path(['a','b']),path(['b','a'])).prefix).toBe(0);
  const result=compareScenarios(path(['a']),path(['a','b']));expect(result.prefix).toBe(1);expect(result.identical).toBe(false);
 });
 it('handles identical, repeated and empty paths',()=>{
  expect(compareScenarios(path(['a','a']),path(['a','a'])).identical).toBe(true);
  expect(compareScenarios(path([]),path([])).identical).toBe(true);
  const result=compareScenarios(path([]),path(['a']));expect(result.prefix).toBe(0);expect(result.shared.size).toBe(0);expect(result.rightOnly.size).toBe(1);
 });
});
