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
      maxWidth: "150px",
    },
    option: {
      maxWidth: "150px",
    }
  });

interface Props {
    onSelectionChange :(e: SelectionEvents, selection: OptionOnSelectData) =>  void;
    defaultLength: string;
}


export const SummarizationLengthSelector =  ({ onSelectionChange, defaultLength }: Props) => {
    const styles = useStyles();
    return (
      <div className={styles.root}>
        <Dropdown 
          aria-label="Die Zusammenfassung soll folgende Länge aufweisen" 
          root={{style: {backgroundColor: "white", width: "150px", minWidth: "100px"}}} 
          listbox={{style: {backgroundColor: "white", width: "150px"}}}
          defaultValue={defaultLength} 
          onOptionSelect={onSelectionChange} 
          size="small" 
          positioning="below-end">

          <Option text="Zwei Sätzen" className={styles.option} value="in a maximum of two sentences">
          Zwei Sätze
          </Option>
          <Option text="Fünf Stichpunkten" className={styles.option} value="in a maximum of 5 bullet points">
          5 Stichpunkten
          </Option>
          <Option text="1/4 der Länge" className={styles.option} value="in bullet points using at most 1/4 as many words as the original">
          1/4 der Länge
          </Option>

        </Dropdown>
      </div>
    );
};
