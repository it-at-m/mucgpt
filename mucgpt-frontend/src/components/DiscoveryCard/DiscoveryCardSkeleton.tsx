import { Card, Skeleton, SkeletonItem } from "@fluentui/react-components";
import styles from "./DiscoveryCardSkeleton.module.css";

export const DiscoveryCardSkeleton = () => {
    return (
        <Card className={styles.card}>
            <Skeleton className={styles.skeleton}>
                <SkeletonItem shape="rectangle" className={styles.title} />
                <div className={styles.spacer} />
                <SkeletonItem shape="rectangle" className={styles.line1} />
                <SkeletonItem shape="rectangle" className={styles.line2} />
            </Skeleton>
        </Card>
    );
};
