// An ES module with top-level await: it pretends to fetch secrets before exporting the config.
console.log('config: loading…');
await new Promise((resolve) => setTimeout(resolve, 100));
export const config = { dbUrl: 'postgres://localhost/shop' };
console.log('config: ready');
