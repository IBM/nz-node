# Netezza Node.js Driver

**Repository:** https://github.com/IBM/nz-node

A Node.js driver for IBM Netezza databases, implementing IBM's proprietary Netezza protocol.


## Installation

```bash
npm install ibm-netezza
```

## Features

- **Data Type Support**: Support for all standard Netezza data types.
- **Full Netezza Protocol Support**: Implements CP_VERSION_2 through CP_VERSION_6
- **Multiple Authentication Methods**: 
  - Plain password (AUTH_REQ_PASSWORD)
  - MD5 hashed password (AUTH_REQ_MD5)
  - SHA256 hashed password (AUTH_REQ_SHA256)
- **Transaction support**: Begin, Commit, Rollback
- **SSL/TLS Support**: Configurable security levels (0)
- **Guardium Audit Integration**: Automatically sends client metadata for audit logging
- **Promise and Callback APIs**: Flexible async patterns

## Quick Start

### Basic Connection

```javascript
const { Client } = require('ibm-netezza')

const client = new Client({
  host: 'netezza-host.example.com',
  port: 5480,  // Default Netezza port
  database: 'mydb',
  user: 'myuser',
  password: 'mypassword'
})

try {
  await client.connect()
  const result = await client.query('SELECT * FROM my_table;')
  console.log(result.rows)
} catch (err) {
  console.error('Error:', err.message)
} finally {
  await client.end()
}



## Configuration Options

### Connection Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | string | 'localhost' | Netezza server hostname |
| `port` | number | 5480 | Netezza server port |
| `database` | string | - | Database name |
| `user` | string | - | Username |
| `password` | string | - | Password |
| `securityLevel` | number | 0 | SSL/TLS security level |


### Security Levels

- **0**: Preferred Unsecured (default) - Try SSL, fall back to unsecured

### Result Object

```javascript
{
  rows: [],        // Array of row objects
  rowCount: 0,     // Number of rows
  command: 'SELECT', // SQL command
  notices: []      // Array of notice messages from server
}
```

### Handling Notices

Netezza servers can send notice messages (warnings, informational messages) during query execution. These are available in the result object:

```javascript
try {
  const result = await client.query('SHOW AUTOMAINT')
  console.log('Query result:', result.rows)

  // Check for notices
  if (result.notices && result.notices.length > 0) {
    result.notices.forEach(notice => {
      console.log('Notice:', notice.message)
    })
  }
} catch (err) {
  console.error('Error:', err.message)
}
```

## Examples

### CRUD Operations

#### Create (INSERT)

```javascript
const { Client } = require('ibm-netezza')
const client = new Client({
  host: 'localhost',
  port: 5480,
  database: 'mydb',
  user: 'admin',
  password: 'password'
})

try {
  await client.connect()
  
  // Insert single row
  const result = await client.query(`
    INSERT INTO users (id, name, email)
    VALUES (1, 'John Doe', 'john@example.com');
  `)
  console.log('Rows inserted:', result.rowCount)
} catch (err) {
  console.error('Error:', err.message)
} finally {
  await client.end()
}
```

#### Read (SELECT)

```javascript
try {
  await client.connect()
  
  // Select all rows
  const allUsers = await client.query('SELECT * FROM users;')
  console.log('All users:', allUsers.rows)
  
  // Select with WHERE clause
  const specificUser = await client.query(`
    SELECT * FROM users WHERE id = 1;
  `)
  console.log('User:', specificUser.rows[0])
} catch (err) {
  console.error('Error:', err.message)
  
} finally {
  await client.end()
}
```

#### Update (UPDATE)

```javascript
try {
  await client.connect()
  
  // Update single row
  const result = await client.query(`
    UPDATE users
    SET email = 'newemail@example.com'
    WHERE id = 1;
  `)
  console.log('Rows updated:', result.rowCount)
  
  // Update multiple rows
  await client.query(`
    UPDATE users
    SET status = 'active'
    WHERE id = 2;
  `)
} catch (err) {
  console.error('Error:', err.message)
} finally {
  await client.end()
}
```

#### Delete (DELETE)

```javascript
try {
  await client.connect()
  
  // Delete specific row
  const result = await client.query(`
    DELETE FROM users WHERE id = 3;
  `)
  console.log('Rows deleted:', result.rowCount)
  
  // Delete with condition
  await client.query(`
    DELETE FROM logs WHERE id = 4;
  `)
} catch (err) {
  console.error('Error:', err.message)
} finally {
  await client.end()
}
```

### Transactions

```javascript
const client = new Client({
    host: 'localhost',
    port: '5480'),
    database: 'system',
    user: 'admin',
    password: 'password',
    debug: false,
  })

try {
  await client.connect()
  await client.query('BEGIN')
  
  await client.query("INSERT INTO transaction_test VALUES (1, 'A', 'tr1')")
  await client.query("INSERT INTO transaction_test VALUES (2, 'B', 'tr2')")
  
  await client.query('COMMIT')
  console.log('Transaction committed')
} catch (e) {
  await client.query('ROLLBACK')
  console.error('Transaction rolled back', e.message)
} finally {
  await client.end()
}
```

### Error Handling

```javascript
try {
  await client.query('SELECT * FROM nonexistent_table;')
} catch (err) {
  console.error('Query error:', err.message)
}
```

## Debugging

Enable debug mode to see detailed handshake information:

```javascript
const client = new Client({
  host: 'netezza-host.example.com',
  port: 5480,
  database: 'mydb',
  user: 'myuser',
  password: 'mypassword',
  debug: true  // Enable debug logging
})
```

This will output:
- Handshake version negotiation
- Protocol version selection
- Authentication method used
- Connection state changes



### Authentication Failures

- Verify username and password
- Check user has database access
- Ensure authentication method is supported

## Compatibility

- **Node.js**: Requires Node.js 22.15.0
- **Netezza**: Compatible with Netezza Performance Server (NPS) versions supporting CP_VERSION_2-6
- **PostgreSQL**: **NOT COMPATIBLE** - This is a Netezza-only driver

## Support

For issues and questions:
- GitHub Issues: [Report issues](https://github.com/IBM/nz-node/issues)
- Netezza Documentation: [IBM Netezza Docs](https://www.ibm.com/docs/en/netezza)

## Contribution and help
All bug reports, feature requests and contributions are welcome at https://github.com/IBM/nz-node

If you have any questions or issues you can create a new issue here.

Pull requests are very welcome! Make sure your patches are well tested. Ideally create a topic branch for every separate change you make. For example:

Fork the repo (git clone https://github.com/IBM/nz-node.git)
Create your feature branch (git checkout -b my-new-feature)
Commit your changes (git commit -am 'Added some feature')
Push to the branch (git push origin my-new-feature)
Create new Pull Request

## References

- [IBM Netezza Performance Server](https://www.ibm.com/products/netezza)
- [Netezza SQL Reference](https://www.ibm.com/docs/en/netezza)