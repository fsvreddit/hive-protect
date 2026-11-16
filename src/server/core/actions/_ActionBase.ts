import { Comment, Post, SettingsValues } from "@devvit/web/server";
import { ProblematicSubsResult } from "../getProblematicItems.js";

export abstract class ActionBase {
    protected target: Post | Comment;
    protected problematicItemsResult: ProblematicSubsResult;
    protected settings: SettingsValues;

    public isModuleEnabled (): boolean {
        if (!this.problematicItemsResult.userActionable) {
            return false;
        }
        return true;
    }

    constructor (target: Post | Comment, problematicItemsResult: ProblematicSubsResult, settings: SettingsValues) {
        this.target = target;
        this.problematicItemsResult = problematicItemsResult;
        this.settings = settings;
    }

    public abstract execute (): Promise<void>;
}
