import * as moment from "moment";
import { sizeToString } from "Utilities/FileUtilities";
import { humanReadableNumber } from "UtilityFunctions";

export interface DataPoint {
    label: string | null
}

export interface DataPoint1D<X = number> extends DataPoint {
    x: X
}

export interface DataPoint2D<X = number, Y = number> extends DataPoint1D<X> {
    y: Y
}

export interface DataPoint3D<X = number, Y = number, Z = number> extends DataPoint2D<X, Y> {
    z: Z
}

export interface ChartResponse {
    chart: Chart<DataPoint2D>
    quota?: number
}

export interface Chart<Point extends DataPoint> {
    chartTypeHint?: string
    data: Point[]

    dataTitle?: string

    /**
     * An array of data types. Each element corresponds to a dimension. 
     * 
     * The data types are typically values from ChartDataTypes, but are allowed
     * to be of a different type.
     */
    dataTypes?: (string | null)[]
}

export interface Usage {
    usage: number
    quota?: number
    dataType?: string
    title?: string
}

export interface AccountingEvent {
    title: string
    description?: string
    timestamp: number
}

/**
 * Contains known data types. 
 * 
 * A data type is allowed to not be one of the following.
 */
export namespace DataTypes {
    export const BYTES = "bytes"
    export const DURATION = "duration"
    export const DATE = "date"
    export const DATETIME = "datetime"
    export const NUMBER = "number";
}

export function formatDataType(type: string, value: any): string {
    if (typeof value !== 'number') return "" + value;

    switch (type) {
        case DataTypes.BYTES: {
            return sizeToString(value);
        }

        case DataTypes.DATE: {
            return moment(value).format("DD/MM");
        }

        case DataTypes.DATETIME: {
            return moment(value).format("DD/MM hh:mm");
        }

        case DataTypes.DURATION: {
            if (value < 60_000) return `${(value / 1000) | 0} seconds`;
            return moment.duration(value, "milliseconds").humanize();
        }
    }

    return "" + value;
}

export function formatDataTypeLong(type: string, value: any): string {
    switch (type) {
        case DataTypes.BYTES: {
            return `${humanReadableNumber(value, ',', '.', 0)} bytes`;
        }

        default: {
            return formatDataType(type, value);
        }
    }
}