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
    TagsToInclude?: ("priority"|"lastmod"|"changefreq")[]
    DefaultChangeFrequency?: "always"|"hourly"|"daily"|"weekly"|"monthly"|"yearly"|"never",
    TabCharacters?: string,
    bIncludeWWW?: boolean,
    bRemoveFileExtentions?: boolean,
    bAutomaticallyUpdateSitemap?: boolean,
    bUseTrailingSlash?: boolean,
    bMinimized?: boolean
}

const DEFAULT_SETTINGS: SitemapSettings = {
    Protocol: "http",
    DomainName: "example.com",
    Root: "./",
    IncludeExt: [".html", ".php"],
    Exclude: [],
    TagsToInclude: ["priority", "lastmod"],
    DefaultChangeFrequency: "monthly",
    TabCharacters: "\t",
    bIncludeWWW: true,
    bRemoveFileExtentions: false,
    bUseTrailingSlash: false,
    bAutomaticallyUpdateSitemap: true,
    bMinimized: false
};


/**
 * Check if a file is a sitemap-generator.json settings file.
 * @param Filepath Absolute filepath
 * @returns boolean weither the file is a settings file or not
 */
export function IsSettingsFile(Filepath: string) {
    return Filepath.endsWith(path.join(".vscode", SETTINGS_FILENAME));
}


/**
 * Get the absolute filepath to the settings file
 * @returns Absolute filepath
 */
export function GetSettingsFilepath() {
    if (vscode.workspace.workspaceFolders)
        return path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, ".vscode", SETTINGS_FILENAME);
    return "";
}


/**
 * Parse the json settings file
 * @param FailedToParseValue - Return value if the settings file couldn't be parsed
 * @returns File content as an object
 */
export function ReadSettings(FailedToParseValue = {}) {
    const Filepath = GetSettingsFilepath();
    if (!fs.existsSync(Filepath))
        return FailedToParseValue;
    const FileContent = fs.readFileSync(Filepath, "utf8");
    try {
        return JSON.parse(FileContent);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to parse ${path.basename(Filepath)}. JSON file incorrectly formatted.`);
        return FailedToParseValue;
    }
}


/**
 * Write data into the settings file, this will overwrite the current file
 * @param Data Data to be written into the file
 */
function WriteSettings(Data: any) {
    const Filepath = GetSettingsFilepath();

    // Ensure .vscode folder exists
    if (!fs.existsSync(path.dirname(Filepath)))
        fs.mkdirSync(path.dirname(Filepath));
        
    fs.writeFileSync(Filepath, JSON.stringify(Data, undefined, 2));
}


/**
 * Get settings
 * @param Sitemap Sitemap relative workspace path
 * @param CachedSettings Optional cached settings, if provided it'll skip re-parsing the settings file
 * @returns Settings object
 */
export function GetSitemapSettings(Sitemap: string, CachedSettings?: any): SitemapSettings {
    const Data = (CachedSettings) ? CachedSettings : ReadSettings();
    if (!Data[Sitemap])
        return DEFAULT_SETTINGS;

    // Get the default values if a value is undefined
    Object.entries(DEFAULT_SETTINGS).forEach(Entry => {
        if (Data[Sitemap][Entry[0]] === undefined) {
            Data[Sitemap][Entry[0]] = Entry[1];
        }
    });

    // If root starts with '.', '/' or './', remove that prefix
    if (Data[Sitemap].Root.startsWith("."))
        Data[Sitemap].Root = Data[Sitemap].Root.substr(1);
    if (Data[Sitemap].Root.startsWith("/"))
        Data[Sitemap].Root = Data[Sitemap].Root.substr(1);

    return Data[Sitemap];
}


/**
 * Update a property
 * Example: SetSitemapSetting("Sitemap.xml" {Protocol: "https"});
 * @param Sitemap Sitemap relative workspace path
 * @param Settings new values
 */
export function SetSitemapSetting(Sitemap: string, Settings: SitemapSettings) {
    const Data = ReadSettings();
    if (!Data[Sitemap])
        Data[Sitemap] = DEFAULT_SETTINGS;
    Object.assign(Data[Sitemap], Settings);
    WriteSettings(Data);
}