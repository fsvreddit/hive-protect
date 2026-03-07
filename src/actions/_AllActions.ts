import { ActionAddModnote } from "./ActionAddModnote.js";
import { ActionRemove } from "./ActionRemove.js";
import { ActionReply } from "./ActionReply.js";
import { ActionReport } from "./ActionReport.js";
import { ActionSendModmail } from "./ActionSendModmail.js";
import { ActionWebhookNotification } from "./ActionWebhookNotification.js";

export const ALL_ACTIONS = [
    ActionReport,
    ActionRemove,
    ActionSendModmail,
    ActionReply,
    ActionAddModnote,
    ActionWebhookNotification,
];
