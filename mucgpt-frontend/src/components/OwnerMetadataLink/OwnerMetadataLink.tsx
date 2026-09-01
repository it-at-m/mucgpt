import { MouseEvent } from "react";

import { OwnerDetailsResponse } from "../../api/models";
import { useConfigContext } from "../../context/ConfigContext";
import styles from "./OwnerMetadataLink.module.css";

type OwnerSource = {
    owners_detailed?: OwnerDetailsResponse[];
    latest_version?: {
        owners_detailed?: OwnerDetailsResponse[];
    } | null;
};

interface OwnerMetadataLinkProps {
    owner?: OwnerDetailsResponse;
    fallbackLabel?: string;
}

export function getPrimaryOwnerDetails(source: OwnerSource | object | null | undefined): OwnerDetailsResponse | undefined {
    if (!source) {
        return undefined;
    }

    const { owners_detailed, latest_version } = source as OwnerSource;

    if (owners_detailed && owners_detailed.length > 0) {
        return owners_detailed[0];
    }

    if (latest_version?.owners_detailed && latest_version.owners_detailed.length > 0) {
        return latest_version.owners_detailed[0];
    }

    return undefined;
}

export function buildOwnerProfileUrl(template: string | undefined, userId: string | null | undefined) {
    const normalizedTemplate = template?.trim();
    const normalizedUserId = userId?.trim();
    if (!normalizedTemplate || !normalizedUserId) {
        return "";
    }

    const encodedUserId = encodeURIComponent(normalizedUserId);
    if (normalizedTemplate.includes("{uid}")) {
        return normalizedTemplate.replace(/\{uid\}/g, encodedUserId);
    }

    return `${normalizedTemplate.replace(/\/$/, "")}/${encodedUserId}`;
}

export function OwnerMetadataLink({ owner, fallbackLabel }: OwnerMetadataLinkProps) {
    const config = useConfigContext();
    const label = owner?.username?.trim() || fallbackLabel;
    if (!label) {
        return null;
    }

    const href = buildOwnerProfileUrl(config.owner_profile_url_template, owner?.user_id);
    if (!href) {
        return <>{label}</>;
    }

    const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
        // Keep card click handlers from triggering when user explicitly clicks owner contact.
        event.stopPropagation();
    };

    return (
        <a href={href} className={styles.ownerLink} target="_blank" rel="noopener noreferrer" onClick={onClick}>
            {label}
        </a>
    );
}
