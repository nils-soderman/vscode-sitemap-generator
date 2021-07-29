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
    bUseTrailingSlash?: boolean
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
    bAutomaticallyUpdateSitemap: true
};


/**
 * 
 * @param Sitemap 
 * @returns 
 */
export function GetSitemapSettings(Sitemap: string): SitemapSettings {
    const Filepath = EnsureSettingsFile();
    const Data = JSON.parse(fs.readFileSync(Filepath, "utf8"));
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
    const Filepath = EnsureSettingsFile();
    const Data = JSON.parse(fs.readFileSync(Filepath, "utf8"));
    if (!Data[Sitemap])
        Data[Sitemap] = DEFAULT_SETTINGS;
    Object.assign(Data[Sitemap], Settings);
    fs.writeFileSync(Filepath, JSON.stringify(Data, undefined, 2));
    return Data;
}


async function WriteDefaultSitemapSettings(Sitemap: string) {
    const Filepath = EnsureSettingsFile();
    const Data = JSON.parse(fs.readFileSync(Filepath, "utf8"));
    Data[Sitemap] = DEFAULT_SETTINGS;
    fs.writeFileSync(Filepath, JSON.stringify(Data, undefined, 2));
}

/**
 * Makes sure a .json sitemap settings file exists.
 * @returns Filepath to the settings file.
 */
function EnsureSettingsFile() {
    let Filepath = "";
    if (vscode.workspace.workspaceFolders)
        Filepath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, ".vscode", SETTINGS_FILENAME);
    else {
        vscode.window.showErrorMessage("No workspace open! :(");
        return "";
    }

    if (!fs.existsSync(Filepath))
        fs.writeFileSync(Filepath, "{}");

    return Filepath;
}