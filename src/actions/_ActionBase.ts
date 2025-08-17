import { Comment, Post, SettingsValues, TriggerContext } from "@devvit/public-api";
import { ProblematicSubsResult } from "../getProblematicItems.js";
import { AppSetting } from "../settings.js";

export abstract class ActionBase {
    protected target: Post | Comment;
    protected problematicItemsResult: ProblematicSubsResult;
    protected settings: SettingsValues;
    protected context: TriggerContext;

    public isModuleEnabled (): boolean {
        if (this.settings[AppSetting.ApplyBanBehavioursToOtherActions] && !this.problematicItemsResult.userBannable) {
            return false;
        }
        return true;
    }

    constructor (target: Post | Comment, problematicItemsResult: ProblematicSubsResult, settings: SettingsValues, context: TriggerContext) {
        this.target = target;
        this.problematicItemsResult = problematicItemsResult;
        this.settings = settings;
        this.context = context;
    }

    public abstract execute (): Promise<void>;
}
