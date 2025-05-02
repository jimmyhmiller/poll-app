const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

require("dotenv").config();

const expectedKeys = new Set([
  'coll',
  'id',
  'ts',
  'callback_id',
  'team',
  'anonymous',
  'question',
  'options',
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
    console.error('Usage: node import_polls.js <path-to-json-file>');
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
      const callback_id = entry.callback_id;
      const team_id = entry.team.id;

      const info = {
        anonymous: entry.anonymous,
        question: entry.question,
        options: entry.options,
      };

      // Check if the team exists first
      const { rows } = await sqlClient.query(sql`
        SELECT 1 FROM team WHERE id = ${team_id};
      `);

      if (rows.length === 0) {
        console.warn(`Skipping poll id=${id}: team ${team_id} does not exist`);
        continue;
      }

      // Safe to insert now
      await sqlClient.query(sql`
        INSERT INTO poll (id, team_id, callback_id, info)
        VALUES (${id}, ${team_id}, ${callback_id}, ${JSON.stringify(info)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          team_id = EXCLUDED.team_id,
          callback_id = EXCLUDED.callback_id,
          info = EXCLUDED.info;
      `);
    }

    await sqlClient.query('COMMIT');
    console.log('All polls imported successfully (skipping missing teams).');
  } catch (e) {
    console.error('Fatal error during import, rolling back.');
    console.error(e);
    await sqlClient.query('ROLLBACK');
    process.exit(1);
  } finally {
    await sqlClient.end();
  }
};

main();