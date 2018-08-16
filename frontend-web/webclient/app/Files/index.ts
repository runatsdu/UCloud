import { Page } from "Types";
import { History } from "history";
import { SemanticICONS, SemanticSIZES, ButtonProps, ModalProps, SemanticCOLORS } from "semantic-ui-react";
import { match } from "react-router-dom";

export enum SortOrder {
    ASCENDING = "ASCENDING",
    DESCENDING = "DESCENDING"
}

export type FileType = "FILE" | "DIRECTORY";
export interface File {
    type: FileType
    path: string
    createdAt: number
    modifiedAt: number
    ownerName: string
    size: number
    acl: Array<Acl>
    favorited: boolean
    sensitivityLevel: string
    isChecked?: boolean
    beingRenamed?: boolean
    link: boolean
    annotations: string[]
}

export interface Acl {
    entity: Entity
    right: string
}

export interface Entity {
    type: string
    name: string
    displayName: string
    zone: string
}

export enum SortBy {
    TYPE = "TYPE",
    PATH = "PATH",
    CREATED_AT = "CREATED_AT",
    MODIFIED_AT = "MODIFIED_AT",
    SIZE = "SIZE",
    ACL = "ACL",
    FAVORITED = "FAVORITED",
    SENSITIVITY = "SENSITIVITY",
    ANNOTATION = "ANNOTATION"
}

export interface FilesProps extends FilesStateProps, FilesOperations {
    match: match<string[]>
    history: History
}

export interface MockedTableProps {
    onCreateFolder: (a, c) => void
    creatingFolder: boolean
}

export interface FilesStateProps { // Redux Props
    path: string
    page: Page<File>
    loading: boolean
    fileSelectorShown: boolean
    fileSelectorLoading: boolean
    disallowedPaths: string[]
    fileSelectorCallback: Function
    fileSelectorPath: string
    fileSelectorPage: Page<File>
    sortBy: SortBy
    sortOrder: SortOrder
    creatingFolder: boolean
    error: string
    fileSelectorError: string
    checkedFilesCount: number
    favFilesCount: number
    renamingCount: number
    leftSortingColumn: SortBy
    rightSortingColumn: SortBy
}

export interface FilesOperations { // Redux operations
    prioritizeFileSearch: () => void
    onFileSelectorErrorDismiss: () => void
    dismissError: () => void
    fetchFiles: (path: string, itemsPerPage: number, pageNumber: number, sortOrder: SortOrder, sortBy: SortBy, sortingColumns: [SortBy, SortBy]) => void
    fetchPageFromPath: (path: string, itemsPerPage: number, sortOrder: SortOrder, sortBy: SortBy) => void;
    fetchSelectorFiles: (path: string, pageNumber: number, itemsPerPage: number) => void
    setFileSelectorCallback: (callback: Function) => void
    checkFile: (checked: boolean, page: Page<File>, newFile: File) => void
    setPageTitle: () => void
    updateFiles: (files: Page<File>) => void
    updatePath: (path: string) => void
    showFileSelector: (open: boolean) => void
    setDisallowedPaths: (disallowedPaths: string[]) => void
    setCreatingFolder: (creating: boolean) => void
}

export interface FileSelectorProps {
    allowUpload?: boolean
    onFileSelect: Function
    uppy?: any
    path: string
    isRequired: boolean
    canSelectFolders?: boolean
    onlyAllowFolders?: boolean
    remove?: Function
}

export interface FileSelectorState {
    promises: any
    path: string
    loading: boolean
    page: Page<File>
    modalShown: boolean
    breadcrumbs: { path: string, actualPath: string }[]
    uppyOnUploadSuccess: Function
    creatingFolder: boolean
}

export interface FilesTableProps {
    sortOrder?: SortOrder
    onDropdownSelect?: (sO: SortOrder, s: SortBy, a: [SortBy, SortBy]) => void
    sortingColumns?: [SortBy, SortBy]
    files: File[]
    masterCheckbox?: React.ReactNode
    sortingIcon: (name: string) => SemanticICONS
    sortFiles: (sortBy: SortBy) => void
    onRenameFile?: (key: number, file: File, name: string) => void
    onCreateFolder?: (key: number, name: string) => void
    onCheckFile: (c: boolean, f: File) => void
    refetchFiles: () => void
    creatingNewFolder: boolean
    onFavoriteFile: (f: File[]) => void
    fileOperations: FileOperation[]
}

