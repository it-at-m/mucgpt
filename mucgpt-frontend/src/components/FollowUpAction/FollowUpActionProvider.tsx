import React, { Dispatch, SetStateAction, useState } from "react";
import { FollowUpActionModel } from "./FollowUpAction";

interface IFollowUpActionProvider {
    followUpActions: FollowUpActionModel[];
    setFollowUpActions: Dispatch<SetStateAction<FollowUpActionModel[]>>;
}

export const FollowUpActionContext = React.createContext<IFollowUpActionProvider>({ followUpActions: [], setFollowUpActions: () => {} });

export const FollowUpActionProvider = (props: React.PropsWithChildren<unknown>) => {
    const [followUpActions, setFollowUpActions] = useState<FollowUpActionModel[]>([]);

    return (
        <FollowUpActionContext.Provider value={{ followUpActions, setFollowUpActions }}>
            {props.children}
        </FollowUpActionContext.Provider>
    );
};
