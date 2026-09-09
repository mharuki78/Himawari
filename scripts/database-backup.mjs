import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,unlink,rmdir,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {encryptBackup,decryptBackup,assertSeparateTarget} from './lib/backup.js';

const mode=process.argv[2],file=process.argv[3];
if(!['backup','verify','restore'].includes(mode)||!file)throw Error('Usage: node scripts/database-backup.mjs backup|verify|restore FILE');
const key=process.env.BACKUP_ENCRYPTION_KEY;
// Validate key before creating any plaintext dump.
encryptBackup(Buffer.from('key-check'),key);
function command(binary,args,url){return new Promise((resolve,reject)=>{const child=spawn(binary,args,{env:{...process.env,PGDATABASE:url||'',PGCONNECT_TIMEOUT:'15'},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>{if(output.length<100000)output+=chunk;});child.stderr.resume();child.on('error',()=>reject(Error(`${binary} could not start. Install matching PostgreSQL client tools.`)));child.on('close',code=>code===0?resolve(output):reject(Error(`${binary} failed. Check the database connection and PostgreSQL client version; credentials are not logged.`)));});}
const folder=await mkdtemp(join(tmpdir(),'himawari-backup-'));const dump=join(folder,'database.dump');
try{
 if(mode==='backup'){
   if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required.');
   await command('pg_dump',['--format=custom','--no-owner','--no-acl','--file',dump],process.env.DATABASE_URL);
   await command('pg_restore',['--list',dump]);
   const encrypted=encryptBackup(await readFile(dump),key);
   await mkdir(dirname(resolve(file)),{recursive:true});
   await writeFile(resolve(file),encrypted,{flag:'wx',mode:0o600});
   console.log('Encrypted database backup created. Existing files are never overwritten.');
 }else{
   await writeFile(dump,decryptBackup(await readFile(resolve(file)),key),{flag:'wx',mode:0o600});
   await command('pg_restore',['--list',dump]);
   if(mode==='restore'){
     if(process.env.RESTORE_CONFIRM!=='ISOLATED_EMPTY_DATABASE')throw Error('Set RESTORE_CONFIRM=ISOLATED_EMPTY_DATABASE for an intentional restore drill.');
     assertSeparateTarget(process.env.DATABASE_URL,process.env.RESTORE_DATABASE_URL);
     const count=await command('psql',['--no-psqlrc','--tuples-only','--no-align','--command',"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','S','v','m');"],process.env.RESTORE_DATABASE_URL);
     if(Number(count.trim())!==0)throw Error('Restore target is not empty. No objects have been overwritten.');
     await command('pg_restore',['--exit-on-error','--single-transaction','--no-owner','--no-acl','--dbname','',dump],process.env.RESTORE_DATABASE_URL);
     console.log('Restore completed in the isolated empty database. Verify application flows before any recovery cutover.');
   }else console.log('Encryption integrity and PostgreSQL archive verified. A full restore drill is still required.');
 }
}finally{await unlink(dump).catch(()=>{});await rmdir(folder).catch(()=>{});}
