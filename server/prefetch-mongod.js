// Render runs this at the end of every build. For PR previews it downloads the mongod binary
// into node_modules, so a preview that wakes from sleep starts without downloading it again.
// Production builds skip it.
if (process.env.IS_PULL_REQUEST === 'true' || process.argv.includes('--force')) {
  const { MongoBinary } = await import('mongodb-memory-server-core');
  console.log(`mongod ready: ${await MongoBinary.getPath()}`);
}
