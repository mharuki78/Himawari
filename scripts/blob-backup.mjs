import {list,get,put} from '@vercel/blob';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {encryptBackup,decryptBackup} from './lib/backup.js';
const [mode,directory,access]=process.argv.slice(2);
if(!['backup','verify','restore'].includes(mode)||!directory||!['private','public'].includes(access))throw Error('Usage: node scripts/blob-backup.mjs backup|verify|restore DIRECTORY private|public');
const key=process.env.BACKUP_ENCRYPTION_KEY,folder=resolve(directory),token=process.env.BLOB_BACKUP_SOURCE_TOKEN;
encryptBackup(Buffer.from('key-check'),key);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
if(mode==='backup'){
 if(!token)throw Error('BLOB_BACKUP_SOURCE_TOKEN is required.');
 // A new folder prevents merging incomplete runs and accidentally replacing a good backup.
 await mkdir(folder,{recursive:false});let cursor;const entries=[];
 do{const page=await list({token,limit:100,cursor});for(const blob of page.blobs){
   if(blob.pathname.startsWith('encrypted-backups/'))continue;
   if(blob.size>128*1024*1024)throw Error('A Blob exceeds the 128MB per-object limit. This backup is incomplete; use a streaming export for large media.');
   const result=await get(access==='public'?blob.url:blob.pathname,{token,access,useCache:false});
   if(!result||result.statusCode!==200)throw Error('A Blob could not be read. Backup is incomplete.');
   const data=Buffer.from(await new Response(result.stream).arrayBuffer());
   if(data.length>128*1024*1024)throw Error('Blob size changed beyond backup limit.');
   const file=digest(Buffer.from(blob.pathname))+'.hmwbackup';
   await writeFile(join(folder,file),encryptBackup(data,key),{flag:'wx',mode:0o600});
   entries.push({pathname:blob.pathname,file,sha256:digest(data),size:data.length,contentType:result.blob?.contentType||'application/octet-stream'});
 }cursor=page.hasMore?page.cursor:undefined;}while(cursor);
 await writeFile(join(folder,'manifest.hmwbackup'),encryptBackup(Buffer.from(JSON.stringify({version:1,access,createdAt:new Date().toISOString(),entries})),key),{flag:'wx',mode:0o600});
 console.log(`Encrypted Blob backup complete: ${entries.length} objects.`);
}else{
 const manifest=JSON.parse(decryptBackup(await readFile(join(folder,'manifest.hmwbackup')),key).toString());
 if(manifest.version!==1||manifest.access!==access||!Array.isArray(manifest.entries))throw Error('Invalid manifest.');
 // Verify every object before starting any restore writes.
 for(const item of manifest.entries){if(!/^[a-f0-9]{64}\.hmwbackup$/.test(item.file)||typeof item.pathname!=='string'||item.pathname.startsWith('/')||item.pathname.split('/').includes('..'))throw Error('Invalid backup entry.');const data=decryptBackup(await readFile(join(folder,item.file)),key);if(data.length!==item.size||digest(data)!==item.sha256)throw Error('Backup object integrity check failed.');}
 if(mode==='restore'){
  const target=process.env.BLOB_RESTORE_TARGET_TOKEN;
  if(!token||!target||target===token||process.env.RESTORE_CONFIRM!=='ISOLATED_EMPTY_STORE')throw Error('Restore requires a different empty store and RESTORE_CONFIRM=ISOLATED_EMPTY_STORE.');
  if((await list({token:target,limit:1})).blobs.length)throw Error('Target store is not empty. Existing objects will not be overwritten.');
  for(const item of manifest.entries)await put(item.pathname,decryptBackup(await readFile(join(folder,item.file)),key),{token:target,access,contentType:item.contentType,addRandomSuffix:false,allowOverwrite:false});
  console.log(`Restored ${manifest.entries.length} objects to the empty isolated store. Public URLs change between stores; update catalog references before any cutover.`);
 }else console.log(`Verified encryption and content hashes: ${manifest.entries.length} objects.`);
}
