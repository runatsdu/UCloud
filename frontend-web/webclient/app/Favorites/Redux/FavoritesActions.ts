import { Cloud } from "Authentication/SDUCloudObject";
import { favoritesQuery } from "Utilities/FileUtilities";
import { Page, PayloadAction, Error, SetLoadingAction } from "Types";
import { File } from "Files";
import { errorMessageOrDefault } from "UtilityFunctions";
import { RECEIVE_FAVORITES, SET_ERROR_MESSAGE, SET_FAVORITES_LOADING, SET_FAVORITES_SHOWN, CHECK_ALL_FAVORITES, CHECK_FAVORITE } from "./FavoritesReducer";
import { FavoriteType } from "Favorites/Favorites";
import {Action} from "redux";
import {snackbarStore} from "Snackbar/SnackbarStore";

export type FavoriteActions = ReceiveFavorites | SetLoading | SetError | SetFavoritesShown | CheckFile | CheckAllFiles;

export const fetchFavorites = async (pageNumber: number, itemsPerPage: number): Promise<ReceiveFavorites | SetError> => {
    try {
        const {response} = await Cloud.get<Page<File>>(favoritesQuery(pageNumber, itemsPerPage));
        return receiveFavorites(response);
    } catch (e) {
        snackbarStore.addFailure(errorMessageOrDefault(e, "An error occurred fetching favorites"));
        return setErrorMessage();
    }
}


type ReceiveFavorites = PayloadAction<typeof RECEIVE_FAVORITES, { page: Page<File> }>
export const receiveFavorites = (page: Page<File>): ReceiveFavorites => ({
    type: RECEIVE_FAVORITES,
    payload: { page }
});

type SetError = Action<typeof SET_ERROR_MESSAGE>
const setErrorMessage = (): SetError => ({
    type: SET_ERROR_MESSAGE
});

type SetLoading = SetLoadingAction<typeof SET_FAVORITES_LOADING>
export const setLoading = (loading: boolean): SetLoading => ({
    type: SET_FAVORITES_LOADING,
    payload: { loading }
});

type SetFavoritesShown = PayloadAction<typeof SET_FAVORITES_SHOWN, { shown: FavoriteType }>
export const setFavoritesShown = (shown: FavoriteType): SetFavoritesShown => ({
    type: SET_FAVORITES_SHOWN,
    payload: { shown }
});

type CheckFile = PayloadAction<typeof CHECK_FAVORITE, { path: string, checked: boolean }>
export const checkFile = (path: string, checked: boolean): CheckFile => ({
    type: CHECK_FAVORITE,
    payload: { path, checked }
});

type CheckAllFiles = PayloadAction<typeof CHECK_ALL_FAVORITES, { checked: boolean }>
export const checkAllFiles = (checked: boolean): CheckAllFiles => ({
    type: CHECK_ALL_FAVORITES,
    payload: { checked }
});