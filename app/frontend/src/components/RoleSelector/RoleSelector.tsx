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
    defaultRole: string;
}


export const RoleSelector =  ({ onSelectionChange, defaultRole }: Props) => {
    const styles = useStyles();
    return (
      <div className={styles.root}>
        <Dropdown  
          aria-label="Zusammenfassung für diese Personengruppe erstellen" 
          root={{style: {backgroundColor: "white", width: "150px", minWidth: "100px"}}}
          listbox={{style: {backgroundColor: "white", width: "150px"}}} 
          defaultValue={defaultRole} 
          onOptionSelect={onSelectionChange} 
          size="small" 
          positioning="below-end">

          <Option text="Grundschüler" className={styles.option} value="Second-Grader">
            Grundschüler
          </Option>
          <Option text="Student" value="Unitversity Student" className={styles.option}>
            Student
          </Option>
          <Option text="Rentner"  value="Retired"className={styles.option} >
          Rentner
          </Option>
        </Dropdown>
      </div>
    );
};
