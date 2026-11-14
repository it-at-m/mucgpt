import {
    Document16Regular,
    Document20Regular,
    DocumentImage16Regular,
    DocumentImage20Regular,
    DocumentPdf16Regular,
    DocumentPdf20Regular,
    DocumentTable16Regular,
    DocumentTable20Regular,
    DocumentText16Regular,
    DocumentText20Regular,
    Mail16Regular,
    Mail20Regular,
    SlideText16Regular,
    SlideText20Regular,
    type FluentIcon
} from "@fluentui/react-icons";

export type DocumentKind = "pdf" | "text" | "spreadsheet" | "presentation" | "email" | "image" | "other";

const EXTENSIONS: Record<Exclude<DocumentKind, "other">, string[]> = {
    pdf: ["pdf"],
    text: ["doc", "docx", "docm", "dot", "dotx", "dotm", "odt", "rtf", "pages", "txt", "md", "markdown", "html", "htm", "xml"],
    spreadsheet: ["xls", "xlsx", "xlsm", "xlsb", "xlt", "xltx", "ods", "numbers", "csv", "tsv"],
    presentation: ["ppt", "pptx", "pptm", "pps", "ppsx", "pot", "potx", "odp", "key"],
    email: ["eml", "msg"],
    image: ["png", "jpg", "jpeg", "tif", "tiff", "webp", "bmp", "gif", "heic", "heif"]
};

const ICONS: Record<DocumentKind, { 16: FluentIcon; 20: FluentIcon }> = {
    pdf: { 16: DocumentPdf16Regular, 20: DocumentPdf20Regular },
    text: { 16: DocumentText16Regular, 20: DocumentText20Regular },
    spreadsheet: { 16: DocumentTable16Regular, 20: DocumentTable20Regular },
    presentation: { 16: SlideText16Regular, 20: SlideText20Regular },
    email: { 16: Mail16Regular, 20: Mail20Regular },
    image: { 16: DocumentImage16Regular, 20: DocumentImage20Regular },
    other: { 16: Document16Regular, 20: Document20Regular }
};

export const getDocumentKind = (filename: string): DocumentKind => {
    const dotIndex = filename.lastIndexOf(".");
    if (dotIndex <= 0) return "other";
    const extension = filename.slice(dotIndex + 1).toLowerCase();
    const kind = (Object.keys(EXTENSIONS) as (keyof typeof EXTENSIONS)[]).find(key => EXTENSIONS[key].includes(extension));
    return kind ?? "other";
};

interface Props {
    filename: string;
    size?: 16 | 20;
}

export const DocumentTypeIcon = ({ filename, size = 16 }: Props) => {
    const Icon = ICONS[getDocumentKind(filename)][size];
    return <Icon />;
};
