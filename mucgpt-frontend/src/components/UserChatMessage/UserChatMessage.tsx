import styles from "./UserChatMessage.module.css";
import { MarkdownRenderer } from "../MarkdownRenderer/MarkdownRenderer";
import type { ImageAttachment } from "../../api";
// import { RollBackMessage } from "./RollbackMessage";

interface Props {
    message: string;
    images?: ImageAttachment[];
    onRollbackMessage?: () => void;
}

export const UserChatMessage = ({ message, images }: Props) => {
    return (
        <div className={styles.messageWrapper}>
            {images && images.length > 0 ? (
                <div className={styles.imageGallery} role="list" aria-label={images.map(image => image.filename ?? "image").join(", ")}>
                    {images.map(image => (
                        <img
                            key={image.id}
                            role="listitem"
                            className={styles.imageGalleryItem}
                            src={image.displayUrl}
                            alt={image.filename ?? ""}
                            loading="lazy"
                        />
                    ))}
                </div>
            ) : null}
            {message ? (
                <div className={styles.message}>
                    <div className={styles.answerText}>
                        <MarkdownRenderer>{message}</MarkdownRenderer>
                    </div>
                </div>
            ) : null}
            {/* Temporarily disabled until backend checkpoints support message rollback.
            {onRollbackMessage && (
                <div className={styles.messageActions}>
                    <RollBackMessage onRollback={onRollbackMessage} />
                </div>
            )} */}
        </div>
    );
};
