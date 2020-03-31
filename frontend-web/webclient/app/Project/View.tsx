import {useAsyncCommand, useCloudAPI} from "Authentication/DataHook";
import {UserAvatar} from "AvataaarLib/UserAvatar";
import {LoadingMainContainer} from "MainContainer/MainContainer";
import {
    addMemberInProject,
    changeRoleInProject,
    deleteMemberInProject,
    emptyProject,
    Project,
    ProjectMember,
    ProjectRole,
    roleInProject,
    viewProject
} from "Project/index";
import * as Heading from "ui-components/Heading";
import * as React from "react";
import {useEffect, useRef, useState} from "react";
import {useParams} from "react-router";
import {Box, Button, Flex, Input, Label} from "ui-components";
import ClickableDropdown from "ui-components/ClickableDropdown";
import {defaultAvatar} from "UserSettings/Avataaar";
import {snackbarStore} from "Snackbar/SnackbarStore";
import {errorMessageOrDefault} from "UtilityFunctions";
import {Client} from "Authentication/HttpClientInstance";
import {connect} from "react-redux";
import {Dispatch} from "redux";
import {setRefreshFunction} from "Navigation/Redux/HeaderActions";
import {ReduxObject} from "DefaultObjects";

const View: React.FunctionComponent<ViewStateProps & ViewOperations> = props => {
    const id = decodeURIComponent(useParams<{ id: string }>().id);
    const [project, setProjectParams] = useCloudAPI<Project>(viewProject({id}), emptyProject(id));

    const role = roleInProject(project.data);
    const allowManagement = role === ProjectRole.PI || Client.userIsAdmin;
    const newMemberRef = useRef<HTMLInputElement>(null);
    const [isCreatingNewMember, createNewMember] = useAsyncCommand();

    const reload = (): void => setProjectParams(viewProject({id}));

    useEffect(() => {
        props.setRefresh(reload);
        return () => props.setRefresh();
    }, []);

    useEffect(() => reload(), [id]);

    const onSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        const inputField = newMemberRef.current!;
        const username = inputField.value;
        try {
            await createNewMember(addMemberInProject({
                projectId: id,
                member: {
                    username,
                    role: ProjectRole.USER
                }
            }));
            inputField.value = "";
            reload();
        } catch (err) {
            snackbarStore.addFailure(errorMessageOrDefault(err, "Failed adding new member"));
        }
    };

    return (
        <LoadingMainContainer
            headerSize={124}
            header={(
                <>
                    <Heading.h3>{project.data.title} ({project.data.id})</Heading.h3>

                    <form onSubmit={onSubmit}>
                        <Label htmlFor={"new-project-member"}>Add new member</Label>
                        <Input
                            id="new-project-member"
                            placeholder="Username"
                            ref={newMemberRef}
                            disabled={isCreatingNewMember}
                        />
                    </form>
                </>
            )}
            sidebar={null}
            loading={project.loading && project.data.members.length === 0}
            error={project.error ? project.error.why : undefined}
            main={(
                <>
                    {!props.shouldVerify ? null : (
                        <Box backgroundColor={"orange"} color={"white"} p={32}>
                            <Heading.h4>Time for a review!</Heading.h4>

                            <ul>
                                <li>PIs and admins are asked to occasionally review members of their project</li>
                                <li>We ask you to ensure that only the people who need access have access</li>
                                <li>If you find someone who should not have access then remove them by clicking 'Remove' next to their name</li>
                                <li>
                                    When you are done, click below:

                                    <Box mt={8}>
                                        <Button color={"green"} textColor={"white"}>Everything looks good now</Button>
                                    </Box>
                                </li>
                            </ul>

                        </Box>
                    )}

                    {project.data.members.map((e, idx) => (
                        <ViewMember
                            key={idx}
                            project={project.data}
                            member={e}
                            allowManagement={allowManagement}
                            onActionComplete={() => undefined/* reload() */}
                        />
                    ))}
                </>
            )}
        />
    );
};

const ViewMember: React.FunctionComponent<{
    project: Project;
    member: ProjectMember;
    allowManagement: boolean;
    onActionComplete: () => void;
}> = props => {
    const [isLoading, runCommand] = useAsyncCommand();
    const [role, setRole] = useState<ProjectRole>(props.member.role);

    const deleteMember = async (): Promise<void> => {
        await runCommand(deleteMemberInProject({
            projectId: props.project.id,
            member: props.member.username
        }));

        props.onActionComplete();
    };

    return (
        <Box mt={16}>
            <Flex>
                <UserAvatar avatar={defaultAvatar}/>
                <Box flexGrow={1}>
                    {props.member.username} <br/>
                    {!props.allowManagement ? role : (
                        <ClickableDropdown
                            chevron
                            trigger={role}
                            onChange={async value => {
                                try {
                                    await runCommand(changeRoleInProject({
                                        projectId: props.project.id,
                                        member: props.member.username,
                                        newRole: value
                                    }));
                                    setRole(value);
                                } catch (err) {
                                    snackbarStore.addFailure(errorMessageOrDefault(err, "Failed to update role."));
                                }

                                props.onActionComplete();
                            }}
                            options={[
                                {text: "User", value: ProjectRole.USER},
                                {text: "Admin", value: ProjectRole.ADMIN}
                            ]}
                        />
                    )}
                </Box>
                {!props.allowManagement || props.member.role == ProjectRole.PI ? null : (
                    <Box flexShrink={0}>
                        <Button
                            color={"red"}
                            mr={8}
                            disabled={isLoading}
                            onClick={deleteMember}
                        >
                            Remove
                        </Button>
                    </Box>
                )}
            </Flex>
        </Box>
    );
};

interface ViewOperations {
    setRefresh: (refresh?: () => void) => void;
}

interface ViewStateProps {
    shouldVerify: boolean;
}

const mapStateToProps = (state: ReduxObject): ViewStateProps => ({
    shouldVerify: state.project.shouldVerify
});

const mapDispatchToProps = (dispatch: Dispatch): ViewOperations => ({
    setRefresh: refresh => dispatch(setRefreshFunction(refresh))
});

export default connect(mapStateToProps, mapDispatchToProps)(View);
