import { useTranslation } from "react-i18next";
import { Example } from "./Example";

import styles from "./Example.module.css";

export type ExampleModel = {
    text: string;
    value: string;
};

const EXAMPLES: ExampleModel[] = [
    {
        text: "Arbeitsschutzgesetz",
        value: `Erster Abschnitt
    Allgemeine Vorschriften
    Nichtamtliches Inhaltsverzeichnis
    1 Zweck des Gesetzes
    Zweck des Gesetzes ist es,
    1.
    die Sicherheit und den Gesundheitsschutz der Arbeitnehmer in der Bundesrepublik Deutschland und in der ausschließlichen Wirtschaftszone bei der Arbeitszeitgestaltung zu gewährleisten und die Rahmenbedingungen für flexible Arbeitszeiten zu verbessern sowie
    2.
    den Sonntag und die staatlich anerkannten Feiertage als Tage der Arbeitsruhe und der seelischen Erhebung der Arbeitnehmer zu schützen.
    Nichtamtliches Inhaltsverzeichnis
    2 Begriffsbestimmungen
    (1) Arbeitszeit im Sinne dieses Gesetzes ist die Zeit vom Beginn bis zum Ende der Arbeit ohne die Ruhepausen; Arbeitszeiten bei mehreren Arbeitgebern sind zusammenzurechnen. Im Bergbau unter Tage zählen die Ruhepausen zur Arbeitszeit.
    (2) Arbeitnehmer im Sinne dieses Gesetzes sind Arbeiter und Angestellte sowie die zu ihrer Berufsbildung Beschäftigten.
    (3) Nachtzeit im Sinne dieses Gesetzes ist die Zeit von 23 bis 6 Uhr, in Bäckereien und Konditoreien die Zeit von 22 bis 5 Uhr.
    (4) Nachtarbeit im Sinne dieses Gesetzes ist jede Arbeit, die mehr als zwei Stunden der Nachtzeit umfaßt.
    (5) Nachtarbeitnehmer im Sinne dieses Gesetzes sind Arbeitnehmer, die
    1.
    auf Grund ihrer Arbeitszeitgestaltung normalerweise Nachtarbeit in Wechselschicht zu leisten haben oder
    2.
    Nachtarbeit an mindestens 48 Tagen im Kalenderjahr leisten.
    Zweiter Abschnitt
    Werktägliche Arbeitszeit und arbeitsfreie Zeiten
    Nichtamtliches Inhaltsverzeichnis
    3 Arbeitszeit der Arbeitnehmer
    Die werktägliche Arbeitszeit der Arbeitnehmer darf acht Stunden nicht überschreiten. Sie kann auf bis zu zehn Stunden nur verlängert werden, wenn innerhalb von sechs Kalendermonaten oder innerhalb von 24 Wochen im Durchschnitt acht Stunden werktäglich nicht überschritten werden.
    Nichtamtliches Inhaltsverzeichnis
    4 Ruhepausen
    Die Arbeit ist durch im voraus feststehende Ruhepausen von mindestens 30 Minuten bei einer Arbeitszeit von mehr als sechs bis zu neun Stunden und 45 Minuten bei einer Arbeitszeit von mehr als neun Stunden insgesamt zu unterbrechen. Die Ruhepausen nach Satz 1 können in Zeitabschnitte von jeweils mindestens 15 Minuten aufgeteilt werden. Länger als sechs Stunden hintereinander dürfen Arbeitnehmer nicht ohne Ruhepause beschäftigt werden.
    Nichtamtliches Inhaltsverzeichnis
    5 Ruhezeit
    (1) Die Arbeitnehmer müssen nach Beendigung der täglichen Arbeitszeit eine ununterbrochene Ruhezeit von mindestens elf Stunden haben.
    (2) Die Dauer der Ruhezeit des Absatzes 1 kann in Krankenhäusern und anderen Einrichtungen zur Behandlung, Pflege und Betreuung von Personen, in Gaststätten und anderen Einrichtungen zur Bewirtung und Beherbergung, in Verkehrsbetrieben, beim Rundfunk sowie in der Landwirtschaft und in der Tierhaltung um bis zu eine Stunde verkürzt werden, wenn jede Verkürzung der Ruhezeit innerhalb eines Kalendermonats oder innerhalb von vier Wochen durch Verlängerung einer anderen Ruhezeit auf mindestens zwölf Stunden ausgeglichen wird.
    (3) Abweichend von Absatz 1 können in Krankenhäusern und anderen Einrichtungen zur Behandlung, Pflege und Betreuung von Personen Kürzungen der Ruhezeit durch Inanspruchnahmen während der Rufbereitschaft, die nicht mehr als die Hälfte der Ruhezeit betragen, zu anderen Zeiten ausgeglichen werden.
    (4) (weggefallen)
    Nichtamtliches Inhaltsverzeichnis
    § 6 Nacht- und Schichtarbeit
    (1) Die Arbeitszeit der Nacht- und Schichtarbeitnehmer ist nach den gesicherten arbeitswissenschaftlichen Erkenntnissen über die menschengerechte Gestaltung der Arbeit festzulegen.
    (2) Die werktägliche Arbeitszeit der Nachtarbeitnehmer darf acht Stunden nicht überschreiten. Sie kann auf bis zu zehn Stunden nur verlängert werden, wenn abweichend von § 3 innerhalb von einem Kalendermonat oder innerhalb von vier Wochen im Durchschnitt acht Stunden werktäglich nicht überschritten werden. Für Zeiträume, in denen Nachtarbeitnehmer im Sinne des § 2 Abs. 5 Nr. 2 nicht zur Nachtarbeit herangezogen werden, findet § 3 Satz 2 Anwendung.
    (3) Nachtarbeitnehmer sind berechtigt, sich vor Beginn der Beschäftigung und danach in regelmäßigen Zeitabständen von nicht weniger als drei Jahren arbeitsmedizinisch untersuchen zu lassen. Nach Vollendung des 50. Lebensjahres steht Nachtarbeitnehmern dieses Recht in Zeitabständen von einem Jahr zu. Die Kosten der Untersuchungen hat der Arbeitgeber zu tragen, sofern er die Untersuchungen den Nachtarbeitnehmern nicht kostenlos durch einen Betriebsarzt oder einen überbetrieblichen Dienst von Betriebsärzten anbietet.
    (4) Der Arbeitgeber hat den Nachtarbeitnehmer auf dessen Verlangen auf einen für ihn geeigneten Tagesarbeitsplatz umzusetzen, wenn
    a)
    nach arbeitsmedizinischer Feststellung die weitere Verrichtung von Nachtarbeit den Arbeitnehmer in seiner Gesundheit gefährdet oder
    b)
    im Haushalt des Arbeitnehmers ein Kind unter zwölf Jahren lebt, das nicht von einer anderen im Haushalt lebenden Person betreut werden kann, oder
    c)
    der Arbeitnehmer einen schwerpflegebedürftigen Angehörigen zu versorgen hat, der nicht von einem anderen im Haushalt lebenden Angehörigen versorgt werden kann,
    sofern dem nicht dringende betriebliche Erfordernisse entgegenstehen. Stehen der Umsetzung des Nachtarbeitnehmers auf einen für ihn geeigneten Tagesarbeitsplatz nach Auffassung des Arbeitgebers dringende betriebliche Erfordernisse entgegen, so ist der Betriebs- oder Personalrat zu hören. Der Betriebs- oder Personalrat kann dem Arbeitgeber Vorschläge für eine Umsetzung unterbreiten.
    (5) Soweit keine tarifvertraglichen Ausgleichsregelungen bestehen, hat der Arbeitgeber dem Nachtarbeitnehmer für die während der Nachtzeit geleisteten Arbeitsstunden eine angemessene Zahl bezahlter freier Tage oder einen angemessenen Zuschlag auf das ihm hierfür zustehende Bruttoarbeitsentgelt zu gewähren.
    (6) Es ist sicherzustellen, daß Nachtarbeitnehmer den gleichen Zugang zur betrieblichen Weiterbildung und zu aufstiegsfördernden Maßnahmen haben wie die übrigen Arbeitnehmer.
    Nichtamtliches Inhaltsverzeichnis
    7 Abweichende Regelungen
    (1) In einem Tarifvertrag oder auf Grund eines Tarifvertrags in einer Betriebs- oder Dienstvereinbarung kann zugelassen werden,
    1.
    abweichend von § 3
    a)
    die Arbeitszeit über zehn Stunden werktäglich zu verlängern, wenn in die Arbeitszeit regelmäßig und in erheblichem Umfang Arbeitsbereitschaft oder Bereitschaftsdienst fällt,
    b)
    einen anderen Ausgleichszeitraum festzulegen,
    c)
    (weggefallen)
    2.
    abweichend von § 4 Satz 2 die Gesamtdauer der Ruhepausen in Schichtbetrieben und Verkehrsbetrieben auf Kurzpausen von angemessener Dauer aufzuteilen,
    3.
    abweichend von § 5 Abs. 1 die Ruhezeit um bis zu zwei Stunden zu kürzen, wenn die Art der Arbeit dies erfordert und die Kürzung der Ruhezeit innerhalb eines festzulegenden Ausgleichszeitraums ausgeglichen wird,
    4.
    abweichend von § 6 Abs. 2
    a)
    die Arbeitszeit über zehn Stunden werktäglich hinaus zu verlängern, wenn in die Arbeitszeit regelmäßig und in erheblichem Umfang Arbeitsbereitschaft oder Bereitschaftsdienst fällt,
    b)
    einen anderen Ausgleichszeitraum festzulegen,
    5.
    den Beginn des siebenstündigen Nachtzeitraums des § 2 Abs. 3 auf die Zeit zwischen 22 und 24 Uhr festzulegen.
    (2) Sofern der Gesundheitsschutz der Arbeitnehmer durch einen entsprechenden Zeitausgleich gewährleistet wird, kann in einem Tarifvertrag oder auf Grund eines Tarifvertrags in einer Betriebs- oder Dienstvereinbarung ferner zugelassen werden,
    1.
    abweichend von § 5 Abs. 1 die Ruhezeiten bei Rufbereitschaft den Besonderheiten dieses Dienstes anzupassen, insbesondere Kürzungen der Ruhezeit infolge von Inanspruchnahmen während dieses Dienstes zu anderen Zeiten auszugleichen,
    2.
    die Regelungen der §§ 3, 5 Abs. 1 und § 6 Abs. 2 in der Landwirtschaft der Bestellungs- und Erntezeit sowie den Witterungseinflüssen anzupassen,
    3.
    die Regelungen der §§ 3, 4, 5 Abs. 1 und § 6 Abs. 2 bei der Behandlung, Pflege und Betreuung von Personen der Eigenart dieser Tätigkeit und dem Wohl dieser Personen entsprechend anzupassen,
    4.
    die Regelungen der §§ 3, 4, 5 Abs. 1 und § 6 Abs. 2 bei Verwaltungen und Betrieben des Bundes, der Länder, der Gemeinden und sonstigen Körperschaften, Anstalten und Stiftungen des öffentlichen Rechts sowie bei anderen Arbeitgebern, die der Tarifbindung eines für den öffentlichen Dienst geltenden oder eines im wesentlichen inhaltsgleichen Tarifvertrags unterliegen, der Eigenart der Tätigkeit bei diesen Stellen anzupassen.
    (2a) In einem Tarifvertrag oder auf Grund eines Tarifvertrags in einer Betriebs- oder Dienstvereinbarung kann abweichend von den §§ 3, 5 Abs. 1 und § 6 Abs. 2 zugelassen werden, die werktägliche Arbeitszeit auch ohne Ausgleich über acht Stunden zu verlängern, wenn in die Arbeitszeit regelmäßig und in erheblichem Umfang Arbeitsbereitschaft oder Bereitschaftsdienst fällt und durch besondere Regelungen sichergestellt wird, dass die Gesundheit der Arbeitnehmer nicht gefährdet wird.
    (3) Im Geltungsbereich eines Tarifvertrags nach Absatz 1, 2 oder 2a können abweichende tarifvertragliche Regelungen im Betrieb eines nicht tarifgebundenen Arbeitgebers durch Betriebs- oder Dienstvereinbarung oder, wenn ein Betriebs- oder Personalrat nicht besteht, durch schriftliche Vereinbarung zwischen dem Arbeitgeber und dem Arbeitnehmer übernommen werden. Können auf Grund eines solchen Tarifvertrags abweichende Regelungen in einer Betriebs- oder Dienstvereinbarung getroffen werden, kann auch in Betrieben eines nicht tarifgebundenen Arbeitgebers davon Gebrauch gemacht werden. Eine nach Absatz 2 Nr. 4 getroffene abweichende tarifvertragliche Regelung hat zwischen nicht tarifgebundenen Arbeitgebern und Arbeitnehmern Geltung, wenn zwischen ihnen die Anwendung der für den öffentlichen Dienst geltenden tarifvertraglichen Bestimmungen vereinbart ist und die Arbeitgeber die Kosten des Betriebs überwiegend mit Zuwendungen im Sinne des Haushaltsrechts decken.
    (4) Die Kirchen und die öffentlich-rechtlichen Religionsgesellschaften können die in Absatz 1, 2 oder 2a genannten Abweichungen in ihren Regelungen vorsehen.
    (5) In einem Bereich, in dem Regelungen durch Tarifvertrag üblicherweise nicht getroffen werden, können Ausnahmen im Rahmen des Absatzes 1, 2 oder 2a durch die Aufsichtsbehörde bewilligt werden, wenn dies aus betrieblichen Gründen erforderlich ist und die Gesundheit der Arbeitnehmer nicht gefährdet wird.
    (6) Die Bundesregierung kann durch Rechtsverordnung mit Zustimmung des Bundesrates Ausnahmen im Rahmen des Absatzes 1 oder 2 zulassen, sofern dies aus betrieblichen Gründen erforderlich ist und die Gesundheit der Arbeitnehmer nicht gefährdet wird.
    (7) Auf Grund einer Regelung nach Absatz 2a oder den Absätzen 3 bis 5 jeweils in Verbindung mit Absatz 2a darf die Arbeitszeit nur verlängert werden, wenn der Arbeitnehmer schriftlich eingewilligt hat. Der Arbeitnehmer kann die Einwilligung mit einer Frist von sechs Monaten schriftlich widerrufen. Der Arbeitgeber darf einen Arbeitnehmer nicht benachteiligen, weil dieser die Einwilligung zur Verlängerung der Arbeitszeit nicht erklärt oder die Einwilligung widerrufen hat.
    (8) Werden Regelungen nach Absatz 1 Nr. 1 und 4, Absatz 2 Nr. 2 bis 4 oder solche Regelungen auf Grund der Absätze 3 und 4 zugelassen, darf die Arbeitszeit 48 Stunden wöchentlich im Durchschnitt von zwölf Kalendermonaten nicht überschreiten. Erfolgt die Zulassung auf Grund des Absatzes 5, darf die Arbeitszeit 48 Stunden wöchentlich im Durchschnitt von sechs Kalendermonaten oder 24 Wochen nicht überschreiten.
    (9) Wird die werktägliche Arbeitszeit über zwölf Stunden hinaus verlängert, muss im unmittelbaren Anschluss an die Beendigung der Arbeitszeit eine Ruhezeit von mindestens elf Stunden gewährt werden.
    Nichtamtliches Inhaltsverzeichnis
    8 Gefährliche Arbeiten
    Die Bundesregierung kann durch Rechtsverordnung mit Zustimmung des Bundesrates für einzelne Beschäftigungsbereiche, für bestimmte Arbeiten oder für bestimmte Arbeitnehmergruppen, bei denen besondere Gefahren für die Gesundheit der Arbeitnehmer zu erwarten sind, die Arbeitszeit über § 3 hinaus beschränken, die Ruhepausen und Ruhezeiten über die §§ 4 und 5 hinaus ausdehnen, die Regelungen zum Schutz der Nacht- und Schichtarbeitnehmer in § 6 erweitern und die Abweichungsmöglichkeiten nach § 7 beschränken, soweit dies zum Schutz der Gesundheit der Arbeitnehmer erforderlich ist. Satz 1 gilt nicht für Beschäftigungsbereiche und Arbeiten in Betrieben, die der Bergaufsicht unterliegen.
    Dritter Abschnitt
    Sonn- und Feiertagsruhe
    Nichtamtliches Inhaltsverzeichnis
    9 Sonn- und Feiertagsruhe
    (1) Arbeitnehmer dürfen an Sonn- und gesetzlichen Feiertagen von 0 bis 24 Uhr nicht beschäftigt werden.
    (2) In mehrschichtigen Betrieben mit regelmäßiger Tag- und Nachtschicht kann Beginn oder Ende der Sonn- und Feiertagsruhe um bis zu sechs Stunden vor- oder zurückverlegt werden, wenn für die auf den Beginn der Ruhezeit folgenden 24 Stunden der Betrieb ruht.
    (3) Für Kraftfahrer und Beifahrer kann der Beginn der 24stündigen Sonn- und Feiertagsruhe um bis zu zwei Stunden vorverlegt werden.
    Nichtamtliches Inhaltsverzeichnis
    10 Sonn- und Feiertagsbeschäftigung
    (1) Sofern die Arbeiten nicht an Werktagen vorgenommen werden können, dürfen Arbeitnehmer an Sonn- und Feiertagen abweichend von § 9 beschäftigt werden
    1.
    in Not- und Rettungsdiensten sowie bei der Feuerwehr,
    2.
    zur Aufrechterhaltung der öffentlichen Sicherheit und Ordnung sowie der Funktionsfähigkeit von Gerichten und Behörden und für Zwecke der Verteidigung,
    3.
    in Krankenhäusern und anderen Einrichtungen zur Behandlung, Pflege und Betreuung von Personen,
    4.
    in Gaststätten und anderen Einrichtungen zur Bewirtung und Beherbergung sowie im Haushalt,
    5.
    bei Musikaufführungen, Theatervorstellungen, Filmvorführungen, Schaustellungen, Darbietungen und anderen ähnlichen Veranstaltungen,
    6.
    bei nichtgewerblichen Aktionen und Veranstaltungen der Kirchen, Religionsgesellschaften, Verbände, Vereine, Parteien und anderer ähnlicher Vereinigungen,
    7.
    beim Sport und in Freizeit-, Erholungs- und Vergnügungseinrichtungen, beim Fremdenverkehr sowie in Museen und wissenschaftlichen Präsenzbibliotheken,
    8.
    beim Rundfunk, bei der Tages- und Sportpresse, bei Nachrichtenagenturen sowie bei den der Tagesaktualität dienenden Tätigkeiten für andere Presseerzeugnisse einschließlich des Austragens, bei der Herstellung von Satz, Filmen und Druckformen für tagesaktuelle Nachrichten und Bilder, bei tagesaktuellen Aufnahmen auf Ton- und Bildträger sowie beim Transport und Kommissionieren von Presseerzeugnissen, deren Ersterscheinungstag am Montag oder am Tag nach einem Feiertag liegt,
    9.
    bei Messen, Ausstellungen und Märkten im Sinne des Titels IV der Gewerbeordnung sowie bei Volksfesten,
    10.
    in Verkehrsbetrieben sowie beim Transport und Kommissionieren von leichtverderblichen Waren im Sinne des § 30 Abs. 3 Nr. 2 der Straßenverkehrsordnung,
    11.
    in den Energie- und Wasserversorgungsbetrieben sowie in Abfall- und Abwasserentsorgungsbetrieben,
    12.
    in der Landwirtschaft und in der Tierhaltung sowie in Einrichtungen zur Behandlung und Pflege von Tieren,
    13.
    im Bewachungsgewerbe und bei der Bewachung von Betriebsanlagen,
    14.
    bei der Reinigung und Instandhaltung von Betriebseinrichtungen, soweit hierdurch der regelmäßige Fortgang des eigenen oder eines fremden Betriebs bedingt ist, bei der Vorbereitung der Wiederaufnahme des vollen werktägigen Betriebs sowie bei der Aufrechterhaltung der Funktionsfähigkeit von Datennetzen und Rechnersystemen,
    15.
    zur Verhütung des Verderbens von Naturerzeugnissen oder Rohstoffen oder des Mißlingens von Arbeitsergebnissen sowie bei kontinuierlich durchzuführenden Forschungsarbeiten,
    16.
    zur Vermeidung einer Zerstörung oder erheblichen Beschädigung der Produktionseinrichtungen.
    (2) Abweichend von § 9 dürfen Arbeitnehmer an Sonn- und Feiertagen mit den Produktionsarbeiten beschäftigt werden, wenn die infolge der Unterbrechung der Produktion nach Absatz 1 Nr. 14 zulässigen Arbeiten den Einsatz von mehr Arbeitnehmern als bei durchgehender Produktion erfordern.
    (3) Abweichend von § 9 dürfen Arbeitnehmer an Sonn- und Feiertagen in Bäckereien und Konditoreien für bis zu drei Stunden mit der Herstellung und dem Austragen oder Ausfahren von Konditorwaren und an diesem Tag zum Verkauf kommenden Bäckerwaren beschäftigt werden.
    (4) Sofern die Arbeiten nicht an Werktagen vorgenommen werden können, dürfen Arbeitnehmer zur Durchführung des Eil- und Großbetragszahlungsverkehrs und des Geld-, Devisen-, Wertpapier- und Derivatehandels abweichend von § 9 Abs. 1 an den auf einen Werktag fallenden Feiertagen beschäftigt werden, die nicht in allen Mitgliedstaaten der Europäischen Union Feiertage sind.`
    },
];

interface Props {
    onExampleClicked: (value: string) => void;
}

export const ExampleListSimply = ({ onExampleClicked }: Props) => {
    const { t } = useTranslation();
    return (
        <ul className={styles.examplesNavList} aria-description={t('common.examples')}>
            {EXAMPLES.map((x, i) => (
                <li key={i} tabIndex={0}>
                    <Example text={x.text} value={x.value} onClick={onExampleClicked} ariaLabel={t('components.example.label') + " " + (i + 1).toString()} />
                </li>
            ))}
        </ul>
    );
};
