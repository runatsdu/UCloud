import React from "react";
import {Cloud} from "../../authentication/SDUCloudObject";
import {getParentPath, updateSharingOfFile, shareFile, favorite, fileSizeToString} from "../UtilityFunctions";
import SectionContainerCard from "./SectionContainerCard";
import {BallPulseLoading} from "./LoadingIcon";
import {SensitivityLevel, RightsNameMap} from "../DefaultObjects"
import {ListGroup, ListGroupItem, Jumbotron, Button, ButtonGroup} from "react-bootstrap";
import swal from "sweetalert2";
import pubsub from "pubsub-js";
import PromiseKeeper from "../PromiseKeeper";

class FileInfo extends React.Component {
    constructor(props) {
        super(props);
        const filePath = props.match.params[0];
        let path;
        if (filePath.endsWith("/")) {
            path = filePath.slice(0, filePath.length - 1)
        } else {
            path = filePath;
        }
        this.state = {
            promises: new PromiseKeeper(),
            filePath: path,
            file: null,
            loading: false,
        };
        this.getFile = this.getFile.bind(this);
        this.revokeRights = this.revokeRights.bind(this);
        this.removeAcl = this.removeAcl.bind(this);
        this.favoriteFile = this.favoriteFile.bind(this);
    }

    componentWillMount() {
        pubsub.publish('setPageTitle', "File Info");
        this.getFile();
    }

    componentWillUnmount() {
        this.state.promises.cancelPromises();
    }

    getFile() {
        this.setState({
            loading: true,
        });
        let path = getParentPath(this.state.filePath);
        this.state.promises.makeCancelable(Cloud.get(`files?path=${path}`)).promise.then(res => {
            let file = res.response.find(file => file.path.path === this.state.filePath); // FIXME massive overhead for single file
            this.setState(() => ({
                file: file,
                loading: false,
            }));
        });
    }

    revokeRights(file, acl) {
        swal({
            title: "Revoke access",
            text: `Revoke ${RightsNameMap[acl.right]} access for ${acl.entity.displayName}.`,
            showCancelButton: true,
            showCloseButton: true,
        }).then(input => {
            if (input.dismiss) {
                return;
            }
            const body = {
                onFile: file.path.path,
                entity: acl.entity.displayName,
                type: "revoke",
            };

            Cloud.delete("/acl", body).then(res => {
                this.removeAcl(acl);
                swal("Success!", `Rights have been revoked`, "success");
            }).catch((failure) => {
                swal("Error", `An error occurred revoking the rights. Please try again later`, "error");
            });
        });
    }

    removeAcl(toRemoveAcl) {
        const file = Object.assign({}, this.state.file);
        let index = file.acl.findIndex(acl => acl.name === toRemoveAcl.entity.name);
        file.acl.splice(index, 1);
        // TODO: rewrite as functional.
        // TODO: E.g. file. file.acl = file.acl.slice(0, index).concat(file.acl.slice(index + 1))
        this.setState(() => ({
            file: file,
        }));
    }

    favoriteFile() {
        this.setState(() => ({
            file: favorite([this.state.file], this.state.file.path.path, Cloud)[0],
        }));
    }

    render() {
        let button = (<div/>);
        if (this.state.file) {
            const currentRights = this.state.file.acl.find(acl => acl.entity.displayName === Cloud.username);
            if (currentRights) {
                if (currentRights.right === "OWN") {
                    button = (
                        <Button onClick={() => shareFile(this.state.file.path, Cloud)} className="btn btn-primary">Share
                            file</Button>);
                }
            }
        }
        return (
            <SectionContainerCard>
                <BallPulseLoading loading={this.state.loading}/>
                <FileHeader file={this.state.file}/>
                <FileView file={this.state.file} favorite={this.favoriteFile}/>
                <FileSharing file={this.state.file} revokeRights={this.revokeRights}/>
                {button}
            </SectionContainerCard>
        );
    }
}

function FileHeader(props) {
    if (!props.file) {
        return null;
    }
    let type = props.file.type === "DIRECTORY" ? "Directory" : "File";
    return (
        <Jumbotron>
            <h3>{props.file.path.path}</h3>
            <h5>
                <small>{type}</small>
            </h5>
        </Jumbotron>)
}

function FileView(props) {
    if (!props.file) {
        return null;
    }
    const sharedWithCount = props.file.acl.filter(acl => acl.entity.displayName !== Cloud.username).length;
    const currentRights = props.file.acl.find(acl => acl.entity.displayName === Cloud.username);
    if (!currentRights) {
        return (
            <h3 className="text-center">
                <small>You do not have rights for this file.</small>
            </h3>);
    }
    return (
        <div className="container-fluid">
            <ListGroup className="col-sm-4">
                <ListGroupItem>Created at: {new Date(props.file.createdAt).toLocaleString()}</ListGroupItem>
                <ListGroupItem>Modified at: {new Date(props.file.createdAt).toLocaleString()}</ListGroupItem>
                <ListGroupItem>Favorite file: {props.file.favorited ?
                    <em onClick={() => props.favorite()} className="ion-star"/> :
                    <em onClick={() => props.favorite()} className="ion-ios-star-outline"/>}</ListGroupItem>
            </ListGroup>
            <ListGroup className="col-sm-4">
                <ListGroupItem>Sensitivity: {SensitivityLevel[props.file.sensitivityLevel]}</ListGroupItem>
                <ListGroupItem>Size: {fileSizeToString(props.file.size)}</ListGroupItem>
                <ListGroupItem>Shared
                    with {sharedWithCount} {sharedWithCount === 1 ? "person" : "people"}.</ListGroupItem>
            </ListGroup>
            <ListGroup className="col-sm-4">
                <ListGroupItem>Type: {currentRights.entity.type}</ListGroupItem>
                <ListGroupItem>Name: {currentRights.entity.displayName}</ListGroupItem>
                <ListGroupItem>Rights Level: {RightsNameMap[currentRights.right]}</ListGroupItem>
            </ListGroup>
        </div>
    );
}

function FileSharing(props) {
    if (!props.file) {
        return null;
    }
    const currentRights = props.file.acl.find(acl => acl.entity.displayName === Cloud.username);
    if (!currentRights || currentRights.right !== "OWN") {
        return null;
    }
    const sharedWith = props.file.acl.filter(acl => acl.entity.displayName !== Cloud.username);
    if (!sharedWith.length) {
        return (
            <h3 className="text-center">
                <small>This file has not been shared with anyone.</small>
            </h3>);
    }
    let i = 0;
    const sharedWithList = sharedWith.map(acl =>
        <ListGroupItem key={i++}>
            <span
                className="text-left"><b>{acl.entity.displayName}</b> has <b>{RightsNameMap[acl.right]}</b> access.</span>
            <ButtonGroup bsSize="xsmall" className="pull-right">
                <Button onClick={() => updateSharingOfFile(props.file.path, acl.entity.displayName, acl.right, Cloud)}
                        className="btn btn-primary">Change</Button>
                <Button onClick={() => props.revokeRights(props.file, acl)}
                        className="btn btn-danger">Revoke</Button>
            </ButtonGroup>
        </ListGroupItem>
    );
    return (
        <div className="container-fluid">
            <ListGroup className="col-sm-4 col-sm-offset-4">
                {sharedWithList}
            </ListGroup>
        </div>
    );
}

export default FileInfo;