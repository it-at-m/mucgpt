import styles from "./LanguageSelector.module.css";
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
      maxWidth: "400px",
    },
  });

interface Props {
    onSelectionChange :(e: SelectionEvents, selection: OptionOnSelectData) =>  void;
    defaultlang: string;
}


export const LanguageSelector =  ({ onSelectionChange, defaultlang }: Props) => {
    const styles = useStyles();
    return (
      <div className={styles.root}>
        <Dropdown  aria-label="Sprache auswählen" defaultValue={defaultlang} onOptionSelect={onSelectionChange}>
          <Option text="Deutsch">
            Deutsch
          </Option>
          <Option text="Englisch">
            Englisch
          </Option>
          <Option text="Bayrisch">
            Bayrisch
          </Option>
        </Dropdown>
      </div>
    );
};
