import { useTranslation } from "react-i18next";
import { Example } from "./Example";

import styles from "./Example.module.css";

export type ExampleModel = {
    id?: string;
    text: string;
    value: string;
    system?: string;
};

interface Props {
    examples: ExampleModel[];
    onExampleClicked: (value: string, system?: string) => void;
}

export const ExampleList = ({ examples, onExampleClicked }: Props) => {
    const { t } = useTranslation();
    return (
        <ul className={styles.examplesNavList} aria-description={t("common.examples")}>
            {examples.map((x, i) => (
                <li key={x.id || i} tabIndex={0}>
                    <Example
                        text={x.text}
                        system={x.system}
                        value={x.value}
                        onClick={onExampleClicked}
                        ariaLabel={t("components.example.label") + " " + (i + 1).toString()}
                    />
                </li>
            ))}
        </ul>
    );
};
