import * as React from "react";
import {useCallback, useEffect, useRef, useState} from "react";
import {useProjectManagementStatus} from "Project";
import {MainContainer} from "MainContainer/MainContainer";
import {ProjectBreadcrumbs} from "Project/Breadcrumbs";
import * as Heading from "ui-components/Heading";
import {Box, Button, ButtonGroup, Card, ExternalLink, Flex, Icon, Input, Label, Text, TextArea, theme, Tooltip} from "ui-components";
import {APICallState, useAsyncCommand, useCloudAPI} from "Authentication/DataHook";
import {
    grantsRetrieveProducts, GrantsRetrieveProductsResponse,
    ProductArea, ProductCategory,
    productCategoryEquals,
    ProductCategoryId,
    retrieveBalance,
    RetrieveBalanceResponse,
    WalletBalance
} from "Accounting";
import styled from "styled-components";
import {DashboardCard} from "Dashboard/Dashboard";
import {
    approveGrantApplication,
    closeGrantApplication,
    Comment,
    commentOnGrantApplication,
    deleteGrantApplicationComment,
    editGrantApplication,
    GrantApplication,
    GrantApplicationStatus,
    GrantRecipient,
    isGrantFinalized,
    readTemplates,
    ReadTemplatesResponse,
    rejectGrantApplication,
    ResourceRequest,
    submitGrantApplication,
    viewGrantApplication,
    ViewGrantApplicationResponse
} from "Project/Grant/index";
import {useHistory, useParams} from "react-router";
import {Client} from "Authentication/HttpClientInstance";
import {snackbarStore} from "Snackbar/SnackbarStore";
import {dateToString} from "Utilities/DateUtilities";
import {UserAvatar} from "AvataaarLib/UserAvatar";
import {AvatarType, defaultAvatar} from "UserSettings/Avataaar";
import {AvatarHook, useAvatars} from "AvataaarLib/hook";
import Table, {TableCell, TableRow} from "ui-components/Table";
import {addStandardDialog} from "UtilityComponents";
import {useTitle} from "Navigation/Redux/StatusActions";
import {Balance, BalanceExplainer, useStoragePrice} from "Accounting/Balance";
import {useDispatch} from "react-redux";
import {setRefreshFunction} from "Navigation/Redux/HeaderActions";
import {loadingAction} from "Loading";

export const RequestForSingleResourceWrapper = styled.div`
    ${Icon} {
        float: right;
        margin-left: 10px;
    }
    
    ${Card} {
        height: 100%;
        
        .dashboard-card-inner {
            padding: 16px;
        }
    }
    
    table {
        margin: 16px;
    }
    
    th {
        width: 100%;
        text-align: left;
        padding-right: 30px
    }
    
    td {
        margin-left: 10px;
        padding-bottom: 16px;
        min-width: 350px;
    }
    
    tr {
        vertical-align: top;
        height: 40px;
    }
    
    .unit {
        flex-shrink: 0;
        margin-left: 10px;
        width: 55px;
    }
`;

const ResourceContainer = styled.div`
    display: grid;
    grid-gap: 32px;
    grid-template-columns: repeat(auto-fit, minmax(500px, auto));
    margin: 32px 0;
`;

const RequestFormContainer = styled.div`
    width: 100%;
    
    ${TextArea} {
        width: 100%;
        height: calc(100% - 40px);
        margin: 10px 0;
    }
`;

export enum RequestTarget {
    EXISTING_PROJECT = "existing",
    NEW_PROJECT = "new",
    PERSONAL_PROJECT = "personal",
    VIEW_APPLICATION = "view"
}

interface UseRequestInformation {
    wallets: WalletBalance[];
    reloadWallets: () => void;
    targetProject?: string;
    documentRef: React.RefObject<HTMLTextAreaElement>;
    templates: APICallState<ReadTemplatesResponse>;
    recipient: GrantRecipient;
    editingApplication?: GrantApplication;
    comments: Comment[];
    avatars: AvatarHook;
    reload: () => void;
    approver: boolean;
    loading: boolean;
}

