import { Client as FaunaClient, fql } from "fauna";
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

// const sqlClient = new PgClient({
//     user: "",
//     password: "",
//     host: "localhost",
//     port: 5432,
//     database: "postgres",
//     // ssl: {
//     //   ca: process.env.POSTGRES_CERT,
//     // },
//   });

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

// ----- FETCH FUNCTIONS -----

const fetchAllIds = async (collectionName) => {
  const paginator = faunaClient.paginate(fql`
    let collection = Collection(${collectionName})
    collection.all().map((doc) => doc.id).pageSize(10000)
  `);

  const allIds = [];
  let pageCount = 0;

  for await (const page of paginator) {
    pageCount++;
    if (Array.isArray(page)) {
      allIds.push(...page);
    } else {
      throw new Error(`Unexpected page structure from Fauna collection: ${collectionName}`);
    }
    console.log(`Fetched ${allIds.length} IDs from ${collectionName} so far (after ${pageCount} page(s))`);
  }
  return allIds;
};

const fetchDocumentById = async (collectionName, id) => {
  const result = await faunaClient.query(fql`
    Collection(${collectionName}).byId(${id})
  `);
  return result.data;
};

const fetchExistingIdsFromSql = async (tableName) => {
  const { rows } = await sqlClient.query(`
    SELECT id FROM ${tableName};
  `);
  return new Set(rows.map(r => r.id));
};

// ----- INSERT FUNCTIONS -----

const insertPollIntoSql = async (poll) => {
  const { id, callback_id, team, anonymous, question, options } = poll;
  const team_id = team.id;

  if (!team_id || team_id === "247758284172296714") {
    console.warn(`Skipping poll id=${id}: invalid team_id`);
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

const insertUserIntoSql = async (user) => {
    
  const { id, team, user_id, slack_access_token, access_token } = user;

  if (id == "307676937590932032") {
    console.warn(`Skipping user id=${id}: invalid user_id`);
    return;
  }
  const team_id = team.id;

  if (!team_id) {
    console.warn(`Skipping user id=${id}: missing team_id`);
    return;
  }

  await sqlClient.query(sql`
    INSERT INTO user_data (id, team_id, user_id, slack_token_id, access_token)
    VALUES (${id}, ${team_id}, ${user_id}, ${slack_access_token}, ${access_token});
  `);
};

const insertTeamIntoSql = async (team) => {
  const { id, team_id, stripe_id, maxCount, expirationDate } = team;

  // if (id == "429597694690852930" || id == "429602378311794754" || id == "429597694701338690") {
  //   console.warn(`skipping teams id=${id}`)
  //   return;
  // }

  await sqlClient.query(sql`
    INSERT INTO team (id, team_id, stripe_id, max_count, expiration_date)
    VALUES (${id}, ${team_id}, ${stripe_id}, ${maxCount ?? 0}, ${expirationDate ?? null});
  `);
};

// ----- MAIN MIGRATION -----

const migrateCollection = async ({ collectionName, tableName, fetchFunction }) => {
  console.log(`Starting migration for collection: ${collectionName}, table: ${tableName}`);
  
  const allIds = await fetchAllIds(collectionName);
  await fs.writeFile(`${collectionName}_ids.txt`, allIds.join('\n'), 'utf8');
  console.log(`Wrote ${allIds.length} IDs to ${collectionName}_ids.txt`);

  const existingIds = await fetchExistingIdsFromSql(tableName);
  console.log(`Loaded ${existingIds.size} existing IDs from SQL for ${tableName}`);

  const missingIds = allIds.filter(id => !existingIds.has(id));
  console.log(`${missingIds.length} documents missing for ${collectionName}, starting migration...`);

  let processed = 0;

  for (const id of missingIds) {
    processed++;
    console.log(`(${processed}/${missingIds.length}) Fetching and inserting ${collectionName} id=${id}`);
    const document = await fetchDocumentById(collectionName, id);
    await fetchFunction(document);
  }
};

const main = async () => {
  await sqlClient.connect();
  await sqlClient.query('BEGIN');

  try {


    await migrateCollection({
      collectionName: "teams",
      tableName: "team",
      fetchFunction: insertTeamIntoSql,
    });
    await migrateCollection({
      collectionName: "users",
      tableName: "user_data",
      fetchFunction: insertUserIntoSql,
    });


    await migrateCollection({
      collectionName: "polls",
      tableName: "poll",
      fetchFunction: insertPollIntoSql,
    });

    await sqlClient.query('COMMIT');
    console.log('All migrations completed successfully.');
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