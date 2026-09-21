export const CATEGORIES={park:'公園',gym:'ジム',cafe:'カフェ',regular:'いつもの場所'};
export function availableInterests(result) {
  return Object.entries(CATEGORIES).filter(([key])=>(result?.candidates||[]).some(c=>c.groups.some(g=>g.kind===key&&g.places.length))).map(([key,label])=>({key,label}));
}
export function leisurePreference(key,frequency,level) {
  if(!CATEGORIES[key]||!['weekly','monthly','rarely'].includes(frequency)||!['must','prefer'].includes(level)) throw new Error('希望を確認してください。');
  const how={weekly:'週に数回',monthly:'月に数回',rarely:'たまに'}[frequency];
  return {text:`${CATEGORIES[key]}を${how}使いたい。徒歩で通いやすいことを${level==='must'?'重視':'できれば希望'}。営業時間や用途への適合は現地で確認する。`,level,source:`leisure:${key}`};
}
export function nearestKnown(result,id,kind) {
  const group=result?.candidates.find(c=>c.id===id)?.groups.find(g=>g.kind===kind);
  const known=(group?.places||[]).filter(p=>p.route?.minutes!=null&&p.businessStatus==='OPERATIONAL');
  return known.length?Math.min(...known.map(p=>p.route.minutes)):null;
}
