const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

require("dotenv").config();

const expectedKeys = new Set([
  'coll',
  'id',
  'ts',
  'user_id',
  'slack_access_token',
  'access_token',
  'team'
]);

const sql = (strings, ...values) => {
  let text = '';
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      text += `$${i + 1}`;
    }
  }
  return { text, values };
};

const main = async () => {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node import_users.js <path-to-json-file>');
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON file');
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error('Expected top-level JSON array');
    process.exit(1);
  }

  data.forEach((entry, idx) => {
    const keys = new Set(Object.keys(entry));
    for (const key of keys) {
      if (!expectedKeys.has(key)) {
        console.error(`Unexpected key "${key}" in entry at index ${idx + 1}`);
        console.error(entry);
        process.exit(1);
      }
    }
    for (const key of expectedKeys) {
      if (!keys.has(key)) {
        console.error(`Missing expected key "${key}" in entry at index ${idx + 1}`);
        console.error(entry);
        process.exit(1);
      }
    }
  });

  const sqlClient = new Client({
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    host: process.env.SQL_HOST,
    port: process.env.SQL_PORT,
    database: process.env.SQL_DATABASE,
    ssl: {
      ca: process.env.POSTGRES_CERT,
    },
  });

  await sqlClient.connect();
  await sqlClient.query('BEGIN');

  try {
    for (const entry of data) {
      const id = entry.id;
      const team_id = entry.team.id;
      const slack_token_id = entry.slack_access_token;
      const access_token = entry.access_token;

      await sqlClient.query(sql`
        INSERT INTO user_data (id, team_id, slack_token_id, access_token)
        VALUES (${id}, ${team_id}, ${slack_token_id}, ${access_token})
        ON CONFLICT (id) DO UPDATE SET
          team_id = EXCLUDED.team_id,
          slack_token_id = EXCLUDED.slack_token_id,
          access_token = EXCLUDED.access_token;
      `);
    }

    await sqlClient.query('COMMIT');
    console.log('All users imported successfully.');
  } catch (e) {
    console.error('Error during import, rolling back.');
    console.error(e);
    await sqlClient.query('ROLLBACK');
    process.exit(1);
  } finally {
    await sqlClient.end();
  }
};

main();