import test from 'node:test';
import assert from 'node:assert/strict';
import { advisorEvidence, confirmProposal, requestAdvice } from '../../../apps/advisor/services.js';
import { emptyPriorities, priorityMemo } from '../../../apps/priorities/services.js';
import { sessionSnapshot, validSnapshot } from '../../../extensions/session.js';
import { createStore } from '../../../extensions/ext_store.js';

test('unknown and uncertain candidate values remain unknown in AI context', () => {
  const data = advisorEvidence([{id:'a', name:'候補', rent:100000, managementFee:null, areaSqm:25, unconfirmedFields:['areaSqm']}]);
  assert.equal(data.find((e)=>e.id==='c0-budget').kind,'unknown');
  assert.equal(data.find((e)=>e.id==='c0-area').kind,'unknown');
});
test('confirming a proposal updates numeric fit inputs or narrative memo only explicitly', () => {
  const before = emptyPriorities();
  const after = confirmProposal(before,{key:'budget',value:110000,level:'prefer',text:'費用'});
  assert.equal(before.budget.value,null);
  assert.equal(after.budget.value,110000);
  const note = confirmProposal(after,{key:'note',level:'later',text:'帰宅が遅い日の買い物を確認する'});
  assert.match(priorityMemo(note),/帰宅が遅い/);
});
test('session snapshot keeps decisions but excludes map-derived conversations', () => {
  const { state } = createStore({properties:[],settings:{moveIn:'2026-10-01'}});
  state.advisor = {history:[{role:'assistant',text:'map content'}],usesMaps:true};
  const snap = sessionSnapshot(state);
  assert.deepEqual(snap.state.advisor.history,[]);
  assert.equal(validSnapshot(snap),true);
  assert.equal(validSnapshot({version:9,state}),false);
  assert.equal(validSnapshot({version:1,state:{...state,priorities:{}}}),false);
});
test('provider failures never become AI responses', async () => {
  await assert.rejects(requestAdvice('',{}),/未設定/);
  await assert.rejects(requestAdvice('/api/advise',{}, {fetchImpl:async()=>({ok:false,json:async()=>({error:{message:'失敗'}})})}),/失敗/);
});
