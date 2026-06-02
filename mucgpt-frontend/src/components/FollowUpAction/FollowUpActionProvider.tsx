import React, { Dispatch, SetStateAction, useCallback, useState } from "react";
import { FollowUpActionModel } from "./FollowUpAction";

interface IFollowUpActionProvider {
    followUpActions: FollowUpActionModel[];
    setFollowUpActions: Dispatch<SetStateAction<FollowUpActionModel[]>>;
}

export const FollowUpActionContext = React.createContext<IFollowUpActionProvider>({ followUpActions: [], setFollowUpActions: () => {} });

const generateFollowUpActionId = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `follow-up-action-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const ensureFollowUpActionIds = (actions: FollowUpActionModel[]) =>
    actions.map(action => ({ ...action, id: action.id || generateFollowUpActionId() }));

export const FollowUpActionProvider = (props: React.PropsWithChildren<unknown>) => {
    const [followUpActions, setFollowUpActionsState] = useState<FollowUpActionModel[]>([]);

    const setFollowUpActions = useCallback<Dispatch<SetStateAction<FollowUpActionModel[]>>>(value => {
        setFollowUpActionsState(current => ensureFollowUpActionIds(typeof value === "function" ? value(current) : value));
    }, []);

    return (
        <FollowUpActionContext.Provider value={{ followUpActions, setFollowUpActions }}>
            {props.children}
        </FollowUpActionContext.Provider>
    );
};
