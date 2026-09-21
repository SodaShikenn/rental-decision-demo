import test from 'node:test';
import assert from 'node:assert/strict';
import {availableInterests,leisurePreference,nearestKnown} from '../../../apps/leisure/services.js';
test('actual returned places enable questions without confirming an interest',()=>{
  const result={candidates:[{id:'a',groups:[{kind:'park',places:[]},{kind:'gym',places:[{businessStatus:'CLOSED_TEMPORARILY',route:{minutes:2}},{businessStatus:'OPERATIONAL',route:null}]}]}]};
  assert.deepEqual(availableInterests(result),[{key:'gym',label:'ジム'}]);
  assert.equal(nearestKnown(result,'a','gym'),null);
  assert.deepEqual(availableInterests(null),[]);
  assert.throws(()=>leisurePreference('none','weekly','prefer'));
  assert.match(leisurePreference('gym','weekly','prefer').text,/週に数回/);
});
