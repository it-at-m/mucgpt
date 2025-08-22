// Context.js
import React, { Dispatch, SetStateAction, useState } from "react";

interface IHeaderProvider {
    header: string;
    setHeader: Dispatch<SetStateAction<string>>;
}

export const DEFAULTHEADER = "";
export const HeaderContext = React.createContext<IHeaderProvider>({ header: DEFAULTHEADER, setHeader: () => {} });

export const HeaderContextProvider = (props: React.PropsWithChildren<unknown>) => {
    const [header, setHeader] = useState<string>(DEFAULTHEADER);

    return <HeaderContext.Provider value={{ header, setHeader }}>{props.children}</HeaderContext.Provider>;
};
