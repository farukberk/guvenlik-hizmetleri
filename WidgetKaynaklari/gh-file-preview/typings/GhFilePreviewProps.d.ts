/**
 * This file was generated from GhFilePreview.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import {
    ActionValue,
    DynamicValue,
    EditableValue,
    ListActionValue,
    ListAttributeValue,
    ListExpressionValue,
    ListValue
} from "mendix";
import { Big } from "big.js";
import { CSSProperties } from "react";

export type DisplayEnum = "inline" | "overlay" | "button";

export interface GhFilePreviewContainerProps {
    name: string;
    class: string;
    style?: CSSProperties;
    tabIndex?: number;
    files: ListValue;
    nameAttr: ListAttributeValue<string>;
    caption?: ListExpressionValue<string>;
    subCaption?: ListExpressionValue<string>;
    display: DisplayEnum;
    height: string;
    openIndex?: EditableValue<Big>;
    zipName?: DynamicValue<string>;
    bulkLabel: string;
    onBulkDownload?: ActionValue;
    onView?: ListActionValue;
    onDownload?: ListActionValue;
}

export interface GhFilePreviewPreviewProps {
    /**
     * @deprecated Deprecated since version 9.18.0. Please use class property instead.
     */
    className: string;
    class: string;
    style: string;
    styleObject?: CSSProperties;
    readOnly: boolean;
    renderMode: "design" | "xray" | "structure";
    translate: (text: string) => string;
    files: {} | { caption: string } | { type: string } | null;
    nameAttr: string;
    caption: string;
    subCaption: string;
    display: DisplayEnum;
    height: string;
    openIndex: string;
    zipName: string;
    bulkLabel: string;
    onBulkDownload: {} | null;
    onView: {} | null;
    onDownload: {} | null;
}
