import { ActionAddModnote } from "./ActionAddModnote.js";
import { ActionBan } from "./ActionBan.js";
import { ActionRemove } from "./ActionRemove.js";
import { ActionReply } from "./ActionReply.js";
import { ActionReport } from "./ActionReport.js";
import { ActionSendModmail } from "./ActionSendModmail.js";
import { ActionWebhookNotification } from "./ActionWebhookNotification.js";

export const ALL_ACTIONS = [
    ActionBan,
    ActionReport,
    ActionRemove,
    ActionSendModmail,
    ActionReply,
    ActionAddModnote,
    ActionWebhookNotification,
];
