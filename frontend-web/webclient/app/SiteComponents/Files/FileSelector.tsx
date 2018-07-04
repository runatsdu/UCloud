import * as React from "react";
import { DefaultLoading } from "../LoadingIcon/LoadingIcon";
import { Modal, Button, List, Input } from "semantic-ui-react";
import { Cloud } from "../../../authentication/SDUCloudObject";
import { BreadCrumbs } from "../Breadcrumbs/Breadcrumbs";
import PropTypes from "prop-types";
import { getFilenameFromPath, getParentPath, isInvalidPathName, inSuccessRange, removeTrailingSlash } from "../../UtilityFunctions";
import * as uf from "../../UtilityFunctions";
import PromiseKeeper from "../../PromiseKeeper";
import { changeUppyRunAppOpen } from "../../Actions/UppyActions";
import { KeyCode } from "../../DefaultObjects";
import { FileIcon } from "../UtilityComponents";
import "./Files.scss";
import "../Styling/Shared.scss";
import { File } from "../../types/types";

interface FileSelectorProps {
    allowUpload?: boolean
    onFileSelect: Function
    uppy?: any
    path: string
    isRequired: boolean
    canSelectFolders?: boolean
    onlyAllowFolders?: boolean
    remove?: Function
}

interface FileSelectorState {
    promises: PromiseKeeper
    currentPath: string
    loading: boolean
    files: File[]
    modalShown: boolean
    breadcrumbs: { path: string, actualPath: string }[]
    uppyOnUploadSuccess: Function
    creatingFolder: boolean
}

class FileSelector extends React.Component<FileSelectorProps, FileSelectorState> {
    constructor(props, context) {
        super(props, context);
        this.state = {
            promises: new PromiseKeeper(),
            currentPath: `${Cloud.homeFolder}`,
            loading: false,
            files: [] as File[],
            modalShown: false,
            breadcrumbs: [],
            uppyOnUploadSuccess: null,
            creatingFolder: false
        };
    }

    static contextTypes = {
        store: PropTypes.object.isRequired
    }

    startCreateNewFolder = () => {
        if (!this.state.creatingFolder) {
            this.setState(() => ({ creatingFolder: true }));
        }
    }

    resetCreateFolder = () => {
        this.setState(() => ({ creatingFolder: false }));
    }

    handleKeyDown = (key, name) => {
        if (key === KeyCode.ESC) {
            this.resetCreateFolder();
        } else if (key === KeyCode.ENTER) {
            const { currentPath, files } = this.state;
            const fileNames = files.map((it) => getFilenameFromPath(it.path));
            if (isInvalidPathName(name, fileNames)) { return }
            const directoryPath = `${currentPath.endsWith("/") ? currentPath + name : currentPath + "/" + name}`;
            Cloud.post("/files/directory", { path: directoryPath }).then(({ request }) => {
                if (inSuccessRange(request.status)) {
                    // TODO Push mock folder
                    this.resetCreateFolder();
                    this.fetchFiles(currentPath);
                }
            }).catch((_) => {
                uf.failureNotification("Folder could not be created.")
                this.resetCreateFolder() // TODO Handle failure
            });
        }
    }

    uppyOnUploadSuccess = (file, resp, uploadURL) => {
        if (!this.props.allowUpload) return;
        // TODO This is a hack.
        let apiIndex = uploadURL.indexOf("/api/");
        if (apiIndex === -1) throw "Did not expect upload URL to not contain /api/";

        let apiEndpoint = uploadURL.substring(apiIndex + 5);

        Cloud.head(apiEndpoint).then(it => {
            console.log("Got a response back!");
            let path = it.request.getResponseHeader("File-Location");
            let lastSlash = path.lastIndexOf("/");
            if (lastSlash === -1) throw "Could not parse name of path: " + path;
            let name = path.substring(lastSlash + 1);
            let fileObject = {
                path: path,
                name: name,
            };
            this.props.onFileSelect(fileObject);
        });
    };

    openModal = (open: boolean): void => {
        this.setState(() => ({ modalShown: open }));
    }

