const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require("dotenv").config();

const expectedKeys = new Set([
  'coll',
  'id',
  'ts',
  'team_id',
  'stripe_id',
]);

const optionalKeys = new Set([
  'maxCount',
  'expirationDate',
  'monthlyCounts',
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
    console.error('Usage: node import_teams.js <path-to-json-file>');
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
      if (!expectedKeys.has(key) && !optionalKeys.has(key)) {
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
      const team_id = entry.team_id;
      const stripe_id = entry.stripe_id;
      const max_count = entry.maxCount ?? 0;
      const expiration_date = entry.expirationDate ?? null;

      await sqlClient.query(sql`
        INSERT INTO team (id, team_id, stripe_id, max_count, expiration_date)
        VALUES (${id}, ${team_id}, ${stripe_id}, ${max_count}, ${expiration_date})
        ON CONFLICT (team_id) DO UPDATE SET
          stripe_id = EXCLUDED.stripe_id,
          max_count = EXCLUDED.max_count,
          expiration_date = EXCLUDED.expiration_date;
      `);

      // Lookup internal UUID id based on team_id
      const { rows: [teamRow] } = await sqlClient.query(sql`
        SELECT id
        FROM team
        WHERE team_id = ${team_id};
      `);

      if (!teamRow) {
        throw new Error(`Team ID not found after insert: ${team_id}`);
      }

      const team_uuid = teamRow.id;

      if (entry.monthlyCounts && typeof entry.monthlyCounts === 'object') {
        for (const [monthString, count] of Object.entries(entry.monthlyCounts)) {
          await sqlClient.query(sql`
            INSERT INTO team_monthly_counts (team_id, month, count)
            VALUES (${team_uuid}, ${monthString}, ${count})
            ON CONFLICT (team_id, month) DO UPDATE SET
              count = ${count};
          `);
        }
      }
    }

    await sqlClient.query('COMMIT');
    console.log('All teams (and monthly counts) imported successfully.');
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