import * as fs from 'fs';

const DEFAULT_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

function GetTagString(Tag: string, Content: string) {
    return `<${Tag}>${Content}</${Tag}>`;
}

class SitemapUrl {
    constructor(public Loc: string, public LastMod: Date, public Prio: number) {

    }

    GetString() {
        let Content = "";
        Content += "\n\t";
        for (let Item of [
            ["loc", this.Loc],
            ["priority", this.Prio.toFixed(2)],
            ["lastmod", this.LastMod.toLocaleDateString()]
        ]) {
            Content += GetTagString(Item[0], Item[1]);
            Content += "\n\t";
        }
        Content = Content.trimEnd() + "\n";
        return GetTagString("url", Content);
    }



}

export class SitemapXmlWriter {
    Header = "";
    Urls: SitemapUrl[] = [];

    constructor(public readonly Filepath: string) {
        if (!fs.statSync(Filepath).isFile())
            return;
        this._ParseContent(fs.readFileSync(Filepath));
    }

    AddItem(Loc: string, LastMod: Date, Prio: number) {
        this.Urls.push(new SitemapUrl(Loc, LastMod, Prio));
    }

    _ParseContent(Content: Buffer) {
    }

    Write(bMinimized = false) {
        let Content = DEFAULT_HEADER;
        Content += "\n";

        // Sort urls list by prio
        this.Urls.sort((a, b) => (a.Prio < b.Prio) ? 1 : -1);

        // Add all urls
        this.Urls.forEach(Url => {
            Content += Url.GetString();
            Content += "\n";
        });

        if (bMinimized)
            Content = Content.replace(/\s*/g, "");

        fs.writeFileSync(this.Filepath, Content, { "encoding": "utf8" });
    }

}