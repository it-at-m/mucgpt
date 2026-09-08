import { MenuItemLink } from "@fluentui/react-components";
import type { ReactElement } from "react";

interface ExternalLinkMenuItemProps {
    href: string;
    icon: ReactElement;
    label: string;
    ariaLabel?: string;
    /** Whether the link leaves the app (opens in a new tab). Set to false for e.g. mailto: links. */
    external?: boolean;
}

export const ExternalLinkMenuItem = ({ href, icon, label, ariaLabel, external = true }: ExternalLinkMenuItemProps) => (
    <MenuItemLink href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} icon={icon} aria-label={ariaLabel ?? label}>
        {label}
    </MenuItemLink>
);

export default ExternalLinkMenuItem;
