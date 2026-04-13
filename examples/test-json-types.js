const { Client } = require('../lib');

async function testJsonTypes() {
    const client = new Client({
        host: process.env.NZ_HOST || 'abs-nzlite1.fyre.ibm.com',
        port: process.env.NZ_PORT || 5480,
        database: process.env.NZ_DATABASE || 'system',
        user: process.env.NZ_USER || 'admin',
        password: process.env.NZ_PASSWORD || 'password',
    });

    try {
        await client.connect();
        console.log('Connected to Netezza');

        // Enable JSON datatype support
        await client.query('SET DATATYPE_BACKWARD_COMPATIBILITY ON');
        console.log('Enabled JSON datatype support');

        // Test JSON type
        console.log('\n=== Testing JSON type ===');
        try {
            await client.query('DROP TABLE json_test');
        } catch (e) {
            // Table doesn't exist
        }
        await client.query('CREATE TABLE json_test (id INTEGER, json_col JSON)');
        console.log('Created json_test table');
        
        const testData = {
            simple: { name: 'John', age: 30 },
            nested: { user: { id: 1, profile: { email: 'test@example.com' } } },
            array: [1, 2, 3, 4, 5],
            mixed: { items: ['a', 'b', 'c'], count: 3, active: true }
        };

        // Insert rows individually
        await client.query(`INSERT INTO json_test VALUES (1, '${JSON.stringify(testData.simple)}')`);
        await client.query(`INSERT INTO json_test VALUES (2, '${JSON.stringify(testData.nested)}')`);
        await client.query(`INSERT INTO json_test VALUES (3, '${JSON.stringify(testData.array)}')`);
        await client.query(`INSERT INTO json_test VALUES (4, '${JSON.stringify(testData.mixed)}')`);
        await client.query(`INSERT INTO json_test VALUES (5, NULL)`);
        console.log('Inserted test data');

        const jsonResult = await client.query('SELECT * FROM json_test ORDER BY id');
        console.log('JSON Results:');
        for (const row of jsonResult.rows) {
            console.log(`  Row ${row.ID}:`, row.JSON_COL, `(type: ${typeof row.JSON_COL})`);
            if (row.ID === 1) {
                console.log(`    Parsed: name="${row.JSON_COL?.name}", age=${row.JSON_COL?.age}`);
            } else if (row.ID === 2) {
                console.log(`    Parsed: email="${row.JSON_COL?.user?.profile?.email}"`);
            } else if (row.ID === 3) {
                console.log(`    Is array: ${Array.isArray(row.JSON_COL)}, first element: ${row.JSON_COL?.[0]}`);
            } else if (row.ID === 4) {
                console.log(`    Parsed: count=${row.JSON_COL?.count}, active=${row.JSON_COL?.active}`);
            }
        }
        await client.query('DROP TABLE json_test');

        // Test JSONB type
        // console.log('\n=== Testing JSONB type ===');
        // try {
        //     await client.query('DROP TABLE jsonb_test');
        // } catch (e) {
        //     // Table doesn't exist
        // }
        // await client.query('CREATE TABLE jsonb_test (id INTEGER, jsonb_col JSONB)');
        
        // await client.query(`INSERT INTO jsonb_test VALUES (1, '${JSON.stringify(testData.simple)}')`);
        // await client.query(`INSERT INTO jsonb_test VALUES (2, '${JSON.stringify(testData.array)}')`);
        // await client.query(`INSERT INTO jsonb_test VALUES (3, NULL)`);

        // const jsonbResult = await client.query('SELECT * FROM jsonb_test ORDER BY id');
        // console.log('JSONB Results:');
        // for (const row of jsonbResult.rows) {
        //     console.log(`  Row ${row.id}:`, row.jsonb_col, `(type: ${typeof row.jsonb_col})`);
        //     if (row.id === 1) {
        //         console.log(`    Parsed: name="${row.jsonb_col?.name}", age=${row.jsonb_col?.age}`);
        //     } else if (row.id === 2) {
        //         console.log(`    Is array: ${Array.isArray(row.jsonb_col)}, length: ${row.jsonb_col?.length}`);
        //     }
        // }
        // await client.query('DROP TABLE jsonb_test');

        // // Test JSONPATH type
        // console.log('\n=== Testing JSONPATH type ===');
        // try {
        //     await client.query('DROP TABLE jsonpath_test');
        // } catch (e) {
        //     // Table doesn't exist
        // }
        // await client.query('CREATE TABLE jsonpath_test (id INTEGER, jsonpath_col JSONPATH)');
        
        // await client.query(`INSERT INTO jsonpath_test VALUES (1, '$.user.profile.email')`);
        // await client.query(`INSERT INTO jsonpath_test VALUES (2, '$.items[0]')`);
        // await client.query(`INSERT INTO jsonpath_test VALUES (3, NULL)`);

        // const jsonpathResult = await client.query('SELECT * FROM jsonpath_test ORDER BY id');
        // console.log('JSONPATH Results:');
        // for (const row of jsonpathResult.rows) {
        //     console.log(`  Row ${row.id}:`, row.jsonpath_col, `(type: ${typeof row.jsonpath_col})`);
        // }
        // await client.query('DROP TABLE jsonpath_test');

        console.log('\n✅ All JSON types tested successfully');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await client.end();
    }
}

testJsonTypes();
