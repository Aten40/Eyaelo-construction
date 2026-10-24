interface Env {
  DB: D1Database;
  ADMIN_API_TOKEN?: string;
  VOUCHER_LAB_ENABLED?: string;
}
const LABEL = "INTERNAL TEST CREDIT — NOT REAL OPERATOR AIRTIME";
const HEADERS = {"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:HEADERS});
const nowIso=()=>new Date().toISOString();
async function authorized(req:Request,env:Env):Promise<boolean>{
  const h=req.headers.get("Authorization")??"", supplied=h.startsWith("Bearer ")?h.slice(7):"";
  if(!supplied||!env.ADMIN_API_TOKEN)return false;
  const enc=new TextEncoder(),a=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(supplied))),b=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(env.ADMIN_API_TOKEN)));
  let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
async function readJson(req:Request):Promise<Record<string,unknown>|null>{try{const v:unknown=await req.json();return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null}catch{return null}}
function makeToken():string{const bytes=crypto.getRandomValues(new Uint8Array(20));const hex=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();return "EYA-"+(hex.match(/.{5}/g)??[]).join("-")}
function validToken(v:unknown):string|null{if(typeof v!=="string")return null;const t=v.trim().toUpperCase();return /^EYA-(?:[0-9A-F]{5}-){7}[0-9A-F]{5}$/.test(t)?t:null}
async function hashToken(t:string):Promise<string>{const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t));return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,"0")).join("")}
export default {async fetch(req:Request,env:Env):Promise<Response>{
  const url=new URL(req.url);
  if(req.method==="GET"&&url.pathname==="/health")return json({ok:true,service:"eyaelo-internal-voucher-lab",enabled:env.VOUCHER_LAB_ENABLED==="true",liveCarrierCredit:false});
  if(!url.pathname.startsWith("/api/vouchers/"))return json({error:"not_found"},404);
  if(env.VOUCHER_LAB_ENABLED!=="true")return json({error:"voucher_lab_disabled",liveCarrierCredit:false},404);
  if(!await authorized(req,env))return json({error:"unauthorised"},401);
  try{
    if(req.method==="POST"&&url.pathname==="/api/vouchers/issue"){
      const b=await readJson(req);if(!b)return json({error:"invalid_json"},400);
      const amount=b.amount_cents,expiry=b.expires_in_hours===undefined?24:b.expires_in_hours;
      if(!Number.isSafeInteger(amount)||Number(amount)<100||Number(amount)>100000)return json({error:"invalid_amount_cents"},400);
      if(!Number.isSafeInteger(expiry)||Number(expiry)<1||Number(expiry)>720)return json({error:"invalid_expiry_hours"},400);
      const id=crypto.randomUUID(),token=makeToken(),created=nowIso(),expires=new Date(Date.now()+Number(expiry)*3600000).toISOString();
      const result=await env.DB.batch([
        env.DB.prepare("INSERT INTO internal_test_vouchers (id,token_hash,amount_cents,currency,status,created_at,expires_at) VALUES (?,?,?,'ZAR','issued',?,?)").bind(id,await hashToken(token),Number(amount),created,expires),
        env.DB.prepare("INSERT INTO internal_voucher_lab_events (id,voucher_id,event_type,outcome,event_at,details_json) VALUES (?,?,'voucher.issued','success',?,?)").bind(crypto.randomUUID(),id,created,JSON.stringify({amount_cents:Number(amount),currency:"ZAR"}))
      ]);
      if(result.some(x=>!x.success))throw new Error("voucher_issue_failed");
      return json({id,token,amount_cents:Number(amount),currency:"ZAR",status:"issued",expires_at:expires,simulated:true,liveCarrierCredit:false,label:LABEL},201);
    }
    if(req.method==="POST"&&url.pathname==="/api/vouchers/validate"){
      const b=await readJson(req);if(!b)return json({error:"invalid_json"},400);
      const token=validToken(b.token),redeem=b.redeem===true,requestId=typeof b.request_id==="string"&&b.request_id.length<=100?b.request_id:null,now=nowIso();
      if(!token){await env.DB.prepare("INSERT INTO internal_voucher_lab_events (id,event_type,outcome,event_at,request_id,details_json) VALUES (?,'voucher.validate','invalid_format',?,?, '{}')").bind(crypto.randomUUID(),now,requestId).run();return json({valid:false,status:"invalid_format",simulated:true,liveCarrierCredit:false,label:LABEL},400)}
      const row=await env.DB.prepare("SELECT id,amount_cents,currency,status,expires_at FROM internal_test_vouchers WHERE token_hash=?").bind(await hashToken(token)).first<{id:string;amount_cents:number;currency:string;status:string;expires_at:string}>();
      if(!row){await env.DB.prepare("INSERT INTO internal_voucher_lab_events (id,event_type,outcome,event_at,request_id,details_json) VALUES (?,'voucher.validate','unknown',?,?, '{}')").bind(crypto.randomUUID(),now,requestId).run();return json({valid:false,status:"unknown",simulated:true,liveCarrierCredit:false,label:LABEL},404)}
      if(row.status==="revoked")return json({valid:false,status:"revoked",simulated:true,liveCarrierCredit:false,label:LABEL},409);
      if(row.status==="redeemed")return json({valid:false,status:"already_redeemed",simulated:true,liveCarrierCredit:false,label:LABEL},409);
      if(row.status==="expired"||row.expires_at<=now){
        await env.DB.batch([
          env.DB.prepare("UPDATE internal_test_vouchers SET status='expired' WHERE id=? AND status='issued' AND expires_at<=?").bind(row.id,now),
          env.DB.prepare("INSERT INTO internal_voucher_lab_events (id,voucher_id,event_type,outcome,event_at,request_id,details_json) VALUES (?,?,'voucher.validate','expired',?,?,'{}')").bind(crypto.randomUUID(),row.id,now,requestId)
        ]);
        return json({valid:false,status:"expired",simulated:true,liveCarrierCredit:false,label:LABEL},410);
      }
      if(!redeem){await env.DB.prepare("INSERT INTO internal_voucher_lab_events (id,voucher_id,event_type,outcome,event_at,request_id,details_json) VALUES (?,?,'voucher.validate','valid',?,?,'{}')").bind(crypto.randomUUID(),row.id,now,requestId).run();return json({valid:true,status:"issued",id:row.id,amount_cents:row.amount_cents,currency:row.currency,simulated:true,liveCarrierCredit:false,label:LABEL})}
      const at=nowIso(),reference=crypto.randomUUID();
      const results=await env.DB.batch([
        env.DB.prepare("UPDATE internal_test_vouchers SET status='redeemed',redeemed_at=?,redemption_reference=? WHERE id=? AND status='issued' AND expires_at>?").bind(at,reference,row.id,at),
        env.DB.prepare("INSERT INTO internal_voucher_lab_events (id,voucher_id,event_type,outcome,event_at,request_id,details_json) SELECT ?,?,'voucher.redeem','success',?,?,? WHERE EXISTS (SELECT 1 FROM internal_test_vouchers WHERE id=? AND status='redeemed' AND redeemed_at=? AND redemption_reference=?)").bind(crypto.randomUUID(),row.id,at,requestId,JSON.stringify({amount_cents:row.amount_cents,currency:row.currency}),row.id,at,reference)
      ]);
      if(!results[0].success||results[0].meta.changes!==1||!results[1].success||results[1].meta.changes!==1){
        const latest=await env.DB.prepare("SELECT status,expires_at FROM internal_test_vouchers WHERE id=?").bind(row.id).first<{status:string;expires_at:string}>();
        const status=latest?.status==="expired"||(latest?.expires_at&&latest.expires_at<=nowIso())?"expired":"already_redeemed";
        return json({valid:false,status,simulated:true,liveCarrierCredit:false,label:LABEL},409);
      }
      return json({valid:true,status:"redeemed",id:row.id,amount_cents:row.amount_cents,currency:row.currency,reference,simulated:true,liveCarrierCredit:false,label:LABEL});
    }
    return json({error:"not_found"},404);
  }catch{return json({error:"internal_error"},500)}
}};
