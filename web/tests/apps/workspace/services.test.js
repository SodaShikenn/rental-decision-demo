import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePair, replacePair, visibleCandidates, contextualQuestion } from '../../../apps/workspace/services.js';
import { emptyPriorities } from '../../../apps/priorities/services.js';
import { advisorInput, advisorEvidence } from '../../../apps/advisor/services.js';
import { createStore } from '../../../extensions/ext_store.js';
const properties = ['a', 'b', 'c'].map(id => ({ id, name: `Apartment ${id}` }));
test('mobile selection never removes candidates and desktop retains input order', () => {
  assert.deepEqual(visibleCandidates(properties, {mobile: true, pair: ['c','a']}).map(p=>p.id), ['c','a']);
  assert.deepEqual(visibleCandidates(properties, {mobile: false, pair: ['c','a']}), properties);
  assert.equal(properties.length, 3);
});
test('selecting the other candidate swaps the pair and deleted candidates are replaced', () => {
  assert.deepEqual(replacePair(properties,['a','b'],0,'b'), ['b','a']);
  assert.deepEqual(replacePair(properties,['a','b'],1,'c'), ['a','c']);
  assert.deepEqual(normalizePair(properties.slice(0,2),['c','a']), ['a','b']);
  assert.deepEqual(normalizePair(properties,['b','b']), ['b','a']);
  assert.deepEqual(normalizePair([],['a']), []);
  assert.deepEqual(normalizePair(properties.slice(0,1),['c']), ['a']);
});
test('questions follow the view without converting navigation into preferences', () => {
  const priorities=emptyPriorities();
  const questions=['budget','walk','area'].map(key=>({key,fingerprint:key}));
  assert.equal(contextualQuestion(questions,priorities,{}, {dimension:'space'}).key,'area');
  assert.equal(contextualQuestion(questions,priorities,{}, {dimension:'living'}), null);
  assert.equal(contextualQuestion(questions,priorities,{budget:'budget'}, {dimension:'cost'}), null);
  assert.equal(contextualQuestion(questions,priorities,{budget:'old'}, {dimension:'cost'}).key,'budget');
  assert.equal(priorities.area.level, 'later');
  priorities.budget={level:'prefer', value:110000};
  assert.equal(contextualQuestion(questions,priorities,{}, {dimension:'cost'}),null);
  assert.equal(contextualQuestion(questions,priorities,{}, {dimension:'all'}).key,'walk');
});
test('AI receives the selected view and evidence for the mobile pair only', () => {
  const {state}=createStore({properties,settings:{moveIn:'2026-10-01',brokerageMonths:1}});
  state.workspace={mobile:true,pair:['b','c'],dimension:'access'};
  const evidence=advisorEvidence(visibleCandidates(properties,state.workspace));
  const input=advisorInput(state,evidence,[]);
  assert.equal(input.focus,'access');
  assert.deepEqual([...new Set(input.evidence.map(e=>e.candidate))],['Apartment b','Apartment c']);
  assert.ok(!input.confirmed.includes('Apartment a'));
  assert.equal(state.priorities.walk.level,'later');
});
