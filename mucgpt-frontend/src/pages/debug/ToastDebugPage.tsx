import { useContext, useEffect, useState } from "react";
import { Button, Card, Divider, Field, Input, Text } from "@fluentui/react-components";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import { HeaderContext } from "../layout/HeaderContextProvider";
import styles from "./ToastDebugPage.module.css";

const ToastDebugPage = () => {
    const { setHeader } = useContext(HeaderContext);
    const { showSuccess, showError, showWarning, showInfo, showToast, showLoadingToast, updateToast } = useGlobalToastContext();
    const [timeoutValue, setTimeoutValue] = useState("5000");

    useEffect(() => {
        setHeader("Toast Debug");
        return () => setHeader("");
    }, [setHeader]);

    const parsedTimeout = Number(timeoutValue);
    const customTimeout = Number.isFinite(parsedTimeout) && parsedTimeout >= 0 ? parsedTimeout : undefined;

    return (
        <div className={styles.page}>
            <div className={styles.hero}>
                <Text as="h1" size={700} weight="bold">
                    Toast Debug
                </Text>
                <Text size={400} className={styles.subtitle}>
                    Testseite fuer das neue zentrale Toast-System.
                </Text>
            </div>

            <div className={styles.grid}>
                <Card className={styles.card}>
                    <Text as="h2" size={500} weight="semibold">
                        Standard-Varianten
                    </Text>
                    <div className={styles.buttonGroup}>
                        <Button onClick={() => showSuccess("Speichern erfolgreich", "Die Einstellungen wurden uebernommen.")}>Success</Button>
                        <Button onClick={() => showError("Speichern fehlgeschlagen", "Bitte versuche es erneut oder wende dich an den Support.")}>Error</Button>
                        <Button onClick={() => showWarning("Fast geschafft", "Es fehlen noch Pflichtangaben, bevor du fortfahren kannst.")}>Warning</Button>
                        <Button onClick={() => showInfo("Neue Information", "Es gibt einen aktualisierten Hinweis zu diesem Vorgang.")}>Info</Button>
                    </div>
                </Card>

                <Card className={styles.card}>
                    <Text as="h2" size={500} weight="semibold">
                        Verhalten
                    </Text>
                    <Field label="Custom Timeout in ms">
                        <Input value={timeoutValue} onChange={(_event, data) => setTimeoutValue(data.value)} />
                    </Field>
                    <div className={styles.buttonGroup}>
                        <Button
                            onClick={() =>
                                showToast({
                                    type: "info",
                                    title: "Eigener Timeout",
                                    message: `Dieser Toast nutzt ${customTimeout ?? 0} ms Sichtbarkeit.`,
                                    timeout: customTimeout
                                })
                            }
                        >
                            Custom Timeout
                        </Button>
                        <Button
                            onClick={() =>
                                showToast({
                                    type: "warning",
                                    title: "Manuell schliessen",
                                    message: "Dieser Toast bleibt sichtbar, bis du ihn aktiv schliesst.",
                                    persistent: true
                                })
                            }
                        >
                            Persistent
                        </Button>
                        <Button
                            onClick={() =>
                                showToast({
                                    type: "warning",
                                    title: "Ohne Icon",
                                    message: "Die Anatomie bleibt gleich, nur das Status-Icon fehlt.",
                                    showIcon: false
                                })
                            }
                        >
                            Without Icon
                        </Button>
                    </div>
                </Card>

                <Card className={styles.card}>
                    <Text as="h2" size={500} weight="semibold">
                        Loading und Updates
                    </Text>
                    <div className={styles.buttonGroup}>
                        <Button onClick={() => showLoadingToast("Datei wird verarbeitet", "Der Upload wird analysiert und vorbereitet.")}>Loading</Button>
                        <Button
                            onClick={() => {
                                const toastId = showLoadingToast("Import laeuft", "Daten werden importiert.");
                                window.setTimeout(() => {
                                    updateToast(toastId, {
                                        type: "success",
                                        title: "Import abgeschlossen",
                                        message: "Alle Datensaetze wurden erfolgreich uebernommen.",
                                        persistent: false,
                                        timeout: 4000
                                    });
                                }, 1800);
                            }}
                        >
                            Loading -&gt; Success
                        </Button>
                        <Button
                            onClick={() => {
                                const toastId = showLoadingToast("Verbindung wird aufgebaut", "Der Dienst antwortet gerade nicht.");
                                window.setTimeout(() => {
                                    updateToast(toastId, {
                                        type: "error",
                                        title: "Verbindung fehlgeschlagen",
                                        message: "Der externe Dienst konnte nicht erreicht werden.",
                                        persistent: false,
                                        timeout: 4000
                                    });
                                }, 1800);
                            }}
                        >
                            Loading -&gt; Error
                        </Button>
                    </div>
                </Card>

                <Card className={styles.card}>
                    <Text as="h2" size={500} weight="semibold">
                        Stacking
                    </Text>
                    <div className={styles.buttonGroup}>
                        <Button
                            onClick={() => {
                                showInfo("Schritt 1", "Der Prozess wurde gestartet.");
                                showWarning("Schritt 2", "Ein Zwischenschritt benoetigt Aufmerksamkeit.");
                                showSuccess("Schritt 3", "Der Prozess wurde abgeschlossen.");
                            }}
                        >
                            Mehrere Toasts
                        </Button>
                        <Button
                            onClick={() => {
                                const first = showLoadingToast("Tool A", "Strukturiere die Anfrage...");
                                const second = showLoadingToast("Tool B", "Suche nach passenden Quellen...");
                                const third = showLoadingToast("Tool C", "Formatiere die Antwort...");

                                window.setTimeout(() => {
                                    updateToast(first, {
                                        type: "success",
                                        title: "Tool A",
                                        message: "Analyse abgeschlossen.",
                                        persistent: false,
                                        timeout: 3500
                                    });
                                }, 1200);

                                window.setTimeout(() => {
                                    updateToast(second, {
                                        type: "success",
                                        title: "Tool B",
                                        message: "Quellen erfolgreich gefunden.",
                                        persistent: false,
                                        timeout: 3500
                                    });
                                }, 2000);

                                window.setTimeout(() => {
                                    updateToast(third, {
                                        type: "error",
                                        title: "Tool C",
                                        message: "Das Formatieren ist mit einem Fehler abgebrochen.",
                                        persistent: false,
                                        timeout: 4000
                                    });
                                }, 2800);
                            }}
                        >
                            Parallele Loading-Toasts
                        </Button>
                    </div>
                </Card>
            </div>

            <Divider className={styles.divider} />

            <Text size={300} className={styles.footerNote}>
                Route: <code>#/debug/toasts</code>
            </Text>
        </div>
    );
};

export default ToastDebugPage;