function useRequestInformation(target: RequestTarget): UseRequestInformation {
    let targetProject: string | undefined;
    let wallets: WalletBalance[] = [];
    let reloadWallets: () => void = () => {
        /* empty */
    };
    let recipient: GrantRecipient;
    let editingApplication: GrantApplication | undefined;
    let approver = false;
    let comments: Comment[] = [];
    const avatars = useAvatars();
    let loading = false;

    let availableProducts: ProductCategory[];
    let reloadProducts: () => void;

    const documentRef = useRef<HTMLTextAreaElement>(null);
    const [templates, fetchTemplates] = useCloudAPI<ReadTemplatesResponse>(
        {noop: true},
        {existingProject: "", newProject: "", personalProject: ""}
    );

    switch (target) {
        case RequestTarget.EXISTING_PROJECT: {
            const {projectId, projectDetails} = useProjectManagementStatus({isRootComponent: true});
            targetProject = projectDetails.data.parent;
            const [w, fetchWallets] = useCloudAPI<RetrieveBalanceResponse>(
                {noop: true},
                {wallets: []}
            );
            wallets = w.data.wallets;
            reloadWallets = useCallback(() => {
                fetchWallets(retrieveBalance({id: projectId, type: "PROJECT", includeChildren: false}));
            }, [projectId]);
            recipient = {type: "existing_project", projectId};
            break;
        }

        case RequestTarget.NEW_PROJECT:
        case RequestTarget.PERSONAL_PROJECT: {
            const {projectId} = useParams<{projectId: string}>();
            targetProject = projectId;
            const [w, fetchWallets] = useCloudAPI<RetrieveBalanceResponse>(
                {noop: true},
                {wallets: []}
            );
            wallets = w.data.wallets;
            reloadWallets = useCallback(() => {
                fetchWallets(retrieveBalance({id: Client.username!, type: "USER", includeChildren: false}));
            }, [projectId]);
            if (target === RequestTarget.NEW_PROJECT) {
                recipient = {type: "new_project", projectTitle: "placeholder"};
            } else {
                recipient = {type: "personal", username: Client.username!};
            }
            break;
        }

        case RequestTarget.VIEW_APPLICATION: {
            const {appId} = useParams<{appId: string}>();

            const [grantApplication, fetchGrantApplication] = useCloudAPI<ViewGrantApplicationResponse>(
                {noop: true},
                {
                    application: {
                        document: "",
                        grantRecipient: {type: "personal", username: Client.username ?? ""},
                        requestedBy: Client.username ?? "",
                        requestedResources: [],
                        resourcesOwnedBy: "unknown",
                        status: GrantApplicationStatus.IN_PROGRESS,
                        grantRecipientPi: Client.username ?? "",
                        id: 0,
                        resourcesOwnedByTitle: "unknown",
                        grantRecipientTitle: "",
                        createdAt: 0,
                        updatedAt: 0
                    },
                    comments: [],
                    approver: false
                }
            );

            targetProject = grantApplication.data.application.resourcesOwnedBy;
            wallets = grantApplication.data.application.requestedResources.map(it => {
                // Note: Some of these are simply placeholder values and are replaced later
                return {
                    wallet: {
                        paysFor: {
                            id: it.productCategory,
                            provider: it.productProvider
                        },
                        id: "unknown",
                        type: "USER"
                    },
                    balance: it.creditsRequested ?? 0,
                    used: 0,
                    allocated: 0,
                    area: ProductArea.COMPUTE
                };
            });
            recipient = grantApplication.data.application.grantRecipient;
            comments = grantApplication.data.comments;
            approver = grantApplication.data.approver;
            editingApplication = grantApplication.data.application;

            reloadWallets = useCallback(() => {
                fetchGrantApplication(viewGrantApplication({id: parseInt(appId, 10)}));
            }, [appId]);

            useEffect(() => {
                reloadWallets();
            }, [appId]);

            loading = loading || grantApplication.loading;
            break;
        }
    }

    {
        const [products, fetchProducts] = useCloudAPI<GrantsRetrieveProductsResponse>(
            {noop: true},
            {availableProducts: []}
        );

        availableProducts = products.data.availableProducts;
        reloadProducts = useCallback(() => {
            if (targetProject) {
                fetchProducts(grantsRetrieveProducts({
                    projectId: targetProject,
                    recipientType: recipient.type,
                    recipientId:
                        recipient.type === "existing_project" ? recipient.projectId :
                            recipient.type === "new_project" ? recipient.projectTitle :
                                recipient.type === "personal" ? recipient.username : ""
                }));
            }
        }, [targetProject, recipient.type]);
    }

    const reload = useCallback(() => {
        if (targetProject) {
            if (targetProject !== "unknown") {
                fetchTemplates(readTemplates({projectId: targetProject}));
            }
            reloadWallets();
            reloadProducts();
        }
    }, [targetProject]);

    useEffect(() => {
        reload();
    }, [targetProject]);

    useEffect(() => {
        if (documentRef.current) {
            switch (target) {
                case RequestTarget.PERSONAL_PROJECT:
                    documentRef.current.value = templates.data.personalProject;
                    break;
                case RequestTarget.EXISTING_PROJECT:
                    documentRef.current.value = templates.data.existingProject;
                    break;
                case RequestTarget.NEW_PROJECT:
                    documentRef.current.value = templates.data.newProject;
                    break;
                case RequestTarget.VIEW_APPLICATION:
                    documentRef.current.value = editingApplication?.document ?? "";
                    break;
            }
        }
    }, [templates, documentRef.current]);

    useEffect(() => {
        const usernames = comments.map(it => it.postedBy);
        usernames.push(Client.username!);
        avatars.updateCache(usernames);
    }, [comments]);

    const mergedWallets: WalletBalance[] = [];
    {
        // Put in all products and attach a price, if there is one
        for (const product of availableProducts) {
            mergedWallets.push({
                area: product.area,
                balance: 0,
                used: 0,
                allocated: 0,
                wallet: {
                    type: "USER",
                    id: "unknown",
                    paysFor: product.id
                }
            });
        }

        for (const wallet of wallets) {
            for (const pWallet of mergedWallets) {
                if (productCategoryEquals(pWallet.wallet.paysFor, wallet.wallet.paysFor)) {
                    pWallet.balance = wallet.balance;
                    break;
                }
            }
        }
    }

    return {
        wallets: mergedWallets, reloadWallets, targetProject, documentRef, templates, recipient, editingApplication,
        comments, avatars, reload, approver, loading
    };
}

