import {
    Dropdown,
    makeStyles,
    Option,
    shorthands
  } from "@fluentui/react-components";
  import {SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
  import { useTranslation } from 'react-i18next';
  
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
    const { t} = useTranslation();
    return (
      <div className={styles.root}>
        <Dropdown 
          aria-label="Die Zusammenfassung soll folgende Länge aufweisen" 
          root={{style: {backgroundColor: "#f2f2f2", width: "150px", borderWidth: "1px", padding: "1.5px", minWidth: "auto"}}}
          listbox={{style: {backgroundColor: "#f2f2f2", width: "150px"}}}
          defaultValue={defaultLength} 
          onOptionSelect={onSelectionChange} 
          size="small" 
          positioning="below-end">

          <Option text={t('components.sumlength.sentences')} className={styles.option} value="in a maximum of two sentences">
          {t('components.sumlength.sentences')}
          </Option>
          <Option text={t('components.sumlength.bullets')} className={styles.option} value="in a maximum of 5 bullet points">
          {t('components.sumlength.bullets')}
          </Option>
          <Option text={t('components.sumlength.quarter')} className={styles.option} value="using at most 1/4 as many words as the original">
          {t('components.sumlength.quarter')}
          </Option>

        </Dropdown>
      </div>
    );
};
