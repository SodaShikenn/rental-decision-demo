import { $, escapeHTML as e } from '../../helper.js';
import { post } from '../../shared/api.js';
import { candidateFingerprint, sourceLink, mapsCredit, saveNote } from '../../shared/maps.js';
import { commuteInput, commutePreference, OBJECTIVES } from './services.js';
import { markup, resultsMarkup } from './views.js';

export function initApp(app) {
  const {store}=app.extensions;
  $('#commuteMount').innerHTML=markup;
  let destination=null, choices=[], result=null, tentative=null, controller, searchController, generation=0, searchGeneration=0;
  let candidates=candidateFingerprint(store.state);
  app.extensions.commuteObservation=()=>result;
  app.extensions.workDestination=()=>destination ? $('#destinationQuery').value.trim() : '';
  const invalidate=()=>{ ++generation; controller?.abort(); result=null; tentative=null; $('#commuteResults').innerHTML=''; $('#commuteForm button').disabled=false; store.emit('context-updated'); };
  const resetDestination=()=>{ ++searchGeneration; searchController?.abort(); destination=null; choices=[]; $('#destinationChoices').innerHTML=''; $('#destinationConfirmed').textContent=''; $('#destinationForm button').disabled=false; invalidate(); };
  $('#destinationQuery').addEventListener('input',resetDestination);
  $('#destinationForm').addEventListener('submit',async event=>{
    event.preventDefault(); resetDestination(); const id=searchGeneration;
    searchController=new AbortController(); const timer=setTimeout(()=>searchController.abort(),30000);
    $('#destinationForm button').disabled=true; $('#commuteStatus').textContent='目的地を探しています…';
    try { const data=await post('destinations',{query:$('#destinationQuery').value.trim()},{signal:searchController.signal}); if(id!==searchGeneration)return;
      choices=data.places; $('#destinationChoices').innerHTML=`<p>${mapsCredit} · 場所と住所を確認して選んでください。</p>${choices.map((p,i)=>`<div class="place-choice"><button class="button" data-destination="${i}">${e(p.name)}<br>${e(p.address)}</button>${sourceLink(p.url)}</div>`).join('')}`;
      $('#commuteStatus').textContent=choices.length?'':'目的地が見つかりません。住所や駅名で試してください。';
    } catch(error){ if(id===searchGeneration)$('#commuteStatus').textContent=error.name==='AbortError'?'検索がタイムアウトしました。':error.message; }
    finally{ clearTimeout(timer); if(id===searchGeneration)$('#destinationForm button').disabled=false; }
  });
  $('#destinationChoices').addEventListener('click',event=>{const b=event.target.closest('[data-destination]');if(!b)return;destination=choices[Number(b.dataset.destination)];invalidate();$('#destinationChoices').innerHTML='';$('#destinationConfirmed').textContent=`確認した目的地：${destination.name} · ${destination.address}`;});
  // Use Japan time regardless of the viewer's OS timezone.
  const tomorrow=new Date(Date.now()+86400000); const date=new Date(+tomorrow+9*3600000).toISOString().slice(0,10);
  $('#commuteForm [name=at]').value=`${date}T09:00`;
  $('#commuteForm').addEventListener('input',()=>{invalidate();$('#commuteStatus').textContent='条件を変えました。もう一度比較してください。';});
  $('#commuteForm').addEventListener('submit',async event=>{
    event.preventDefault(); invalidate(); const id=generation;
    try { const input=commuteInput(store.state,destination?.id,Object.fromEntries(new FormData(event.currentTarget)));
      controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),90000);
      $('#commuteForm button').disabled=true; $('#commuteStatus').textContent='全候補を同じ条件で調べています…';
      try { const data=await post('commutes',input,{signal:controller.signal}); if(id!==generation)return;
        result=data;$('#commuteResults').innerHTML=resultsMarkup(data);$('#commuteStatus').textContent='取得結果を比較できます。経路がない候補は地図で確認してください。';store.emit('context-updated');
      } finally {clearTimeout(timer);}
    } catch(error) {if(id===generation)$('#commuteStatus').textContent=error.name==='AbortError'?'確認がタイムアウトしました。':error.message;}
    finally {if(id===generation)$('#commuteForm button').disabled=false;}
  });
  $('#commuteResults').addEventListener('click',event=>{
    const choice=event.target.closest('[data-commute-choice]');
    if(choice){ tentative=choice.dataset.commuteChoice; $('#commuteConfirm').innerHTML=tentative==='later'?'<p>今は決めずに、ほかの条件も比べましょう。</p>':`<p>「${OBJECTIVES[tentative]}」を希望に加えますか？</p><button class="button" data-commute-level="must">必須として確認</button> <button class="button" data-commute-level="prefer">できればとして確認</button>`;return; }
    const level=event.target.closest('[data-commute-level]');if(!level||!result||!OBJECTIVES[tentative])return;
    const note=commutePreference(result,tentative,level.dataset.commuteLevel); saveNote(store,note.text,note.level,note.source,note.details); $('#commuteConfirm').textContent='希望と条件メモに反映しました。';
  });
  store.on('change',()=>{const next=candidateFingerprint(store.state);if(next!==candidates){candidates=next;invalidate();$('#commuteStatus').textContent='候補が変わりました。再確認してください。';}});
}