function productCategoryId(pid: ProductCategoryId): string {
    return `${pid.id}/${pid.provider}`;
}

function parseIntegerFromInput(input?: HTMLInputElement | null): number | undefined {
    if (!input) return undefined;
    const rawValue = input.value;
    const parsed = parseInt(rawValue, 10);
    if (isNaN(parsed)) return undefined;
    return parsed;
}

const StorageRequestCard: React.FunctionComponent<{
    wb: WalletBalance,
    state: UseRequestInformation,
    grantFinalized: boolean,
    isLocked: boolean,
    storagePrice: number
}> = ({wb, state, grantFinalized, isLocked, storagePrice}) => {
    const onQuotaChange = (): void => {
        const quota = document.querySelector(
            `input[data-target="quota-${productCategoryId(wb.wallet.paysFor)}"]`
        )! as HTMLInputElement;

        const duration = document.querySelector(
            `input[data-target="duration-${productCategoryId(wb.wallet.paysFor)}"]`
        )! as HTMLInputElement;

        const balance = document.querySelector(
            `input[data-target="${productCategoryId(wb.wallet.paysFor)}"]`
        )! as HTMLInputElement;

        const durationMonths = parseInt(duration.value, 10);
        const quotaGb = parseInt(quota.value, 10);
        if (balance) {
            balance.value = Math.ceil((durationMonths * 30 * quotaGb * storagePrice) / 1000000).toString();
        }
    };

    return <RequestForSingleResourceWrapper>
        <DashboardCard color="blue" isLoading={false}>
            <table>
                <tbody>
                    <tr>
                        <th>Product</th>
                        <td>
                            {wb.wallet.paysFor.provider} / {wb.wallet.paysFor.id}
                            <Icon
                                name={"ftFileSystem"}
                                size={40}
                            />
                        </td>
                    </tr>


                    <tr>
                        <th>
                            How much&nbsp;
                            {state.recipient.type !== "new_project" ?
                                "additional " : ""
                            }
                            data will be stored?
                        <br />
                            <HelpText>
                                You will not be able to store more data than the amount specified here.
                            </HelpText>
                        </th>
                        <td>
                            <Flex alignItems="center">
                                <Input
                                    placeholder="0"
                                    disabled={grantFinalized || isLocked}
                                    data-target={
                                        "quota-" +
                                        productCategoryId(wb.wallet.paysFor)
                                    }
                                    onInput={onQuotaChange}
                                    autoComplete="off"
                                    type="number"
                                    min={0}
                                />
                                <div className="unit">GB</div>
                            </Flex>
                        </td>
                    </tr>
                    <tr>
                        <th>
                            For how long should the&nbsp;
                            {state.recipient.type !== "new_project" ?
                                "additional " : ""
                            }
                            data be stored?
                            <br />
                            <HelpText>
                                You will be granted enough credits to store your files for at least this long.
                                We will always attempt to notify you before deleting your data.
                        </HelpText>
                        </th>
                        <td>
                            <Flex alignItems={"center"}>
                                <Input
                                    placeholder={"0"}
                                    disabled={grantFinalized || isLocked}
                                    data-target={
                                        "duration-" +
                                        productCategoryId(wb.wallet.paysFor)
                                    }
                                    onInput={onQuotaChange}
                                    autoComplete="off"
                                    type="number"
                                    min={0}
                                />
                                <div className={"unit"}>Months</div>
                            </Flex>
                        </td>
                    </tr>
                    <tr />
                    {state.editingApplication !== undefined || state.recipient.type === "new_project" ? null : (
                        <tr>
                            <th>Current balance</th>
                            <td>
                                <Balance
                                    amount={wb.balance}
                                    productCategory={wb.wallet.paysFor}
                                />
                            </td>
                        </tr>
                    )}
                    <tr>
                        <th>
                            Balance requested
                        <br />
                            <HelpText>
                                Note: You only pay for what you use.
                                If you only use 50% of your quota you will
                                be able to store your data for twice as long.
                        </HelpText>
                        </th>
                        <td>
                            <Flex alignItems={"center"}>
                                <Input
                                    placeholder={"0"}
                                    disabled={true}
                                    data-target={productCategoryId(wb.wallet.paysFor)}
                                    autoComplete="off"
                                    type="number"
                                    min={0}
                                />
                                <div className={"unit"}>DKK</div>
                            </Flex>
                        </td>
                    </tr>
                </tbody>
            </table>
        </DashboardCard>
    </RequestForSingleResourceWrapper>;
};

