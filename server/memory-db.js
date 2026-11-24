/**
 * A throwaway MongoDB that lives only as long as this process. Used by `npm run dev:local`,
 * the CI smoke test and Render PR previews; never by production. The first run downloads
 * the mongod binary (about 100 MB) into node_modules/.cache/mongodb-memory-server.
 */
export async function startMemoryDb() {
  const { MongoMemoryServer } = await import('mongodb-memory-server-core');
  // 0.25 GB is WiredTiger's smallest cache, which keeps mongod inside a free Render instance.
  const server = await MongoMemoryServer.create({ instance: { args: ['--wiredTigerCacheSizeGB', '0.25'] } });

  // Stop mongod with the server, including on `node --watch` restarts (SIGTERM) and Ctrl+C.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.stop().finally(() => process.exit(0)));
  }
  return server.getUri('arcade');
}
