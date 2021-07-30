import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import * as settings from './settings';
import { SitemapXmlWriter } from "./xmlWriter";

interface SitemapFileData {
    Url: string,
    LastMod: Date,
    Depth: number
}


export function GetWorkspaceFolder() {
    if (!vscode.workspace.workspaceFolders)
        return "";
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
}


function GetUrlDepthValue(Url: string) {
    return (Url.slice(0, -1).match(/\//g) || [0, 0]).length - 2;
}


function GetSitemapData(Settings: settings.SitemapSettings) {
    let MaxDepth = -1;
    let FilesData: SitemapFileData[] = [];
    const PathSlashesRE = new RegExp("\\" + path.sep, "g");
    const FwdSlashRE = new RegExp("/", "g");
    if (Settings.Root === undefined)
        return { Files: FilesData, MaxDepth: MaxDepth };

    let ExcludePatterns: RegExp[] = [];
    Settings.Exclude?.forEach(Pattern => {
        ExcludePatterns.push(new RegExp(Pattern));
    });

    const AbsRootDir = path.posix.join(GetWorkspaceFolder(), Settings.Root);

    function _GetFilesRecursivly(Directory: string) {
        fs.readdirSync(Directory).forEach((File: string) => {
            const Filepath = path.join(Directory, File);
            if (fs.statSync(Filepath).isDirectory())
                return _GetFilesRecursivly(Filepath);
            else {
                const Extention = path.extname(Filepath);
                if (!Settings.IncludeExt?.includes(Extention))
                    return;


                const RelativeFilepath = path.relative(AbsRootDir, Filepath).replace(PathSlashesRE, "/");

                for (const Pattern of ExcludePatterns) {
                    if (RelativeFilepath.search(Pattern) !== -1)
                        return;
                }

                const Url = GetWebUrlFromFilepath(Settings, RelativeFilepath);
                const Depth = GetUrlDepthValue(Url);
                if (Depth > MaxDepth)
                    MaxDepth = Depth;

                return FilesData.push({
                    Url: Url,
                    LastMod: fs.statSync(Filepath).mtime,
                    Depth: Depth
                });
            }
        });
    }

    _GetFilesRecursivly(AbsRootDir);

    return { Files: FilesData, MaxDepth: MaxDepth };
}


function GetWebUrlFromFilepath(SitemapSettings: settings.SitemapSettings, Filepath: string) {
    if (path.isAbsolute(Filepath)) {
        Filepath = path.relative(GetWorkspaceFolder(), Filepath).replace(/\\/g, "/");
    }
    const FileBaseName = path.basename(Filepath, path.extname(Filepath));
    if (SitemapSettings.bRemoveFileExtentions)
        Filepath = path.posix.join(path.posix.dirname(Filepath), FileBaseName);

    if (FileBaseName.toLowerCase() === "index") {
        Filepath = path.posix.dirname(Filepath);
        if (Filepath === ".")
            Filepath = "";
    }

    if (Filepath)
        Filepath = "/" + Filepath;

    let Url = `${SitemapSettings.Protocol}://`;
    if (SitemapSettings.bIncludeWWW)
        Url += "www.";
    Url += SitemapSettings.DomainName + Filepath;
    if (SitemapSettings.bUseTrailingSlash && Filepath)
        Url += "/";

    return Url;
}


function CalculatePrio(UrlDepth: number, MaxDepth: number) {
    return 1 - (UrlDepth / (MaxDepth + 1));
}


export function GenerateSiteMap(Sitemap: string) {
    const SitemapSettings = settings.GetSitemapSettings(Sitemap);

    const SitemapData = GetSitemapData(SitemapSettings);

    const AbsoluteSitemapPath = path.join(GetWorkspaceFolder(), Sitemap);
    const SitemapWriter = new SitemapXmlWriter(AbsoluteSitemapPath, false);

    SitemapData.Files.forEach(FileData => {
        const Depth = CalculatePrio(FileData.Depth, SitemapData.MaxDepth);
        SitemapWriter.AddItem(FileData.Url, FileData.LastMod, Depth);
    });

    SitemapWriter.Write();

    return AbsoluteSitemapPath;

}


// Auto Updater
export function OnFileAdded(Sitemap: string, Filepath: string) {
    const AbsoluteSitemapPath = path.join(GetWorkspaceFolder(), Sitemap);
    const SitemapWriter = new SitemapXmlWriter(AbsoluteSitemapPath, true);
    const SitemapSettings = settings.GetSitemapSettings(Sitemap);
    const Url = GetWebUrlFromFilepath(SitemapSettings, Filepath);
    SitemapWriter.AddItem(
        Url,
        new Date(),
        CalculatePrio(GetUrlDepthValue(Url), SitemapWriter.GetCurrentMaxDepth())
    );
    SitemapWriter.Write();
}


export function OnFileSaved(Sitemap: string, Filepath: string) {
    const AbsoluteSitemapPath = path.join(GetWorkspaceFolder(), Sitemap);
    const SitemapWriter = new SitemapXmlWriter(AbsoluteSitemapPath, true);
    const Url = GetWebUrlFromFilepath(settings.GetSitemapSettings(Sitemap), Filepath);
    const Item = SitemapWriter.GetItem(Url);
    Item.LastMod = new Date(); // Update last modified to today
    SitemapWriter.Write();
}


export function OnFileRemoved(Sitemap: string, Filepath: string) {
    const AbsoluteSitemapPath = path.join(GetWorkspaceFolder(), Sitemap);
    const SitemapWriter = new SitemapXmlWriter(AbsoluteSitemapPath, true);
    const Url = GetWebUrlFromFilepath(settings.GetSitemapSettings(Sitemap), Filepath);
    SitemapWriter.RemoveItem(Url);
    SitemapWriter.Write();
}


export function OnFileRenamed(Sitemap:string, OldFilepath: string, NewFilePath: string) {
    const AbsoluteSitemapPath = path.join(GetWorkspaceFolder(), Sitemap);
    const SitemapSettings = settings.GetSitemapSettings(Sitemap);
    const OldUrl = GetWebUrlFromFilepath(SitemapSettings, OldFilepath);
    const NewUrl = GetWebUrlFromFilepath(SitemapSettings, NewFilePath);
    const SitemapWriter = new SitemapXmlWriter(AbsoluteSitemapPath, true);
    const OldItem = SitemapWriter.GetItem(OldUrl);
    SitemapWriter.AddItem(NewUrl, new Date(), OldItem.Prio);
    SitemapWriter.RemoveItem(OldUrl);
    SitemapWriter.Write();
}