export interface CreateFolderProps {
    creatingNewFolder: boolean
    onCreateFolder: (key: number, name: string) => void
}

export interface FilesTableHeaderProps {
    sortingIcon?: (s: SortBy) => SemanticICONS
    sortFiles?: (s: SortBy) => void
    sortOrder: SortOrder
    masterCheckbox?: React.ReactNode
    sortingColumns?: [SortBy, SortBy]
    onDropdownSelect?: (sO: SortOrder, s: SortBy, a: [SortBy, SortBy]) => void
}

export interface FilenameAndIconsProps {
    file: File
    hasCheckbox: boolean
    size?: SemanticSIZES
    onRenameFile: (key: number, file: File, name: string) => void
    onCheckFile: (c: boolean, f: File) => void
    onFavoriteFile: (files: File[]) => void
}

export interface FileSelectorModalProps {
    show: boolean
    loading: boolean
    path: string
    onHide: (event: React.MouseEvent<HTMLButtonElement | HTMLElement>, data: ButtonProps | ModalProps) => void
    page: Page<File>
    setSelectedFile: Function
    fetchFiles: (path: string, pageNumber: number, itemsPerPage: number) => void
    disallowedPaths?: string[]
    onlyAllowFolders?: boolean
    canSelectFolders?: boolean
    creatingFolder?: boolean
    handleKeyDown?: Function
    createFolder?: Function
    errorMessage?: string
    onErrorDismiss?: () => void
    navigate?: (path, pageNumber, itemsPerPage) => void
}

export interface FileSelectorBodyProps {
    disallowedPaths?: string[]
    onlyAllowFolders?: boolean
    creatingFolder?: boolean
    canSelectFolders?: boolean
    page: Page<File>
    fetchFiles: (path: string) => void
    handleKeyDown?: Function
    setSelectedFile: Function
    createFolder?: Function
    path: string
}

export interface FileListProps {
    files: File[]
    setSelectedFile, fetchFiles: Function
    canSelectFolders: boolean
}

export interface MoveCopyOperations {
    showFileSelector: (show: boolean) => void
    setDisallowedPaths: (paths: string[]) => void
    setFileSelectorCallback: (callback: Function) => void
    fetchPageFromPath: (path: string) => void
}

export interface FileOptionsProps {
    files: File[]
    fileOperations: FileOperation[]
}

export interface SortByDropdownProps {
    currentSelection: SortBy
    sortOrder: SortOrder
    onSelect: (sortorder: SortOrder, s: SortBy) => void
}

export interface MobileButtonsProps {
    file: File
    fileOperations: FileOperation[]
}

export type PredicatedOperation = { predicate: (f: File[]) => boolean, onTrue: Operation, onFalse: Operation }
export type Operation = { text: string, onClick: (f: File[]) => void, disabled: (files: File[]) => boolean, icon: SemanticICONS, color: SemanticCOLORS }
export type FileOperation = (Operation | PredicatedOperation)

export interface ContextButtonsProps {
    currentPath: string
    createFolder: () => void
    refetch: () => void
}


export interface DetailedFileSearchProps {

}

export type Annotation = "Project";

export type SensitivityLevel = "Open Access" | "Confidential" | "Sensitive";

export interface DetailedFileSearchState {
    allowFolders: boolean
    allowFiles: boolean
    filename: string
    extensions: string[]
    extensionValue: string
    tags: string[]
    tagValue: string,
    sensitivities: SensitivityLevel[],
    annotations: Annotation[]
    createdBefore: TimeAndDate
    createdAfter: TimeAndDate
    modifiedBefore: TimeAndDate
    modifiedAfter: TimeAndDate
}

type TimeAndDate = { date?: string, time?: string }