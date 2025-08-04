import { Dropdown, Option, OptionOnSelectData, SelectionEvents } from "@fluentui/react-components";
import { Model } from "../../api";

interface Props {
    onSelectionChange: (nextLLM: string) => void;
    defaultLLM: string;
    options: Model[];
}

export const LLMSelector = ({ onSelectionChange, defaultLLM, options }: Props) => {
    return (
        <div>
            <Dropdown
                aria-label="Sprachmodell auswählen"
                defaultValue={defaultLLM}
                onOptionSelect={(e: SelectionEvents, data: OptionOnSelectData) => {
                    const selected = data.optionText;
                    if (selected) onSelectionChange(selected);
                }}
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
