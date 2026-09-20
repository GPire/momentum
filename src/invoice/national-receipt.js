const base='https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/';
const responseNS=base+'RespuestaSuministro.xsd',infoNS=base+'SuministroInformacion.xsd';
const children=(node,name,ns)=>Array.from(node.children).filter(n=>n.localName===name&&n.namespaceURI===ns);
function one(node,name,ns=responseNS,required=true){
 const nodes=children(node,name,ns);
 if(nodes.length>1||(required&&nodes.length!==1))throw Error('Invalid receipt field');
 return nodes[0];
}
function scalar(node,name,ns=responseNS,required=true,max=1500){
 const el=one(node,name,ns,required);if(!el)return null;
 if(el.children.length)throw Error('Invalid scalar');
 const value=el.textContent.trim();if(!value||value.length>max)throw Error('Invalid receipt value');
 return value;
}
// Reads declared outcomes only. Neither an XSD validator nor proof of AEAT origin.
// Never writes invoice status or interprets a batch result as an invoice result.
export function readVerifactuReceipt(xml){
 if(typeof xml!=='string'||xml.length>2000000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Unsupported XML');
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.getElementsByTagName('parsererror').length||doc.doctype)throw Error('Invalid XML');
 let root=doc.documentElement;
 if(root.localName==='Envelope'&&['http://schemas.xmlsoap.org/soap/envelope/','http://www.w3.org/2003/05/soap-envelope'].includes(root.namespaceURI)){
  const body=one(root,'Body',root.namespaceURI);if(body.children.length!==1)throw Error('Ambiguous SOAP body');root=body.children[0];
 }
 if(root.localName!=='RespuestaRegFactuSistemaFacturacion'||root.namespaceURI!==responseNS)throw Error('Unsupported receipt');
 const batchStatus=scalar(root,'EstadoEnvio');
 if(!['Correcto','ParcialmenteCorrecto','Incorrecto'].includes(batchStatus))throw Error('Unknown batch status');
 one(root,'Cabecera');
 if(!/^\d{1,6}$/.test(scalar(root,'TiempoEsperaEnvio')))throw Error('Invalid wait time');
 const nodes=children(root,'RespuestaLinea',responseNS);if(nodes.length>1000)throw Error('Too many lines');
 const lines=nodes.map(node=>{
  const id=one(node,'IDFactura'),operation=scalar(one(node,'Operacion'),'TipoOperacion',infoNS);
  if(!['Alta','Anulacion'].includes(operation))throw Error('Unknown operation');
  const issuer=scalar(id,'IDEmisorFactura',infoNS,true,9),number=scalar(id,'NumSerieFactura',infoNS,true,60);
  const rawDate=scalar(id,'FechaExpedicionFactura',infoNS),match=/^(\d{2})-(\d{2})-(\d{4})$/.exec(rawDate);
  const date=match&&`${match[3]}-${match[2]}-${match[1]}`;
  if(!date||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Invalid invoice date');
  const status=scalar(node,'EstadoRegistro');if(!['Correcto','AceptadoConErrores','Incorrecto'].includes(status))throw Error('Unknown line status');
  const code=scalar(node,'CodigoErrorRegistro',responseNS,false,30);
  if(code!==null&&!/^[+-]?\d+$/.test(code))throw Error('Invalid error code');
  return {issuer,number,date,operation,status,code,description:scalar(node,'DescripcionErrorRegistro',responseNS,false),duplicate:!!one(node,'RegistroDuplicado',responseNS,false)};
 });
 return {country:'ES',format:'AEAT-RespuestaSuministro',batchStatus,csv:scalar(root,'CSV',responseNS,false,200),lines,authenticityVerified:false,schemaValidated:false};
}

export function receiptXml(data){
 if(typeof data!=='string'||data.length>3000000)throw Error('Unsupported receipt');
 if(!data.startsWith('data:'))return data;
 const match=/^data:[^,]*;base64,([A-Za-z0-9+/=\r\n]*)$/.exec(data);if(!match)throw Error('Unsupported receipt encoding');
 return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0)));
}

// Private-sector SdI messages v1.0 only; PA messages use another schema.
export function readSdiReceipt(xml){
 if(typeof xml!=='string'||xml.length>2000000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Unsupported XML');
 const doc=new DOMParser().parseFromString(xml,'application/xml'),root=doc.documentElement;
 if(doc.getElementsByTagName('parsererror').length||doc.doctype||root.namespaceURI!=='http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fattura/messaggi/v1.0'||root.getAttribute('versione')!=='1.0')throw Error('Unsupported SdI receipt');
 const status=root.localName;
 if(!['RicevutaConsegna','RicevutaScarto','RicevutaImpossibilitaRecapito'].includes(status))throw Error('Unsupported SdI message');
 // Local elements are unqualified in MessaggiFatturaTypes_v1.0.
 const value=(node,name,max=1500,required=true)=>scalar(node,name,null,required,max);
 const dateTime=name=>{const s=value(root,name,40);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s.slice(0,10)).toISOString().slice(0,10)!==s.slice(0,10))throw Error('Invalid date');return s;};
 const issuer=value(root,'IdentificativoSdI',36),number=value(root,'NomeFile',50),hash=value(root,'Hash',200),date=dateTime('DataOraRicezione');
 value(root,'MessageId',36);
 if(!/^[a-fA-F0-9]{64}$/.test(hash))throw Error('Unsupported document hash');
 if(status==='RicevutaConsegna'){dateTime('DataOraConsegna');one(root,'Destinatario',null);}
 if(status==='RicevutaImpossibilitaRecapito'){const d=value(root,'DataMessaADisposizione',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw Error('Invalid date');}
 let errors=[];
 if(status==='RicevutaScarto'){
  errors=children(one(root,'ListaErrori',null),'Errore',null);if(!errors.length||errors.length>200)throw Error('Invalid error list');
 }
 const common={issuer,number,date,operation:'SdI',status,duplicate:false};
 const lines=errors.length?errors.map(e=>({...common,code:value(e,'Codice',5),description:[value(e,'Descrizione',1000),value(e,'Suggerimento',2000,false)].filter(Boolean).join(' · ')})):[{...common,description:value(root,'Descrizione',1000,false)}];
 return {country:'IT',format:'SdI-private-v1.0',documentHash:hash.toLowerCase(),lines,signaturePresent:children(root,'Signature','http://www.w3.org/2000/09/xmldsig#').length>0,authenticityVerified:false,schemaValidated:false};
}