const ComputeRequestCard: React.FunctionComponent<{
    wb: WalletBalance,
    state: UseRequestInformation,
    grantFinalized: boolean,
    isLocked: boolean
}> = ({wb, state, grantFinalized, isLocked}) => {
    return <RequestForSingleResourceWrapper>
        <DashboardCard color="blue" isLoading={false}>
            <table>
                <tbody>
                    <tr>
                        <th>Product</th>
                        <td>
                            {wb.wallet.paysFor.provider} / {wb.wallet.paysFor.id}
                            <Icon
                                name={"cpu"}
                                size={40}
                            />
                        </td>
                    </tr>
                    {state.editingApplication !== undefined || state.recipient.type === "new_project" ? null : (
                        <tr>
                            <th>Current balance</th>
                            <td>
                                <Balance
                                    amount={wb.balance}
                                    productCategory={wb.wallet.paysFor}
                                />
                            </td>
                        </tr>
                    )}
                    <tr>
                        <th>Balance requested</th>
                        <td>
                            <Flex alignItems={"center"}>
                                <Input
                                    placeholder={"0"}
                                    disabled={grantFinalized || isLocked}
                                    data-target={productCategoryId(wb.wallet.paysFor)}
                                    autoComplete="off"
                                    type="number"
                                    min={0}
                                />
                                <div className={"unit"}>DKK</div>
                            </Flex>
                        </td>
                    </tr>
                    <tr>
                        <th />
                        <td>
                            <HelpText>
                                1.000 DKK ={" "}
                                <BalanceExplainer
                                    amount={1_000_000_000}
                                    productCategory={wb.wallet.paysFor}
                                />

                            </HelpText>
                        </td>
                    </tr>
                </tbody>
            </table>
        </DashboardCard>
    </RequestForSingleResourceWrapper>;
};

