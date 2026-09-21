import { $, escapeHTML as e } from '../../helper.js';
import { post } from '../../shared/api.js';
import { sourceLink, mapsCredit, saveNote } from '../../shared/maps.js';
import { observation, reviewTopics } from './services.js';
import { markup, resultsMarkup } from './views.js';
export function initApp(app){
  const {store}=app.extensions;$('#reviewsMount').innerHTML=markup;
  let result=null, choices=[], generation=0, controller, fingerprint='';
  const property=()=>store.state.properties.find(p=>p.id===$('#reviewCandidate').value);
  function invalidate(){++generation;controller?.abort();result=null;choices=[];$('#reviewChoices').innerHTML='';$('#reviewResults').innerHTML='';$('#reviewSearch').disabled=false;}
  function renderOwn(){const p=property();$('#ownObservations').innerHTML=(store.state.observations||[]).filter(o=>o.candidateId===p?.id).map(o=>`<article class="review-entry"><h4>自分の内見記録 · ${e(o.date)}</h4><p>${e(o.text)}</p><button class="link-button" data-remove-observation="${e(o.id)}">この記録を削除</button></article>`).join('');}
  function render(){const select=$('#reviewCandidate'),old=select.value;select.innerHTML=store.state.properties.map(p=>`<option value="${e(p.id)}">${e(p.name)}</option>`).join('');if(store.state.properties.some(p=>p.id===old))select.value=old;
    const p=property(),next=JSON.stringify(p?{id:p.id,name:p.name,address:p.address}:null);if(next!==fingerprint){fingerprint=next;invalidate();}renderOwn();}
  async function run(path,input){invalidate();const id=generation;controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);$('#reviewSearch').disabled=true;$('#reviewStatus').textContent='建物の一致と情報を確認しています…';
    try{const data=await post(path,input,{signal:controller.signal});if(id!==generation)return;
      if(path==='reviews/search'){choices=data.places;$('#reviewChoices').innerHTML=`<p>${mapsCredit}</p>${choices.map((p,i)=>`<div class="place-choice"><button class="button" data-review-place="${i}">${e(p.name)} · ${e(p.address)}<br>この建物であることを確認して口コミを見る</button>${sourceLink(p.url)}</div>`).join('')}`;$('#reviewStatus').textContent=choices.length?'名前と住所を見て、対象の建物を確認してください。':'建物を一致させられません。住所・建物名を確認してください。';}
      else{result=data;$('#reviewResults').innerHTML=resultsMarkup(data);$('#reviewStatus').textContent='投稿者の報告と、自分の確認を分けて記録できます。';}
    }catch(error){if(id===generation)$('#reviewStatus').textContent=error.name==='AbortError'?'確認がタイムアウトしました。':error.message;}
    finally{clearTimeout(timer);if(id===generation)$('#reviewSearch').disabled=false;}
  }
  $('#reviewCandidate').addEventListener('change',()=>{fingerprint='';render();});
  $('#reviewSearch').addEventListener('click',()=>{const p=property();if(!p?.address){$('#reviewStatus').textContent='候補の住所を番地まで補ってください。';return;}run('reviews/search',{name:p.name,address:p.address});});
  $('#reviewChoices').addEventListener('click',event=>{const b=event.target.closest('[data-review-place]');if(!b)return;const place=choices[Number(b.dataset.reviewPlace)],p=property();if(place&&p)run('reviews',{name:p.name,address:p.address,placeId:place.id,confirmed:true});});
  $('#reviewResults').addEventListener('click',event=>{const b=event.target.closest('[data-review-topic]');if(!b||!result)return;const topic=reviewTopics(result.reviews).find(t=>t.key===b.dataset.reviewTopic);if(topic){saveNote(store,`${property().name}の内見で確認：${topic.question}`,'later',`review-check:${property().id}:${topic.key}`);$('#reviewStatus').textContent='投稿を事実として断定せず、内見での確認事項に加えました。';}});
  $('#observationForm [name=date]').value=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  $('#observationForm').addEventListener('submit',event=>{event.preventDefault();try{const form=Object.fromEntries(new FormData(event.target));const entry=observation(property()?.id,form.text,form.date);store.setObservations([...(store.state.observations||[]),entry].slice(-100));$('#observationForm [name=text]').value='';$('#reviewStatus').textContent='自分の内見記録を保存しました。';}catch(error){$('#reviewStatus').textContent=error.message;}});
  $('#ownObservations').addEventListener('click',event=>{const b=event.target.closest('[data-remove-observation]');if(b)store.setObservations(store.state.observations.filter(o=>o.id!==b.dataset.removeObservation));});
  store.on('change',render);render();
}
