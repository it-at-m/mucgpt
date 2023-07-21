import {
    Dropdown,
    makeStyles,
    Option,
    shorthands
  } from "@fluentui/react-components";
  import {SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
  
  const useStyles = makeStyles({
    root: {
      // Stack the label above the field with a gap
      display: "grid",
      gridTemplateRows: "repeat(1fr)",
      justifyItems: "start",
      ...shorthands.gap("2px"),
      maxWidth: "300px",
    },
    option: {
      maxWidth: "300px",
    }
  });

interface Props {
    onSelectionChange :(e: SelectionEvents, selection: OptionOnSelectData) =>  void;
    defaultLength: string;
}


export const SummarizationLengthSelector =  ({ onSelectionChange, defaultLength: defaultRole }: Props) => {
    const styles = useStyles();
    return (
      <div className={styles.root}>
        <Dropdown aria-label="Die Zusammenfassung soll folgende Länge aufweisen" listbox={{style: {backgroundColor: "white", width: "245px"}}} defaultValue={defaultRole} onOptionSelect={onSelectionChange} size="small" positioning="below-end">
          <Option text="In maximal zwei Sätzen" className={styles.option} value="in a maximum of two sentences">
          Zwei Sätze
          </Option>
          <Option text="In maximal 5 Stichpunkten" className={styles.option} value="in a maximum of 5 bullet points">
          In maximal 5 Stichpunkten
          </Option>
          <Option text="In maximal 1/4 des Orginaltexts" className={styles.option} value="in bullet points using at most 1/4 as many words as the original">
          In maximal 1/4 des Orginaltexts
          </Option>

        </Dropdown>
      </div>
    );
};
