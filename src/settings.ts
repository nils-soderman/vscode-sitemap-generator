import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const SETTINGS_FILENAME = "sitemap-generator.json";

export interface SitemapSettings {
    Protocol?: "http" | "https"
    DomainName?: string,
    Root?: string,
    IncludeExt?: string[],
    Exclude?: string[],
    bIncludeWWW?: boolean,
    bRemoveFileExtentions?: boolean,
    bAutomaticallyUpdateSitemap?: boolean,
    bUseTrailingSlash?: boolean,
    bMinimized?: boolean
}


export const DEFAULT_SETTINGS: SitemapSettings = {
    Protocol: "http",
    DomainName: "example.com",
    Root: "./",
    IncludeExt: [".html", ".php"],
    Exclude: [],
    bIncludeWWW: true,
    bRemoveFileExtentions: false,
    bUseTrailingSlash: false,
    bAutomaticallyUpdateSitemap: true,
    bMinimized: false
};


export function IsSettingsFile(Filepath: string) {
    return Filepath.endsWith(path.join(".vscode", SETTINGS_FILENAME));
}


export function GetSettingsFilepath(bEnsureFileExists = false) {
    let Filepath = "";
    if (vscode.workspace.workspaceFolders)
        Filepath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, ".vscode", SETTINGS_FILENAME);
    else {
        vscode.window.showErrorMessage("No workspace open! :(");
        return "";
    }
    // TODO: this could probably be removed.
    if (bEnsureFileExists && !fs.existsSync(Filepath))
        fs.writeFileSync(Filepath, "{}");

    return Filepath;
}


export function ReadSettings() {
    const Filepath = GetSettingsFilepath();
    if (!fs.existsSync(Filepath))
        return {};
    return JSON.parse(fs.readFileSync(Filepath, "utf8"));
}


function WriteSettings(Data: any) {
    const Filepath = GetSettingsFilepath();
    fs.writeFileSync(Filepath, JSON.stringify(Data, undefined, 2));
}


export function GetSitemaps() {
    return Object.keys(ReadSettings());
}


/**
 * 
 * @param Sitemap 
 * @returns 
 */
export function GetSitemapSettings(Sitemap: string, CachedSettings?:any): SitemapSettings {
    const Data = (CachedSettings) ? CachedSettings : ReadSettings();
    if (!Data[Sitemap]) {
        WriteDefaultSitemapSettings(Sitemap);
        return DEFAULT_SETTINGS;
    }

    // Get default values if a value is undefined
    Object.entries(DEFAULT_SETTINGS).forEach(Entry => {
        if (Data[Sitemap][Entry[0]] === undefined) {
            Data[Sitemap][Entry[0]] = Entry[1];
        }
    });

    if (Data[Sitemap].Root.startsWith("."))
        Data[Sitemap].Root = Data[Sitemap].Root.substr(1);
    if (Data[Sitemap].Root?.startsWith("/"))
        Data[Sitemap].Root = Data[Sitemap].Root.substr(1);

    return Data[Sitemap];
}


export function SetSitemapSetting(Sitemap: string, Settings: SitemapSettings): SitemapSettings {
    const Data = ReadSettings();
    if (!Data[Sitemap])
        Data[Sitemap] = DEFAULT_SETTINGS;
    Object.assign(Data[Sitemap], Settings);
    WriteSettings(Data);
    return Data;
}


async function WriteDefaultSitemapSettings(Sitemap: string) {
    const Data = ReadSettings();
    Data[Sitemap] = DEFAULT_SETTINGS;
    WriteSettings(Data);
}