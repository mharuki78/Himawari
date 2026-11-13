import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,publicEncrypt,constants} from 'node:crypto';
const api=await import('../api/_lib/npay-credentials.js').catch(()=>({}));
test('sandbox credentials transfer stays encrypted until server memory and cannot select production',()=>{
  assert.equal(typeof api.readNpayOrderCredentials,'function');
  const keys=generateKeyPairSync('rsa',{modulusLength:2048});
  const encrypt=value=>publicEncrypt({key:keys.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(JSON.stringify(value))).toString('base64');
  const env={NPAY_ORDER_API_ENV:'sandbox',NPAY_SANDBOX_CREDENTIAL_PRIVATE_KEY:keys.privateKey.export({format:'der',type:'pkcs8'}).toString('base64'),
    NPAY_SANDBOX_NPAY_ENVELOPE:encrypt({clientId:'fixture',clientSecret:'fixture-salt'}),NPAY_SANDBOX_FIXIE_ENVELOPE:encrypt({fixieUrl:'https://fixture:fixture@fixture.usefixie.com:443'})};
  assert.deepEqual(api.readNpayOrderCredentials(env),{environment:'sandbox',clientId:'fixture',clientSecret:'fixture-salt',proxyUrl:'https://fixture:fixture@fixture.usefixie.com:443'});
  assert.throws(()=>api.readNpayOrderCredentials({...env,NPAY_ORDER_API_ENV:'production'}),{status:503});
  assert.throws(()=>api.readNpayOrderCredentials({...env,NPAY_SANDBOX_NPAY_ENVELOPE:'invalid'}),e=>{assert.doesNotMatch(e.message,/fixture|PRIVATE KEY/);return e.status===503;});
});
