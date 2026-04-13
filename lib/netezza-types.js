'use strict'

/**
 * Netezza Type Parser
 * Handles conversion of Netezza data types to JavaScript types
 * Netezza uses PostgreSQL OIDs in the wire protocol (same as nzpy)
 * Reference: nzpy/nzpy/core.py pg_types mapping
 */

// Import Netezza type constants
const {
  NzTypeRecAddr,
  NzTypeDouble,
  NzTypeInt,
  NzTypeFloat,
  NzTypeMoney,
  NzTypeDate,
  NzTypeNumeric,
  NzTypeTime,
  NzTypeTimestamp,
  NzTypeInterval,
  NzTypeTimeTz,
  NzTypeBool,
  NzTypeInt1,
  NzTypeBinary,
  NzTypeChar,
  NzTypeVarChar,
  NzTypeUnknown,
  NzTypeInt2,
  NzTypeInt8,
  NzTypeVarFixedChar,
  NzTypeGeometry,
  NzTypeVarBinary,
  NzTypeNChar,
  NzTypeNVarChar,
  NzTypeJson,
  NzTypeJsonb,
  NzTypeJsonpath,
  NzTypeVector,
} = require('./protocol/netezza-types')

// Identity parser - returns value as-is
const identity = (val) => val

// String parser - converts to string
const toString = (val) => String(val)

// Integer parser - converts to integer
const toInt = (val) => {
  if (val === null || val === undefined) return null
  return parseInt(val, 10)
}

// Float parser - converts to float
const toFloat = (val) => {
  if (val === null || val === undefined) return null
  return parseFloat(val)
}

// Boolean parser - handles boolean, 't'/'f', 'true'/'false', or 1/0
const toBool = (val) => {
  if (val === null || val === undefined) return null
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val !== 0
  if (typeof val === 'string') {
    const lower = val.toLowerCase()
    return lower === 't' || lower === 'true' || lower === '1'
  }
  return Boolean(val)
}

// Date parser - converts Netezza date to JavaScript Date
const toDate = (val) => {
  if (val === null || val === undefined) return null
  if (val instanceof Date) return val
  
  // Netezza date format: YYYY-MM-DD
  const date = new Date(val)
  if (isNaN(date.getTime())) return null
  return date
}

// Timestamp parser - converts Netezza timestamp to JavaScript Date
const toTimestamp = (val) => {
  if (val === null || val === undefined) return null
  if (val instanceof Date) return val
  
  // Netezza timestamp format: YYYY-MM-DD HH:MM:SS[.ffffff]
  const date = new Date(val)
  if (isNaN(date.getTime())) return null
  return date
}

// Time parser - returns time string
const toTime = (val) => {
  if (val === null || val === undefined) return null
  return String(val)
}

// JSON parser - parses JSON string
const toJson = (val) => {
  if (val === null || val === undefined) return null
  if (typeof val === 'object') return val
  try {
    return JSON.parse(val)
  } catch (e) {
    return val
  }
}

// Numeric/Decimal parser - returns as string to preserve precision
const toNumeric = (val) => {
  if (val === null || val === undefined) return null
  return String(val)
}

// BigInt parser - returns as string to preserve precision
const toBigInt = (val) => {
  if (val === null || val === undefined) return null
  return String(val)
}

// Binary parser - returns Buffer
const toBinary = (val) => {
  if (val === null || val === undefined) return null
  if (Buffer.isBuffer(val)) return val
  if (typeof val === 'string') {
    // Handle hex string format
    if (val.startsWith('\\x')) {
      return Buffer.from(val.slice(2), 'hex')
    }
    return Buffer.from(val)
  }
  return val
}

// Array parser - parses Netezza array format
const toArray = (val, elementParser) => {
  if (val === null || val === undefined) return null
  if (Array.isArray(val)) return val
  
  // Netezza array format: {elem1,elem2,elem3}
  if (typeof val === 'string') {
    if (!val.startsWith('{') || !val.endsWith('}')) return val
    
    const content = val.slice(1, -1)
    if (content === '') return []
    
    const elements = content.split(',').map(elem => {
      elem = elem.trim()
      if (elem === 'NULL') return null
      // Remove quotes if present
      if (elem.startsWith('"') && elem.endsWith('"')) {
        elem = elem.slice(1, -1)
      }
      return elementParser ? elementParser(elem) : elem
    })
    
    return elements
  }
  
  return val
}

