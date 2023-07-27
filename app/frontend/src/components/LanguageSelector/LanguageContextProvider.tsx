// Context.js
import React, { Dispatch, SetStateAction, useState } from "react";
 
interface ILanguageProvider {
    language: string;
    setLanguage: Dispatch<SetStateAction<string>>;
  }
  
export const DEFAULTLANG = "Deutsch";
export const LanguageContext = React.createContext<ILanguageProvider>({language: DEFAULTLANG, setLanguage:  () => {}});

export const LanguageContextProvider = (props: React.PropsWithChildren<{}>)  => {
    const [language, setLanguage] = useState<string>(DEFAULTLANG);
 
    return (
        <LanguageContext.Provider value={{ language, setLanguage }}>
            {props.children}
        </LanguageContext.Provider>
    );
};