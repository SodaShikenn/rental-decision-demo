import { $, escapeHTML as e } from '../../helper.js';
import { post } from '../../shared/api.js';
import { candidateInputs, candidateFingerprint, sourceLink, mapsCredit, saveNote } from '../../shared/maps.js';
import { markup, resultsMarkup, questionMarkup } from './views.js';
import { CATEGORIES, leisurePreference } from './services.js';
export function initApp(app){
  const {store}=app.extensions;$('#leisureMount').innerHTML=markup;
  let result=null, selected=null, choices=[], generation=0, controller, searchController, searchGeneration=0, fingerprint=candidateFingerprint(store.state);
  app.extensions.leisureObservation=()=>result;
  const invalidate=()=>{++generation;controller?.abort();result=null;selected=null;$('#leisureResults').innerHTML='';$('#leisureQuestion').innerHTML='';$('#leisureConfirm').innerHTML='';$('#regularDestination').hidden=true;$('#discoverLeisure').disabled=false;store.emit('context-updated');};
  async function discover(destinationId=null){
    const id=++generation;controller?.abort();controller=new AbortController();const timer=setTimeout(()=>controller.abort(),90000);
    result=null;$('#leisureResults').innerHTML='';$('#leisureQuestion').innerHTML='';$('#leisureConfirm').innerHTML='';$('#discoverLeisure').disabled=true;$('#leisureStatus').textContent='周辺施設と徒歩経路を調べています…';store.emit('context-updated');
    try {const data=await post('leisure',{candidates:candidateInputs(store.state),...(destinationId?{destinationId}:{})},{signal:controller.signal});if(id!==generation)return;
      result=data;$('#leisureResults').innerHTML=resultsMarkup(data);$('#leisureQuestion').innerHTML=questionMarkup(data);$('#leisureStatus').textContent='取得できた場所から考えてみましょう。';store.emit('context-updated');
    }catch(error){if(id===generation)$('#leisureStatus').textContent=error.name==='AbortError'?'確認がタイムアウトしました。':error.message;}
    finally{clearTimeout(timer);if(id===generation)$('#discoverLeisure').disabled=false;}
  }
  $('#discoverLeisure').addEventListener('click',()=>{selected=null;$('#regularDestination').hidden=true;discover();});
  $('#leisureQuestion').addEventListener('click',event=>{const button=event.target.closest('[data-interest]');if(!button)return;selected=button.dataset.interest;
    if(!CATEGORIES[selected]){$('#leisureConfirm').textContent=selected==='none'?'周辺の余暇施設は今は重視しません。条件は追加していません。':'保留しました。ほかの条件から考えられます。';$('#regularDestination').hidden=true;return;}
    $('#regularDestination').hidden=false;
    $('#leisureConfirm').innerHTML=`<form id="leisurePreferenceForm" class="feature-form"><label>${CATEGORIES[selected]}を使う頻度<select name="frequency"><option value="weekly">週に数回</option><option value="monthly">月に数回</option><option value="rarely">たまに</option></select></label><label>徒歩で通いやすいことは<select name="level"><option value="prefer">できれば</option><option value="must">必須</option></select></label><button class="button">この希望を確認して加える</button></form>`;
  });
  $('#leisureConfirm').addEventListener('submit',event=>{event.preventDefault();if(!CATEGORIES[selected]||!result)return;const f=Object.fromEntries(new FormData(event.target));const note=leisurePreference(selected,f.frequency,f.level);saveNote(store,note.text,note.level,note.source);$('#leisureConfirm').textContent='希望と条件メモに反映しました。';});
  $('#regularQuery').addEventListener('input',()=>{++searchGeneration;searchController?.abort();choices=[];$('#regularChoices').innerHTML='';});
  $('#regularForm').addEventListener('submit',async event=>{event.preventDefault();const id=++searchGeneration;searchController?.abort();searchController=new AbortController();const timer=setTimeout(()=>searchController.abort(),30000);
    try{const data=await post('destinations',{query:$('#regularQuery').value.trim()},{signal:searchController.signal});if(id!==searchGeneration)return;choices=data.places;$('#regularChoices').innerHTML=`<p>${mapsCredit} · 場所を確認して、徒歩を比較します。</p>${choices.map((p,i)=>`<div class="place-choice"><button class="button" data-regular="${i}">${e(p.name)} · ${e(p.address)}</button>${sourceLink(p.url)}</div>`).join('')||'<p>検索結果なし</p>'}`;}
    catch(error){if(id===searchGeneration)$('#leisureStatus').textContent=error.name==='AbortError'?'検索を中断しました。':error.message;}finally{clearTimeout(timer);}
  });
  $('#regularChoices').addEventListener('click',event=>{const button=event.target.closest('[data-regular]');if(button){const place=choices[Number(button.dataset.regular)];if(place){$('#regularChoices').innerHTML='';discover(place.id);}}});
  store.on('change',()=>{const next=candidateFingerprint(store.state);if(next!==fingerprint){fingerprint=next;invalidate();++searchGeneration;searchController?.abort();$('#regularChoices').innerHTML='';$('#leisureStatus').textContent='候補が変わりました。再確認してください。';}});
}
