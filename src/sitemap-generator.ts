import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import * as settings from './settings';
import { XmlWriter } from "./xmlWriter";

interface SitemapFileData {
    Url:string,
    LastMod:string,
    Depth:number
}

export function GetWorkspaceFolder() {
    if (!vscode.workspace.workspaceFolders)
        return "";
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
}

function GetSitemapData(Settings: settings.SitemapSettings) {
    let MaxDepth = -1;
    let FilesData:SitemapFileData[] = [];
    const NumberOfSlashesRE = new RegExp("\\" + path.sep, "g");
    if (Settings.Root === undefined)
        return {Files: FilesData, MaxDepth: MaxDepth};

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

                // If file is not under a subfolder, add it to the beginning of the array
                const RelativeFilepath = path.relative(AbsRootDir, Filepath);
                const Depth = (RelativeFilepath.match(NumberOfSlashesRE)||[]).length;
                if (Depth > MaxDepth)
                    MaxDepth = Depth;
                
                
                const Data:SitemapFileData = {
                    Url: GetWebUrlFromFilepath(Settings, Filepath),
                    LastMod: fs.statSync(Filepath).mtime.toLocaleDateString(),
                    Depth: Depth
                };

                if (!Depth)
                    return FilesData.unshift(Data);
                return FilesData.push(Data);
            }
        });
    }

    _GetFilesRecursivly(AbsRootDir);
    
    return {Files: FilesData, MaxDepth: MaxDepth};
}

function GetWebUrlFromFilepath(SitemapSettings: settings.SitemapSettings, Filepath: string) {
    if (SitemapSettings.Root === undefined)
        return "";
    let AbsRootPath = path.join(GetWorkspaceFolder(), SitemapSettings.Root);
    Filepath = Filepath.replace(AbsRootPath, "").substr(1);

    const FileBaseName = path.basename(Filepath, path.extname(Filepath));
    if (SitemapSettings.bRemoveFileExtentions)
        Filepath = path.join(path.dirname(Filepath), FileBaseName);

    if (FileBaseName.toLowerCase() === "index") {
        Filepath = path.dirname(Filepath);
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

export function GenerateSiteMap(Sitemap: string) {
    const SitemapSettings = settings.GetSitemapSettings(Sitemap);
    const AbsoluteSitemapPath = path.join(GetWorkspaceFolder(), Sitemap);

    const SitemapData = GetSitemapData(SitemapSettings);

    const SitemapWriter = new XmlWriter(AbsoluteSitemapPath);

    SitemapData.Files.forEach(FileData => {
        const Depth = 1 - (FileData.Depth / (SitemapData.MaxDepth + 1));
        AddSitemapEntry(SitemapWriter, FileData.Url, FileData.LastMod, Depth);
    });

    SitemapWriter.WriteFile();

    return AbsoluteSitemapPath;

}

function AddSitemapEntry(SitemapWriter: XmlWriter, Loc: string, Lastmod: string, Priority: number) {
    SitemapWriter.OpenTag("url");

    SitemapWriter.OpenTag("loc");
    SitemapWriter.WriteContent(Loc);
    SitemapWriter.CloseTag();

    SitemapWriter.OpenTag("lastmod");
    SitemapWriter.WriteContent(Lastmod);
    SitemapWriter.CloseTag();

    SitemapWriter.OpenTag("priority");
    SitemapWriter.WriteContent(Priority.toString());
    SitemapWriter.CloseTag();

    SitemapWriter.CloseTag();
}