/**
 * Netezza DBOS Type Definitions
 */
export declare const NzTypeRecAddr = 1;
export declare const NzTypeDouble = 2;
export declare const NzTypeInt = 3;
export declare const NzTypeFloat = 4;
export declare const NzTypeMoney = 5;
export declare const NzTypeDate = 6;
export declare const NzTypeNumeric = 7;
export declare const NzTypeTime = 8;
export declare const NzTypeTimestamp = 9;
export declare const NzTypeInterval = 10;
export declare const NzTypeTimeTz = 11;
export declare const NzTypeBool = 12;
export declare const NzTypeInt1 = 13;
export declare const NzTypeBinary = 14;
export declare const NzTypeChar = 15;
export declare const NzTypeVarChar = 16;
export declare const NzTypeUnknown = 18;
export declare const NzTypeInt2 = 19;
export declare const NzTypeInt8 = 20;
export declare const NzTypeVarFixedChar = 21;
export declare const NzTypeGeometry = 22;
export declare const NzTypeVarBinary = 23;
export declare const NzTypeNChar = 25;
export declare const NzTypeNVarChar = 26;
export declare const NzTypeJson = 30;
export declare const NzTypeJsonb = 31;
export declare const NzTypeJsonpath = 32;
export declare const NzTypeVector = 33;
/**
 * DBOS Tuple Descriptor
 * Describes the structure of DBOS data tuples
 */
export declare class DbosTupleDesc {
    version: number;
    nullsAllowed: number;
    sizeWord: number;
    sizeWordSize: number;
    numFixedFields: number;
    numVaryingFields: number;
    fixedFieldsSize: number;
    maxRecordSize: number;
    numFields: number;
    field_type: number[];
    field_size: number[];
    field_trueSize: number[];
    field_offset: number[];
    field_physField: number[];
    field_logField: number[];
    field_nullAllowed: number[];
    field_fixedSize: number[];
    field_springField: number[];
    DateStyle: number;
    EuroDates: number;
    DBcharset: number;
    EnableTime24: number;
}
//# sourceMappingURL=netezza-types.d.ts.map