    componentDidMount() {
        this.fetchFiles(Cloud.homeFolder);
    }

    componentWillUnmount() {
        this.state.promises.cancelPromises();
    }

    onUppyClose = (): void => {
        this.props.uppy.off("upload-success", this.state.uppyOnUploadSuccess);
        this.setState(() => ({
            uppyOnUploadSuccess: null,
        }));
    }

    setSelectedFile = (file) => {
        let fileCopy = { path: file.path };
        this.setState(() => ({
            modalShown: false,
            creatingFolder: false
        }));
        this.props.onFileSelect(fileCopy);
    }

    fetchFiles = (path) => {
        this.setState(() => ({ loading: true, creatingFolder: false }));
        // FIXME  Introduce Pagination instead
        this.state.promises.makeCancelable(Cloud.get(`files?path=${path}&page=0&itemsPerPage=100`)).promise.then(req => {
            this.setState(() => ({
                files: uf.sortFilesByTypeAndName(req.response.items, true),
                loading: false,
                currentPath: path
            }));
        });
    }

    render() {
        const onUpload = () => {
            if (!this.props.allowUpload) return;
            this.context.store.dispatch(changeUppyRunAppOpen(true));
            let uppy = this.props.uppy;
            uppy.reset();
            uppy.once("upload-success", this.uppyOnUploadSuccess);
        };
        const path = this.props.path ? this.props.path : "";
        const uploadButton = this.props.allowUpload ? (<UploadButton onClick={onUpload} />) : null;
        const removeButton = this.props.remove ? (<RemoveButton onClick={this.props.remove} />) : null;
        return (
            <React.Fragment>
                <Input
                    className="readonly mobile-padding"
                    required={this.props.isRequired}
                    placeholder={"No file selected"}
                    value={path}
                    action
                >
                    <input />
                    <Button type="button" onClick={() => this.openModal(true)} content="Browse" color="blue" />
                    {uploadButton}
                    {removeButton}
                </Input>
                <FileSelectorModal
                    show={this.state.modalShown}
                    onHide={() => this.openModal(false)}
                    currentPath={this.state.currentPath}
                    navigate={this.fetchFiles}
                    files={this.state.files}
                    loading={this.state.loading}
                    creatingFolder={this.state.creatingFolder}
                    setSelectedFile={this.setSelectedFile}
                    fetchFiles={this.fetchFiles}
                    handleKeyDown={this.handleKeyDown}
                    createFolder={this.startCreateNewFolder}
                    canSelectFolders={this.props.canSelectFolders}
                    onlyAllowFolders={this.props.onlyAllowFolders}
                />
            </React.Fragment>)
    }
}

export const FileSelectorModal = (props) => (
    <Modal open={props.show} onClose={props.onHide} closeOnDimmerClick size="large">
        <Modal.Header>
            File selector
            <Button circular floated="right" icon="cancel" type="button" onClick={props.onHide} />
            <Button icon="redo" loading={props.loading} floated="right" circular onClick={() => props.fetchFiles(props.currentPath)} />
        </Modal.Header>
        <Modal.Content scrolling>
            <BreadCrumbs currentPath={props.currentPath} navigate={props.fetchFiles} />
            <DefaultLoading size="big" loading={props.loading} />
            <FileSelectorBody {...props} />
        </Modal.Content>
    </Modal>
);

const FileSelectorBody = ({ disallowedPaths = [], onlyAllowFolders = false, ...props }) => {
    let f = onlyAllowFolders ? props.files.filter(f => uf.isDirectory(f)) : props.files;
    const files = f.filter((it) => !disallowedPaths.some((d) => d === it.path));
    return (
        <React.Fragment>
            <List divided size="large">
                <List.Header>
                    Filename
                </List.Header>
                <CreatingFolder
                    creatingFolder={props.creatingFolder}
                    handleKeyDown={props.handleKeyDown}
                />
                <ReturnFolder
                    path={props.currentPath}
                    fetchFiles={props.fetchFiles}
                    setSelectedFile={props.setSelectedFile}
                    canSelectFolders={props.canSelectFolders}
                />
                <CurrentFolder
                    currentPath={removeTrailingSlash(props.currentPath)}
                    onlyAllowFolders={onlyAllowFolders}
                    setSelectedFile={props.setSelectedFile}
                />
                <FileList files={files} setSelectedFile={props.setSelectedFile} fetchFiles={props.fetchFiles} canSelectFolders={props.canSelectFolders} />
            </List>
            <CreateFolderButton createFolder={props.createFolder} />
        </React.Fragment>)
};

