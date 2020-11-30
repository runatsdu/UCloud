import * as React from "react";
import * as UCloud from "UCloud";
import {useLoading, useTitle} from "Navigation/Redux/StatusActions";
import {SidebarPages, useSidebarPage} from "ui-components/Sidebar";
import {useRefreshFunction} from "Navigation/Redux/HeaderActions";
import {useCallback, useEffect, useState} from "react";
import {useCloudAPI} from "Authentication/DataHook";
import {emptyPageV2} from "DefaultObjects";
import {useProjectId} from "Project";
import * as Pagination from "Pagination";
import {MainContainer} from "MainContainer/MainContainer";
import {useHistory} from "react-router";
import {AppToolLogo} from "Applications/AppToolLogo";
import {ListRow, ListRowStat} from "ui-components/List";
import Text from "ui-components/Text";
import {shortUUID} from "UtilityFunctions";
import {formatRelative} from "date-fns/esm";
import {enGB} from "date-fns/locale";
import {isRunExpired} from "Utilities/ApplicationUtilities";
import {Flex} from "ui-components";

const itemsPerPage = 50;

export const Browse: React.FunctionComponent = () => {
    useTitle("Runs")
    useSidebarPage(SidebarPages.Runs);

    const [infScrollId, setInfScrollId] = useState(0);
    const [jobs, fetchJobs] = useCloudAPI<UCloud.PageV2<UCloud.compute.Job>>(
        {noop: true},
        emptyPageV2
    );

    const refresh = useCallback(() => {
        fetchJobs(UCloud.compute.jobs.browse({itemsPerPage}));
        setInfScrollId(id => id + 1);
    }, []);

    const history = useHistory();

    useRefreshFunction(refresh);

    useLoading(jobs.loading);
    const projectId = useProjectId();

    useEffect(() => {
        fetchJobs(UCloud.compute.jobs.browse({itemsPerPage}));
    }, [projectId]);

    const loadMore = useCallback(() => {
        fetchJobs(UCloud.compute.jobs.browse({itemsPerPage, next: jobs.data.next}));
    }, [jobs.data]);

    const [checked, setChecked] = useState(new Set<string>());

    const pageRenderer = useCallback((page: UCloud.PageV2<UCloud.compute.Job>): React.ReactNode => (
        page.items.map(job => {
            const isExpired = isRunExpired(job);
            const hideExpiration = isExpired || job.parameters.timeAllocation === null; //TODO || isJobStateFinal(job.parameters);
            return (
                <ListRow
                    key={job.id}
                    navigate={() => history.push(`/applications/results/${job.id}`)}
                    icon={<AppToolLogo size="36px" type="APPLICATION" name={job.parameters.application.name} />}
                    isSelected={checked[job.parameters.name!]}
                    select={() => {
                        if (checked.has(job.parameters.name!)) {
                            checked.delete(job.parameters.name!)
                        } else {
                            checked.add(job.parameters.name!);
                        }
                        setChecked(new Set(...checked));
                    }}
                    left={<Text cursor="pointer">{job.parameters.name ?? shortUUID(job.id)}</Text>}
                    leftSub={<>
                        <ListRowStat color="gray" icon="id">
                            {job.parameters.application.name} v{job.parameters.application.version}
                        </ListRowStat>
                        <ListRowStat color="gray" color2="gray" icon="chrono">
                            {/* TODO: Created at timestamp */}
                            Started {formatRelative(0, new Date(), {locale: enGB})}
                        </ListRowStat>
                    </>}
                    right={<>
                        {hideExpiration ? null : (
                            <Text mr="25px">
                                {/* TODO: Expiration */}
                                Expires {formatRelative(0, new Date(), {locale: enGB})}
                            </Text>
                        )}
                        <Flex width="110px">
                            {/* TODO */}
                            {/* <JobStateIcon state={job.state} isExpired={isExpired} mr="8px" /> */}
                            {/*<Flex mt="-3px">{isExpired ? "Expired" : stateToTitle(it.state)}</Flex>*/}
                        </Flex>
                    </>}
                />
            )
        })
    ), []);

    return <MainContainer
        main={
            <Pagination.ListV2
                page={jobs.data}
                loading={jobs.loading}
                onLoadMore={loadMore}
                pageRenderer={pageRenderer}
                infiniteScrollGeneration={infScrollId}
            />
        }

        sidebar={
            <div>Filtering options TODO</div>
        }
    />;
};

