import { Hono } from "hono";
import { createServer, getServerPort } from "@devvit/web/server";
import { getRequestListener } from "@hono/node-server";
import { onCommentCreate, onPostCreate, onModAction, onAppInstallOrUpgrade } from "./triggers";
import { handleValidateDomains, handleSelectFieldHasOptionChosen, handleValidateNumberGreaterThanZero, handleValidateNumberGreaterThanOrEqualToZero, handleStringNoLongerThan100 } from "./validators";
import { handleCleanupDeletedAccountsJob, handleSendDailyDigestJob, handleCheckUserQueueJob } from "./tasks";
import { handleToggleExemptionStatusMenu } from "./menu/toggleExemptionStatus";

const application = new Hono();

// Triggers
application.post("/internal/triggers/comment-create", onCommentCreate);
application.post("/internal/triggers/post-create", onPostCreate);
application.post("/internal/triggers/mod-action", onModAction);
application.post("/internal/triggers/app-install-or-upgrade", onAppInstallOrUpgrade);

// Settings validators
application.post("/internal/validators/domains", handleValidateDomains);
application.post("/internal/validators/select-field-has-option-chosen", handleSelectFieldHasOptionChosen);
application.post("/internal/validators/number-field-positive", handleValidateNumberGreaterThanZero);
application.post("/internal/validators/number-field-gteq-zero", handleValidateNumberGreaterThanOrEqualToZero);
application.post("/internal/validators/string-field-max-length-100", handleStringNoLongerThan100);

// Scheduler jobs
application.post("/internal/tasks/check-user-queue", handleCheckUserQueueJob);
application.post("/internal/tasks/cleanup-deleted-accounts", handleCleanupDeletedAccountsJob);
application.post("/internal/tasks/send-daily-digest", handleSendDailyDigestJob);

// Menus
application.post("/internal/menu/toggle-exemption-status", handleToggleExemptionStatusMenu);

const server = createServer(getRequestListener(application.fetch));
server.on("error", (err) => {
    console.error(`server error; ${err.stack}`);
});

const port = getServerPort();
server.listen(port);
