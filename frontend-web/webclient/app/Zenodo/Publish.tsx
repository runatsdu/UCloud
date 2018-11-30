import * as React from "react";
import FileSelector from "Files/FileSelector";
import { Cloud } from "Authentication/SDUCloudObject";
import { NotConnectedToZenodo } from "Utilities/ZenodoPublishingUtilities";
import { DefaultLoading } from "LoadingIcon/LoadingIcon";
import { updatePageTitle } from "Navigation/Redux/StatusActions";
import { setZenodoLoading, setErrorMessage } from "./Redux/ZenodoActions";
import { connect } from "react-redux";
import { History } from "history";
import { removeEntry } from "Utilities/CollectionUtilities";
import { failureNotification } from "UtilityFunctions";
import { getFilenameFromPath } from "Utilities/FileUtilities";
import { File } from "Files";
import { SET_ZENODO_ERROR } from "Zenodo/Redux/ZenodoReducer";
import { Dispatch } from "redux";
import { Button, Error, Input, Label, Flex, LoadingButton, Box, Link } from "ui-components";
import * as Heading from "ui-components/Heading";
import { MainContainer } from "MainContainer/MainContainer";

interface ZenodoPublishState {
    files: string[]
    name: string
    requestSent: boolean
}

interface ZenodoPublishProps {
    loading: boolean
    connected: boolean
    history: History
    error?: string
}

interface ZenodoPublishOperations {
    updatePageTitle: () => void
    setLoading: (loading: boolean) => void
    setErrorMessage: (error?: string) => void
}

class ZenodoPublish extends React.Component<ZenodoPublishProps & ZenodoPublishOperations, ZenodoPublishState> {
    constructor(props) {
        super(props);
        this.state = {
            files: [""],
            name: "",
            requestSent: false,
        };
        props.updatePageTitle();
    }

    componentWillUnmount = () => this.props.setErrorMessage();

    submit = e => {
        e.preventDefault();
        const filePaths = this.state.files.filter(filePath => filePath);
        Cloud.post("/zenodo/publish/", { filePaths, name: this.state.name }).then((res) => {
            this.props.history.push(`/zenodo/info/${res.response.publicationId}`);
            this.setState(() => ({ requestSent: true }));
        }).catch(_ => this.props.setErrorMessage("An error occurred publishing. Please try again later."));

    }

    removeFile = (index: number) => {
        const { files } = this.state;
        const remainderFiles = removeEntry<string>(files, index);
        this.setState(() => ({ files: remainderFiles }));
    }

    handleFileSelection = (file: File, index: number) => {
        const files = this.state.files.slice();
        if (files.some(f => getFilenameFromPath(f) === getFilenameFromPath(file.path))) {
            failureNotification("Zenodo does not allow duplicate filenames. Please rename either file and try again.", 8);
            return;
        }
        files[index] = file.path;
        this.setState(() => ({ files }));
    }

    newFile() {
        const files = this.state.files.slice();
        files.push("");
        this.setState(() => ({ files }));
    }

    render() {
        const { name } = this.state;
        if (this.props.loading) {
            return (<DefaultLoading className="" size={undefined} loading={true} />);
        } else if (!this.props.connected) {
            return (<NotConnectedToZenodo />);
        }


        const header = (
            <>
                <Heading.h3>
                    File Selection
                </Heading.h3>
                <Error error={this.props.error} clearError={() => this.props.setErrorMessage(undefined)} />
            </>)

        const main = (
            <form onSubmit={(e) => this.submit(e)}>
                <FileSelections
                    handleFileSelection={this.handleFileSelection}
                    files={this.state.files}
                    removeFile={this.removeFile}
                />
                <Label>Publication Name
                    <Input
                        required={true}
                        value={name}
                        type="text"
                        onChange={({ target: { value } }) => this.setState(() => ({ name: value }))}
                    />
                </Label>
                <Flex mt="0.5em">
                    <Button
                        color="green"
                        type="button"
                        onClick={() => this.newFile()}
                    >Add file</Button>
                    <Box ml="auto" />
                    <LoadingButton
                        disabled={!name || this.state.files.filter(p => p).length === 0}
                        color="blue"
                        type="submit"
                        loading={this.state.requestSent}
                        content="Upload files"
                        onClick={this.submit}
                    />
                </Flex>
            </form>);

        const sidebar = (<Link to="/zenodo/"><Button fullWidth color="green">Publications</Button></Link>)

        return (
            <MainContainer
                header={header}
                main={main}
                sidebar={sidebar}
            />)
    }
}

const FileSelections = ({ files, handleFileSelection, removeFile }: { files: string[], handleFileSelection: Function, removeFile: Function }) => (
    <>
        {files.map((file, index) =>
            (<FileSelector
                key={index}
                isRequired={files.length === 1}
                path={file}
                onFileSelect={(chosenFile: File) => handleFileSelection(chosenFile, index)}
                allowUpload={false}
                remove={files.length > 1 ? () => removeFile(index) : undefined}
            />))}
    </>
);

const mapStateToProps = ({ zenodo }) => zenodo;
const mapDispatchToProps = (dispatch: Dispatch): ZenodoPublishOperations => ({
    updatePageTitle: () => dispatch(updatePageTitle("Zenodo Publish")),
    setErrorMessage: (error?: string) => dispatch(setErrorMessage(SET_ZENODO_ERROR, error)),
    setLoading: (loading: boolean) => dispatch(setZenodoLoading(loading))
})
export default connect(mapStateToProps, mapDispatchToProps)(ZenodoPublish);