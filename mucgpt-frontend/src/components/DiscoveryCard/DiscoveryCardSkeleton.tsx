import { Card, Skeleton, SkeletonItem } from "@fluentui/react-components";
import styles from "./DiscoveryCardSkeleton.module.css";

export const DiscoveryCardSkeleton = () => {
    return (
        <Card className={styles.card}>
            <Skeleton className={styles.skeleton}>
                <SkeletonItem shape="rectangle" style={{ height: "24px" }} className={styles.title} />
                <div style={{ height: "4px" }} />
                <SkeletonItem shape="rectangle" style={{ height: "16px" }} className={styles.line1} />
                <SkeletonItem shape="rectangle" style={{ height: "16px" }} className={styles.line2} />
            </Skeleton>
        </Card>
    );
};