// PostgreSQL OID to Netezza type mapping
// Based on nzpy's pg_types mapping in core.py
const PG_OID_TO_NZ_TYPE = {
  16: NzTypeBool,        // bool
  17: NzTypeBinary,      // bytea
  20: NzTypeInt8,        // int8/bigint
  21: NzTypeInt2,        // int2/smallint
  23: NzTypeInt,         // int4/integer
  25: NzTypeVarChar,     // text
  700: NzTypeFloat,      // float4
  701: NzTypeDouble,     // float8
  1042: NzTypeChar,      // bpchar/char
  1043: NzTypeVarChar,   // varchar
  1082: NzTypeDate,      // date
  1083: NzTypeTime,      // time
  1114: NzTypeTimestamp, // timestamp
  1184: NzTypeTimestamp, // timestamptz
  1186: NzTypeInterval,  // interval
  1266: NzTypeTimeTz,    // timetz
  1700: NzTypeNumeric,   // numeric/decimal
  114: NzTypeJson,       // json
  3802: NzTypeJsonb,     // jsonb
}

// Default parsers for each Netezza type
const defaultParsers = {
  text: {
    [NzTypeRecAddr]: toString,
    [NzTypeDouble]: toFloat,
    [NzTypeInt]: toInt,
    [NzTypeFloat]: toFloat,
    [NzTypeMoney]: toNumeric,
    [NzTypeDate]: toDate,
    [NzTypeNumeric]: toNumeric,
    [NzTypeTime]: toTime,
    [NzTypeTimestamp]: toTimestamp,
    [NzTypeInterval]: toString,
    [NzTypeTimeTz]: toTime,
    [NzTypeBool]: toBool,
    [NzTypeInt1]: toInt,
    [NzTypeBinary]: toBinary,
    [NzTypeChar]: toString,
    [NzTypeVarChar]: toString,
    [NzTypeUnknown]: toString,
    [NzTypeInt2]: toInt,
    [NzTypeInt8]: toBigInt,
    [NzTypeVarFixedChar]: toString,
    [NzTypeGeometry]: toString,
    [NzTypeVarBinary]: toBinary,
    [NzTypeNChar]: toString,
    [NzTypeNVarChar]: toString,
    [NzTypeJson]: toJson,
    [NzTypeJsonb]: toJson,
    [NzTypeJsonpath]: toString,
    [NzTypeVector]: toString,
  },
  binary: {
    // Binary format parsers (if needed in future)
    // For now, most types are handled in the protocol parser
  }
}

// Custom parser overrides
const customParsers = {
  text: {},
  binary: {}
}

/**
 * Get type parser for a PostgreSQL OID or Netezza type ID
 * @param {number} typeId - PostgreSQL OID (from RowDescription) or Netezza type ID
 * @param {string} format - 'text' or 'binary'
 * @returns {Function} Parser function
 */
function getTypeParser(typeId, format = 'text') {
  // Check custom parsers first
  if (customParsers[format] && customParsers[format][typeId]) {
    return customParsers[format][typeId]
  }
  
  // Map PostgreSQL OID to Netezza type (Netezza sends PG OIDs in RowDescription)
  let nzTypeId = typeId
  if (PG_OID_TO_NZ_TYPE[typeId]) {
    nzTypeId = PG_OID_TO_NZ_TYPE[typeId]
  }
  
  // Return default parser
  if (defaultParsers[format] && defaultParsers[format][nzTypeId]) {
    return defaultParsers[format][nzTypeId]
  }
  
  // Fallback to identity parser
  return identity
}

/**
 * Set custom type parser for a Netezza type
 * @param {number} typeId - Netezza type ID
 * @param {string|Function} format - 'text', 'binary', or parser function
 * @param {Function} parser - Parser function (if format is string)
 */
function setTypeParser(typeId, format, parser) {
  if (typeof format === 'function') {
    parser = format
    format = 'text'
  }
  
  if (!customParsers[format]) {
    customParsers[format] = {}
  }
  
  customParsers[format][typeId] = parser
}

/**
 * Get array parser for a Netezza type
 * @param {number} typeId - Netezza type ID
 * @param {string} format - 'text' or 'binary'
 * @returns {Function} Array parser function
 */
function getArrayParser(typeId, format = 'text') {
  const elementParser = getTypeParser(typeId, format)
  return (val) => toArray(val, elementParser)
}

module.exports = {
  getTypeParser,
  setTypeParser,
  getArrayParser,
  // Export type constants for convenience
  types: {
    NzTypeRecAddr,
    NzTypeDouble,
    NzTypeInt,
    NzTypeFloat,
    NzTypeMoney,
    NzTypeDate,
    NzTypeNumeric,
    NzTypeTime,
    NzTypeTimestamp,
    NzTypeInterval,
    NzTypeTimeTz,
    NzTypeBool,
    NzTypeInt1,
    NzTypeBinary,
    NzTypeChar,
    NzTypeVarChar,
    NzTypeUnknown,
    NzTypeInt2,
    NzTypeInt8,
    NzTypeVarFixedChar,
    NzTypeGeometry,
    NzTypeVarBinary,
    NzTypeNChar,
    NzTypeNVarChar,
    NzTypeJson,
    NzTypeJsonb,
    NzTypeJsonpath,
    NzTypeVector,
  }
}
