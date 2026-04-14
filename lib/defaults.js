'use strict'

module.exports = {
  // database host. defaults to localhost
  host: 'localhost',

  // database user's name
  user: process.platform === 'win32' ? process.env.USERNAME : process.env.USER,

  // name of database to connect
  database: undefined,

  // database user's password
  password: null,

  // a Netezza connection string to be used instead of setting individual connection items
  // NOTE:  Setting this value will cause it to override any other value (such as database or user) defined
  // in the defaults object.
  connectionString: undefined,

  // database port (Netezza default is 5480)
  port: 5480,

  // number of rows to return at a time from a prepared statement's
  // portal. 0 will return all rows at once
  rows: 0,

  // binary result mode
  binary: false,

  // Connection pool options

  // number of connections to use in connection pool
  // 0 will disable connection pooling
  max: 10,

  // max milliseconds a client can go unused before it is removed
  // from the pool and destroyed
  idleTimeoutMillis: 30000,

  client_encoding: '',

  ssl: false,

  application_name: undefined,

  fallback_application_name: undefined,

  options: undefined,

  parseInputDatesAsUTC: false,

  // max milliseconds any query using this connection will execute for before timing out in error.
  // false=unlimited
  statement_timeout: false,

  // Abort any statement that waits longer than the specified duration in milliseconds while attempting to acquire a lock.
  // false=unlimited
  lock_timeout: false,

  // Terminate any session with an open transaction that has been idle for longer than the specified duration in milliseconds
  // false=unlimited
  idle_in_transaction_session_timeout: false,

  // max milliseconds to wait for query to complete (client side)
  query_timeout: false,

  connect_timeout: 0,

  keepalives: 1,

  keepalives_idle: 0,
}

const nzTypes = require('./netezza-types')
// save default parsers
const parseBigInteger = nzTypes.getTypeParser(nzTypes.types.NzTypeInt8, 'text')
const parseBigIntegerArray = nzTypes.getArrayParser(nzTypes.types.NzTypeInt8, 'text')

// parse int8 so you can get your count values as actual numbers
module.exports.__defineSetter__('parseInt8', function (val) {
  nzTypes.setTypeParser(nzTypes.types.NzTypeInt8, 'text', val ? nzTypes.getTypeParser(nzTypes.types.NzTypeInt, 'text') : parseBigInteger)
  // Note: Array parser would need to be set separately if needed
})
