"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const messages_1 = require("./messages");
const buffer_reader_1 = require("./buffer-reader");
const netezza_types_1 = require("./netezza-types");
const { parseNumeric } = require("../numeric-parser");
// every message is prefixed with a single bye
const CODE_LENGTH = 1;
// every message has an int32 length which includes itself but does
// NOT include the code in the length
const LEN_LENGTH = 4;
// Netezza has 4 extra bytes between code and length
const NETEZZA_OFFSET = 4;
const NETEZZA_HEADER_LENGTH = CODE_LENGTH + NETEZZA_OFFSET + LEN_LENGTH;
// A placeholder for a `BackendMessage`’s length value that will be set after construction.
const LATEINIT_LENGTH = -1;
const emptyBuffer = Buffer.allocUnsafe(0);
class Parser {
    constructor(opts) {
        this.buffer = emptyBuffer;
        this.bufferLength = 0;
        this.bufferOffset = 0;
        this.reader = new buffer_reader_1.BufferReader();
        this.fieldCount = 0; // Track field count from RowDescription for DataRow parsing
        this.dbosTupleDesc = null; // Netezza DBOS tuple descriptor
        if ((opts === null || opts === void 0 ? void 0 : opts.mode) === 'binary') {
            throw new Error('Binary mode not supported yet');
        }
        this.mode = (opts === null || opts === void 0 ? void 0 : opts.mode) || 'text';
    }
    parse(buffer, callback) {
        this.mergeBuffer(buffer);
        const bufferFullLength = this.bufferOffset + this.bufferLength;
        let offset = this.bufferOffset;
        while (offset + NETEZZA_HEADER_LENGTH <= bufferFullLength) {
            // code is 1 byte long - it identifies the message type
            const code = this.buffer[offset];
            // length is 1 Uint32BE - it INCLUDES itself (4 bytes) but EXCLUDES code (1 byte) and command number (4 bytes)
            const length = this.buffer.readUInt32BE(offset + CODE_LENGTH + NETEZZA_OFFSET);
            if (process.env.DEBUG_PARSER) {
                console.log(`[Parser] offset=${offset}, code=0x${code.toString(16)} ('${String.fromCharCode(code)}'), length=${length}, bufferFullLength=${bufferFullLength}`);
                console.log(`[Parser] Next 20 bytes:`, this.buffer.slice(offset, Math.min(offset + 20, bufferFullLength)).toString('hex'));
            }
            // Full message = code (1) + command (4) + length field (4) + data (length bytes)
            const fullMessageLength = CODE_LENGTH + NETEZZA_OFFSET + LEN_LENGTH + length;
            // Validate length is reasonable (not negative, not absurdly large)
            // Max reasonable message is 100MB
            if (length < 0 || length > 100 * 1024 * 1024) {
                if (process.env.DEBUG_PARSER) {
                    console.log(`[Parser] Invalid length ${length}, stopping parse loop`);
                }
                break;
            }
            // Check if we have the complete message
            if (fullMessageLength + offset <= bufferFullLength) {
                const message = this.handlePacket(offset + NETEZZA_HEADER_LENGTH, code, length, this.buffer);
                callback(message);
                offset += fullMessageLength;
            }
            else {
                // Not enough data for complete message, wait for more
                break;
            }
        }
        if (offset === bufferFullLength) {
            // No more use for the buffer
            this.buffer = emptyBuffer;
            this.bufferLength = 0;
            this.bufferOffset = 0;
        }
        else {
            // Adjust the cursors of remainingBuffer
            this.bufferLength = bufferFullLength - offset;
            this.bufferOffset = offset;
        }
    }
    mergeBuffer(buffer) {
        if (this.bufferLength > 0) {
            const newLength = this.bufferLength + buffer.byteLength;
            const newFullLength = newLength + this.bufferOffset;
            if (newFullLength > this.buffer.byteLength) {
                // We can't concat the new buffer with the remaining one
                let newBuffer;
                if (newLength <= this.buffer.byteLength && this.bufferOffset >= this.bufferLength) {
                    // We can move the relevant part to the beginning of the buffer instead of allocating a new buffer
                    newBuffer = this.buffer;
                }
                else {
                    // Allocate a new larger buffer
                    let newBufferLength = this.buffer.byteLength * 2;
                    while (newLength >= newBufferLength) {
                        newBufferLength *= 2;
                    }
                    newBuffer = Buffer.allocUnsafe(newBufferLength);
                }
                // Move the remaining buffer to the new one
                this.buffer.copy(newBuffer, 0, this.bufferOffset, this.bufferOffset + this.bufferLength);
                this.buffer = newBuffer;
                this.bufferOffset = 0;
            }
            // Concat the new buffer with the remaining one
            buffer.copy(this.buffer, this.bufferOffset + this.bufferLength);
            this.bufferLength = newLength;
        }
        else {
            this.buffer = buffer;
            this.bufferOffset = 0;
            this.bufferLength = buffer.byteLength;
        }
    }
    handlePacket(offset, code, length, bytes) {
        const { reader } = this;
        // NOTE: This undesirably retains the buffer in `this.reader` if the `parse*Message` calls below throw. However, those should only throw in the case of a protocol error, which normally results in the reader being discarded.
        reader.setBuffer(offset, bytes);
        let message;
        switch (code) {
            case 50 /* MessageCodes.BindComplete */:
                message = messages_1.bindComplete;
                break;
            case 49 /* MessageCodes.ParseComplete */:
                message = messages_1.parseComplete;
                break;
            case 51 /* MessageCodes.CloseComplete */:
                message = messages_1.closeComplete;
                break;
            case 110 /* MessageCodes.NoData */:
                message = messages_1.noData;
                break;
            case 115 /* MessageCodes.PortalSuspended */:
                message = messages_1.portalSuspended;
                break;
            case 99 /* MessageCodes.CopyDone */:
                message = messages_1.copyDone;
                break;
            case 87 /* MessageCodes.ReplicationStart */:
                message = messages_1.replicationStart;
                break;
            case 73 /* MessageCodes.EmptyQuery */:
                message = messages_1.emptyQuery;
                break;
            case 68 /* MessageCodes.DataRow */:
                message = parseDataRowMessage(reader, this.fieldCount);
                break;
            case 67 /* MessageCodes.CommandComplete */:
                message = parseCommandCompleteMessage(reader);
                break;
            case 90 /* MessageCodes.ReadyForQuery */:
                message = parseReadyForQueryMessage(reader);
                break;
            case 65 /* MessageCodes.NotificationResponse */:
                message = parseNotificationMessage(reader);
                break;
            case 82 /* MessageCodes.AuthenticationResponse */:
                message = parseAuthenticationResponse(reader, length);
                break;
            case 83 /* MessageCodes.ParameterStatus */:
                message = parseParameterStatusMessage(reader);
                break;
            case 75 /* MessageCodes.BackendKeyData */:
                message = parseBackendKeyData(reader);
                break;
            case 69 /* MessageCodes.ErrorMessage */:
                message = parseErrorMessage(reader, length, 'error');
                break;
            case 78 /* MessageCodes.NoticeMessage */:
                message = parseErrorMessage(reader, length, 'notice');
                break;
            case 84 /* MessageCodes.RowDescriptionMessage */:
                message = parseRowDescriptionMessage(reader);
                // Store field count for DataRow parsing
                this.fieldCount = message.fieldCount;
                break;
            case 116 /* MessageCodes.ParameterDescriptionMessage */:
                message = parseParameterDescriptionMessage(reader);
                break;
            case 71 /* MessageCodes.CopyIn */:
                message = parseCopyInMessage(reader);
                break;
            case 72 /* MessageCodes.CopyOut */:
                message = parseCopyOutMessage(reader);
                break;
            case 100 /* MessageCodes.CopyData */:
                message = parseCopyData(reader, length);
                break;
            case 80 /* MessageCodes.NetezzaPortalName */:
                // Netezza-specific: Portal name message
                // Just read and discard the portal name for now
                message = parseNetezzaPortalName(reader);
                break;
            case 88 /* MessageCodes.NetezzaDbosTupleDescriptor */:
                // Netezza-specific: DBOS tuple descriptor message
                // This describes the structure of DBOS data tuples that follow
                message = parseNetezzaDbosTupleDescriptor(reader, length);
                // Store the tuple descriptor for use with DBOS data rows
                if (message.tupdesc) {
                    this.dbosTupleDesc = message.tupdesc;
                }
                break;
            case 89 /* MessageCodes.NetezzaDbosDataTuple */:
                // Netezza-specific: DBOS data tuple message
                // Parse it as a DataRow with DBOS format using the stored tuple descriptor
                message = parseDbosDataRow(reader, this.fieldCount, length, this.dbosTupleDesc);
                break;
            default:
                return new messages_1.DatabaseError('received invalid response: ' + code.toString(16), length, 'error');
        }
        reader.setBuffer(0, emptyBuffer);
        message.length = length;
        return message;
    }
}
exports.Parser = Parser;
const parseReadyForQueryMessage = (reader) => {
    const status = reader.string(1);
    return new messages_1.ReadyForQueryMessage(LATEINIT_LENGTH, status);
};
const parseCommandCompleteMessage = (reader) => {
    const text = reader.cstring();
    return new messages_1.CommandCompleteMessage(LATEINIT_LENGTH, text);
};
const parseCopyData = (reader, length) => {
    const chunk = reader.bytes(length - 4);
    return new messages_1.CopyDataMessage(LATEINIT_LENGTH, chunk);
};
const parseCopyInMessage = (reader) => parseCopyMessage(reader, 'copyInResponse');
const parseCopyOutMessage = (reader) => parseCopyMessage(reader, 'copyOutResponse');
const parseCopyMessage = (reader, messageName) => {
    const isBinary = reader.byte() !== 0;
    const columnCount = reader.int16();
    const message = new messages_1.CopyResponse(LATEINIT_LENGTH, messageName, isBinary, columnCount);
    for (let i = 0; i < columnCount; i++) {
        message.columnTypes[i] = reader.int16();
    }
    return message;
};
const parseNotificationMessage = (reader) => {
    const processId = reader.int32();
    const channel = reader.cstring();
    const payload = reader.cstring();
    return new messages_1.NotificationResponseMessage(LATEINIT_LENGTH, processId, channel, payload);
};
const parseRowDescriptionMessage = (reader) => {
    const fieldCount = reader.int16();
    const message = new messages_1.RowDescriptionMessage(LATEINIT_LENGTH, fieldCount);
    for (let i = 0; i < fieldCount; i++) {
        message.fields[i] = parseNetezzaField(reader);
    }
    return message;
};
const parseNetezzaField = (reader) => {
    // Netezza field format (simpler than PostgreSQL):
    // - cstring (name)
    // - uint32 (OID/dataTypeID)
    // - int16 (length/dataTypeSize)
    // - int32 (modifier/dataTypeModifier)
    // - byte (format: 0=text, 1=binary)
    const name = reader.cstring();
    const dataTypeID = reader.uint32();
    const dataTypeSize = reader.int16();
    const dataTypeModifier = reader.int32();
    const formatByte = reader.byte();
    const mode = formatByte === 0 ? 'text' : 'binary';
    // Netezza doesn't provide tableID and columnID, so use 0
    const tableID = 0;
    const columnID = 0;
    return new messages_1.Field(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, mode);
};
const parseParameterDescriptionMessage = (reader) => {
    const parameterCount = reader.int16();
    const message = new messages_1.ParameterDescriptionMessage(LATEINIT_LENGTH, parameterCount);
    for (let i = 0; i < parameterCount; i++) {
        message.dataTypeIDs[i] = reader.int32();
    }
    return message;
};
const parseDataRowMessage = (reader, fieldCount) => {
    // Netezza DataRow format:
    // 1. Bitmap (1 bit per field, rounded up to bytes) - bit=0 means NULL, bit=1 means NOT NULL
    // 2. For each NON-NULL field: 4-byte int32 length + data (length includes the 4 bytes itself)
    
    // Calculate bitmap length (1 bit per field, rounded up to bytes)
    const bitmapLen = Math.ceil(fieldCount / 8);
    
    // Read bitmap
    const bitmapBytes = reader.bytes(bitmapLen);
    
    // Convert bitmap to array of bits
    // nzpy treats the bitmap bytes as a single big-endian number, then extracts bits LSB-first
    // Convert bytes to a single number (big-endian)
    let bitmapNumber = 0;
    for (let i = 0; i < bitmapLen; i++) {
        bitmapNumber = (bitmapNumber << 8) | bitmapBytes[i];
    }
    
    // Extract bits LSB-first from the number
    const allBits = [];
    for (let i = 0; i < bitmapLen * 8; i++) {
        allBits.push((bitmapNumber & (1 << i)) !== 0);
    }
    
    // Reverse the bit array
    allBits.reverse();
    
    // Take only the first fieldCount bits
    const bitmap = allBits.slice(0, fieldCount);
    
    if (process.env.DEBUG_DATAROW) {
        console.log(`[DataRow] fieldCount=${fieldCount}, bitmapLen=${bitmapLen}`);
        console.log(`[DataRow] bitmap bytes:`, bitmapBytes.toString('hex'));
        console.log(`[DataRow] bitmap bits:`, bitmap.map(b => b ? '1' : '0').join(''));
    }
    
    const fields = new Array(fieldCount);
    for (let i = 0; i < fieldCount; i++) {
        if (!bitmap[i]) {
            // NULL field
            fields[i] = null;
            if (process.env.DEBUG_DATAROW) {
                console.log(`[DataRow] Field ${i}: NULL`);
            }
        }
        else {
            // Non-null field - read length and data
            const length = reader.int32();
            const dataLength = length - 4; // length includes the 4-byte length field itself
            if (process.env.DEBUG_DATAROW) {
                console.log(`[DataRow] Field ${i}: length=${length}, dataLength=${dataLength}`);
            }
            if (dataLength > 0) {
                fields[i] = reader.string(dataLength);
                if (process.env.DEBUG_DATAROW) {
                    console.log(`[DataRow] Field ${i} value:`, fields[i]);
                }
            }
            else {
                fields[i] = '';
            }
        }
    }
    return new messages_1.DataRowMessage(LATEINIT_LENGTH, fields);
};
const parseNetezzaDbosTupleDescriptor = (reader, length) => {
    // Netezza DBOS Tuple Descriptor format (message code 'X'):
    // Based on nzpy core.py Res_get_dbos_column_descriptions (lines 1984-2012)
    if (process.env.DEBUG_DATAROW) {
        console.log(`[DBOS TupleDescriptor] message length=${length}`);
    }
    // The entire message content is the descriptor data
    // Read all remaining bytes as the descriptor
    const data = reader.bytes(length - 4); // Subtract 4 for the length field itself
    // Parse the tuple descriptor structure
    const tupdesc = new netezza_types_1.DbosTupleDesc();
    let dataIdx = 0;
    // Read header fields (9 int32 values = 36 bytes)
    tupdesc.version = data.readInt32BE(dataIdx);
    tupdesc.nullsAllowed = data.readInt32BE(dataIdx + 4);
    tupdesc.sizeWord = data.readInt32BE(dataIdx + 8);
    tupdesc.sizeWordSize = data.readInt32BE(dataIdx + 12);
    tupdesc.numFixedFields = data.readInt32BE(dataIdx + 16);
    tupdesc.numVaryingFields = data.readInt32BE(dataIdx + 20);
    tupdesc.fixedFieldsSize = data.readInt32BE(dataIdx + 24);
    tupdesc.maxRecordSize = data.readInt32BE(dataIdx + 28);
    tupdesc.numFields = data.readInt32BE(dataIdx + 32);
    dataIdx += 36;
    // Read field descriptors (9 int32 values per field = 36 bytes per field)
    for (let ix = 0; ix < tupdesc.numFields; ix++) {
        tupdesc.field_type.push(data.readInt32BE(dataIdx));
        tupdesc.field_size.push(data.readInt32BE(dataIdx + 4));
        tupdesc.field_trueSize.push(data.readInt32BE(dataIdx + 8));
        tupdesc.field_offset.push(data.readInt32BE(dataIdx + 12));
        tupdesc.field_physField.push(data.readInt32BE(dataIdx + 16));
        tupdesc.field_logField.push(data.readInt32BE(dataIdx + 20));
        tupdesc.field_nullAllowed.push(data.readInt32BE(dataIdx + 24));
        tupdesc.field_fixedSize.push(data.readInt32BE(dataIdx + 28));
        tupdesc.field_springField.push(data.readInt32BE(dataIdx + 32));
        dataIdx += 36;
    }
    // Read footer fields
    tupdesc.DateStyle = data.readInt32BE(dataIdx);
    tupdesc.EuroDates = data.readInt32BE(dataIdx + 4);
    if (process.env.DEBUG_DATAROW) {
        console.log(`[DBOS TupleDescriptor] numFields=${tupdesc.numFields}, fixedFieldsSize=${tupdesc.fixedFieldsSize}`);
        for (let i = 0; i < tupdesc.numFields; i++) {
            console.log(`[DBOS TupleDescriptor] Field ${i}: type=${tupdesc.field_type[i]}, size=${tupdesc.field_size[i]}, offset=${tupdesc.field_offset[i]}, fixedSize=${tupdesc.field_fixedSize[i]}`);
        }
    }
    // Return the tuple descriptor wrapped in a message
    // We'll store this in the parser for use with 'Y' messages
    return {
        name: 'dbosTupleDescriptor',
        length: LATEINIT_LENGTH,
        tupdesc,
    };
};
const parseDbosDataRow = (reader, fieldCount, messageLength, tupdesc) => {
    // Netezza DBOS DataRow format (message code 'Y'):
    // Based on nzpy core.py Res_read_dbos_tuple (line 2013-2021)
    // First 4 bytes are the record length (big-endian)
    const recordLength = reader.int32();
    if (process.env.DEBUG_DATAROW) {
        console.log(`[DBOS DataRow] fieldCount=${fieldCount}, recordLength=${recordLength}`);
    }
    // Read the data tuple
    const tupleData = reader.bytes(recordLength);
    // If we don't have a tuple descriptor, fall back to simple parsing
    if (!tupdesc) {
        if (process.env.DEBUG_DATAROW) {
            console.log(`[DBOS DataRow] No tuple descriptor available, using simple parsing`);
        }
        // Use the simple parsing logic below
    }
    // DBOS format: 2-byte length prefix + 1-byte bitmap + 1-byte padding + field data
    // Skip 2-byte length prefix
    let offset = 2;
    // Calculate bitmap length (1 bit per field, rounded up to bytes)
    const bitmapLen = Math.ceil(fieldCount / 8);
    // Read null bitmap
    const bitmap = tupleData.slice(offset, offset + bitmapLen);
    offset += bitmapLen;
    // Skip 1-byte padding after bitmap (Netezza alignment)
    offset += 1;
    if (process.env.DEBUG_DATAROW) {
        console.log(`[DBOS DataRow] Bitmap:`, bitmap.toString('hex'));
        console.log(`[DBOS DataRow] Starting data offset: ${offset}`);
        console.log(`[DBOS DataRow] Tuple data hex:`, tupleData.toString('hex'));
    }
    const fields = new Array(fieldCount);
    // Data section starts after the bitmap and padding
    const dataStart = offset;
    // CRITICAL FIX: Variable fields start after fixed fields
    // The fixedFieldsSize from tupdesc tells us where fixed fields end
    // The offset is absolute within the tuple data
    let varOffset = dataStart;
    if (tupdesc && tupdesc.fixedFieldsSize > 0) {
        // fixedFieldsSize is the absolute offset where variable fields start
        varOffset = tupdesc.fixedFieldsSize;
        if (process.env.DEBUG_DATAROW) {
            console.log(`[DBOS DataRow] fixedFieldsSize=${tupdesc.fixedFieldsSize}, initial varOffset=${varOffset}`);
            console.log(`[DBOS DataRow] numVaryingFields=${tupdesc.numVaryingFields}, tupleData.length=${tupleData.length}`);
        }
        // Netezza adds a padding byte after fixed fields for alignment
        // This is especially common when BOOLEAN fields are present
        // The padding byte is typically 0x00 or 0xff
        // We can detect it by checking if the next 2 bytes form a valid length prefix
        if (varOffset + 1 < tupleData.length && tupdesc.numVaryingFields > 0) {
            const possibleLength = tupleData.readUInt16LE(varOffset);
            if (process.env.DEBUG_DATAROW) {
                console.log(`[DBOS DataRow] Checking padding: possibleLength=${possibleLength}, remaining=${tupleData.length - varOffset}`);
            }
            // Valid VARCHAR length should be:
            // - At least 2 (includes the 2-byte length itself)
            // - Not larger than remaining data
            // - Typically less than 1000 for reasonable strings
            // If it looks invalid, skip one padding byte
            if (possibleLength < 2 || possibleLength > tupleData.length - varOffset) {
                varOffset += 1;
                if (process.env.DEBUG_DATAROW) {
                    console.log(`[DBOS DataRow] Skipped padding byte 0x${tupleData[varOffset - 1].toString(16)} at offset ${varOffset - 1}, new varOffset: ${varOffset}`);
                }
            }
        }
    }
    if (process.env.DEBUG_DATAROW) {
        console.log(`[DBOS DataRow] Variable fields start at offset: ${varOffset}`);
    }
    for (let i = 0; i < fieldCount; i++) {
        // Check if field is null using bitmap (bit=1 means NULL in Netezza)
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        const isNull = (bitmap[byteIndex] & (1 << bitIndex)) !== 0;
        if (isNull) {
            fields[i] = null;
            if (process.env.DEBUG_DATAROW) {
                console.log(`[DBOS DataRow] Field ${i}: NULL`);
            }
        }
        else if (tupdesc && i < tupdesc.numFields) {
            // Use tuple descriptor to parse field correctly
            const fieldType = tupdesc.field_type[i];
            const fieldSize = tupdesc.field_size[i];
            const isFixedSize = tupdesc.field_fixedSize[i] === 1;
            if (process.env.DEBUG_DATAROW) {
                console.log(`[DBOS DataRow] Field ${i}: type=${fieldType}, size=${fieldSize}, fixedSize=${isFixedSize}`);
            }
            if (isFixedSize) {
                // Fixed-size field: offset from tuple descriptor is absolute within tuple data
                const fieldOffset = tupdesc.field_offset[i];
                // The offset is already correct - it's relative to the start of tuple data (after length+bitmap)
                const absoluteOffset = fieldOffset;
                if (process.env.DEBUG_DATAROW) {
                    console.log(`[DBOS DataRow] Field ${i}: reading from fixed offset ${absoluteOffset} (dataStart=${dataStart}, fieldOffset=${fieldOffset})`);
                }
                // Parse based on type
                if (fieldType === netezza_types_1.NzTypeInt) {
                    // INT32
                    if (absoluteOffset + 4 <= tupleData.length) {
                        fields[i] = tupleData.readInt32LE(absoluteOffset);
                    }
                    else {
                        fields[i] = null;
                    }
                }
                else if (fieldType === netezza_types_1.NzTypeInt2) {
                    // INT16
                    if (absoluteOffset + 2 <= tupleData.length) {
                        fields[i] = tupleData.readInt16LE(absoluteOffset);
                    }
                    else {
                        fields[i] = null;
                    }
                }
                else if (fieldType === netezza_types_1.NzTypeInt1) {
                    // INT8
                    if (absoluteOffset + 1 <= tupleData.length) {
                        fields[i] = tupleData.readInt8(absoluteOffset);
                    }
                    else {
                        fields[i] = null;
                    }
                }
                else if (fieldType === netezza_types_1.NzTypeInt8) {
                    // INT64
                    if (absoluteOffset + 8 <= tupleData.length) {
                        // Read as BigInt (native JavaScript bigint type)
                        fields[i] = tupleData.readBigInt64LE(absoluteOffset);
                    }
                    else {
                        fields[i] = null;
                    }
                }
                else if (fieldType === netezza_types_1.NzTypeDouble) {
                    if (absoluteOffset + 8 <= tupleData.length) {
                        fields[i] = tupleData.readDoubleLE(absoluteOffset);
                    }
                    else {
                        fields[i] = null;
                    }
                }
                else if (fieldType === netezza_types_1.NzTypeFloat) {
                    if (absoluteOffset + 4 <= tupleData.length) {
                        fields[i] = tupleData.readFloatLE(absoluteOffset);
                    }
                    else {
                        fields[i] = null;
                    }
                }
                else if (fieldType === netezza_types_1.NzTypeBool) {
                    if (absoluteOffset + 1 <= tupleData.length) {
                        // Convert to JavaScript boolean
                        fields[i] = tupleData[absoluteOffset] !== 0;
                    }
                    else {
                        fields[i] = null;
                    }
                }
                else if (fieldType === netezza_types_1.NzTypeChar) {
                    // CHAR - fixed-length character field
                    if (absoluteOffset + fieldSize <= tupleData.length) {
                        fields[i] = tupleData.slice(absoluteOffset, absoluteOffset + fieldSize).toString('utf8');
                    }
                    else {
                        fields[i] = null;
                    }
                }
                else if (fieldType === netezza_types_1.NzTypeDate) {
                    // DATE - 4 bytes, days since 2000-01-01
                    if (absoluteOffset + 4 <= tupleData.length) {
                        const days = tupleData.readInt32LE(absoluteOffset);
                        // Convert to JavaScript Date (2000-01-01 + days)
                        const epoch = new Date(2000, 0, 1);
                        const date = new Date(epoch.getTime() + days * 86400000);
                        fields[i] = date;
                    }
                    else {
                        fields[i] = null;
                    }
                }
                else if (fieldType === netezza_types_1.NzTypeTime) {
                    // TIME - 8 bytes, microseconds since midnight
                    if (absoluteOffset + 8 <= tupleData.length) {
                        const micros = Number(tupleData.readBigInt64LE(absoluteOffset));
                        const hours = Math.floor(micros / 3600000000);
                        const minutes = Math.floor((micros % 3600000000) / 60000000);
                        const seconds = Math.floor((micros % 60000000) / 1000000);
                        const microseconds = micros % 1000000;
                        fields[i] = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(microseconds).padStart(6, '0')}`;
                    }
                    else {
                        fields[i] = null;
                    }
                }
                else if (fieldType === netezza_types_1.NzTypeTimestamp) {
                    // TIMESTAMP - 8 bytes, microseconds since 2000-01-01 00:00:00
                    if (absoluteOffset + 8 <= tupleData.length) {
                        const micros = Number(tupleData.readBigInt64LE(absoluteOffset));
                        // Convert to JavaScript Date (2000-01-01 + microseconds)
                        const epoch = new Date(2000, 0, 1).getTime();
                        const timestamp = new Date(epoch + micros / 1000);
                        fields[i] = timestamp;
                    }
                    else {
                        fields[i] = null;
                    }
                }
                else if (fieldType === netezza_types_1.NzTypeInterval) {
                    // INTERVAL - 12 bytes (8 bytes time + 4 bytes month)
                    if (absoluteOffset + 12 <= tupleData.length) {
                        const timeMicros = Number(tupleData.readBigInt64LE(absoluteOffset));
                        const months = tupleData.readInt32LE(absoluteOffset + 8);
                        // Format as PostgreSQL interval string
                        const years = Math.floor(months / 12);
                        const remainingMonths = months % 12;
                        const days = Math.floor(timeMicros / 86400000000);
                        const remainingMicros = timeMicros % 86400000000;
                        const hours = Math.floor(remainingMicros / 3600000000);
                        const minutes = Math.floor((remainingMicros % 3600000000) / 60000000);
                        const seconds = (remainingMicros % 60000000) / 1000000;
                        let parts = [];
                        if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
                        if (remainingMonths > 0) parts.push(`${remainingMonths} mon${remainingMonths !== 1 ? 's' : ''}`);
                        if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
                        if (hours > 0 || minutes > 0 || seconds > 0) {
                            parts.push(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${seconds.toFixed(6).padStart(9, '0')}`);
                        }
                        fields[i] = parts.join(' ') || '0';
                    }
                    else {
                        fields[i] = null;
                    }
                }
                else if (fieldType === netezza_types_1.NzTypeNumeric) {
                    // NUMERIC/DECIMAL - multi-precision numeric format
                    // Extract precision and scale from fieldSize
                    const precision = (fieldSize >> 8) & 0x7F;
                    const scale = fieldSize & 0xFF;
                    // Calculate digit count from trueSize
                    const digitCount = Math.floor(tupdesc.field_trueSize[i] / 4);
                    
                    if (absoluteOffset + digitCount * 4 <= tupleData.length) {
                        const numericData = tupleData.slice(absoluteOffset, absoluteOffset + digitCount * 4);
                        fields[i] = parseNumeric(numericData, precision, scale, digitCount);
                    }
                    else {
                        fields[i] = null;
                    }
                }
                else {
                    // Unknown fixed-size type, read as buffer
                    if (absoluteOffset + fieldSize <= tupleData.length) {
                        fields[i] = tupleData.slice(absoluteOffset, absoluteOffset + fieldSize).toString('utf8');
                    }
                    else {
                        fields[i] = null;
                    }
                }
            }
            else {
                // Variable-size field: read from variable offset with 2-byte length prefix
                // CRITICAL FIX: Ensure we have enough data before reading
                if (varOffset + 2 > tupleData.length) {
                    fields[i] = '';
                    if (process.env.DEBUG_DATAROW) {
                        console.log(`[DBOS DataRow] Field ${i}: insufficient data at varOffset ${varOffset}`);
                    }
                    continue;
                }
                const fieldLength = tupleData.readUInt16LE(varOffset);
                if (process.env.DEBUG_DATAROW) {
                    console.log(`[DBOS DataRow] Field ${i}: reading from var offset ${varOffset}, length=${fieldLength}`);
                    console.log(`[DBOS DataRow] Field ${i}: next bytes:`, tupleData.slice(varOffset, Math.min(varOffset + 20, tupleData.length)).toString('hex'));
                }
                // CRITICAL FIX: Validate field length is reasonable
                // fieldLength of 0 or 2 means empty string (just the length prefix)
                if (fieldLength === 0 || fieldLength === 2) {
                    fields[i] = '';
                    if (process.env.DEBUG_DATAROW) {
                        console.log(`[DBOS DataRow] Field ${i}: empty string (length=${fieldLength})`);
                    }
                    varOffset += 2;
                }
                else if (fieldLength > tupleData.length - varOffset || fieldLength < 2) {
                    // Invalid length, treat as empty string
                    fields[i] = '';
                    if (process.env.DEBUG_DATAROW) {
                        console.log(`[DBOS DataRow] Field ${i}: invalid length ${fieldLength}, treating as empty`);
                    }
                    // Try to skip to next field by advancing 2 bytes (just the length prefix)
                    varOffset += 2;
                }
                else {
                    // Length includes the 2-byte length prefix itself
                    const dataLength = fieldLength - 2;
                    if (dataLength > 0) {
                        const strValue = tupleData.slice(varOffset + 2, varOffset + 2 + dataLength).toString('utf8');
                        // Parse JSON types
                        if (fieldType === netezza_types_1.NzTypeJson ||
                            fieldType === netezza_types_1.NzTypeJsonb ||
                            fieldType === netezza_types_1.NzTypeJsonpath) {
                            try {
                                fields[i] = JSON.parse(strValue);
                            } catch (e) {
                                // If JSON parsing fails, return as string
                                fields[i] = strValue;
                            }
                        } else {
                            fields[i] = strValue;
                        }
                    }
                    else {
                        fields[i] = '';
                    }
                    // Advance to next variable field
                    varOffset += fieldLength;
                    // CRITICAL FIX: Skip padding/alignment byte between variable fields
                    // Netezza adds padding bytes (0xff, 0x00, or other values) after variable fields
                    // The padding ensures proper alignment for the next field
                    // Check if the next byte looks like a valid length prefix (< 256 for the low byte)
                    // If not, it's likely padding and should be skipped
                    if (varOffset < tupleData.length) {
                        // Peek at the next 2 bytes to see if they look like a valid length
                        if (varOffset + 1 < tupleData.length) {
                            const nextLength = tupleData.readUInt16LE(varOffset);
                            // If the "length" is suspiciously large (> remaining data), skip one byte
                            if (nextLength > tupleData.length - varOffset) {
                                varOffset += 1;
                                if (process.env.DEBUG_DATAROW) {
                                    console.log(`[DBOS DataRow] Field ${i}: skipped padding byte 0x${tupleData[varOffset - 1].toString(16)} at offset ${varOffset - 1}`);
                                }
                            }
                        }
                    }
                }
            }
            if (process.env.DEBUG_DATAROW) {
                console.log(`[DBOS DataRow] Field ${i} value:`, fields[i]);
            }
        }
        else {
            // Fallback: assume variable-length field with 2-byte length prefix
            const remainingData = tupleData.slice(offset);
            if (remainingData.length < 2) {
                fields[i] = '';
                if (process.env.DEBUG_DATAROW) {
                    console.log(`[DBOS DataRow] Field ${i}: (insufficient data)`);
                }
                continue;
            }
            const fieldLength = remainingData.readUInt16LE(0);
            if (fieldLength >= 2 && remainingData.length >= fieldLength) {
                fields[i] = remainingData.slice(2, fieldLength).toString('utf8');
                offset += fieldLength;
            }
            else {
                fields[i] = '';
                offset += 2;
            }
            if (process.env.DEBUG_DATAROW) {
                console.log(`[DBOS DataRow] Field ${i}: ${fields[i]}`);
            }
        }
    }
    if (process.env.DEBUG_DATAROW) {
        console.log(`[DBOS DataRow] Final fields array:`, fields);
    }
    return new messages_1.DataRowMessage(LATEINIT_LENGTH, fields);
};
const parseParameterStatusMessage = (reader) => {
    const name = reader.cstring();
    const value = reader.cstring();
    return new messages_1.ParameterStatusMessage(LATEINIT_LENGTH, name, value);
};
const parseBackendKeyData = (reader) => {
    const processID = reader.int32();
    const secretKey = reader.int32();
    return new messages_1.BackendKeyDataMessage(LATEINIT_LENGTH, processID, secretKey);
};
const parseAuthenticationResponse = (reader, length) => {
    const code = reader.int32();
    // TODO(bmc): maybe better types here
    const message = {
        name: 'authenticationOk',
        length,
    };
    switch (code) {
        case 0: // AuthenticationOk
            break;
        case 3: // AuthenticationCleartextPassword
            if (message.length === 8) {
                message.name = 'authenticationCleartextPassword';
            }
            break;
        case 5: // AuthenticationMD5Password
            if (message.length === 12) {
                message.name = 'authenticationMD5Password';
                const salt = reader.bytes(4);
                return new messages_1.AuthenticationMD5Password(LATEINIT_LENGTH, salt);
            }
            break;
        case 10: // AuthenticationSASL
            {
                message.name = 'authenticationSASL';
                message.mechanisms = [];
                let mechanism;
                do {
                    mechanism = reader.cstring();
                    if (mechanism) {
                        message.mechanisms.push(mechanism);
                    }
                } while (mechanism);
            }
            break;
        case 11: // AuthenticationSASLContinue
            message.name = 'authenticationSASLContinue';
            message.data = reader.string(length - 8);
            break;
        case 12: // AuthenticationSASLFinal
            message.name = 'authenticationSASLFinal';
            message.data = reader.string(length - 8);
            break;
        default:
            throw new Error('Unknown authenticationOk message type ' + code);
    }
    return message;
};
const parseNetezzaPortalName = (reader) => {
    // Netezza portal name message - just read and discard the portal name
    const portalName = reader.cstring();
    // Return a simple message indicating portal name was received
    return {
        name: 'netezzaPortalName',
        length: LATEINIT_LENGTH,
        portalName,
    };
};
const parseErrorMessage = (reader, length, name) => {
    const startOffset = reader['offset'];
    const endOffset = startOffset + length - 4; // Subtract 4 for the length field itself
    // Read the entire message as a null-terminated string
    const messageValue = reader.cstring();
    if (process.env.DEBUG_PARSER && name === 'notice') {
        console.log(`[Parser] Netezza ${name} message:`, messageValue);
    }
    const message = name === 'notice'
        ? new messages_1.NoticeMessage(LATEINIT_LENGTH, messageValue)
        : new messages_1.DatabaseError(messageValue, LATEINIT_LENGTH, name);
    // Netezza doesn't provide detailed error fields like PostgreSQL
    // Set basic fields from the message text if needed
    message.severity = name === 'notice' ? 'NOTICE' : 'ERROR';
    const fields = {};
    while (reader['offset'] < endOffset) {
        const fieldType = reader.byte();
        if (fieldType === 0) {
            break;
        }
        const fieldTypeChar = String.fromCharCode(fieldType);
        const fieldValue = reader.cstring();
        fields[fieldTypeChar] = fieldValue;
    }
    // Populate any additional fields if they were present
    message.code = fields.C; // C for SQLSTATE code
    message.detail = fields.D; // D for detail
    message.hint = fields.H; // H for hint
    message.position = fields.P; // P for position
    message.internalPosition = fields.p; // p for internal position
    message.internalQuery = fields.q; // q for internal query
    message.where = fields.W; // W for where
    message.schema = fields.s; // s for schema name
    message.table = fields.t; // t for table name
    message.column = fields.c; // c for column name
    message.dataType = fields.d; // d for data type name
    message.constraint = fields.n; // n for constraint name
    message.file = fields.F; // F for file
    message.line = fields.L; // L for line
    message.routine = fields.R; // R for routine
    return message;
};
//# sourceMappingURL=parser.js.map