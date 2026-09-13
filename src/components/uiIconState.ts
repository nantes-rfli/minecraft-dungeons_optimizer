export const shouldRenderUiIcon = (source: string | undefined, failedSource: string | undefined): source is string => Boolean(source && source !== failedSource)
