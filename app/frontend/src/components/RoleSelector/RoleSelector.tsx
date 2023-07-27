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
    defaultRole: string;
}


export const RoleSelector =  ({ onSelectionChange, defaultRole }: Props) => {
    const styles = useStyles();
    const { t} = useTranslation ();
    return (
      <div className={styles.root}>
        <Dropdown  
          aria-label={t('sum.rolelabel')}
          root={{style: {backgroundColor: "white", width: "150px", minWidth: "100px"}}}
          listbox={{style: {backgroundColor: "white", width: "150px"}}} 
          defaultValue={defaultRole} 
          onOptionSelect={onSelectionChange} 
          size="small" 
          positioning="below-end">

          <Option text={t('components.roles.secondgrader')} className={styles.option} value="Second-Grader">
            {t('components.roles.secondgrader')}
          </Option>
          <Option text={t('components.roles.student')} value="University Student" className={styles.option}>
            {t('components.roles.student')}
          </Option>
          <Option text= {t('components.roles.retired')}  value="Retired"className={styles.option} >
            {t('components.roles.retired')}
          </Option>
        </Dropdown>
      </div>
    );
};
