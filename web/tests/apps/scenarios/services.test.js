import test from 'node:test';
import assert from 'node:assert/strict';
import {scenarioRows,journeyEvidence} from '../../../apps/scenarios/services.js';
const properties=[{id:'a',name:'A',rent:100000,managementFee:0},{id:'b',name:'B',rent:null,managementFee:0}];
const commute={checkedAt:'2026-09-22',schedule:{mode:'TRANSIT',at:'2026-09-23',timeKind:'arrival',daysPerWeek:3,objective:'fastest'},candidates:[{id:'a',status:'checked',routes:[{minutes:20,transfers:2,walkingMinutes:5},{minutes:30,transfers:0,walkingMinutes:10}]},{id:'b',status:'no_route',routes:[]}]};
test('confirmed route objective changes explanation without promoting missing values',()=>{
  const state={properties,priorities:{notes:[]}};
  assert.equal(scenarioRows(state,commute,null,3)[0].weeklyOutboundMinutes,60);
  state.priorities.notes=[{source:'commute',details:{objective:'transfers'}}];
  const rows=scenarioRows(state,commute,null,3);
  assert.equal(rows[0].weeklyOutboundMinutes,90);
  assert.equal(rows[1].monthly,null);assert.deepEqual(rows[1].advantages,[]);
  assert.equal(scenarioRows(state,commute,null,0)[1].weeklyOutboundMinutes,0);
});
test('AI observations are scoped and marked ephemeral Maps evidence',()=>{
  const evidence=journeyEvidence([properties[0]],commute,null);
  assert.equal(evidence.length,1);assert.equal(evidence[0].kind,'maps');assert.match(evidence[0].text,/未確認の場合/);
});
