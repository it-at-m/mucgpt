import { Dropdown, Option } from "@fluentui/react-components";
import { SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
import { Model } from "../../api";

interface Props {
    onSelectionChange: (e: SelectionEvents, selection: OptionOnSelectData) => void;
    defaultLLM: string;
    options: Model[];
}

export const LLMSelector = ({ onSelectionChange, defaultLLM, options }: Props) => {
    return (
        <div>
            <Dropdown
                aria-label="Sprachmodell auswählen"
                defaultValue={defaultLLM}
                onOptionSelect={onSelectionChange}
                appearance="underline"
                size="small"
                positioning="below-start"
            >
                {options.map(item => (
                    <Option key={item.llm_name}>{item.llm_name}</Option>
                ))}
            </Dropdown>
        </div>
    );
};
