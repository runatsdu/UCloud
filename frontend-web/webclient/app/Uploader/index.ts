import Uploader from "./Uploader";
export { Uploader };
import { Dispatch} from "redux";


export interface Upload {
    file: File
    isUploading: boolean
    progressPercentage: number
    extractArchive: boolean
    uploadXHR?: XMLHttpRequest
}

export interface UploaderState {
}

export interface UploaderProps {
    visible: boolean
    uploads: Upload[]
    allowMultiple?: boolean
    location: string
    onFilesUploaded?: () => void
    dispatch: Dispatch
}
