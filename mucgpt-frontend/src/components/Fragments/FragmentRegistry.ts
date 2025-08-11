import React, { ReactNode } from "react";
import { FragmentType, BaseFragmentProps } from "./types";

/**
 * Configuration for creating a new fragment renderer
 */
export interface FragmentConfig {
    type: FragmentType;
    title: string;
    identifiers: string[];
    component: React.ComponentType<BaseFragmentProps>;
}

/**
 * Registry of all available fragment types
 */
export class FragmentRegistry {
    private static fragments = new Map<FragmentType, FragmentConfig>();

    /**
     * Register a new fragment type
     */
    static register(config: FragmentConfig): void {
        this.fragments.set(config.type, config);
    }

    /**
     * Get fragment configuration by type
     */
    static getConfig(type: FragmentType): FragmentConfig | undefined {
        return this.fragments.get(type);
    }

    /**
     * Get all registered fragment types
     */
    static getAllTypes(): FragmentType[] {
        return Array.from(this.fragments.keys());
    } /**
     * Detect fragment type from content
     */
    static detectType(content: string, explicitType?: string): FragmentType | null {
        // First check explicit type against identifiers (not fragment type names)
        if (explicitType) {
            const normalizedExplicitType = explicitType.toLowerCase();
            for (const [type, config] of this.fragments) {
                if (config.identifiers.some(identifier => identifier.toLowerCase() === normalizedExplicitType)) {
                    console.log("Found fragment type via explicitType:", type);
                    return type;
                }
            }
        }

        // Fall back to content-based detection
        const lowerContent = content.toLowerCase();
        for (const [type, config] of this.fragments) {
            if (config.identifiers.some(identifier => lowerContent.includes(identifier.toLowerCase()))) {
                return type;
            }
        }
        return null;
    } /**
     * Render a fragment based on detected type
     */
    static render(content: string, explicitType?: string): ReactNode | null {
        const type = this.detectType(content, explicitType);
        if (!type) return null;

        const config = this.getConfig(type);
        if (!config) return null;

        const Component = config.component;
        return React.createElement(Component, { content });
    }
}
