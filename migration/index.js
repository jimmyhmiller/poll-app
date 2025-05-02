import { Client, fql, FaunaError } from "fauna";
import fs from "fs";

// Route queries to a specific database
// using the authentication secret in
// the `FAUNA_SECRET` environment variable.
const client = new Client();

// Specify the collections to export.
// You can retrieve a list of user-defined collections
// using a `Collection.all()` query.
const collectionsToExport = ["polls", "users", "teams"];

// Loop through the collections.
for (const collectionName of collectionsToExport) {
  try {
    // Compose a query using an FQL template string.
    // The query returns a Set containint all documents
    // in the collection.
    const query = fql`
      let collection = Collection(${collectionName})
      collection.all()`;

    // Run the query.
    const pages = client.paginate(query);

    // Iterate through the resulting document Set.
    const documents = [];
    for await (const page of pages.flatten()) {
      documents.push(page);
    }

    // Convert the 'documents' array to a JSON string.
    const jsonData = JSON.stringify(documents, null, 2);

    // Write the JSON string to a file named `<collectionName>.json`.
    fs.writeFileSync(`/Users/jimmyhmiller/Desktop/poll-data/${collectionName}.json`, jsonData, "utf-8");

    console.log(
      `${collectionName} collection data written to ${collectionName}.json`
    );
  } catch (error) {
    if (error instanceof FaunaError) {
      console.error(`Error exporting ${collectionName}:`, error);
    } else {
      console.error(
        `An unexpected error occurred for ${collectionName}:`,
        error
      );
    }
  }
}

// Close the Fauna client.
client.close();