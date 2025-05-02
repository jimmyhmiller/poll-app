import { Client as FaunaClient, fql, FaunaError } from "fauna";
import { Client as PgClient } from "pg";
import dotenv from "dotenv";
import fs from "fs/promises";

dotenv.config();

const faunaClient = new FaunaClient({
  secret: process.env.FAUNA_SECRET,
});

const sqlClient = new PgClient({
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    host: process.env.SQL_HOST,
    port: process.env.SQL_PORT,
    database: process.env.SQL_DATABASE,
    ssl: {
      ca: process.env.POSTGRES_CERT,
    },
  });

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

const fetchAllPollIds = async () => {
  const paginator = faunaClient.paginate(fql`
    let collection = Collection("polls")
    collection.all().map((doc) => doc.id).pageSize(10000)
  `);

  const allIds = [];
  let pageCount = 0;

  for await (const page of paginator) {
    pageCount++;
    if (Array.isArray(page)) {
      allIds.push(...page);
    } else {
      throw new Error('Unexpected page structure from Fauna');
    }
    console.log(`Fetched ${allIds.length} poll IDs so far (after ${pageCount} page(s))`);
  }
  return allIds;
};

const fetchPollById = async (id) => {
  const result = await faunaClient.query(fql`
    polls.byId(${id})
  `);
  return result.data;
};

const fetchExistingPollIdsFromSql = async () => {
  const { rows } = await sqlClient.query(`
    SELECT id FROM poll;
  `);
  return new Set(rows.map(r => r.id));
};

const insertPollIntoSql = async (poll) => {
  const { id, callback_id, team, anonymous, question, options } = poll;
  const team_id = team.id;

  if (team_id === "247758284172296714") {
    console.warn(`Skipping poll id=${id}: team_id is missing`);
    return;
  }
  const info = {
    anonymous,
    question,
    options,
  };

  await sqlClient.query(sql`
    INSERT INTO poll (id, team_id, callback_id, info)
    VALUES (${id}, ${team_id}, ${callback_id}, ${JSON.stringify(info)}::jsonb);
  `);
};

const main = async () => {
  await sqlClient.connect();
  await sqlClient.query('BEGIN');

  try {
    const pollIds = await fetchAllPollIds();
    await fs.writeFile('poll_ids.txt', pollIds.join('\n'), 'utf8');
    console.log(`Wrote ${pollIds.length} poll IDs to poll_ids.txt`);

    const existingPollIds = await fetchExistingPollIdsFromSql();
    console.log(`Loaded ${existingPollIds.size} existing poll IDs from SQL`);

    const missingPollIds = pollIds.filter(id => !existingPollIds.has(id));
    console.log(`${missingPollIds.length} polls missing, starting migration...`);

    let processed = 0;

    for (const id of missingPollIds) {
      processed++;
      console.log(`(${processed}/${missingPollIds.length}) Fetching and inserting poll ${id}`);
      const poll = await fetchPollById(id);
      await insertPollIntoSql(poll);
    }

    await sqlClient.query('COMMIT');
    console.log('Poll migration completed successfully.');
  } catch (e) {
    console.error('Error during migration, rolling back.');
    console.error(e);
    await sqlClient.query('ROLLBACK');
    process.exit(1);
  } finally {
    await sqlClient.end();
  }
};

main();