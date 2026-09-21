import test from 'node:test';
import assert from 'node:assert/strict';
import { commuteInput, commuteQuestion, commutePreference } from '../../../apps/commute/services.js';
test('schedule conversion always interprets the form as Japan time',()=>{
  const state={properties:[{id:'a',name:'A'}]};
  const form={at:'2026-09-23T09:00',mode:'TRANSIT',timeKind:'arrival',daysPerWeek:'3',objective:'fastest'};
  assert.equal(commuteInput(state,'place',form).at,'2026-09-23T00:00:00.000Z');
  assert.throws(()=>commuteInput(state,null,form),/目的地/);
});
test('questions exclude failures and confirmation stores intent rather than provider data',()=>{
  const result={schedule:{daysPerWeek:3},candidates:[{id:'a',name:'A',status:'checked',routes:[{minutes:25}],recommended:0},{id:'b',name:'B',status:'no_route',routes:[]}]};
  assert.match(commuteQuestion(result).evidence,/25分/);
  assert.equal(commuteQuestion({candidates:[]}),null);
  const note=commutePreference(result,'walking','prefer');
  assert.match(note.text,/徒歩を少なく/);assert.ok(!note.text.includes('25分'));
});
