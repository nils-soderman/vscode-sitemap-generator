import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import * as settings from './settings';
import { SitemapXmlWriter } from "./sitemap-writer";

interface SitemapFileData {
    Url: string,
    LastMod: Date,
    Depth: number
}


/**
 * @returns The current vscode workspace folder
 */
export function GetWorkspaceFolder() {
    if (!vscode.workspace.workspaceFolders)
        return "";
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
}


/**
 * @param Url The web url
 * @returns The url's depth value as an number
 */
function GetUrlDepthValue(Url: string) {
    return (Url.slice(0, -1).match(/\//g) || [0, 0]).length - 2;
}


/**
 * Calculate the prio number
 * @param UrlDepth Depth value of the url. Use `GetUrlDepthValue(Url);` to find out.
 * @param MaxDepth The maximum depth of any url in the sitemap
 * @returns A number within the range 0.0 - 1.0
 */
function CalculatePrio(UrlDepth: number, MaxDepth: number) {
    return 1 - (UrlDepth / (MaxDepth + 1));
}


/**
 * Recursivly look throuh all of the directories under the root defined in Settings & collect all of the avaliable urls
 * @param Settings Settings for a sitemap
 * @returns 
 */
function GetSitemapData(Settings: settings.SitemapSettings) {
    let MaxDepth = -1;
    let FilesData: SitemapFileData[] = [];
    const PathSlashesRE = new RegExp("\\" + path.sep, "g");

    // Build regex patterns from the exclude pattens entered in setting
    // TODO: Change these to be glob patterns instead
    let ExcludePatterns: RegExp[] = [];
    Settings.Exclude?.forEach(Pattern => {
        ExcludePatterns.push(new RegExp(Pattern));
    });

    const AbsRootDir = path.posix.join(GetWorkspaceFolder(), Settings.Root ? Settings.Root : "");

    /**
     * Recursivly walk through the given directory and populate the FilesData list
     * @param Directory absolute path to check for files / subdirs
     */
    function _GetSitemapDataRecursivly(Directory: string) {
        fs.readdirSync(Directory).forEach((File: string) => {
            const AbsolutePath = path.join(Directory, File);

            // If AbsolutePath is a directory look through that directory for any files / subdirs
            if (fs.statSync(AbsolutePath).isDirectory())
                return _GetSitemapDataRecursivly(AbsolutePath);

            else {
                // AbsolutePath must be a file

                // Check if we're interested in this filetype
                const Extention = path.extname(AbsolutePath);
                if (!Settings.IncludeExt?.includes(Extention))
                    return;

                // Get the relative filepath to the root & compare it against any exclude patterns
                const RelativeFilepath = path.relative(AbsRootDir, AbsolutePath).replace(PathSlashesRE, "/");
                for (const Pattern of ExcludePatterns) {
                    if (RelativeFilepath.search(Pattern) !== -1)
                        return;
                }

                // Get some data from the filepath & append it to the list that'll later be returned
                const Url = GetWebUrlFromFilepath(Settings, RelativeFilepath);
                const Depth = GetUrlDepthValue(Url);
                if (Depth > MaxDepth)
                    MaxDepth = Depth;

                return FilesData.push({
                    Url: Url,
                    LastMod: fs.statSync(AbsolutePath).mtime,
                    Depth: Depth
                });
            }
        });
    }

    _GetSitemapDataRecursivly(AbsRootDir);

    return { Files: FilesData, MaxDepth: MaxDepth };
}


/**
 * Get a web url from a filepath, based on the settings given
 * @param SitemapSettings Settings for the sitemap
 * @param Filepath can be either absolute or relative (possix) to the sitemap root.
 * @returns a web url
 */
function GetWebUrlFromFilepath(SitemapSettings: settings.SitemapSettings, Filepath: string) {
    // If Filepath is absolute, make it relative to the root
    if (path.isAbsolute(Filepath)) {
        Filepath = path.relative(
            path.join(GetWorkspaceFolder(), SitemapSettings.Root ? SitemapSettings.Root : ""),
            Filepath
        ).replace(/\\/g, "/");
    }

    // Get the filename without any file extention 
    const FileBaseName = path.basename(Filepath, path.extname(Filepath));

    // Check if we should remove the file extention from the url
    if (SitemapSettings.bRemoveFileExtentions)
        Filepath = path.posix.join(path.posix.dirname(Filepath), FileBaseName);

    // If file is named index, remove 'index.<ext>' from the end of the url
    if (FileBaseName.toLowerCase() === "index") {
        Filepath = path.posix.dirname(Filepath);
        if (Filepath === ".")
            Filepath = "";
    }

    // Append a fwd slash as a prefix is filepath isn't empty
    if (Filepath)
        Filepath = "/" + Filepath;

    // Construct the actual url with protocol, domain name etc.
    let Url = `${SitemapSettings.Protocol}://`;
    if (SitemapSettings.bIncludeWWW)
        Url += "www.";
    Url += SitemapSettings.DomainName + Filepath;
    if (SitemapSettings.bUseTrailingSlash && Filepath && !Filepath.includes("."))
        Url += "/";

    return Url;
}


/**
 * Generate a sitemap, if one already exists at the given location it'll be overwritten
 * @param Sitemap relative filepath to the sitemap from the workspace
 * @returns The absolute filepath of the sitemap generated
 */
export function GenerateSiteMap(Sitemap: string) {
    const SitemapSettings = settings.GetSitemapSettings(Sitemap);

    const SitemapData = GetSitemapData(SitemapSettings);

    const AbsoluteSitemapPath = path.join(GetWorkspaceFolder(), Sitemap);
    const SitemapWriter = new SitemapXmlWriter(AbsoluteSitemapPath, false);

    // Add all of the data to the sitemap
    SitemapData.Files.forEach(FileData => {
        SitemapWriter.AddItem(
            FileData.Url,
            FileData.LastMod,
            CalculatePrio(FileData.Depth, SitemapData.MaxDepth)
        );
    });

    SitemapWriter.Write(SitemapSettings.bMinimized, SitemapSettings.TabCharacters);

    return AbsoluteSitemapPath;
}


/* ===============================================
            AUTO-UPDATER functions
   =============================================*/

/**
 * Called when a auto-update is enabled & a new file of interest has been added
 * @param Sitemap Relative filepath to the sitemap from the workspace
 * @param Filepath The absolute filepath to the file that has been added
 */
export function OnFileAdded(Sitemap: string, Filepath: string) {
    const SitemapSettings = settings.GetSitemapSettings(Sitemap);
    const AbsoluteSitemapPath = path.join(GetWorkspaceFolder(), Sitemap);
    const SitemapWriter = new SitemapXmlWriter(AbsoluteSitemapPath, true);
    const Url = GetWebUrlFromFilepath(SitemapSettings, Filepath);

    // Add the item to the sitemap
    SitemapWriter.AddItem(
        Url,
        new Date(),
        CalculatePrio(GetUrlDepthValue(Url), SitemapWriter.GetCurrentMaxDepth())
    );

    SitemapWriter.Write(SitemapSettings.bMinimized, SitemapSettings.TabCharacters);
}


/**
 * Called when a auto-update is enabled & a file of interest has been saved
 * @param Sitemap Relative filepath to the sitemap from the workspace
 * @param Filepath The absolute filepath to the file that has been saved
 */
export function OnFileSaved(Sitemap: string, Filepath: string) {
    const SitemapSettings = settings.GetSitemapSettings(Sitemap);
    const AbsoluteSitemapPath = path.join(GetWorkspaceFolder(), Sitemap);
    const SitemapWriter = new SitemapXmlWriter(AbsoluteSitemapPath, true);
    const Url = GetWebUrlFromFilepath(SitemapSettings, Filepath);
    const Item = SitemapWriter.GetItem(Url);

    // Update last modified to today
    Item.LastMod = new Date();

    SitemapWriter.Write(SitemapSettings.bMinimized, SitemapSettings.TabCharacters);
}


/**
 * Called when a auto-update is enabled & a file of interest has been deleted
 * @param Sitemap Relative filepath to the sitemap from the workspace
 * @param Filepath The absolute filepath to the file that has been deleted
 */
export function OnFileRemoved(Sitemap: string, Filepath: string) {
    const SitemapSettings = settings.GetSitemapSettings(Sitemap);
    const AbsoluteSitemapPath = path.join(GetWorkspaceFolder(), Sitemap);
    const SitemapWriter = new SitemapXmlWriter(AbsoluteSitemapPath, true);
    const Url = GetWebUrlFromFilepath(SitemapSettings, Filepath);

    // Remove the item from the sitemap
    SitemapWriter.RemoveItem(Url);

    SitemapWriter.Write(SitemapSettings.bMinimized, SitemapSettings.TabCharacters);
}


/**
 * Called when a auto-update is enabled & a file of interest has been renamed
 * @param Sitemap Relative filepath to the sitemap from the workspace
 * @param OldFilepath The previous absolute filepath
 * @param NewFilePath The new absolute filepath
 */
export function OnFileRenamed(Sitemap: string, OldFilepath: string, NewFilePath: string) {
    const SitemapSettings = settings.GetSitemapSettings(Sitemap);
    const AbsoluteSitemapPath = path.join(GetWorkspaceFolder(), Sitemap);
    const OldUrl = GetWebUrlFromFilepath(SitemapSettings, OldFilepath);
    const NewUrl = GetWebUrlFromFilepath(SitemapSettings, NewFilePath);
    const SitemapWriter = new SitemapXmlWriter(AbsoluteSitemapPath, true);

    // Get the old sitemap item, to be able to abstract data from it
    const OldItem = SitemapWriter.GetItem(OldUrl);

    // Add the new item and remove the old item
    SitemapWriter.AddItem(NewUrl, new Date(), OldItem.Prio);
    SitemapWriter.RemoveItem(OldUrl);

    SitemapWriter.Write(SitemapSettings.bMinimized, SitemapSettings.TabCharacters);
}