import {getSqlClient, sql} from "./util";

export default async (req, res) => {
    const client = await getSqlClient();
    try {
        const {rows} = await client.query(sql`SELECT NOW()`);
        res.status(200).json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: e.message});
    } finally {
        await client.release();
    }
}
