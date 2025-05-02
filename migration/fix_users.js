import { Client as FaunaClient, fql } from "fauna";
import { Client as PgClient } from "pg";
import dotenv from "dotenv";

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

const fetchAllUserMappings = async () => {
  const paginator = faunaClient.paginate(fql`
    let collection = Collection("users")
    collection.all().map((doc) => {
      id: doc.id,
      user_id: doc.user_id
    }).pageSize(100)
  `);

  const mappings = [];
  let pageCount = 0;

  for await (const page of paginator) {
    await sleep(1000);
    pageCount++;
    if (Array.isArray(page)) {
      mappings.push(...page);
    } else {
      throw new Error('Unexpected page structure from Fauna');
    }
    console.log(`Fetched ${mappings.length} user mappings so far (after ${pageCount} page(s))`);
  }

  return mappings;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const updateUserInSql = async (id, user_id) => {
  await sqlClient.query(sql`
    UPDATE user_data
    SET user_id = ${user_id}
    WHERE id = ${id};
  `);
};

const main = async () => {
  await sqlClient.connect();
  await sqlClient.query('BEGIN');

  try {
    const mappings = await fetchAllUserMappings();

    console.log(`Starting to update ${mappings.length} users...`);
    let processed = 0;

    for (const { id, user_id } of mappings) {
      processed++;
      console.log(`(${processed}/${mappings.length}) Updating user id=${id} with user_id=${user_id}`);
      await updateUserInSql(id, user_id);
    }

    await sqlClient.query('COMMIT');
    console.log('User ID update migration completed successfully.');
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