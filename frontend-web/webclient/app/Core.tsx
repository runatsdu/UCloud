import * as React from "react";
import { Switch, Route } from "react-router-dom";
import Files from "Files/Files";
import Dashboard from "Dashboard/Dashboard";
import Applications from "Applications/Applications";
import RunApp from "Applications/RunApp";
import Analyses from "Applications/Analyses";
import Header from "Navigation/Header";
import Sidebar from "ui-components/Sidebar";
import ZenodoPublish from "Zenodo/Publish";
import * as Share from "Shares";
import * as Metadata from "Metadata";
import Activity from "Activity/Activity";
import Uploader from "Uploader/Uploader";
import { Box } from "ui-components";

// use `const COMPNAME = React.lazy(() => import("${path}"));` when react router is updated
import Projects from "Projects/Projects";
import Search from "SimpleSearch/Search";
import FileInfo from "Files/FileInfo";
import FilePreview from "Files/FilePreview";
import UserCreation from "Admin/UserCreation";
import UserSettings from "UserSettings/UserSettings";
import ZenodoHome from "Zenodo/Zenodo";
import ZenodoInfo from "Zenodo/Info";
import DetailedResult from "Applications/DetailedResult";
import DetailedApplication from "Applications/DetailedApplication";
import Status from "Navigation/StatusPage";

const NotFound = () => (<div><h1>Not found.</h1></div>);

const Core = () => (
    <>
        <Header />
        <Uploader />
        <Sidebar />
        <Box mt="48px" ml="190px" pt="15px" pl="15px" pr="15px">
            <Switch>
                <Route path="/files/*" component={Files} />
                <Route exact path="/dashboard" component={Dashboard} />
                <Route exact path="/" component={Dashboard} />
                <Route exact path="/fileInfo/*" component={FileInfo} />
                <Route exact path="/filepreview/*" component={FilePreview} />
                <Route exact path="/activity/*" component={Activity} />
                <Route exact path="/status" component={Status} />s
                <Route exact path="/applications" component={Applications} />
                <Route exact path="/applications/:appName/:appVersion" component={RunApp} />
                <Route exact path="/appDetails/:appName/:appVersion" component={DetailedApplication} />
                <Route exact path="/analyses" component={Analyses} />
                <Route exact path="/analyses/:jobId" component={DetailedResult} />
                <Route exact path="/zenodo/" component={ZenodoHome} />
                <Route exact path="/zenodo/info/:jobID" component={ZenodoInfo} />
                <Route exact path="/zenodo/publish/" component={ZenodoPublish} />
                <Route exact path="/shares" component={Share.List} />
                <Route exact path="/metadata/edit/*" component={Metadata.CreateUpdate} />
                <Route exact path="/metadata/search/:query?" component={Metadata.Search} />
                <Route exact path="/metadata/*" component={Metadata.ManagedView} />
                <Route exact path="/admin/usercreation" component={UserCreation} />
                <Route exact path="/usersettings/settings" component={UserSettings} />
                <Route exact path="/simpleSearch/:priority/*" component={Search} />
                <Route exact path="/projects" component={Projects} />
                <Route component={NotFound} />
            </Switch>
        </Box>
    </>
);

export default Core;