const CreateFolderButton = ({ createFolder }) =>
    !!createFolder ?
        (<Button onClick={() => createFolder()} className="create-folder-button" content="Create new folder" />) : null;

// FIXME CurrentFolder and Return should share similar traits
const CurrentFolder = ({ currentPath, onlyAllowFolders, setSelectedFile }) =>
    onlyAllowFolders ? (
        <List.Item className="pointer-cursor itemPadding">
            <List.Content floated="right">
                <Button onClick={() => setSelectedFile({ path: currentPath })}>Select</Button>
            </List.Content>
            <List.Icon name="folder" color="blue" />
            <List.Content>
                {`${getFilenameFromPath(uf.replaceHomeFolder(currentPath, Cloud.homeFolder))} (Current folder)`}
            </List.Content>
        </List.Item>
    ) : null;


function ReturnFolder({ path, fetchFiles, setSelectedFile, canSelectFolders }) {
    const parentPath = removeTrailingSlash(getParentPath(path));
    const folderSelection = canSelectFolders ? (
        <List.Content floated="right">
            <Button onClick={() => setSelectedFile({ path: parentPath })}>Select</Button>
        </List.Content>) : null;
    return uf.removeTrailingSlash(path) !== uf.removeTrailingSlash(Cloud.homeFolder) ? (
        <List.Item className="pointer-cursor itemPadding" onClick={() => fetchFiles(parentPath)}>
            {folderSelection}
            <List.Icon name="folder" color="blue" />
            <List.Content content=".." />
        </List.Item>) : null;
}

const CreatingFolder = ({ creatingFolder, handleKeyDown }) => (
    (!creatingFolder) ? null : (
        <List.Item className="itemPadding">
            <List.Content>
                <List.Icon name="folder" color="blue" />
                <Input
                    onKeyDown={(e) => handleKeyDown(e.keyCode, e.target.value)}
                    placeholder="Folder name..."
                    autoFocus
                    transparent
                />
                <Button floated="right" onClick={() => handleKeyDown(KeyCode.ESC)}>✗</Button>
            </List.Content>
        </List.Item>
    )
);

const UploadButton = ({ onClick }) => (<Button type="button" content="Upload File" onClick={() => onClick()} />);
const RemoveButton = ({ onClick }) => (<Button type="button" content="✗" onClick={() => onClick()} />);
const FolderSelection = ({ canSelectFolders, setSelectedFile }) => canSelectFolders ?
    (<Button onClick={setSelectedFile} floated="right" content="Select"/>) : null;

const FileList = ({ files, fetchFiles, setSelectedFile, canSelectFolders }) =>
    !files.length ? null :
        (<React.Fragment>
            {files.map((file, index) =>
                file.type === "FILE" ? (
                    <List.Item
                        key={index}
                        icon={uf.iconFromFilePath(file.path)}
                        content={uf.getFilenameFromPath(file.path)}
                        onClick={() => setSelectedFile(file)}
                        className="itemPadding pointer-cursor"
                    />
                ) : (
                        <List.Item key={index} className="itemPadding pointer-cursor">
                            <List.Content floated="right">
                                <FolderSelection canSelectFolders={canSelectFolders} setSelectedFile={() => setSelectedFile(file)} />
                            </List.Content>
                            <List.Content onClick={() => fetchFiles(file.path)}>
                                <FileIcon size={null} name="folder" link={file.link} color="blue" />
                                {getFilenameFromPath(file.path)}
                            </List.Content>
                        </List.Item>
                    ))}
        </React.Fragment>);

export default FileSelector;