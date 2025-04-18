import { Dropdown, makeStyles, Option } from "@fluentui/react-components";
import { SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";

const useStyles = makeStyles({
    root: {
        // Stack the label above the field with a gap
    },
    option: {}
});

interface Props {
    onSelectionChange: (e: SelectionEvents, selection: OptionOnSelectData) => void;
    defaultlang: string;
}

export const LanguageSelector = ({ onSelectionChange, defaultlang }: Props) => {
    const styles = useStyles();
    return (
        <div className={styles.root}>
            <Dropdown
                aria-label="Sprache auswählen"
                defaultValue={defaultlang}
                onOptionSelect={onSelectionChange}
                appearance="underline"
                size="small"
                positioning="below-start"
            >
                <Option text="Deutsch" className={styles.option}>
                    Deutsch
                </Option>
                <Option text="Englisch" className={styles.option}>
                    Englisch
                </Option>
                <Option text="French" className={styles.option}>
                    Französich
                </Option>
                <Option text="Bairisch" className={styles.option}>
                    Bairisch
                </Option>
                <Option text="Ukrainisch" className={styles.option}>
                    Ukrainisch
                </Option>
            </Dropdown>
        </div>
    );
};
