import { NotificationsReduxObject, initNotifications } from "DefaultObjects";
import { NotificationActions } from "./NotificationsActions";

export const RECEIVE_NOTIFICATIONS = "RECEIVE_NOTIFICATIONS";
export const NOTIFICATION_READ = "NOTIFICATION_READ";
export const SET_REDIRECT = "SET_REDIRECT";
export const SET_NOTIFICATIONS_ERROR = "SET_NOTIFICATIONS_ERROR";

const Notifications = (state: NotificationsReduxObject = initNotifications(), action: NotificationActions): NotificationsReduxObject => {
    switch (action.type) {
        case RECEIVE_NOTIFICATIONS: {
            return { ...state, ...action.payload };
        }
        case NOTIFICATION_READ: {
            return {
                ...state, page: {
                    ...state.page,
                    items: state.page.items.map((n) => {
                        if (n.id === action.payload.id) n.read = true;
                        return n;
                    })
                }
            }
        }
        case SET_REDIRECT: {
            return { ...state, ...action.payload };
        }
        // FIXME Error case missing
        default: {
            return state;
        }
    }
}

export default Notifications;