import { MouseEvent } from "react";

import { OwnerDetailsResponse } from "../../api/models";
import styles from "./OwnerMetadataLink.module.css";

type OwnerSource = {
    owners_detailed?: OwnerDetailsResponse[];
    latest_version?: {
        owners_detailed?: OwnerDetailsResponse[];
    };
};

interface OwnerMetadataLinkProps {
    owner?: OwnerDetailsResponse;
    fallbackLabel?: string;
}

export function getPrimaryOwnerDetails(source: OwnerSource | null | undefined): OwnerDetailsResponse | undefined {
    if (!source) {
        return undefined;
    }

    if (source.owners_detailed && source.owners_detailed.length > 0) {
        return source.owners_detailed[0];
    }

    if (source.latest_version?.owners_detailed && source.latest_version.owners_detailed.length > 0) {
        return source.latest_version.owners_detailed[0];
    }

    return undefined;
}

export function OwnerMetadataLink({ owner, fallbackLabel }: OwnerMetadataLinkProps) {
    const label = owner?.username?.trim() || fallbackLabel;
    if (!label) {
        return null;
    }

    const mail = owner?.mail?.trim();
    if (!mail) {
        return <>{label}</>;
    }

    const href = `mailto:${mail}`;
    const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
        // Keep card click handlers from triggering when user explicitly clicks owner contact.
        event.stopPropagation();
    };

    return (
        <a href={href} className={styles.ownerLink} onClick={onClick}>
            {label}
        </a>
    );
}
