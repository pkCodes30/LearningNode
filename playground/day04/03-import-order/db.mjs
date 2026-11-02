// Reads the DB url the moment this file runs (like a module that creates a DB pool at load time).
const url = process.env.DB_URL;
console.log('db loaded, url =', url);

export const connect = () => console.log('connecting to', url);
