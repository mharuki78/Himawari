// Isolated API harness: real route/auth/catalog validation, in-memory Blob and PostgreSQL.
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { neonConfig } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, rmdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createSessionCookie } from '../../api/_lib/auth.js';
import { publicProduct, seedCatalog } from '../../api/_lib/products.js';

export async function createProductCsvSandbox(fixtureProducts = seedCatalog().products.slice(0, 3)) {
  const root = new URL('../../', import.meta.url);
  const key = `product-csv-${randomUUID()}`;
  const directory = new URL(`backups/${key}/`, root);
  await mkdir(directory, { recursive: true });
  const environment = ['ADMIN_PASSWORD_HASH', 'ADMIN_SESSION_SECRET', 'DATABASE_URL', 'PRODUCT_BLOB_READ_WRITE_TOKEN'];
  const previous = Object.fromEntries(environment.map((name) => [name, process.env[name]]));
  Object.assign(process.env, { ADMIN_PASSWORD_HASH: 'fixture-configured', ADMIN_SESSION_SECRET: 'csv-fixture-only-'.repeat(3),
    DATABASE_URL: 'postgresql://fixture:fixture@fixture.invalid/csv', PRODUCT_BLOB_READ_WRITE_TOKEN: 'fixture-no-real-store' });
  const state = { blobs: new Map(), writes: 0, revision: 1, raceNextWrite: false };
  state.blobs.set('products/v1/catalog.json', { body: JSON.stringify({ version: 1, revision: 1, products: fixtureProducts }), etag: 'fixture-v1' });
  globalThis[key] = state;
  const db = new PGlite();
  const previousNeon = neonConfig.fetchFunction;
  const pgText = (value) => value === null ? null : typeof value === 'boolean' ? (value ? 't' : 'f')
    : value instanceof Date ? value.toISOString().replace('T', ' ').replace(/Z$/, '+00')
      : typeof value === 'object' ? JSON.stringify(value) : String(value);
  neonConfig.fetchFunction = async (_url, { body }) => {
    const { query, params, queries } = JSON.parse(body);
    const run = async (executor, query, params) => {
      const { fields, rows } = await executor.query(query, params);
      return { fields, rows: rows.map((row) => fields.map((field) => pgText(row[field.name]))) };
    };
    try {
      if (!queries) return Response.json(await run(db, query, params));
      return Response.json({ results: await db.transaction(async (tx) => {
        const results = [];
        for (const item of queries) results.push(await run(tx, item.query, item.params));
        return results;
      }) });
    } catch (error) { return Response.json({ message: error.message, code: error.code }, { status: 400 }); }
  };
  const blobStub = `
    const state = globalThis[${JSON.stringify(key)}];
    export class BlobNotFoundError extends Error {}
    export class BlobPreconditionFailedError extends Error {}
    const path = value => String(value).startsWith('https:') ? new URL(value).pathname.slice(1) : value;
    export async function head(value) {
      const pathname = path(value), item = state.blobs.get(pathname);
      if (!item) throw new BlobNotFoundError();
      return {url:'https://fixture.public.blob.vercel-storage.com/'+pathname, pathname, etag:item.etag, contentType:item.contentType, size:item.size};
    }
    export async function get(value) {
      const item = state.blobs.get(path(value));
      if (!item) throw new BlobNotFoundError();
      return {statusCode:200, blob:{etag:item.etag}, stream:new Response(item.body).body};
    }
    export async function put(pathname, body, options) {
      const existing = state.blobs.get(pathname);
      if (state.raceNextWrite && pathname==='products/v1/catalog.json') {state.raceNextWrite=false; throw new BlobPreconditionFailedError();}
      if (existing && (!options.allowOverwrite || options.ifMatch && options.ifMatch!==existing.etag)) throw new BlobPreconditionFailedError();
      const etag='fixture-v'+(++state.revision);
      state.blobs.set(pathname,{body:String(body),etag});
      if (pathname==='products/v1/catalog.json') state.writes++;
      return {etag,url:'https://fixture.public.blob.vercel-storage.com/'+pathname};
    }
    export async function del() {throw new Error('Media deletion is outside CSV fixture scope');}
  `;
  const paths = [];
  async function bundle(entry, name) {
    const outfile = new URL(name, directory); paths.push(outfile);
    await build({ absWorkingDir: fileURLToPath(root), entryPoints: [entry], outfile: fileURLToPath(outfile),
      bundle: true, format: 'esm', platform: 'node', packages: 'external', logLevel: 'silent',
      plugins: [{ name: 'isolated-blob', setup(build) {
        build.onResolve({ filter: /^@vercel\/blob$/ }, () => ({ path: 'blob-fixture', namespace: 'csv-fixture' }));
        build.onLoad({ filter: /.*/, namespace: 'csv-fixture' }, () => ({ contents: blobStub, loader: 'js' }));
      } }],
    });
    return (await import(outfile.href)).fetch;
  }
  const handler = await bundle('api/admin/products.js', 'admin.mjs');
  const publicHandler = await bundle('api/products.js', 'public.mjs');
  const origin = 'https://csv-fixture.invalid';
  const cookie = createSessionCookie(new Request(origin)).split(';')[0];
  const request = (method = 'GET', body, headers = {}) => new Request(`${origin}/api/admin/products?route=bulk-products`, {
    method, headers: { origin, cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { handler, publicHandler, request, db, state, cookie,
    get products() { return JSON.parse(state.blobs.get('products/v1/catalog.json').body).products.map(publicProduct); },
    async close() {
      neonConfig.fetchFunction = previousNeon;
      for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
      delete globalThis[key];
      await db.close();
      for (const path of paths) await unlink(path);
      await rmdir(directory);
    },
  };
}
