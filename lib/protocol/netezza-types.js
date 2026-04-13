"use strict";
/**
 * Netezza DBOS Type Definitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbosTupleDesc = exports.NzTypeVector = exports.NzTypeJsonpath = exports.NzTypeJsonb = exports.NzTypeJson = exports.NzTypeNVarChar = exports.NzTypeNChar = exports.NzTypeVarBinary = exports.NzTypeGeometry = exports.NzTypeVarFixedChar = exports.NzTypeInt8 = exports.NzTypeInt2 = exports.NzTypeUnknown = exports.NzTypeVarChar = exports.NzTypeChar = exports.NzTypeBinary = exports.NzTypeInt1 = exports.NzTypeBool = exports.NzTypeTimeTz = exports.NzTypeInterval = exports.NzTypeTimestamp = exports.NzTypeTime = exports.NzTypeNumeric = exports.NzTypeDate = exports.NzTypeMoney = exports.NzTypeFloat = exports.NzTypeInt = exports.NzTypeDouble = exports.NzTypeRecAddr = void 0;
// Netezza data types
exports.NzTypeRecAddr = 1;
exports.NzTypeDouble = 2;
exports.NzTypeInt = 3; // INT32
exports.NzTypeFloat = 4;
exports.NzTypeMoney = 5;
exports.NzTypeDate = 6;
exports.NzTypeNumeric = 7;
exports.NzTypeTime = 8;
exports.NzTypeTimestamp = 9;
exports.NzTypeInterval = 10;
exports.NzTypeTimeTz = 11;
exports.NzTypeBool = 12;
exports.NzTypeInt1 = 13; // INT8
exports.NzTypeBinary = 14;
exports.NzTypeChar = 15;
exports.NzTypeVarChar = 16;
exports.NzTypeUnknown = 18;
exports.NzTypeInt2 = 19; // INT16
exports.NzTypeInt8 = 20; // INT64
exports.NzTypeVarFixedChar = 21;
exports.NzTypeGeometry = 22;
exports.NzTypeVarBinary = 23;
exports.NzTypeNChar = 25;
exports.NzTypeNVarChar = 26;
exports.NzTypeJson = 30;
exports.NzTypeJsonb = 31;
exports.NzTypeJsonpath = 32;
exports.NzTypeVector = 33;
/**
 * DBOS Tuple Descriptor
 * Describes the structure of DBOS data tuples
 */
class DbosTupleDesc {
    constructor() {
        this.version = 0;
        this.nullsAllowed = 0;
        this.sizeWord = 0;
        this.sizeWordSize = 0;
        this.numFixedFields = 0;
        this.numVaryingFields = 0;
        this.fixedFieldsSize = 0;
        this.maxRecordSize = 0;
        this.numFields = 0;
        this.field_type = [];
        this.field_size = [];
        this.field_trueSize = [];
        this.field_offset = [];
        this.field_physField = [];
        this.field_logField = [];
        this.field_nullAllowed = [];
        this.field_fixedSize = [];
        this.field_springField = [];
        this.DateStyle = 0;
        this.EuroDates = 0;
        this.DBcharset = 0;
        this.EnableTime24 = 0;
    }
}
exports.DbosTupleDesc = DbosTupleDesc;
//# sourceMappingURL=netezza-types.js.map