// Note: target is baked into the component to make sure we follow the rules of hooks.
//
// We need to take wildly different paths depending on the target which causes us to use very different hooks. Baking
// the target property ensures a remount of the component.
export const GrantApplicationEditor: (target: RequestTarget) =>
    React.FunctionComponent = target => function MemoizedEditor() {
        const state = useRequestInformation(target);
        const grantFinalized = isGrantFinalized(state.editingApplication?.status);
        const [loading, runWork] = useAsyncCommand();
        const projectTitleRef = useRef<HTMLInputElement>(null);
        const history = useHistory();
        const dispatch = useDispatch();
        const [isLocked, setIsLocked] = useState<boolean>(target === RequestTarget.VIEW_APPLICATION);
        const storagePrice = useStoragePrice(); // Note: This will change later

        switch (target) {
            case RequestTarget.EXISTING_PROJECT:
                useTitle("Viewing Project");
                break;
            case RequestTarget.NEW_PROJECT:
                useTitle("Create Project");
                break;
            case RequestTarget.PERSONAL_PROJECT:
                useTitle("My Workspace");
                break;
            case RequestTarget.VIEW_APPLICATION:
                useTitle("Viewing Application");
                break;
        }

        dispatch(setRefreshFunction(state.reload));
        dispatch(loadingAction(state.loading));
        useEffect(() => {
            return () => {
                dispatch(setRefreshFunction(undefined));
            };
        }, []);

        const discardChanges = useCallback(async () => {
            state.reload();
            setIsLocked(true);
        }, [state.reload]);

        const submitRequest = useCallback(async () => {
            if (state.targetProject === undefined) {
                snackbarStore.addFailure("Unknown target. Root level projects cannot apply for more resources.", false);
                return;
            }

            let grantRecipient: GrantRecipient = state.recipient;
            if (target === RequestTarget.NEW_PROJECT) {
                grantRecipient = {type: "new_project", projectTitle: projectTitleRef.current!.value};
            }

            const requestedResources = state.wallets.map(wb => {
                let creditsRequested = parseIntegerFromInput(
                    document.querySelector<HTMLInputElement>(
                        `input[data-target="${productCategoryId(wb.wallet.paysFor)}"]`
                    )
                );
                if (creditsRequested) creditsRequested = creditsRequested * 1000000;

                let quotaRequested = parseIntegerFromInput(
                    document.querySelector<HTMLInputElement>(
                        `input[data-target="quota-${productCategoryId(wb.wallet.paysFor)}"]`
                    )
                );

                if (wb.area === ProductArea.STORAGE) {
                    if ((creditsRequested !== undefined) || (quotaRequested !== undefined)) {
                        if ((creditsRequested === undefined) || (quotaRequested === undefined)) {
                            snackbarStore.addFailure("Please fill out both \"Resources\" and \"Quota\" for requested storage product", false);
                            return;
                        }
                    }
                }

                if (quotaRequested) quotaRequested = quotaRequested * (1000 * 1000 * 1000);

                if (creditsRequested === undefined && quotaRequested === undefined) {
                    return null;
                }

                return {
                    creditsRequested,
                    quotaRequested,
                    productCategory: wb.wallet.paysFor.id,
                    productProvider: wb.wallet.paysFor.provider
                } as ResourceRequest;
            }).filter(it => it !== null) as ResourceRequest[];

            const newDocument = state.documentRef.current!.value;
            if (state.editingApplication === undefined) {
                const response = await runWork<{id: number}>(submitGrantApplication({
                    document: newDocument,
                    resourcesOwnedBy: state.targetProject!,
                    requestedResources,
                    grantRecipient
                }));

                if (response) {
                    history.push(`/project/grants/view/${response.id}`);
                }
            } else {
                await runWork(editGrantApplication({
                    id: state.editingApplication.id!,
                    newDocument,
                    newResources: requestedResources
                }));
                state.reload();
                setIsLocked(true);
            }
        }, [state.targetProject, state.documentRef, state.recipient, state.wallets, projectTitleRef,
        state.editingApplication?.id, state.reload]);

        const approveRequest = useCallback(async () => {
            if (state.editingApplication !== undefined) {
                addStandardDialog({
                    title: "Approve application?",
                    message: "Are you sure you wish to approve this application?",
                    onConfirm: async () => {
                        await runWork(approveGrantApplication({requestId: state.editingApplication!.id}));
                        state.reload();
                    }
                });
            }
        }, [state.editingApplication?.id]);

        const rejectRequest = useCallback(async () => {
            if (state.editingApplication !== undefined) {
                addStandardDialog({
                    title: "Reject application?",
                    message: "Are you sure you wish to reject this application?",
                    onConfirm: async () => {
                        await runWork(rejectGrantApplication({requestId: state.editingApplication!.id}));
                        state.reload();
                    }
                });
            }
        }, [state.editingApplication?.id]);

        const closeRequest = useCallback(async () => {
            if (state.editingApplication !== undefined) {
                addStandardDialog({
                    title: "Withdraw application?",
                    message: "Are you sure you wish to withdraw this application?",
                    onConfirm: async () => {
                        await runWork(closeGrantApplication({requestId: state.editingApplication!.id}));
                        state.reload();
                    }
                });
            }
        }, [state.editingApplication?.id]);

        useEffect(() => {
            if (state.editingApplication !== undefined) {
                for (const resource of state.editingApplication.requestedResources) {
                    const credits = resource.creditsRequested;
                    const quota = resource.quotaRequested;

                    // TODO(Dan): The following code is a terrible idea.
                    // This code is in here only because we did not notice the error until it was already in production
                    // and was causing a lot of crashes. A proper solution is tracked in #1928.
                    //
                    // The code tends to crash because React has not yet rendered the inputs and we attempt to write to
                    // the inputs before they are actually ready. We solve it in the code below by simply retrying
                    // (via setTimeout) until React has rendered our input elements. This is obviously a bad idea and the
                    // code should be refactored to avoid this. The error only manifests itself if the loading of network
                    // resources occur in a specific order, an order which happens to occur often in production but for
                    // some reason not in dev.
                    let attempts = 0;
                    const work = (): void => {
                        let success = true;
                        const creditsInput = document.querySelector<HTMLInputElement>(
                            `input[data-target="${productCategoryId({
                                provider: resource.productProvider,
                                id: resource.productCategory
                            })}"]`
                        );

                        const quotaCredits = document.querySelector<HTMLInputElement>(
                            `input[data-target="quota-${productCategoryId({
                                provider: resource.productProvider,
                                id: resource.productCategory
                            })}"]`
                        );

                        const durationInput = document.querySelector<HTMLInputElement>(
                            `input[data-target="duration-${productCategoryId({
                                provider: resource.productProvider,
                                id: resource.productCategory
                            })}"]`
                        )!;

                        if (credits) {
                            if (creditsInput) {
                                creditsInput.value = (credits / 1000000).toFixed(0);
                            } else {
                                success = false;
                            }
                        }

                        if (quota) {
                            if (quotaCredits) {
                                quotaCredits.value = (quota / (1000 * 1000 * 1000)).toFixed(0);
                            } else {
                                success = false;
                            }
                        }

                        if (quota != null && credits != null && storagePrice != null) {
                            const pricePerMonth = ((quota / (1000 * 1000 * 1000)) * 30 * storagePrice);
                            if (durationInput) {
                                if (pricePerMonth !== 0) {
                                    durationInput.value = Math.floor(credits / pricePerMonth).toString();
                                }
                            } else {
                                success = false;
                            }
                        }

                        if (!success) {
                            if (attempts > 10) {
                                snackbarStore.addFailure("Unable to render application", true);
                            } else {
                                attempts++;
                                setTimeout(work, 500);
                            }
                        }
                    };

                    setTimeout(work, 0);
                }
            }
        }, [state.editingApplication, storagePrice]);

        return (
            <MainContainer
                header={target === RequestTarget.EXISTING_PROJECT ?
                    <ProjectBreadcrumbs crumbs={[{title: "Request for Resources"}]} /> : null
                }
                sidebar={null}
                main={
                    <Flex justifyContent="center">
                        <Box maxWidth={1400} width="100%">
                            {target !== RequestTarget.NEW_PROJECT ? null : (
                                <>
                                    <Label mb={16} mt={16}>
                                        Principal Investigator (PI)
                                    <Input
                                            value={
                                                `${Client.userInfo?.firstNames} ${Client.userInfo?.lastName} ` +
                                                `(${Client.username})`
                                            }
                                            disabled
                                        />
                                    </Label>
                                    <Label mb={16} mt={16}>
                                        Project title
                                    <Input ref={projectTitleRef} />
                                    </Label>
                                </>
                            )}

                            {target !== RequestTarget.VIEW_APPLICATION ? null : (
                                <>
                                    <DashboardCard color="blue" isLoading={false}>
                                        <Heading.h4 mb={16}>Metadata</Heading.h4>

                                        <Text mb={16}>
                                            <i>Application must be resubmitted to change the metadata.</i>
                                        </Text>
                                        <Table>
                                            <tbody>
                                                <TableRow>
                                                    <TableCell>Application Approver</TableCell>
                                                    <TableCell>{state.editingApplication!.resourcesOwnedByTitle}</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell>Project Title</TableCell>
                                                    <TableCell>{state.editingApplication!.grantRecipientTitle}</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell>Principal Investigator (PI)</TableCell>
                                                    <TableCell>{state.editingApplication!.grantRecipientPi}</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell verticalAlign="top">
                                                        Project Type
                                            </TableCell>
                                                    <TableCell>
                                                        <table>
                                                            <tbody>
                                                                <tr>
                                                                    <td>Personal</td>
                                                                    <td width="100%">
                                                                        {state.recipient.type === "personal" ?
                                                                            <Icon name={"check"} color={"green"} /> :
                                                                            <Icon name={"close"} color={"red"} />}
                                                                    </td>
                                                                </tr>
                                                                <tr>
                                                                    <td width="100%">New Project</td>
                                                                    <td>
                                                                        {state.recipient.type === "new_project" ?
                                                                            <Icon name={"check"} color={"green"} /> :
                                                                            <Icon name={"close"} color={"red"} />}
                                                                    </td>
                                                                </tr>
                                                                <tr>
                                                                    <td width="100%">Existing Project</td>
                                                                    <td>
                                                                        {state.recipient.type === "existing_project" ?
                                                                            <Icon name={"check"} color={"green"} /> :
                                                                            <Icon name={"close"} color={"red"} />}
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell verticalAlign={"top"} mt={32}>Current Status</TableCell>
                                                    <TableCell>
                                                        {
                                                            state.editingApplication!.status === GrantApplicationStatus.IN_PROGRESS ? "In progress" :
                                                                state.editingApplication!.status === GrantApplicationStatus.APPROVED ? (state.editingApplication?.statusChangedBy === null ? "Approved" : "Approved by " + state.editingApplication?.statusChangedBy) :
                                                                    state.editingApplication!.status === GrantApplicationStatus.REJECTED ? (state.editingApplication?.statusChangedBy === null ? "Rejected" : "Rejected  by " + state.editingApplication?.statusChangedBy) :
                                                                        (state.editingApplication?.statusChangedBy === null ? "Closed" : "Closed by " + state.editingApplication?.statusChangedBy)
                                                        }
                                                        <ButtonGroup>
                                                            {target !== RequestTarget.VIEW_APPLICATION ? null : (
                                                                <>
                                                                    {state.approver && !grantFinalized ?
                                                                        <>
                                                                            <Button
                                                                                color="green"
                                                                                onClick={approveRequest}
                                                                                disabled={!isLocked}
                                                                            >
                                                                                Approve
                                                                    </Button>
                                                                            <Button
                                                                                color="red"
                                                                                onClick={rejectRequest}
                                                                                disabled={!isLocked}
                                                                            >
                                                                                Reject
                                                                    </Button>
                                                                        </> : null
                                                                    }
                                                                    {!state.approver && !grantFinalized ?
                                                                        <>
                                                                            <Button
                                                                                color="red"
                                                                                onClick={closeRequest}
                                                                                disabled={!isLocked}
                                                                            >
                                                                                Withdraw
                                                                    </Button>
                                                                        </> : null
                                                                    }

                                                                </>
                                                            )}
                                                        </ButtonGroup>
                                                        {target !== RequestTarget.VIEW_APPLICATION || isLocked ||
                                                            grantFinalized ? null :
                                                            <Text>
                                                                You must finish making changes before you can
                                                                change the status of this application
                                                    </Text>
                                                        }

                                                    </TableCell>
                                                </TableRow>
                                            </tbody>
                                        </Table>
                                    </DashboardCard>
                                </>
                            )}

                            <Heading.h3 mt={32}>
                                {target === RequestTarget.VIEW_APPLICATION ? "Requested Resources" : "Resources"}
                            </Heading.h3>

                            <Heading.h4 mt={32}><Flex>Storage <ProductLink /></Flex></Heading.h4>
                            <ResourceContainer>
                                {state.wallets.map((it, idx) => (
                                    it.area !== ProductArea.STORAGE ? null :
                                        <StorageRequestCard
                                            wb={it}
                                            state={state}
                                            grantFinalized={grantFinalized}
                                            isLocked={isLocked}
                                            storagePrice={storagePrice}
                                            key={idx}
                                        />
                                ))}
                            </ResourceContainer>

                            <Heading.h4 mt={32}><Flex>Compute <ProductLink /></Flex></Heading.h4>
                            <ResourceContainer>
                                {state.wallets.map((it, idx) => (
                                    it.area !== ProductArea.COMPUTE ? null :
                                        <ComputeRequestCard
                                            key={idx}
                                            wb={it}
                                            state={state}
                                            grantFinalized={grantFinalized}
                                            isLocked={isLocked}
                                        />
                                ))}
                            </ResourceContainer>

                            <CommentApplicationWrapper>
                                <RequestFormContainer>
                                    <Heading.h4>Application</Heading.h4>
                                    <TextArea
                                        disabled={grantFinalized || isLocked || state.approver}
                                        rows={25}
                                        ref={state.documentRef}
                                    />
                                </RequestFormContainer>

                                {state.editingApplication === undefined ? null : (
                                    <Box width="100%">
                                        <Heading.h4>Comments</Heading.h4>
                                        {state.comments.length > 0 ? null : (
                                            <Box mt={16} mb={16}>
                                                No comments have been posted yet.
                                            </Box>
                                        )}

                                        {state.comments.map(it => (
                                            <CommentBox
                                                key={it.id}
                                                comment={it}
                                                avatar={state.avatars.cache[it.postedBy] ?? defaultAvatar}
                                                reload={state.reload}
                                            />
                                        ))}

                                        <PostCommentWidget
                                            applicationId={state.editingApplication.id!}
                                            avatar={state.avatars.cache[Client.username!] ?? defaultAvatar}
                                            reload={state.reload}
                                        />
                                    </Box>
                                )}
                            </CommentApplicationWrapper>
                            <Box p={32} pb={16}>
                                {target !== RequestTarget.VIEW_APPLICATION ? (
                                    <Button disabled={grantFinalized} fullWidth onClick={submitRequest}>
                                        Submit Application
                                    </Button>
                                ) : null
                                }
                                {target !== RequestTarget.VIEW_APPLICATION || grantFinalized ? null : (
                                    isLocked ? (
                                        <Button fullWidth onClick={() => setIsLocked(false)} disabled={loading}>
                                            Edit this request
                                        </Button>
                                    ) : (
                                            <ButtonGroup>
                                                <Button
                                                    color={"green"}
                                                    fullWidth
                                                    disabled={loading}
                                                    onClick={submitRequest}
                                                >
                                                    Save Changes
                                        </Button>
                                                <Button color={"red"} onClick={discardChanges}>Discard changes</Button>
                                            </ButtonGroup>
                                        )
                                )}
                            </Box>
                        </Box>
                    </Flex>
                }
            />
        );
    };

