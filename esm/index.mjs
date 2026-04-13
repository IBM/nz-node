// ESM wrapper for ibm-netezza
import nz from '../lib/index.js'

// Re-export all the properties
export const Client = nz.Client
export const Pool = nz.Pool
export const Connection = nz.Connection
export const types = nz.types
export const Query = nz.Query
export const DatabaseError = nz.DatabaseError
export const escapeIdentifier = nz.escapeIdentifier
export const escapeLiteral = nz.escapeLiteral
export const Result = nz.Result
export const TypeOverrides = nz.TypeOverrides

// Also export the defaults
export const defaults = nz.defaults

// Re-export the default
export default nz
