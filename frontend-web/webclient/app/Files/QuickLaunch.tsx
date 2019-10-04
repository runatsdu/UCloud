import {ApplicationMetadata} from "Applications";
import {Cloud} from "Authentication/SDUCloudObject";
import {setLoading} from "Navigation/Redux/StatusActions";
import {hpcJobQueryPost} from "Utilities/ApplicationUtilities";
import {errorMessageOrDefault} from "UtilityFunctions";
import {snackbarStore} from "Snackbar/SnackbarStore";
import {History} from "history";

export async function quickLaunchCallback(
    app: QuickLaunchApp,
    mountPath: string,
    history: History<any>
): Promise<void> {
    const mountPathList = mountPath.split("/");
    const directory = (mountPath.endsWith("/")) ?
        mountPathList[mountPathList.length - 2]
        : mountPathList[mountPathList.length - 1];


    const job = {
        application: {
            name: app.metadata.name,
            version: app.metadata.version,
        },
        mounts: [{
            source: mountPath,
            destination: directory,
            readOnly: false
        }],
        numberOfNodes: 0,
        tasksPerNode: 0,
        peers: [],
        reservation: null,
        type: "start",
        name: null,
    };

    try {
        setLoading(true);
        const req = await Cloud.post(hpcJobQueryPost, job);
        history.push(`/applications/results/${req.response.jobId}`);
    } catch (err) {
        snackbarStore.addFailure(errorMessageOrDefault(err, "An error ocurred submitting the job."));
    } finally {
        setLoading(false);
    }
}

export interface QuickLaunchApp {
    extensions: string[];
    metadata: ApplicationMetadata;
    onClick: (name: string, version: string) => Promise<any>;
}