const CommentApplicationWrapper = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(600px, 1fr));
    grid-gap: 32px;
    max-width: 1400px;
`;

const CommentBoxWrapper = styled.div`
    display: flex;
    margin: 10px 0;

    .body {
        flex-grow: 1;
        margin: 0 6px;
    }

    time {
        color: var(--gray, #ff0);
    }

    p {
        margin: 0;
    }
`;

const CommentBox: React.FunctionComponent<{
    comment: Comment,
    avatar: AvatarType,
    reload: () => void
}> = ({comment, avatar, reload}) => {
    const [, runCommand] = useAsyncCommand();
    const onDelete = useCallback(() => {
        addStandardDialog({
            title: "Confirm comment deletion",
            message: "Are you sure you wish to delete your comment?",
            confirmText: "Delete",
            addToFront: true,
            onConfirm: async () => {
                await runCommand(deleteGrantApplicationComment({commentId: comment.id}));
                reload();
            }
        });
    }, [comment.id]);

    return <CommentBoxWrapper>
        <div className="avatar">
            <UserAvatar avatar={avatar} width={"48px"} />
        </div>

        <div className="body">
            <p><strong>{comment.postedBy}</strong> says:</p>
            <p>{comment.comment}</p>
            <time>{dateToString(comment.postedAt)}</time>
        </div>

        {comment.postedBy === Client.username ? (
            <div>
                <Icon cursor={"pointer"} name={"trash"} color={"red"} onClick={onDelete} />
            </div>
        ) : null}
    </CommentBoxWrapper>;
};

const PostCommentWrapper = styled.form`
    .wrapper {
        display: flex;
    }

    ${TextArea} {
        flex-grow: 1;
        margin-left: 6px;
    }

    .buttons {
        display: flex;
        margin-top: 6px;
        justify-content: flex-end;
    }
`;

const HelpText = styled.p`
    margin: 0;
    font-size: ${theme.fontSizes[1]}px;
    color: var(--gray, #f00);
`;

const PostCommentWidget: React.FunctionComponent<{
    applicationId: number,
    avatar: AvatarType,
    reload: () => void
}> = ({applicationId, avatar, reload}) => {
    const commentBoxRef = useRef<HTMLTextAreaElement>(null);
    const [loading, runWork] = useAsyncCommand();
    const submitComment = useCallback(async (e) => {
        e.preventDefault();

        await runWork(commentOnGrantApplication({
            requestId: applicationId,
            comment: commentBoxRef.current!.value
        }));
        reload();
        if (commentBoxRef.current) commentBoxRef.current!.value = "";
    }, [runWork, applicationId, commentBoxRef.current]);
    return <PostCommentWrapper onSubmit={submitComment}>
        <div className="wrapper">
            <UserAvatar avatar={avatar} width={"48px"} />
            <TextArea rows={3} ref={commentBoxRef} placeholder={"Your comment"} />
        </div>
        <div className="buttons">
            <Button disabled={loading}>Send</Button>
        </div>
    </PostCommentWrapper>;
};

function ProductLink(): JSX.Element {
    return <Tooltip
        trigger={<ExternalLink href="/app/skus"><Box style={{
            cursor: "pointer",
            border: "2px var(--black) solid",
            borderRadius: "9999px",
            width: "35px",
            height: "35px",
            marginLeft: "9px",
            paddingLeft: "10px",
            marginTop: "-2px"
        }}> ?</Box></ExternalLink>}
    >
        <Box width="100px">Click to view details for resources</Box>
    </Tooltip>
}

export default GrantApplicationEditor;
