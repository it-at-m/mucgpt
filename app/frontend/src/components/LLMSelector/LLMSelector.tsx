import {
    Dropdown,
    makeStyles,
    Option,
} from "@fluentui/react-components";
import { SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";

const useStyles = makeStyles({
    root: {
        // Stack the label above the field with a gap

    },
    option: {
    }
});

interface Props {
    onSelectionChange: (e: SelectionEvents, selection: OptionOnSelectData) => void;
    defaultLLM: string;
}


export const LLMSelector = ({ onSelectionChange, defaultLLM }: Props) => {
    const styles = useStyles();
    return (
        <div className={styles.root}>
            <Dropdown
                aria-label="Sprachmodell auswählen"
                defaultValue={defaultLLM}
                onOptionSelect={onSelectionChange}
                appearance="underline"
                size="small" positioning="below-start">
                <Option text="GPT-4o-mini" className={styles.option}>
                    GPT-4o-mini
                </Option>
                <Option text="LLama" className={styles.option}>
                    LLama
                </Option>
                <Option text="Mistral" className={styles.option}>
                    Mistral
                </Option>
                <Option text="GPT-4o" className={styles.option}>
                    GPT-4o
                </Option>
            </Dropdown>
        </div >
    );
};