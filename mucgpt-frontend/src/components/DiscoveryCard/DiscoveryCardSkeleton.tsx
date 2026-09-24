import { Card, Skeleton, SkeletonItem, mergeClasses, tokens } from "@fluentui/react-components";
import cardStyles from "./DiscoveryCard.module.css";
import styles from "./DiscoveryCardSkeleton.module.css";

export const DiscoveryCardSkeleton = () => {
    return (
        <Card
            size="large"
            appearance="subtle"
            className={mergeClasses(cardStyles.card, styles.card)}
            style={{ backgroundColor: tokens.colorNeutralCardBackground }}
        >
            <Skeleton className={styles.skeleton}>
                <SkeletonItem shape="rectangle" style={{ width: "58%", height: "var(--lineHeightBase300)" }} />
                <div className={styles.description}>
                    <SkeletonItem shape="rectangle" style={{ width: "100%", height: "var(--lineHeightBase200)" }} />
                    <SkeletonItem shape="rectangle" style={{ width: "68%", height: "var(--lineHeightBase200)" }} />
                </div>
                <div className={styles.metadata}>
                    <SkeletonItem shape="rectangle" style={{ width: "30%", height: "var(--lineHeightBase200)" }} />
                    <SkeletonItem shape="rectangle" style={{ width: "14%", height: "var(--lineHeightBase200)" }} />
                </div>
            </Skeleton>
        </Card>
    );
};
