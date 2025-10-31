/**
 * Represents the types of fragments supported by the application
 */
export type FragmentType = "brainstorming" | "simplify" | "summary" | "mindmap" | "diagram" | "bpmn";

/**
 * Base interface for all fragment metadata
 */
export interface FragmentMetadata {
    type: FragmentType;
    title: string;
    supportDownload?: boolean;
    supportsSourceView?: boolean;
}

/**
 * Common props for all fragment components
 */
export interface BaseFragmentProps {
    content: string;
    metadata?: FragmentMetadata;
}
