import { Example } from "./Example";

import styles from "./Example.module.css";

export type ExampleModel = {
    text: string;
    value: string;
};

const EXAMPLES: ExampleModel[] = [
    {
        text: "Maßnahmen für Städte um besser mit dem Klimawandel zurechtzukommen",
        value: "Maßnahmen für Städte um besser mit dem Klimawandel zurechtzukommen"
    },
    {
        text: "Gründe in München zu wohnen",
        value: "Gründe in München zu wohnen"
    },
    {
        text: "Wie bereite ich mich am Besten fürs Oktoberfest vor",
        value: "Wie bereite ich mich am Besten fürs Oktoberfest vor"
    }
];

interface Props {
    onExampleClicked: (value: string) => void;
}

export const ExampleListBrainstorm = ({ onExampleClicked }: Props) => {
    return (
        <ul className={styles.examplesNavList}>
            {EXAMPLES.map((x, i) => (
                <li key={i}>
                    <Example text={x.text} value={x.value} onClick={onExampleClicked} />
                </li>
            ))}
        </ul>
    );
};
