import otherStyles from "./LanguageSelector.module.css";
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
      maxWidth: "100px"
    },
    option: {
      maxWidth: "100px",
    }
  });

interface Props {
    onSelectionChange :(e: SelectionEvents, selection: OptionOnSelectData) =>  void;
    defaultlang: string;
}


export const LanguageSelector =  ({ onSelectionChange, defaultlang }: Props) => {
    const styles = useStyles();
    return (
      <div className={styles.root}>
        <Dropdown  aria-label="Sprache auswählen" defaultValue={defaultlang} onOptionSelect={onSelectionChange} size="small" positioning="below-end"  listbox={{style: {backgroundColor: "white", width: "245px"}}}>
          <Option text="Deutsch" className={styles.option}>
            Deutsch
          </Option>
          <Option text="Englisch" className={styles.option}>
            Englisch
          </Option>
          <Option text="Bayrisch" className={styles.option}>
            Bayrisch
          </Option>
          <Option text="Ukrainisch" className={styles.option}>
          Ukrainisch
          </Option>
        </Dropdown>
      </div>
    );
};
