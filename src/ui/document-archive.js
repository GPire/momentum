import {createDocumentArchive,verifyDocumentArchive} from '../invoice/document-archive.js';
import {loadDocumentArchive,saveDocumentArchive} from '../invoice/document-storage.js';
import {documentPersistenceCopy} from '../i18n/document-archive.js';
import {documentArchiveCopy} from '../i18n/document-archive.js';
import {readVerifactuReceipt,readSdiReceipt,receiptXml} from '../invoice/national-receipt.js';
import {nationalReceiptCopy,sdiReceiptCopy} from '../i18n/national-receipt.js';
export function mountDocumentArchive(root,{country,invoiceId,lang,store}){
 const c=documentArchiveCopy(lang);let files=[],selected=null,busy=false,hash=null;
 const section=document.createElement('section');section.className='finance-workspace collection-workspace';root.append(section);
 const heading=document.createElement('h3');heading.textContent=c.title;
 const intro=document.createElement('p');intro.textContent=documentPersistenceCopy(lang);
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const actions=document.createElement('div');actions.className='collection-list';
 const list=document.createElement('div');list.className='collection-list';section.append(heading,intro,actions,status,list);
 const download=(blob,name)=>{const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const run=async fn=>{if(busy)return;busy=true;status.textContent=c.busy;for(const b of actions.querySelectorAll('button'))b.disabled=true;try{await fn();status.textContent=files.length?c.verified:c.empty;}catch{status.textContent=c.error;}finally{busy=false;draw();}};
 const choose=(kind)=>{if(kind==='receipt'&&!selected){status.textContent=c.choose;return;}const input=document.createElement('input');input.type='file';input.hidden=true;input.accept=kind==='package'?'.json':'.xml,.pdf,.p7m,.png,.jpg,.jpeg';
 input.onchange=()=>run(async()=>{const f=input.files?.[0];if(!f)return;if(f.size>(kind==='package'?30000000:6000000))throw Error();
 if(kind==='package'){const packet=JSON.parse(await f.text());if(!(await verifyDocumentArchive(packet)).ok||packet.country!==country||packet.invoiceId!==invoiceId)throw Error();if(files.length)throw Error();hash=await saveDocumentArchive(store,packet,hash);files=packet.files;selected=files.find(f=>f.kind==='invoice')?.id;}
 else{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});const next=[...files,{id:crypto.randomUUID(),kind:kind==='receipt'?'receipt':'invoice',name:f.name,data,...(kind==='receipt'?{documentId:selected}:{})}];const archive=await createDocumentArchive({country,invoiceId,files:next});hash=await saveDocumentArchive(store,archive,hash);files=next;selected ||= files[0].id;}}).finally(()=>input.remove());section.append(input);input.click();};
 const button=(title,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn-action';b.textContent=title;b.onclick=fn;return b;};
 function addReceiptReader(item,file){
  if(!['IT','ES'].includes(country)||file.kind!=='receipt')return;
  item.classList.add('receipt-file');
  const copy=country==='IT'?sdiReceiptCopy(lang):nationalReceiptCopy(lang),output=document.createElement('div');output.className='receipt-outcomes';output.setAttribute('aria-live','polite');
  item.append(button(copy.read,()=>{
   output.replaceChildren();
   try{
    const result=(country==='IT'?readSdiReceipt:readVerifactuReceipt)(receiptXml(file.data));
    const notice=document.createElement('p');notice.textContent=copy.notice;output.append(notice);
    if(!result.lines.length){const p=document.createElement('p');p.textContent=copy.empty;output.append(p);}
    let shown=0;
    const more=button(copy.more,()=>render());
    const render=()=>{
     more.remove();
     for(const line of result.lines.slice(shown,shown+20)){
      const row=document.createElement('article');row.className='collection-item';
      const title=document.createElement('strong');title.textContent=`${line.number} · ${line.date}`;
      const detail=document.createElement('p');detail.textContent=`${line.issuer} · ${copy[line.operation]} · ${copy[line.status]}`;
      row.append(title,detail);
      if(line.code||line.description||line.duplicate){const p=document.createElement('p');p.textContent=[line.code,line.description,line.duplicate?copy.duplicate:null].filter(Boolean).join(' · ');row.append(p);}
      output.append(row);
     }
     shown+=20;if(shown<result.lines.length)output.append(more);
    };render();
   }catch{output.textContent=copy.error;}
  }),output);
 }
 const add=button(c.add,()=>choose('invoice')),receipt=button(c.receipt,()=>choose('receipt')),open=button(c.open,()=>choose('package')),save=button(c.save,()=>run(async()=>{const a=await createDocumentArchive({country,invoiceId,files});download(new Blob([JSON.stringify(a)],{type:'application/json'}),'momentum-documents.json');}));actions.append(add,receipt,open,save);
 function draw(){add.disabled=busy;receipt.disabled=busy||!selected;open.disabled=busy||files.length>0;save.disabled=busy||!files.length;list.replaceChildren();if(!files.length){const p=document.createElement('p');p.textContent=c.empty;list.append(p);}for(const f of files){const item=document.createElement('article');item.className='collection-item';const name=document.createElement('strong');name.textContent=f.name;item.append(name);if(f.kind==='invoice'){const target=button(c.target,()=>{selected=f.id;draw();});target.setAttribute('aria-pressed',String(selected===f.id));item.append(target);}item.append(button(c.download,()=>{if(f.data.startsWith('data:')){const match=/^data:[^,]*;base64,([A-Za-z0-9+/=\r\n]*)$/.exec(f.data);if(!match){status.textContent=c.error;return;}try{const bytes=Uint8Array.from(atob(match[1]),v=>v.charCodeAt(0));download(new Blob([bytes],{type:'application/octet-stream'}),f.name);}catch{status.textContent=c.error;}}else download(new Blob([f.data],{type:'application/octet-stream'}),f.name);}));addReceiptReader(item,f);list.append(item);}}
 draw();
 run(async()=>{const archive=await loadDocumentArchive(store,country,invoiceId);if(archive){files=archive.files;hash=archive.manifestSha256;selected=files.find(f=>f.kind==='invoice')?.id;}});
}
