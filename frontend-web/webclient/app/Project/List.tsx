import {useCloudAPI} from "Authentication/DataHook";
import {emptyPage} from "DefaultObjects";
import {MainContainer} from "MainContainer/MainContainer";
import * as Pagination from "Pagination";
import {listProjects, ListProjectsRequest, UserInProject} from "Project/index";
import * as React from "react";
import {connect} from "react-redux";
import {Dispatch} from "redux";
import {Page} from "Types";
import Button from "ui-components/Button";
import * as Heading from "ui-components/Heading";
import Link from "ui-components/Link";
import VerticalButtonGroup from "ui-components/VerticalButtonGroup";

const List: React.FunctionComponent<DispatchProps> = props => {
    const [response, setFetchParams] = useCloudAPI<Page<UserInProject>, ListProjectsRequest>(
        listProjects({page: 0, itemsPerPage: 50}),
        emptyPage
    );

    return (
        <MainContainer
            headerSize={0}
            header={null}
            main={(
                <Pagination.List
                    page={response.data}
                    pageRenderer={page => (
                        <>
                            {page.items.map(e =>
                                <ProjectSummary summary={e} setProject={props.setProject} key={e.id} />
                            )}
                        </>
                    )}
                    loading={response.loading}
                    onPageChanged={(newPage, page) => setFetchParams(listProjects({page: newPage, itemsPerPage: 50}))}
                />
            )}
            sidebar={(
                <VerticalButtonGroup>
                    <Link to={"/projects/create"}><Button>Create</Button></Link>
                    <Button color={"red"} onClick={e => props.setProject(undefined)}>Clear Project</Button>
                </VerticalButtonGroup>
            )}
        />
    );
};

const ProjectSummary: React.FunctionComponent<{summary: UserInProject} & DispatchProps> = props => (
    <div>
        <Heading.h3>{props.summary.title}</Heading.h3>
        <ul>
            <li>{props.summary.id}</li>
            <li>{props.summary.whoami.role}</li>
            <li><Link to={`/projects/view/${props.summary.id}`}>View</Link></li>
            <li><Link to="#" onClick={() => props.setProject(props.summary.id)}>Set as active</Link></li>
        </ul>
    </div>
);

interface DispatchProps {
    setProject: (id?: string) => void;
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
    setProject: (id?: string) => dispatch({type: "SET_PROJECT", project: id})
});

export default connect(null, mapDispatchToProps)(List);
