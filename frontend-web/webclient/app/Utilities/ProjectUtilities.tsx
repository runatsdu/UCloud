export const projectViewPage = (filePath: string): string => {
    return `/projects/view?filePath=${encodeURI(filePath)}`;
}

export const projectEditPage = (filePath: string): string => {
    return `/projects/edit?filePath=${encodeURI(filePath)}`;
}