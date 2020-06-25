import {callAPIWithErrorHandler, useCloudAPI} from "Authentication/DataHook";
import {MainContainer} from "MainContainer/MainContainer";
import {useProjectManagementStatus,} from "Project/index";
import * as Heading from "ui-components/Heading";
import * as React from "react";
import {useCallback, useEffect} from "react";
import {Box, Button, Link, Flex} from "ui-components";
import {connect} from "react-redux";
import {Dispatch} from "redux";
import {setRefreshFunction} from "Navigation/Redux/HeaderActions";
import {loadingAction} from "Loading";
import {
    membershipSearch,
    shouldVerifyMembership,
    ShouldVerifyMembershipResponse,
    verifyMembership
} from "Project";
import styled from "styled-components";
import GroupView from "./GroupList";
import ProjectMembers from "./MembersPanel";
import {dispatchSetProjectAction} from "Project/Redux";
import {ProjectSettings} from "Project/ProjectSettings";
import {ProjectBreadcrumbs} from "Project/Breadcrumbs";

const Members: React.FunctionComponent<MembersOperations> = props => {
    const {
        projectId,
        group,
        projectMembers,
        setProjectMemberParams,
        projectMemberParams,
        groupMembers,
        memberSearchQuery,
        membersPage,
        reload
    } = useProjectManagementStatus();

    const [shouldVerify, setShouldVerifyParams] = useCloudAPI<ShouldVerifyMembershipResponse>(
        shouldVerifyMembership(projectId),
        {shouldVerify: false}
    );

    useEffect(() => {
        setProjectMemberParams(
            membershipSearch({
                ...projectMemberParams.parameters,
                query: memberSearchQuery,
                notInGroup: group
            })
        );
    }, [projectId, group, groupMembers.data, memberSearchQuery]);

    useEffect(() => {
        props.setLoading(projectMembers.loading || groupMembers.loading);
    }, [projectMembers.loading, groupMembers.loading]);

    useEffect(() => {
        props.setRefresh(reload);
        return () => props.setRefresh();
    }, [reload]);

    useEffect(() => {
        if (projectId !== "") {
            props.setActiveProject(projectId);
        }
    }, [projectId]);

    const onApprove = async (): Promise<void> => {
        await callAPIWithErrorHandler(verifyMembership(projectId));
        setShouldVerifyParams(shouldVerifyMembership(projectId));
    };

    const isSettingsPage = membersPage === "settings";

    return (
        <MainContainer
            header={<ProjectBreadcrumbs crumbs={[{title: "Members"}]} />}
            sidebar={null}
            main={(
                <>
                    {!shouldVerify.data.shouldVerify ? null : (
                        <Box backgroundColor="orange" color="white" p={32} m={16}>
                            <Heading.h4>Time for a review!</Heading.h4>

                            <ul>
                                <li>PIs and admins are asked to occasionally review members of their project</li>
                                <li>We ask you to ensure that only the people who need access have access</li>
                                <li>If you find someone who should not have access then remove them by clicking
                                &apos;X&apos; next to their name
                                </li>
                                <li>
                                    When you are done, click below:

                                    <Box mt={8}>
                                        <Button color={"green"} textColor={"white"} onClick={onApprove}>
                                            Everything looks good now
                                        </Button>
                                    </Box>
                                </li>
                            </ul>

                        </Box>
                    )}
                    <TwoColumnLayout>
                        <Box className="members">
                            <Box ml={8} mr={8}>
                                {isSettingsPage ? <ProjectSettings /> : <ProjectMembers />}
                            </Box>
                        </Box>
                        <Box className="groups">
                            <GroupView />
                        </Box>
                    </TwoColumnLayout>
                </>
            )}
        />
    );
};

const TwoColumnLayout = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    width: 100%;
    
    & > * {
        flex-basis: 100%;
    }

    & > .groups {
        overflow: auto;
    }
    
    @media screen and (min-width: 1200px) {
        & {
            height: calc(100vh - 100px);
            overflow: hidden;
        }
        
        & > .members {
            height: 100%;
            flex: 1;
            overflow-y: auto;
            margin-right: 32px;
        }
        
        & > .groups {
            flex: 1;
            height: 100%;
        }
    }
`;

interface MembersOperations {
    setRefresh: (refresh?: () => void) => void;
    setLoading: (loading: boolean) => void;
    setActiveProject: (project: string) => void;
}

const mapDispatchToProps = (dispatch: Dispatch): MembersOperations => ({
    setRefresh: refresh => dispatch(setRefreshFunction(refresh)),
    setLoading: loading => dispatch(loadingAction(loading)),
    setActiveProject: project => dispatchSetProjectAction(dispatch, project),
});

export default connect(null, mapDispatchToProps)(Members);