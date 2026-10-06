/** Publishes a change to the streams of the workspace or person it concerns (`WorkspaceEventsPort`). */
export const WORKSPACE_EVENTS = Symbol('WORKSPACE_EVENTS');

/** Subscribes one stream to the changes it may see (`WorkspaceEventFeedPort`). */
export const WORKSPACE_EVENT_FEED = Symbol('WORKSPACE_EVENT_FEED');
