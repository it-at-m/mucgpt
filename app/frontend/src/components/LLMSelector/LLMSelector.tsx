import {
    Dropdown,
    makeStyles,
    Option,
} from "@fluentui/react-components";
import { SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
import { Model } from "../../api";

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
    options: Model[];
}


export const LLMSelector = ({ onSelectionChange, defaultLLM, options }: Props) => {
    const styles = useStyles();
    return (
        <div className={styles.root}>
            <Dropdown
                aria-label="Sprachmodell auswählen"
                defaultValue={defaultLLM}
                onOptionSelect={onSelectionChange}
                appearance="underline"
                size="small" positioning="below-start">
                {options.map((item, index) => (
                    <Option text={item.llm_name} className={styles.option} key={index}>
                        {item.llm_name}
                    </Option>

                ))}
            </Dropdown>
        </div >
    );
};