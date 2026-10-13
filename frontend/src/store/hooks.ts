import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./index";

/** [Major · Frameworks React + NestJS] `useDispatch` typé avec le store de l'application. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
/** [Major · Frameworks React + NestJS] `useSelector` typé avec l'état racine de l'application. */
export const useAppSelector = useSelector.withTypes<RootState>();
