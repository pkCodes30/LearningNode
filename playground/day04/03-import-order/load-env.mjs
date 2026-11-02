// The fix: a tiny module whose only job is to set the env. Import it FIRST (like `import "dotenv/config"`).
process.env.DB_URL = 'postgres://localhost/shop';
