import { Example } from "./Example";

import styles from "./Example.module.css";

export type ExampleModel = {
    text: string;
    value: string;
};

const EXAMPLES: ExampleModel[] = [
    {
        text: "Proteinbiosynthese ist die ... ",
        value: "Proteinbiosynthese ist die Neubildung von Proteinen in Zellen. Bei diesem für alle Lebewesen zentralen Prozess wird ein Protein durch Verknüpfung verschiedener Aminosäuren aufgebaut, an Ribosomen nach Vorgabe genetischer Information. Die Synthese eines Proteins aus seinen Bausteinen, den proteinogenen Aminosäuren, findet im Rahmen der Genexpression an den Ribosomen statt. Die ribosomale Proteinsynthese wird auch als Translation bezeichnet, da hierbei die Basenfolge einer messenger-RNA (mRNA) in die Abfolge von Aminosäuren eines Peptids übersetzt wird. Dies geschieht, indem fortlaufend jedem Codon der mRNA das entsprechende Anticodon einer transfer-RNA (tRNA) zugeordnet wird und deren jeweils einzeln transportierte Aminosäure an die benachbarte gebunden wird (Peptidbindung), sodass eine Kette mit charakteristischer Aminosäuresequenz entsteht. Dieses Polypeptid kann sich im umgebenden Medium zu einem strukturierten Gebilde dreidimensionaler Form auffalten, dem nativen Protein. Häufig wird es durch Abspaltungen, Umbauten und Anbauten danach noch verändert, posttranslational modifiziert. Während bei prokaryoten Zellen (Procyten) die ringförmige DNA frei im Zytosol vorliegt und die ribosomale Proteinsynthese zumeist unmittelbar und prompt mit der gerade eben erstellten mRNA erfolgt, sind die Verhältnisse bei eukaryoten Zellen (Eucyten) komplizierter. Für das auf mehrere Chromosomen verteilte Genom ist hier mit dem Zellkern (Nukleus) ein eigenes Kompartiment geschaffen, in dessen Karyoplasma auch die Transkription stattfindet. Die primär gezogene RNA-Kopie (hnRNA) wird zunächst stabilisiert, überarbeitet und auf den Kernexport vorbereitet, bevor sie als mRNA eine Kernpore passiert und ins Zytoplasma gelangt, das die Untereinheiten der Ribosomen enthält. Diese räumliche Aufteilung und der mehrschrittige Prozessweg erlauben somit zusätzliche Weisen, eine (hn)RNA posttranskriptional zu modifizieren und darüber die Genexpression zu regulieren beziehungsweise bestimmte RNA-Vorlagen von der Proteinbiosynthese auszuschließen (Gen-Stilllegung). "
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
