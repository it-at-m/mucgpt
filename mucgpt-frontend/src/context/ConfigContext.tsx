import { createContext, useContext } from "react";
import { ApplicationConfig } from "../api/models";
import { DEFAULT_APP_CONFIG } from "../constants";

export const ConfigContext = createContext<ApplicationConfig>(DEFAULT_APP_CONFIG);

export const useConfigContext = () => useContext(ConfigContext);
