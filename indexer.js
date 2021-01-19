const { Pool } = require('pg');

const INDEXER_DB_CONNECTION = process.env.INDEXER_DB_CONNECTION;

let pool;
async function withPgClient(fn) {
    if (!pool) {
        pool = new Pool({
            connectionString: INDEXER_DB_CONNECTION,
        });
    }
    const client = await pool.connect();

    try {
        return fn(client);
    } finally {
        client.release();
    }
}



async function findEdits(accountId) {
    console.log('findEdits', accountId);

    return withPgClient(async client => {
        const { rows } = await client.query(`
            SELECT included_in_block_timestamp AS block_timestamp, included_in_block_hash AS block_hash
            FROM receipts ${accountId ? '' : `TABLESAMPLE SYSTEM(0.05)`}
            WHERE receiver_account_id = 'berryclub.ek.near'
                ${accountId ? `AND predecessor_account_id = $1` : ''}
            ORDER BY random()
            LIMIT 50
            `, accountId ? [accountId] : []);

        console.log(`Found ${rows.length} rows`);
        return rows;
    })
}

async function findRandomPair() {
    console.log('findRandomPair');

    return withPgClient(async client => {
        const { rows } = await client.query(`
            SELECT board_id FROM
                (SELECT DISTINCT board_id FROM (
                    (SELECT included_in_block_hash AS board_id
                            FROM receipts TABLESAMPLE SYSTEM(0.05)
                        WHERE receiver_account_id = 'berryclub.ek.near'
                        ORDER BY random()
                        LIMIT 100
                    )
                    UNION
                    (SELECT
                        (SELECT value->>'id'
                            FROM json_array_elements(convert_from(decode(args->>'args_base64', 'base64'), 'UTF8')::json->'players')
                            ORDER BY random()
                            LIMIT 1
                        ) AS board_id
                        FROM receipts
                        JOIN action_receipt_actions USING (receipt_id)
                        WHERE receiver_account_id = 'berry-or-not.near'
                            AND args->>'method_name' = 'vote'
                        ORDER BY random()
                        LIMIT 500
                    )
                ) AS query_union
            ) AS unique_ids
            ORDER BY random()
            LIMIT 2
        `);

        console.log(`Found ${rows.length} rows`);
        console.log('rows', rows);
        return rows.map(({ board_id }) => board_id);
    })
}

module.exports = { findEdits, findRandomPair };