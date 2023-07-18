import { Example } from "./Example";

import styles from "./Example.module.css";

export type ExampleModel = {
    text: string;
    value: string;
};

const EXAMPLES: ExampleModel[] = [
    {
        text: "Protein synthesis can be divided broadly into... ",
        value: "Protein synthesis can be divided broadly into two phases - transcription and translation. During transcription, a section of DNA encoding a protein, known as a gene, is converted into a template molecule called messenger RNA (mRNA). This conversion is carried out by enzymes, known as RNA polymerases, in the nucleus of the cell.[2] In eukaryotes, this mRNA is initially produced in a premature form (pre-mRNA) which undergoes post-transcriptional modifications to produce mature mRNA. The mature mRNA is exported from the cell nucleus via nuclear pores to the cytoplasm of the cell for translation to occur. During translation, the mRNA is read by ribosomes which use the nucleotide sequence of the mRNA to determine the sequence of amino acids. The ribosomes catalyze the formation of covalent peptide bonds between the encoded amino acids to form a polypeptide chain. "
    },
    {
        text: "Autonome Autos sind Autos ...",
        value: "Autonome Autos sind Autos, die komplett selbstständig fahren. Sie brauchen keinen Fahrer mehr. Ihr Innenraum könnte beispielsweise wie in einem Zug aussehen, mit vier Sitzen und eventuell einem Tisch. Lenkrad, Pedale, Schaltknüppel – all das wäre nicht mehr vorhanden. Damit diese Autos autonom fahren können, sind sie mit einer Fülle von Technik ausgestattet. Laser, Sensoren, Kameras, ein GPS-Empfänger, Messgeräte und ein Bordcomputer erkennen andere Verkehrsteilnehmer, Straßenschilder, Ampeln usw. Sie machen es möglich, dass das Auto sich sicher durch den Verkehr bewegt und Kollisionen vermeidet. Mehrere Autohersteller arbeiten an verschiedenen Modellen autonomer Autos und die Forschung ist schon weit fortgeschritten."
    }
];

interface Props {
    onExampleClicked: (value: string) => void;
}

export const ExampleListSum = ({ onExampleClicked }: Props) => {
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
