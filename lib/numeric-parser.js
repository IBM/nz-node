'use strict'

/**
 * Netezza NUMERIC/DECIMAL Parser
 * Based on nzpy's numeric.py implementation
 * Handles multi-precision 128-bit numeric values
 */

const MAX_NUMERIC_DIGIT_COUNT = 4
const NUMERIC_MAX_PRECISION = 38

/**
 * Check if numeric data is negative (sign bit set in first 32-bit word)
 */
function isNegative(data) {
  return (data[0] & 0x80000000) !== 0
}

/**
 * Negate a 128-bit number using two's complement
 * @param {Array<number>} data - Array of 4 32-bit unsigned integers
 */
function negate128(data) {
  // One's complement
  for (let i = 0; i < MAX_NUMERIC_DIGIT_COUNT; i++) {
    data[i] = (~data[i]) >>> 0  // >>> 0 ensures unsigned 32-bit
  }
  
  // Add 1 for two's complement
  let carry = 1
  for (let i = MAX_NUMERIC_DIGIT_COUNT - 1; i >= 0 && carry; i--) {
    const sum = data[i] + carry
    data[i] = sum >>> 0
    carry = sum > 0xFFFFFFFF ? 1 : 0
  }
}

/**
 * Divide 128-bit number by 10, return remainder
 * @param {Array<number>} data - Array of 4 32-bit unsigned integers (modified in place)
 * @returns {number} Remainder (0-9)
 */
function div10(data) {
  let remainder = 0
  
  for (let i = 0; i < MAX_NUMERIC_DIGIT_COUNT; i++) {
    // JavaScript can handle 53-bit integers safely
    // Combine current 32-bit word with remainder from previous
    const high = remainder
    const low = data[i]
    
    // For division, we need to treat this as a 64-bit number
    // high * 2^32 + low
    const dividend = high * 0x100000000 + low
    
    data[i] = Math.floor(dividend / 10)
    remainder = dividend % 10
  }
  
  return remainder
}

/**
 * Load numeric data from buffer
 * @param {Buffer} buffer - Raw numeric data
 * @param {number} precision - Total digits
 * @param {number} scale - Digits after decimal point
 * @param {number} digitCount - Number of 32-bit words (1, 2, or 4)
 * @returns {Object} Numeric variable
 */
function loadNumericVar(buffer, precision, scale, digitCount) {
  const data = []
  
  // Read digitCount 32-bit words as little-endian unsigned integers
  const rawData = []
  for (let i = 0; i < digitCount; i++) {
    rawData.push(buffer.readUInt32LE(i * 4))
  }
  
  // Extend sign to fill 128 bits (4 words)
  const sign = rawData[0] & 0x80000000
  const leadDigit = sign !== 0 ? 0xFFFFFFFF : 0
  
  // Pad leading words with sign extension
  for (let i = 0; i < MAX_NUMERIC_DIGIT_COUNT - digitCount; i++) {
    data.push(leadDigit)
  }
  
  // Add actual data words
  for (let i = 0; i < digitCount; i++) {
    data.push(rawData[i])
  }
  
  return {
    data: data,
    scale: scale,
    precision: precision
  }
}

/**
 * Convert numeric variable to string
 * @param {Object} nvar - Numeric variable with data and scale
 * @returns {string} String representation
 */
function numericToString(nvar) {
  const dscale = nvar.scale
  const negative = isNegative(nvar.data)
  
  // Work with absolute value
  const workData = [...nvar.data]
  if (negative) {
    negate128(workData)
  }
  
  // Extract all digits by repeatedly dividing by 10
  const digits = []
  for (let i = 0; i < NUMERIC_MAX_PRECISION; i++) {
    digits.push(div10(workData))
  }
  
  // Reverse to get most significant digit first
  digits.reverse()
  
  // Build result string
  const allDigits = digits.join('')
  
  // Find first non-zero digit
  let firstNonZero = 0
  while (firstNonZero < allDigits.length && allDigits[firstNonZero] === '0') {
    firstNonZero++
  }
  
  // Calculate where decimal point should go
  const totalDigits = NUMERIC_MAX_PRECISION
  const intDigits = totalDigits - dscale
  
  // Extract integer and fractional parts
  let intPart = allDigits.substring(0, intDigits)
  let fracPart = allDigits.substring(intDigits)
  
  // Trim leading zeros from integer part
  intPart = intPart.replace(/^0+/, '') || '0'
  
  // Trim trailing zeros from fractional part if scale allows
  if (dscale > 0) {
    fracPart = fracPart.substring(0, dscale)
  } else {
    fracPart = ''
  }
  
  // Build final result
  let result = intPart
  if (fracPart) {
    result += '.' + fracPart
  }
  
  if (negative) {
    result = '-' + result
  }
  
  return result
}

/**
 * Parse NUMERIC/DECIMAL from Netezza DBOS format
 * @param {Buffer} buffer - Raw data buffer
 * @param {number} precision - Total number of digits
 * @param {number} scale - Number of digits after decimal point
 * @param {number} digitCount - Number of 32-bit words
 * @returns {string|null} String representation of the number
 */
function parseNumeric(buffer, precision, scale, digitCount) {
  try {
    // Validate inputs
    if (!buffer || buffer.length < digitCount * 4) {
      return null
    }
    
    if (precision < 1 || precision > NUMERIC_MAX_PRECISION) {
      return null
    }
    
    if (scale < 0 || scale > precision) {
      return null
    }
    
    const nvar = loadNumericVar(buffer, precision, scale, digitCount)
    return numericToString(nvar)
  } catch (err) {
    console.error('Error parsing NUMERIC:', err)
    return null
  }
}

module.exports = {
  parseNumeric
}
