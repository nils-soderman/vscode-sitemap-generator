import * as fs from 'fs';

const DEFAULT_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

function GetTagString(Tag: string, Content: string) {
    return `<${Tag}>${Content}</${Tag}>`;
}


class SitemapUrl {
    constructor(public Loc: string, public LastMod?: Date, public Prio?: number) {

    }

    GetString() {
        let Content = "";
        Content += "\n\t";
        for (let Item of [
            ["loc", this.Loc],
            ["priority", this.Prio?.toFixed(2)],
            ["lastmod", this.LastMod?.toLocaleDateString()]
        ]) {
            if (Item[0] === undefined || Item[1] === undefined)
                continue;
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

    constructor(public readonly Filepath: string, bParseCurrentContent = true) {
        if (bParseCurrentContent) {
            if (!fs.statSync(Filepath).isFile())
                return;
            this._ParseContent(fs.readFileSync(Filepath).toString());
        }
    }

    AddItem(Loc: string, LastMod?: Date, Prio?: number) {
        this.Urls.push(new SitemapUrl(Loc, LastMod, Prio));
    }

    RemoveItem(Loc: string) {
        this.Urls = this.Urls.filter(x => x.Loc !== Loc);
    }

    GetItem(Loc: string) {
        const Index = this.Urls.findIndex((x => x.Loc === Loc));
        return this.Urls[Index];
    }

    _ParseContent(Content: string) {
        const RawData = Content.match(/(?<=<url>)(.|\n)*?(?=<\/url>)/g);
        if (!RawData)
            return;

        const LocRegexp = new RegExp("(?<=<loc>)(.|\n)*?(?=</loc>)", "g");
        const PrioRegexp = new RegExp("(?<=<priority>)(.|\n)*?(?=</priority>)", "g");
        const LastModRegexp = new RegExp("(?<=<lastmod>)(.|\n)*?(?=</lastmod>)", "g");
        RawData.forEach(UrlItemRawData => {
            const Url = UrlItemRawData.match(LocRegexp);
            if (!Url)
                return;
            let Prio = UrlItemRawData.match(PrioRegexp);
            const PrioNumber = (Prio) ? Number(Prio[0]) : undefined;

            let LastMod = UrlItemRawData.match(LastModRegexp);
            const LastModDate = (LastMod) ? new Date(LastMod[0]) : undefined;

            this.AddItem(Url[0], LastModDate, PrioNumber);
        });
    }

    Write(bMinimized = false) {
        let Content = DEFAULT_HEADER;
        Content += "\n";

        // Sort urls list by prio
        this.Urls.sort((a, b) => ((a.Prio ? a.Prio : 0) < (b.Prio ? b.Prio : 0)) ? 1 : -1);

        // Add all urls
        this.Urls.forEach(Url => {
            Content += Url.GetString();
            Content += "\n";
        });

        if (bMinimized)
            Content = Content.replace(/\s*/g, "");

        fs.writeFileSync(this.Filepath, Content, { "encoding": "utf8" });
    }

    GetCurrentMaxDepth() {
        let MaxDepth = -1;
        const FwdSlashRegexp = new RegExp("/", "g");
        this.Urls.forEach(Url => {
            const Depth = (Url.Loc.slice(0, -1).match(FwdSlashRegexp) || [0, 0]).length - 2;
            if (Depth > MaxDepth)
                MaxDepth = Depth;
        });
        return MaxDepth;
    }

}