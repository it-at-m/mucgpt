import { useTranslation } from "react-i18next";
import { Example } from "./Example";

import styles from "./Example.module.css";

export type ExampleModel = {
    text: string;
    value: string;
};

const EXAMPLES: ExampleModel[] = [
    {
        text: "Proteinbiosynthese ist die... ",
        value: "Proteinbiosynthese ist die Neubildung von Proteinen in Zellen. Bei diesem für alle Lebewesen zentralen Prozess wird ein Protein durch Verknüpfung verschiedener Aminosäuren aufgebaut, an Ribosomen nach Vorgabe genetischer Information. Die Synthese eines Proteins aus seinen Bausteinen, den proteinogenen Aminosäuren, findet im Rahmen der Genexpression an den Ribosomen statt. Die ribosomale Proteinsynthese wird auch als Translation bezeichnet, da hierbei die Basenfolge einer messenger-RNA (mRNA) in die Abfolge von Aminosäuren eines Peptids übersetzt wird. Dies geschieht, indem fortlaufend jedem Codon der mRNA das entsprechende Anticodon einer transfer-RNA (tRNA) zugeordnet wird und deren jeweils einzeln transportierte Aminosäure an die benachbarte gebunden wird (Peptidbindung), sodass eine Kette mit charakteristischer Aminosäuresequenz entsteht. Dieses Polypeptid kann sich im umgebenden Medium zu einem strukturierten Gebilde dreidimensionaler Form auffalten, dem nativen Protein. Häufig wird es durch Abspaltungen, Umbauten und Anbauten danach noch verändert, posttranslational modifiziert. Während bei prokaryoten Zellen (Procyten) die ringförmige DNA frei im Zytosol vorliegt und die ribosomale Proteinsynthese zumeist unmittelbar und prompt mit der gerade eben erstellten mRNA erfolgt, sind die Verhältnisse bei eukaryoten Zellen (Eucyten) komplizierter. Für das auf mehrere Chromosomen verteilte Genom ist hier mit dem Zellkern (Nukleus) ein eigenes Kompartiment geschaffen, in dessen Karyoplasma auch die Transkription stattfindet. Die primär gezogene RNA-Kopie (hnRNA) wird zunächst stabilisiert, überarbeitet und auf den Kernexport vorbereitet, bevor sie als mRNA eine Kernpore passiert und ins Zytoplasma gelangt, das die Untereinheiten der Ribosomen enthält. Diese räumliche Aufteilung und der mehrschrittige Prozessweg erlauben somit zusätzliche Weisen, eine (hn)RNA posttranskriptional zu modifizieren und darüber die Genexpression zu regulieren beziehungsweise bestimmte RNA-Vorlagen von der Proteinbiosynthese auszuschließen (Gen-Stilllegung). "
    },
    {
        text: "Autonome Autos sind Autos...",
        value: "Autonome Autos sind Autos, die komplett selbstständig fahren. Sie brauchen keinen Fahrer mehr. Ihr Innenraum könnte beispielsweise wie in einem Zug aussehen, mit vier Sitzen und eventuell einem Tisch. Lenkrad, Pedale, Schaltknüppel – all das wäre nicht mehr vorhanden. Damit diese Autos autonom fahren können, sind sie mit einer Fülle von Technik ausgestattet. Laser, Sensoren, Kameras, ein GPS-Empfänger, Messgeräte und ein Bordcomputer erkennen andere Verkehrsteilnehmer, Straßenschilder, Ampeln usw. Sie machen es möglich, dass das Auto sich sicher durch den Verkehr bewegt und Kollisionen vermeidet. Mehrere Autohersteller arbeiten an verschiedenen Modellen autonomer Autos und die Forschung ist schon weit fortgeschritten."
    },
    {
        text: "Tempolimit",
        value: "Viele wollen es. 57 Prozent der Deutschen sagen in einer Umfrage des Meinungsforschungsinstituts YouGov, dass sie für ein Tempolimit von 130 Stundenkilometern auf Autobahnen sind. Genauso sind es Menschen aus Wissenschaft, Politik, Kirche und dem öffentlichen Leben, die im Bündnis Tempolimit jetzt! aktiv sind. Einer davon: Sebastian Vettel, der vier Saisons der Formel-1 gewonnen hat.​Einer, der es definitiv nicht will, ist Verkehrsminister Volker Wissing. Der Politiker aus der Freien Demokratischen Partei (FDP) ist gegen staatliche Limitierungen im Straßenverkehr. Er sagt: „Autofahren bedeutet Freiheit.“ Mit dieser Meinung ist Wissing in seiner Partei und in Deutschland nicht allein.​Fast allein ist das Land aber mit der Möglichkeit, auf Autobahnen so schnell zu fahren, wie man will. In Europa hat nur ein anderer Ort kein Limit: die Isle of Man in der Irischen See. Autobahnen gibt es dort aber keine. Auch insgesamt gibt es nur wenige andere Länder ohne Maximalgeschwindigkeit, sie haben aber schlechte Straßen. ​Über ein Tempolimit diskutiert man in Deutschland schon ziemlich lang – und meistens emotional. Dabei ist 1953 ein wichtiges Jahr. Damals fand unter Kanzler Konrad Adenauer eine große Deregulierung der Geschwindigkeit statt: Menschen in Pkw und auf Motorrädern durften überall in der Bundesrepublik so schnell fahren, wie sie wollten und konnten. Westdeutschland lebte seinen Mythos der Autobahn. Anders in der Deutschen Demokratischen Republik: Dort waren 100 Stundenkilometer auf Autobahnen das Maximum, 80 außerhalb von Orten und 50 in Orten.​Weil in der Bundesrepublik die Zahl der Verkehrstoten deutlich stieg, führte die Regierung im Jahr 1957 für Orte eine Maximalgeschwindigkeit von 50 Stundenkilometern ein. Diese Norm hatte viele Gegner: den Allgemeinen Deutschen Automobil-Club (ADAC), die Autoindustrie, aber auch Menschen aus Politik und Wissenschaft.​Im Jahr 1972 kam die Einführung eines Tempolimits von 100 Stundenkilometern auf Landstraßen. Auch über diese Aktion gegen die vielen Verkehrstoten gab es intensive Diskussionen. ​Monate später kam die Ölkrise – und mit ihr ab November 1973 ein vorübergehendes Tempolimit von 100 Stundenkilometern auf Autobahnen. So wollte man den Erdölverbrauch reduzieren. Aber der Protest war groß. Ganz vorn dabei war der ADAC, der eine Kampagne mit dem Motto „Freie Fahrt für freie Bürger“ startete. Mit Erfolg: Nach 111 Tagen endete das Tempolimit auf Autobahnen. Ab dem 15. März 1974 durfte man wieder so viel Gas geben, wie man wollte. Das ist bis heute auf circa 70 Prozent der deutschen Autobahnen möglich. Dort gibt es nur die Empfehlung für eine Geschwindigkeit von 130 Stundenkilometern.  ​ Die Debatte über das Tempolimit hat trotzdem nicht aufgehört. Und auch 50 Jahre später spielen die mächtige deutsche Autolobby und das (oft auch von ihr verwendete) Freiheitsargument noch immer zentrale Rollen – obwohl die Welt heute eine andere ist.​ Da ist vor allem die Frage, ob ein Tempolimit gegen die Klimakrise hilft. Anfang dieses Jahres hat das Umweltbundesamt eine Studie publiziert. Sie zeigt, dass ein Limit von 120 Stundenkilometern einen größeren Effekt hätte als bis jetzt gedacht. Pro Jahr könnte man die Treibhausgasemissionen des deutschen Straßenverkehrs so um 4,2 Prozent reduzieren.​ Elementar ist außerdem die Frage, ob ein Tempolimit den Verkehr sicherer macht. Klar ist: Je schneller ein Auto unterwegs ist, desto länger dauert das Bremsen bis zum Stoppen. Das Nachrichtenportal Spiegel Online hat den Unfallatlas der statistischen Ämter des Bundes und der Länder analysiert. Das Resultat: Je eine Milliarde gefahrener Kilometer gibt es auf Autobahnabschnitten mit Tempolimit 0,95 tödliche Unfälle. Auf Strecken ohne Tempolimit sind es 1,67 tödliche Unfälle – rund 75 Prozent mehr.​ Warum lieben viele Deutsche das schnelle Fahren trotzdem so sehr? Fragt man Verkehrspsychologen, hört man bald wieder das große Wort dieser Debatte: Freiheit. Aber dominiert der Wunsch danach wirklich die kollektive Psyche und entscheidet über das Tempo deutscher Autofahrerinnen?​Eine Antwort liefert eine Studie des Instituts der deutschen Wirtschaft aus dem Jahr 2021. Sie zeigt: 77 Prozent der Autofahrer sind auf Autobahnabschnitten ohne Tempolimit langsamer als 130 Stundenkilometer unterwegs. Zwölf Prozent fahren dort zwischen 130 und 140 Stundenkilometer. Nur weniger als zwei Prozent fahren schneller als 160.​Inzwischen ist auch die Mehrheit der Mitglieder des ADAC für ein Tempolimit. Der Verband der Automobilindustrie ist noch dagegen. Und die Regierung? Im Koalitionsvertrag steht auf Wunsch der FDP: „Ein generelles Tempolimit wird es nicht geben."
    }
];

interface Props {
    onExampleClicked: (value: string) => void;
}

export const ExampleListSum = ({ onExampleClicked }: Props) => {
    const { t } = useTranslation();
    return (
        <ul className={styles.examplesNavList} aria-description={t('common.examples')}>
            {EXAMPLES.map((x, i) => (
                <li key={i}>
                    <Example text={x.text} value={x.value} onClick={onExampleClicked} ariaLabel={t('components.example.label') + " " + (i + 1).toString()} />
                </li>
            ))}
        </ul>
    );
};
