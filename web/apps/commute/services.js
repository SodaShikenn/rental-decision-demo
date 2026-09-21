import { candidateInputs } from '../../shared/maps.js';
export const OBJECTIVES = {fastest:'所要時間を短く',transfers:'乗換を少なく',walking:'徒歩を少なく'};
export function commuteInput(state, destinationId, form) {
  if (!destinationId) throw new Error('候補から目的地を選んで確認してください。');
  const at=new Date(`${form.at}:00+09:00`);
  if(!Number.isFinite(+at)) throw new Error('日時を入力してください。');
  return {candidates:candidateInputs(state),destinationId,at:at.toISOString(),timezone:'Asia/Tokyo',timeKind:form.timeKind,mode:form.mode,daysPerWeek:Number(form.daysPerWeek),objective:form.objective};
}
export function selectedRoutes(result) { return (result?.candidates||[]).flatMap(c=>c.status==='checked' && c.recommended!=null ? [{id:c.id,name:c.name,...c.routes[c.recommended]}] : []); }
export function commuteQuestion(result) {
  const routes=selectedRoutes(result);
  if(!routes.length) return null;
  const values=routes.map(r=>r.minutes);
  return {evidence:routes.map(r=>`${r.name}：片道${r.minutes}分`).join('／'), text:`片道${Math.min(...values)}${new Set(values).size>1?`〜${Math.max(...values)}`:''}分。この通勤で何を優先したいですか？`};
}
export function commutePreference(result, objective, level) {
  return {text:`通勤は週${result.schedule.daysPerWeek}日を想定し、${OBJECTIVES[objective]}ことを${level==='must'?'重視':'できれば希望'}。経路・時刻はその都度再確認する。`,level,source:'commute',details:{objective,daysPerWeek:result.schedule.daysPerWeek}};
}
