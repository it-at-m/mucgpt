import styles from "./Faq.module.css";

const Faq = () => {
    return (
        <div className={styles.container}>
            <div>
                <h1 className={styles.header}>FAQ</h1>
                <ul>
                    <li>Aber Kay, der kleine Kay! fragte Gerda. Wann kam er? Befand er sich unter der Menge?</li>
                    <li>Eil mit Weile! nun sind wir gerade bei ihm! Am dritten Tage kam eine kleine Person, weder mit Pferd, noch mit Wagen, ganz lustig und guter Dinge gerade auf das Schloss hinaufspaziert. Seine Augen blitzten wie deine, er hatte prächtiges langes Haar, aber sonst ärmliche Kleider.</li>
                    <li>Da war Kay! jubelte Gerda. O, dann habe ich ihn gefunden und dabei klatschte sie in die Hände.
                    </li>
                    <li>Er hatte einen kleinen Ranzen auf seinem Rücken! sagte die Krähe.</li>
                    <li>Nein, das war sicherlich sein Schlitten! sagte Gerda, denn damit ging er fort!</li>
                </ul>
            </div>
        </div>
    );
};

export default Faq;
