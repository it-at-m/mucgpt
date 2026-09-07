import { OwnerDetailsResponse } from "../../api/models";
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

    return (
        <a href={href} className={styles.ownerLink}>
            {label}
        </a>
    );
}
