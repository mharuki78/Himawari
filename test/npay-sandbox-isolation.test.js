import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSandboxDatabase, readSandboxReservedNpayProducts } from '../api/_lib/npay-sandbox-products.js';
import { fetch as storefront } from '../api/storefront.js';

test('sandbox product-info bridge rejects the production database even through pooled hostname or another role',()=>{
  const production='postgresql://fixture:fixture@ep-fixture.neon.tech/production?sslmode=require';
  assert.throws(()=>validateSandboxDatabase(production,'postgresql://other:fixture@ep-fixture-pooler.neon.tech/production?sslmode=require'),{status:503});
  assert.equal(validateSandboxDatabase(production,'postgresql://fixture:fixture@ep-fixture-pooler.neon.tech/sandbox?sslmode=require'),true);
  assert.throws(()=>validateSandboxDatabase(production,'https://example.invalid/sandbox'),{status:503});
});

test('unconfigured sandbox aliases require no secondary database access',async()=>{
  const previous=process.env.NPAY_SANDBOX_DATABASE_URL;delete process.env.NPAY_SANDBOX_DATABASE_URL;
  try{assert.deepEqual(await readSandboxReservedNpayProducts(['NPR-0123456789abcdef01234567']),[]);}
  finally{if(previous!==undefined)process.env.NPAY_SANDBOX_DATABASE_URL=previous;}
});

test('private sandbox checkout stays inaccessible on production and unauthenticated preview',async()=>{
  const previous=process.env.VERCEL_ENV,open=process.env.NPAY_PUBLIC_ENABLED;
  try{
    process.env.VERCEL_ENV='production';
    const request=()=>new Request('https://example.invalid/npay-sandbox-checkout.html?page=npay-sandbox-checkout');
    assert.equal((await storefront(request())).status,404);
    process.env.VERCEL_ENV='preview';process.env.NPAY_PUBLIC_ENABLED='false';
    const response=await storefront(request());
    assert.equal(response.status,404);assert.match(response.headers.get('cache-control'),/no-store/);
    assert.match(response.headers.get('x-robots-tag'),/noindex/);
  }finally{previous===undefined?delete process.env.VERCEL_ENV:process.env.VERCEL_ENV=previous;open===undefined?delete process.env.NPAY_PUBLIC_ENABLED:process.env.NPAY_PUBLIC_ENABLED=open;}
});
