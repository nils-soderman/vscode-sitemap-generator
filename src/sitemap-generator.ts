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

function GetSitemapData(Settings: settings.SitemapSettings) {
    let MaxDepth = -1;
    let FilesData: SitemapFileData[] = [];
    const PathSlashesRE = new RegExp("\\" + path.sep, "g");
    const FwdSlashRE = new RegExp("/", "g");
    if (Settings.Root === undefined)
        return { Files: FilesData, MaxDepth: MaxDepth };

    let ExcludePatterns: RegExp[] = [];
    Settings.Exclude?.forEach(Pattern => {
        console.log("Pattern: " + Pattern);
        ExcludePatterns.push(new RegExp(Pattern));
    });

    const AbsRootDir = path.join(GetWorkspaceFolder(), Settings.Root);

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
                const Depth = (Url.slice(0, -1).match(FwdSlashRE) || [0, 0]).length - 2;
                if (Depth > MaxDepth)
                    MaxDepth = Depth;

                const Data: SitemapFileData = {
                    Url: Url,
                    LastMod: fs.statSync(Filepath).mtime,
                    Depth: Depth
                };

                if (!Depth) // Remove once prio sorting is in
                    return FilesData.unshift(Data);
                return FilesData.push(Data);
            }
        });
    }

    _GetFilesRecursivly(AbsRootDir);

    return { Files: FilesData, MaxDepth: MaxDepth };
}

function GetWebUrlFromFilepath(SitemapSettings: settings.SitemapSettings, RelativeFilepath: string) {
    const FileBaseName = path.basename(RelativeFilepath, path.extname(RelativeFilepath));
    if (SitemapSettings.bRemoveFileExtentions)
        RelativeFilepath = path.posix.join(path.posix.dirname(RelativeFilepath), FileBaseName);

    if (FileBaseName.toLowerCase() === "index") {
        RelativeFilepath = path.posix.dirname(RelativeFilepath);
        if (RelativeFilepath === ".")
            RelativeFilepath = "";
    }

    if (RelativeFilepath)
        RelativeFilepath = "/" + RelativeFilepath;

    let Url = `${SitemapSettings.Protocol}://`;
    if (SitemapSettings.bIncludeWWW)
        Url += "www.";
    Url += SitemapSettings.DomainName + RelativeFilepath;
    if (SitemapSettings.bUseTrailingSlash && RelativeFilepath)
        Url += "/";

    return Url;
}

export function GenerateSiteMap(Sitemap: string) {
    const SitemapSettings = settings.GetSitemapSettings(Sitemap);
    
    const SitemapData = GetSitemapData(SitemapSettings);
    
    const AbsoluteSitemapPath = path.join(GetWorkspaceFolder(), Sitemap);
    const SitemapWriter = new SitemapXmlWriter(AbsoluteSitemapPath);

    SitemapData.Files.forEach(FileData => {
        const Depth = 1 - (FileData.Depth / (SitemapData.MaxDepth + 1));
        SitemapWriter.AddItem(FileData.Url, FileData.LastMod, Depth);
    });

    SitemapWriter.Write();

    return AbsoluteSitemapPath;

}