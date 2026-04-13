# Netezza Node.js Driver

**Repository:** https://github.com/IBM/nz-node

A Node.js driver for IBM Netezza databases, implementing IBM's proprietary Netezza protocol.

## Overview

This is a dedicated Netezza driver that implements the Netezza-specific connection protocol. It is **not** compatible with standard PostgreSQL databases - it is designed exclusively for Netezza Performance Server (NPS).

## Installation

```bash
npm install ibm-netezza
```

## Features

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

await client.connect()

try {
  const result = await client.query('SELECT * FROM my_table')
  console.log(result.rows)
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
  fields: [],      // Array of field metadata
  rowCount: 0,     // Number of rows
  command: 'SELECT' // SQL command
}
```

## Examples

### Transactions

```javascript
const client = await pool.connect()

try {
  await client.query('BEGIN')
  
  await client.query('INSERT INTO accounts(name, balance) VALUES($1, $2)', 
    ['Alice', 1000])
  await client.query('INSERT INTO accounts(name, balance) VALUES($1, $2)', 
    ['Bob', 500])
  
  await client.query('COMMIT')
  console.log('Transaction committed')
} catch (e) {
  await client.query('ROLLBACK')
  console.error('Transaction rolled back', e)
  throw e
} finally {
  client.release()
}
```

### Error Handling

```javascript
try {
  await client.query('SELECT * FROM nonexistent_table')
} catch (err) {
  console.error('Query error:', err.message)
  console.error('Error code:', err.code)
  console.error('Error detail:', err.detail)
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

### Debug Connection Issues

```javascript
const client = new Client({
  // ... other options
  debug: true
})

client.on('error', (err) => {
  console.error('Client error:', err)
})
```

## Compatibility

- **Node.js**: Requires Node.js 22.15.0
- **Netezza**: Compatible with Netezza Performance Server (NPS) versions supporting CP_VERSION_2-6
- **PostgreSQL**: **NOT COMPATIBLE** - This is a Netezza-only driver

## Support

For issues and questions:
- GitHub Issues: [Report issues](https://github.com/IBM/nz-node/issues)
- Netezza Documentation: [IBM Netezza Docs](https://www.ibm.com/docs/en/netezza)

## References

- [IBM Netezza Performance Server](https://www.ibm.com/products/netezza)
- [Netezza SQL Reference](https://www.ibm.com/docs/en/netezza)