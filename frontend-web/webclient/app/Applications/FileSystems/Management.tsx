import * as React from "react";
import {createRef, useState} from "react";
import {APICallParameters, APICallState, useAsyncCommand, useCloudAPI} from "Authentication/DataHook";
import * as Heading from "ui-components/Heading";
import {
    createFileSystem,
    listFileSystems,
    SharedFileSystem,
    SharedFileSystemMount
} from "Applications/FileSystems/index";
import {Page} from "Types";
import {emptyPage} from "DefaultObjects";
import * as Pagination from "Pagination";
import Box from "ui-components/Box";
import Flex from "ui-components/Flex";
import Button from "ui-components/Button";
import Input from "ui-components/Input";
import {addStandardDialog} from "UtilityComponents";
import {dialogStore} from "Dialog/DialogStore";
import {snackbarStore} from "Snackbar/SnackbarStore";
import {SnackType} from "Snackbar/Snackbars";
import normalize from "normalize-path";
import {TextP} from "ui-components/Text";
import Divider from "ui-components/Divider";
import {dateToString} from "Utilities/DateUtilities";
import ButtonGroup from "ui-components/ButtonGroup";
import Label from "ui-components/Label";
import * as ReactModal from "react-modal";
import {inDevEnvironment} from "UtilityFunctions";
import Icon from "ui-components/Icon";
import ClickableDropdown from "ui-components/ClickableDropdown";
import {WithAppInvocation, WithAppMetadata} from "Applications";
import {Cloud} from "Authentication/SDUCloudObject";
import styled from "styled-components";

interface ManagementProps {
    application: WithAppMetadata & WithAppInvocation
    mountLocation: string
    onMountsChange?: (mounts: SharedFileSystemMount) => void
    parameterRef: React.RefObject<HTMLInputElement>
}

function fakeMount(id: string, name: string, mountedAt: string): SharedFileSystemMount {
    return {
        mountedAt,
        sharedFileSystem: {
            id,
            backend: "",
            createdAt: new Date().getTime(),
            title: name,
            owner: Cloud.username ? Cloud.username : "nobody"
        }
    }
}

const Management: React.FunctionComponent<ManagementProps> = (
    {
        mountLocation,
        application,
        parameterRef,
        onMountsChange = (mounts) => 42
    }: ManagementProps
) => {
    if (!inDevEnvironment()) return null;

    const [selectedMount, setSelectedMount] = useState<SharedFileSystemMount | null>(null);

    const [currentPage, setListParams] = useCloudAPI<Page<SharedFileSystem>>(
        listFileSystems({}),
        emptyPage
    );

    const [isCommandLoading, invokeCommand] = useAsyncCommand();

    const [isMountDialogOpen, setIsMountDialogOpen] = useState(false);

    return <Box mb={16}>
        <Flex>
            <PointerInput
                placeholder={"No selected file system"}
                onClick={() => setIsMountDialogOpen(true)}
                value={!selectedMount ? "" : `${selectedMount.sharedFileSystem.title} (${dateToString(selectedMount.sharedFileSystem.createdAt)})`}
            />

            <input type={"hidden"} ref={parameterRef} value={!selectedMount ? "" : selectedMount.sharedFileSystem.id} />

            <ButtonGroup ml={"6px"} width={"115px"}>
                <Button
                    fullWidth
                    type={"button"}
                    color={"blue"}
                    disabled={isCommandLoading}
                    onClick={async () => {
                        const resp = await invokeCommand<{ id: string }>(createFileSystem({title: application.metadata.name}));
                        if (resp !== null) {
                            setSelectedMount(fakeMount(resp.id, application.metadata.name, mountLocation));
                        }
                    }}
                >
                    New
                </Button>

                <ClickableDropdown
                    trigger={
                        <Button color={"darkBlue"} type={"button"}>
                            <Icon name="chevronDown" size=".7em" m=".7em"/>
                        </Button>
                    }
                    options={[{text: "New custom FS", value: "fs_customize"}]}
                    onChange={async () => {
                        const {command} = await createNewDialog();
                        if (command !== undefined && !isCommandLoading) {
                            const resp = await invokeCommand<{ id: string }>(command);
                            if (resp !== null) {
                                setSelectedMount(fakeMount(resp.id, command.parameters["title"], mountLocation));
                            }
                            setListParams(listFileSystems({}));
                        }
                    }}
                />
            </ButtonGroup>
        </Flex>


        <MountDialogStep1
            isOpen={isMountDialogOpen}
            selectedMount={selectedMount}
            currentPage={currentPage}
            onPageChanged={(page) => setListParams(listFileSystems({page}))}
            resolve={async (data) => {
                setIsMountDialogOpen(false);
                const fs = await mountDialog(selectedMount, data.sharedFileSystem);
                if (fs !== null) {
                    const mount = {mountedAt: mountLocation, sharedFileSystem: fs};
                    setSelectedMount(mount);
                    onMountsChange(mount);
                }
            }}

        />
    </Box>;
};

const PointerInput = styled(Input)`
    cursor: pointer;
`;