// Old component pasted below

/*
interface FetchJobsOptions {
    itemsPerPage?: number;
    pageNumber?: number;
    sortBy?: RunsSortBy;
    sortOrder?: SortOrder;
    minTimestamp?: number;
    maxTimestamp?: number;
    filter?: string;
}

const StickyBox = styled(Box)`
    position: sticky;
    top: 95px;
    z-index: 50;
`;


const Runs: React.FunctionComponent = () => {
    React.useEffect(() => {
        props.onInit();
        fetchJobs();
        props.setRefresh(() => fetchJobs());
        return (): void => props.setRefresh();
    }, []);

    function fetchJobs(options?: FetchJobsOptions): void {
        const opts = options ?? {};
        const {page, setLoading} = props;
        const itemsPerPage = opts.itemsPerPage != null ? opts.itemsPerPage : page.itemsPerPage;
        const pageNumber = opts.pageNumber != null ? opts.pageNumber : page.pageNumber;
        const sortOrder = opts.sortOrder != null ? opts.sortOrder : props.sortOrder;
        const sortBy = opts.sortBy != null ? opts.sortBy : props.sortBy;
        const minTimestamp = opts.minTimestamp != null ? opts.minTimestamp : undefined;
        const maxTimestamp = opts.maxTimestamp != null ? opts.maxTimestamp : undefined;
        const filterValue = opts.filter && opts.filter !== "Don't filter" ? opts.filter as JobState : undefined;

        setLoading(true);
        props.fetchJobs(itemsPerPage, pageNumber, sortOrder, sortBy, minTimestamp, maxTimestamp, filterValue);
        props.setRefresh(() =>
            props.fetchJobs(itemsPerPage, pageNumber, sortOrder, sortBy, minTimestamp, maxTimestamp, filterValue)
        );
    }

    const {page, loading, sortBy, sortOrder} = props;
    const {itemsPerPage, pageNumber} = page;
    const history = useHistory();

    const selectedAnalyses = page.items.filter(it => it.checked);
    const cancelableAnalyses = selectedAnalyses.filter(it => inCancelableState(it.state));

    const allChecked = selectedAnalyses.length === page.items.length && page.items.length > 0;

    const content = (
        <>
            <StickyBox backgroundColor="white">
                <Spacer
                    left={(
                        <Label ml={10} width="auto">
                            <Checkbox
                                size={27}
                                onClick={() => props.checkAllAnalyses(!allChecked)}
                                checked={allChecked}
                                onChange={stopPropagation}
                            />
                            <Box as={"span"}>Select all</Box>
                        </Label>
                    )}
                    right={(
                        <Box>
                            <ClickableDropdown
                                trigger={(
                                    <>
                                        <Icon
                                            cursor="pointer"
                                            name="arrowDown"
                                            rotation={sortOrder === SortOrder.ASCENDING ? 180 : 0}
                                            size=".7em"
                                            mr=".4em"
                                        />
                                        Sort by: {prettierString(sortBy)}
                                    </>
                                )}
                                chevron
                            >
                                <Box
                                    ml="-16px"
                                    mr="-16px"
                                    pl="15px"
                                    onClick={() => fetchJobs({
                                        sortOrder: sortOrder === SortOrder.ASCENDING ?
                                            SortOrder.DESCENDING : SortOrder.ASCENDING
                                    })}
                                >
                                    <>
                                        {prettierString(sortOrder === SortOrder.ASCENDING ?
                                            SortOrder.DESCENDING : SortOrder.ASCENDING
                                        )}
                                    </>
                                </Box>
                                <Divider />
                                {Object.values(RunsSortBy)
                                    .filter(it => it !== sortBy)
                                    .map((sortByValue: RunsSortBy, j) => (
                                        <Box
                                            ml="-16px"
                                            mr="-16px"
                                            pl="15px"
                                            key={j}
                                            onClick={() =>
                                                fetchJobs({sortBy: sortByValue, sortOrder: SortOrder.ASCENDING})}
                                        >
                                            {prettierString(sortByValue)}
                                        </Box>
                                    ))}
                            </ClickableDropdown>
                        </Box>
                    )}
                />
            </StickyBox>
            <List
                customEmptyPage={<Heading.h1>No jobs found.</Heading.h1>}
                loading={loading}
                pageRenderer={({items}) => (
                    <ItemList>
                        {items.map(it => {
                            const isExpired = isRunExpired(it);
                            const hideExpiration = isExpired || it.expiresAt === null || isJobStateFinal(it.state);
                            return (
                                <ListRow
                                    key={it.jobId}
                                    navigate={() => history.push(`/applications/results/${it.jobId}`)}
                                    icon={<AppToolLogo size="36px" type="APPLICATION" name={it.metadata.name} />}
                                    isSelected={it.checked!}
                                    select={() => props.checkAnalysis(it.jobId, !it.checked)}
                                    left={<Text cursor="pointer">{it.name ? it.name : shortUUID(it.jobId)}</Text>}
                                    leftSub={<>
                                        <ListRowStat color="gray" icon="id">
                                            {it.metadata.title} v{it.metadata.version}
                                        </ListRowStat>
                                        <ListRowStat color="gray" color2="gray" icon="chrono">
                                            Started {formatRelative(it.createdAt, new Date(), {locale: enGB})}
                                        </ListRowStat>
                                        {!it.creditsCharged ? null : (
                                            <ListRowStat color={"gray"} icon={"grant"}>
                                                Price: {creditFormatter(it.creditsCharged)}
                                            </ListRowStat>
                                        )}
                                    </>}
                                    right={<>
                                        {hideExpiration ? null : (
                                            <Text mr="25px">
                                                Expires {formatRelative(it.expiresAt ?? 0, new Date(), {locale: enGB})}
                                            </Text>
                                        )}
                                        <Flex width="110px">
                                            <JobStateIcon state={it.state} isExpired={isExpired} mr="8px" />
                                            <Flex mt="-3px">{isExpired ? "Expired" : stateToTitle(it.state)}</Flex>
                                        </Flex>
                                    </>}
                                />
                            );
                        })}
                    </ItemList>
                )
                }
                page={page}
                onPageChanged={pageNumber => fetchJobs({pageNumber})}
            />
        </>
    );

    const defaultFilter = {text: "Don't filter", value: "Don't filter"};
    const [filter, setFilter] = React.useState(defaultFilter);
    const [firstDate, setFirstDate] = React.useState<Date | null>(null);
    const [secondDate, setSecondDate] = React.useState<Date | null>(null);

    const appStates = Object.keys(JobState)
        .filter(it => it !== "CANCELLING").map(it => ({text: prettierString(it), value: it}));
    appStates.push(defaultFilter);

    function fetchJobsInRange(minDate: Date | null, maxDate: Date | null) {
        return () => fetchJobs({
            itemsPerPage,
            pageNumber,
            sortOrder,
            sortBy,
            minTimestamp: minDate?.getTime() ?? undefined,
            maxTimestamp: maxDate?.getTime() ?? undefined,
            filter: filter.value === "Don't filter" ? undefined : filter.value
        });
    }

    const startOfToday = getStartOfDay(new Date());
    const dayInMillis = 24 * 60 * 60 * 1000;
    const startOfYesterday = getStartOfDay(new Date(startOfToday.getTime() - dayInMillis));
    const startOfWeek = getStartOfWeek(new Date()).getTime();

    function updateFilterAndFetchJobs(value: string): void {
        setFilter({text: prettierString(value), value});
        fetchJobs({
            itemsPerPage,
            pageNumber,
            sortBy,
            sortOrder,
            filter: value === "Don't filter" ? undefined : value as JobState
        });
    }

    const sidebar = (
        <Box pt={48}>
            <Heading.h3>
                Quick Filters
            </Heading.h3>
            <Box cursor="pointer" onClick={fetchJobsInRange(getStartOfDay(new Date()), null)}>
                <TextSpan>Today</TextSpan>
            </Box>
            <Box
                cursor="pointer"
                onClick={fetchJobsInRange(
                    new Date(startOfYesterday),
                    new Date(startOfYesterday.getTime() + dayInMillis)
                )}
            >
                <TextSpan>Yesterday</TextSpan>
            </Box>
            <Box
                cursor="pointer"
                onClick={fetchJobsInRange(new Date(startOfWeek), null)}
            >
                <TextSpan>This week</TextSpan>
            </Box>
            <Box cursor="pointer" onClick={fetchJobsInRange(null, null)}><TextSpan>No filter</TextSpan></Box>
            <Heading.h3 mt={16}>Active Filters</Heading.h3>
            <Label>Filter by app state</Label>
            <ClickableDropdown
                chevron
                trigger={filter.text}
                onChange={updateFilterAndFetchJobs}
                options={appStates.filter(it => it.value !== filter.value)}
            />
            <Box mb={16} mt={16}>
                <Label>Job created after</Label>
                <InputGroup>
                    <DatePicker
                        placeholderText="Don't filter"
                        isClearable
                        selectsStart
                        showTimeInput
                        startDate={firstDate}
                        endDate={secondDate}
                        selected={firstDate}
                        onChange={(date: Date) => (setFirstDate(date), fetchJobsInRange(date, secondDate)())}
                        timeFormat="HH:mm"
                        dateFormat="dd/MM/yy HH:mm"
                    />
                </InputGroup>
            </Box>
            <Box mb={16}>
                <Label>Job created before</Label>
                <InputGroup>
                    <DatePicker
                        placeholderText="Don't filter"
                        isClearable
                        selectsEnd
                        showTimeInput
                        startDate={firstDate}
                        endDate={secondDate}
                        selected={secondDate}
                        onChange={(date: Date) => (setSecondDate(date), fetchJobsInRange(firstDate, date)())}
                        onSelect={d => fetchJobsInRange(firstDate, d)}
                        timeFormat="HH:mm"
                        dateFormat="dd/MM/yy HH:mm"
                    />
                </InputGroup>
            </Box>
            <AnalysisOperations cancelableAnalyses={cancelableAnalyses} onFinished={() => fetchJobs()} />
        </Box>
    );

    return (
        <MainContainer
            header={(
                <Spacer
                    left={null}
                    right={(
                        <Box width="170px">
                            <EntriesPerPageSelector
                                content="Jobs per page"
                                entriesPerPage={page.itemsPerPage}
                                onChange={items => fetchJobs({itemsPerPage: items})}
                            />
                        </Box>
                    )}
                />
            )}
            headerSize={48}
            sidebarSize={340}
            main={content}
            sidebar={sidebar}
        />
    );
}

interface AnalysisOperationsProps {
    cancelableAnalyses: JobWithStatus[];
    onFinished: () => void;
}

function AnalysisOperations({cancelableAnalyses, onFinished}: AnalysisOperationsProps): JSX.Element | null {
    if (cancelableAnalyses.length === 0) return null;
    return (
        <Button
            fullWidth
            color="red"
            onClick={() => cancelJobDialog({
                jobCount: cancelableAnalyses.length,
                jobId: cancelableAnalyses[0].jobId,
                onConfirm: async () => {
                    try {
                        await Promise.all(cancelableAnalyses.map(a => cancelJob(Client, a.jobId)));
                        snackbarStore.addSuccess("Jobs cancelled", false);
                    } catch (e) {
                        snackbarStore.addFailure(errorMessageOrDefault(e, "An error occurred "), false);
                    } finally {
                        onFinished();
                    }
                }
            })}
        >
            Cancel selected ({cancelableAnalyses.length}) jobs
        </Button >
    );
}

const mapDispatchToProps = (dispatch: Dispatch): AnalysesOperations => ({
    setLoading: loading => dispatch(setLoading(loading)),
    fetchJobs: async (itemsPerPage, pageNumber, sortOrder, sortBy, minTimestamp, maxTimestamp, filter) =>
        dispatch(await fetchAnalyses(itemsPerPage, pageNumber, sortOrder, sortBy, minTimestamp, maxTimestamp, filter)),
    setRefresh: refresh => dispatch(setRefreshFunction(refresh)),
    onInit: () => {
        dispatch(setActivePage(SidebarPages.Runs));
        dispatch(updatePageTitle("Runs"));
    },
    checkAnalysis: (jobId, checked) => dispatch(checkAnalysis(jobId, checked)),
    checkAllAnalyses: checked => dispatch(checkAllAnalyses(checked))
});

const mapStateToProps = ({analyses}: ReduxObject): AnalysesStateProps => analyses;


 */