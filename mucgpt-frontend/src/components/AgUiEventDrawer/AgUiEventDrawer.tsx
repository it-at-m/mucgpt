import { useEffect, useRef } from "react";
import type { BaseEvent } from "@ag-ui/core";
import { Button, DrawerBody, DrawerHeader, DrawerHeaderTitle, OverlayDrawer, Text } from "@fluentui/react-components";
import { Delete16Regular, Dismiss24Regular } from "@fluentui/react-icons";

import styles from "./AgUiEventDrawer.module.css";

export interface AgUiEventLogEntry {
    event: BaseEvent;
    receivedAt: string;
}

interface AgUiEventDrawerProps {
    open: boolean;
    events: AgUiEventLogEntry[];
    onClose: () => void;
    onClear: () => void;
}

export const AgUiEventDrawer = ({ open, events, onClose, onClear }: AgUiEventDrawerProps) => {
    const eventListEnd = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) eventListEnd.current?.scrollIntoView({ block: "end" });
    }, [events.length, open]);

    return (
        <OverlayDrawer open={open} position="end" size="medium" onOpenChange={(_, data) => !data.open && onClose()}>
            <DrawerHeader>
                <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Schließen" icon={<Dismiss24Regular />} onClick={onClose} />}>
                    AG-UI Events
                </DrawerHeaderTitle>
                <div className={styles.summary}>
                    <Text size={200}>{events.length} von maximal 200 Events</Text>
                    <Button appearance="subtle" size="small" icon={<Delete16Regular />} onClick={onClear} disabled={events.length === 0}>
                        Leeren
                    </Button>
                </div>
            </DrawerHeader>
            <DrawerBody className={styles.body}>
                {events.length === 0 ? (
                    <Text className={styles.empty}>Noch keine AG-UI Events empfangen.</Text>
                ) : (
                    <ol className={styles.eventList}>
                        {events.map((entry, index) => (
                            <li className={styles.event} key={`${entry.receivedAt}-${index}`}>
                                <div className={styles.eventHeader}>
                                    <Text weight="semibold">{entry.event.type}</Text>
                                    <time dateTime={entry.receivedAt}>{new Date(entry.receivedAt).toLocaleTimeString()}</time>
                                </div>
                                <pre>{JSON.stringify(entry.event, null, 2)}</pre>
                            </li>
                        ))}
                    </ol>
                )}
                <div ref={eventListEnd} />
            </DrawerBody>
        </OverlayDrawer>
    );
};