const blacklistLocations = [
    "",
    "/",
    "/bin",
    "/boot",
    "/cdrom",
    "/dev",
    "/etc",
    "/home",
    "/lib",
    "/lost+found",
    "/media",
    "/mnt",
    "/opt",
    "/proc",
    "/root",
    "/run",
    "/sbin",
    "/selinux",
    "/srv",
    "/sys",
    "/tmp",
    "/usr",
    "/var"
];

async function createNewDialog(): Promise<{ command?: APICallParameters }> {
    return new Promise(resolve => {
        const ref = createRef<HTMLInputElement>();
        const validator = () => {
            const value = ref.current!.value;
            if (value.length === 0) {
                snackbarStore.addSnack({
                    type: SnackType.Failure,
                    message: "Title cannot be empty"
                });
                return false;
            }
            return true;
        };

        const onConfirm = () => {
            const title = ref.current!.value;
            resolve({command: createFileSystem({title})});
        };

        addStandardDialog({
            title: "Create new shared file system",
            message: (
                <form onSubmit={e => {
                    e.preventDefault();
                    onConfirm();
                    dialogStore.popDialog();
                }}>
                    <Label htmlFor={"sharedFsTitle"}>Title</Label>
                    <Input autoFocus id={"sharedFsTitle"} ref={ref} placeholder={"Spark FS"}/>
                </form>
            ),
            onConfirm,
            onCancel: () => {
            },
            validator
        })
    });
}

const MountDialogStep1: React.FunctionComponent<{
    isOpen: boolean,
    selectedMount: SharedFileSystemMount | null,
    currentPage: APICallState<Page<SharedFileSystem>>,
    onPageChanged: (page: number) => void,
    resolve: (data: { sharedFileSystem?: SharedFileSystem }) => void
}> = props => {
    return <ReactModal
        isOpen={props.isOpen}
        shouldCloseOnEsc={true}
        onRequestClose={() => props.resolve({})}
        ariaHideApp={false}
        style={{
            content: {
                top: "50%",
                left: "50%",
                right: "auto",
                bottom: "auto",
                marginRight: "-50%",
                transform: "translate(-50%, -50%)",
                background: ""
            }
        }}
    >
        <>
            <Box>
                <Heading.h3>Shared File Systems</Heading.h3>
                <Divider/>
            </Box>
            <Pagination.List
                loading={props.currentPage.loading}
                page={props.currentPage.data}
                onPageChanged={(page: number) => props.onPageChanged(page)}
                pageRenderer={page => {
                    return <Box>
                        {
                            props.currentPage.data.items.map((fs, idx) => {
                                return <Flex alignItems={"center"} mb={8} key={fs.id}>
                                    <TextP mr={8}>
                                        {fs.title} <br/>
                                        Created at: {dateToString(fs.createdAt)}
                                    </TextP>
                                    <Box ml={"auto"}/>
                                    <Button
                                        type={"button"}
                                        ml={8}
                                        onClick={() => {
                                            props.resolve({sharedFileSystem: fs});
                                        }}
                                    >Mount</Button>
                                </Flex>;
                            })
                        }
                    </Box>
                }}
            />
        </>
    </ReactModal>;
};

async function mountDialog(
    selectedMount: SharedFileSystemMount | null,
    sharedFileSystem?: SharedFileSystem
): Promise<SharedFileSystem | null> {
    if (sharedFileSystem === undefined) return null;
    if (selectedMount !== null && selectedMount.sharedFileSystem.id === sharedFileSystem.id) {
        snackbarStore.addSnack({
            type: SnackType.Failure,
            message: "File system has already been mounted"
        });
        return null;
    }

    return sharedFileSystem;
}

function mountDialogStep2(
    mountTitle: string,
    selectedMount: SharedFileSystemMount | null
): Promise<{ mountedAt?: string }> {
    const ref = createRef<HTMLInputElement>();
    return new Promise(resolve => {
        const onConfirm = () => resolve({mountedAt: ref.current!.value});
        const validator = () => {
            const location = ref.current!.value;
            console.log("Running the validator with this value", location);
            if (blacklistLocations.indexOf(normalize(location)) !== -1 ||
                location.indexOf("/") !== 0) {
                snackbarStore.addSnack({
                    message: `Invalid mount location: ${location}`,
                    type: SnackType.Failure
                });

                return false;
            }

            if (selectedMount !== null && normalize(selectedMount.mountedAt) === normalize(location)) {
                snackbarStore.addSnack({
                    message: `Another file system is already mounted at this location: ${location}`,
                    type: SnackType.Failure
                });

                return false;
            }

            return true;
        };

        addStandardDialog({
            title: `Where to mount ${mountTitle}?`,
            confirmText: "Mount",
            message: (
                <form onSubmit={e => {
                    e.preventDefault();
                    if (validator()) {
                        onConfirm();
                        dialogStore.popDialog();
                    }
                }}>
                    <Input autoFocus ref={ref} placeholder={"/mnt/shared"}/>
                </form>
            ),

            onConfirm,
            onCancel: () => resolve({}),
            validator
        })
    });
}

export default Management;

