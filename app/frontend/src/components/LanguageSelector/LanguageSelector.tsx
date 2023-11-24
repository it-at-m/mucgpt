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
    maxWidth: "50px"
  }
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
        size="small" positioning="below-start"
        listbox={{ style: { backgroundColor: "#f2f2f2", maxWidth: "auto" } }}
        root={{ style: { borderWidth: "0px", minWidth: "auto" } }}>
        <Option text="Deutsch" className={styles.option}>
          Deutsch
        </Option>
        <Option text="Englisch" className={styles.option}>
          Englisch
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
