/**
 * Comprehensive test for all Netezza data types
 * Tests type parsing and conversion from Netezza to JavaScript
 */

const { Client } = require('../lib')

async function testAllDataTypes() {
  const client = new Client({
    host: process.env.NZ_HOST || 'abs-nzlite1.fyre.ibm.com',
    port: process.env.NZ_PORT || 5480,
    database: process.env.NZ_DATABASE || 'system',
    user: process.env.NZ_USER || 'admin',
    password: process.env.NZ_PASSWORD || 'password',
  })

  try {
    await client.connect()
    console.log('Connected to Netezza database\n')

    // Drop table if exists (Netezza doesn't support IF EXISTS)
    console.log('Dropping existing table if any...')
    try {
      await client.query('DROP TABLE test_all_types')
      console.log('✓ Existing table dropped')
    } catch (err) {
      if (!err.message.includes('does not exist')) {
        throw err
      }
      console.log('✓ No existing table to drop')
    }
    
    console.log('Creating test table with all data types...')
    await client.query(`
      CREATE TABLE test_all_types (
        -- Integer types
        col_byteint BYTEINT,
        col_smallint SMALLINT,
        col_integer INTEGER,
        col_bigint BIGINT,
        
        -- Floating point types
        col_real REAL,
        col_double DOUBLE PRECISION,
        
        -- Numeric/Decimal types
        col_numeric NUMERIC(10,2),
        col_decimal DECIMAL(15,4),
        
        -- Character types
        col_char CHAR(10),
        col_varchar VARCHAR(50),
        col_nchar NCHAR(10),
        col_nvarchar NVARCHAR(50),
        
        -- Date/Time types
        col_date DATE,
        col_time TIME,
        col_timestamp TIMESTAMP,
        col_interval INTERVAL,
        
        -- Boolean type
        col_boolean BOOLEAN
      )
    `)
    console.log('✓ Test table created\n')

    // Insert test data
    console.log('Inserting test data...')
    await client.query(`
      INSERT INTO test_all_types VALUES (
        -- Integer types
        127,                                    -- BYTEINT (max: 127)
        32767,                                  -- SMALLINT (max: 32767)
        2147483647,                             -- INTEGER (max: 2147483647)
        9223372036854775807,                    -- BIGINT (max: 9223372036854775807)
        
        -- Floating point types
        3.14159,                                -- REAL
        2.718281828459045,                      -- DOUBLE
        
        -- Numeric/Decimal types
        12345.67,                               -- NUMERIC(10,2)
        98765.4321,                             -- DECIMAL(15,4)
        
        -- Character types
        'CHAR10    ',                           -- CHAR(10)
        'Variable length string',               -- VARCHAR(50)
        'NCHAR10   ',                           -- NCHAR(10)
        'Unicode string',                       -- NVARCHAR(50)
        
        -- Date/Time types
        '2024-01-15',                           -- DATE
        '14:30:00',                             -- TIME
        '2024-01-15 14:30:00',                  -- TIMESTAMP
        '1 year 2 months 3 days',               -- INTERVAL
        
        -- Boolean type
        true                                    -- BOOLEAN
      )
    `)
    console.log('✓ Test data inserted\n')

    // Query and display results
    console.log('Querying test data...\n')
    const result = await client.query('SELECT * FROM test_all_types')
    
    if (result.rows.length > 0) {
      const row = result.rows[0]
      
      console.log('=== INTEGER TYPES ===')
      console.log(`BYTEINT:    ${row.COL_BYTEINT} (type: ${typeof row.COL_BYTEINT})`)
      console.log(`SMALLINT:   ${row.COL_SMALLINT} (type: ${typeof row.COL_SMALLINT})`)
      console.log(`INTEGER:    ${row.COL_INTEGER} (type: ${typeof row.COL_INTEGER})`)
      console.log(`BIGINT:     ${row.COL_BIGINT} (type: ${typeof row.COL_BIGINT})`)
      
      console.log('\n=== FLOATING POINT TYPES ===')
      console.log(`REAL:       ${row.COL_REAL} (type: ${typeof row.COL_REAL})`)
      console.log(`DOUBLE:     ${row.COL_DOUBLE} (type: ${typeof row.COL_DOUBLE})`)
      
      console.log('\n=== NUMERIC/DECIMAL TYPES ===')
      console.log(`NUMERIC:    ${row.COL_NUMERIC} (type: ${typeof row.COL_NUMERIC})`)
      console.log(`DECIMAL:    ${row.COL_DECIMAL} (type: ${typeof row.COL_DECIMAL})`)
      
      console.log('\n=== CHARACTER TYPES ===')
      console.log(`CHAR:       "${row.COL_CHAR}" (type: ${typeof row.COL_CHAR})`)
      console.log(`VARCHAR:    "${row.COL_VARCHAR}" (type: ${typeof row.COL_VARCHAR})`)
      console.log(`NCHAR:      "${row.COL_NCHAR}" (type: ${typeof row.COL_NCHAR})`)
      console.log(`NVARCHAR:   "${row.COL_NVARCHAR}" (type: ${typeof row.COL_NVARCHAR})`)
      
      console.log('\n=== DATE/TIME TYPES ===')
      console.log(`DATE:       ${row.COL_DATE} (type: ${typeof row.COL_DATE}, isDate: ${row.COL_DATE instanceof Date})`)
      console.log(`TIME:       ${row.COL_TIME} (type: ${typeof row.COL_TIME})`)
      console.log(`TIMESTAMP:  ${row.COL_TIMESTAMP} (type: ${typeof row.COL_TIMESTAMP}, isDate: ${row.COL_TIMESTAMP instanceof Date})`)
      console.log(`INTERVAL:   ${row.COL_INTERVAL} (type: ${typeof row.COL_INTERVAL})`)
      
      console.log('\n=== BOOLEAN TYPE ===')
      console.log(`BOOLEAN:    ${row.COL_BOOLEAN} (type: ${typeof row.COL_BOOLEAN})`)
      
      console.log('\n=== FIELD METADATA ===')
      result.fields.forEach((field, idx) => {
        console.log(`Field ${idx + 1}: ${field.name} (OID: ${field.dataTypeID}, format: ${field.format})`)
      })
    }

    // Clean up
    console.log('\nCleaning up...')
    await client.query('DROP TABLE test_all_types')
    console.log('✓ Test table dropped')

  } catch (error) {
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await client.end()
    console.log('\nConnection closed')
  }
}

// Run the test
console.log('='.repeat(60))
console.log('Netezza Data Types Test')
console.log('='.repeat(60))
console.log()

testAllDataTypes().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

