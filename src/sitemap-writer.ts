import * as fs from 'fs';
import * as xml2js from 'xml2js';

type ChangeFreqencyTypes = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

function EnsureTwoDigitString(Number: number) {
    let ReturnValue = Number.toString();
    return (ReturnValue.length > 1) ? ReturnValue : "0" + ReturnValue;
}

class SitemapUrl {
    constructor(
        public Url: string,
        public LastMod?: Date,
        public Prio?: number,
        public ChangeFreq?: ChangeFreqencyTypes
    ) { }

    /**
     * @param TabCharacter the character(s) to use as tabs
     * @returns This url group as an xml formatted string
     */
    ToXMLString(TabCharacter = "\t") {
        let Content = "\n";
        let DateString = "";
        
        if (this.LastMod)
            DateString = `${this.LastMod?.getFullYear()}-${EnsureTwoDigitString(this.LastMod.getMonth() + 1)}-${EnsureTwoDigitString(this.LastMod.getDate())}`;

        // Add all tags
        for (let Item of [
            ["loc", this.Url],
            ["priority", this.Prio?.toFixed(2)],
            ["changefreq", this.ChangeFreq],
            ["lastmod", DateString]
        ]) {
            // If a value is undefined, skip adding that tag
            if (Item[1] === undefined)
                continue;

            Content += `${TabCharacter}${TabCharacter}<${Item[0]}>${Item[1]}</${Item[0]}>\n`;
        }

        return `<url>${Content}${TabCharacter}</url>`;
    }

}


export class SitemapXmlWriter {
    XMLVersion = "1.0";
    XMLEncoding = "UTF-8";
    UrlsetProperties: any = {
        "xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9"
    };
    Urls: SitemapUrl[] = [];

    /**
     * @param Filepath Absolute filepath to the sitemap
     */
    constructor(public readonly Filepath: string) {}

    /**
     * Parse the xml file content and populate the Urls list
     * @param Content file content
     */
    async ParseFile() {
        if (!fs.statSync(this.Filepath).isFile())
            return;
        
        const RawFileContent = fs.readFileSync(this.Filepath).toString();
        // Get all of the <url> tags
        
        // Find out xml version & encoding
        const WantedVersion = RawFileContent.match(/(?<=\?xml\s*version=")(.|\n)*?(?=")/);
        this.XMLVersion = WantedVersion ? WantedVersion[0] : this.XMLVersion;

        const WantedEncoding = RawFileContent.match(/(?<=encoding=")(.|\n)*?(?=")/);
        this.XMLEncoding = WantedEncoding ? WantedEncoding[0] : this.XMLEncoding;
        
        const ParsedFileContent = await xml2js.parseStringPromise(RawFileContent);
        if (!ParsedFileContent.urlset)
            return;
        
        this.UrlsetProperties = ParsedFileContent.urlset.$ ? ParsedFileContent.urlset.$ : this.UrlsetProperties;

        if (!ParsedFileContent.urlset.url)
            return;
        ParsedFileContent.urlset.url.forEach((UrlData:any) => {
            const LastModDate = UrlData.lastmod ? new Date(UrlData.lastmod[0]) : undefined;
            const PrioNumber = UrlData.priority ? Number(UrlData.priority[0]) : undefined;
            const ChangeFreq = UrlData.changefreq ? <ChangeFreqencyTypes>UrlData.changefreq[0] : undefined;
            this.AddItem(
                UrlData.loc[0], 
                LastModDate,
                PrioNumber,
                ChangeFreq
                );
        });
    }

    /**
     * Add a new url item to the sitemap
     * @param Url The web url
     * @param LastMod Date when page was last modified
     * @param Prio The priority of the page
     */
    AddItem(Url: string, LastMod?: Date, Prio?: number, ChangeFreq?: ChangeFreqencyTypes) {
        this.Urls.push(new SitemapUrl(Url, LastMod, Prio, ChangeFreq));
    }

    /**
     * Remove an item from the sitemap
     * @param Url The URL of the item to remove
     */
    RemoveItem(Url: string) {
        this.Urls = this.Urls.filter(x => x !== this.GetItem(Url));
    }

    /**
     * Get a url item
     * @param Url The web url of the item
     * @returns pointer to a Url object that can be modified
     */
    GetItem(Url: string) {
        const WantedItemPath = this._GetRelativePathFromUrl(Url);
        const Index = this.Urls.findIndex((x => this._GetRelativePathFromUrl(x.Url) === WantedItemPath));
        return this.Urls[Index];
    }

    private _GetRelativePathFromUrl(Url: string) {
        return Url.substring(Url.indexOf('/', 8) + 1);
    }

    /**
     * @returns The highest depth value any url in the sitemap has
     */
    GetCurrentMaxDepth() {
        let MaxDepth = -1;
        const FwdSlashRegexp = new RegExp("/", "g");

        this.Urls.forEach(Url => {
            const Depth = (Url.Url.slice(0, -1).match(FwdSlashRegexp) || [0, 0]).length - 2;
            if (Depth > MaxDepth)
                MaxDepth = Depth;
        });

        return MaxDepth;
    }

    /**
     * Write the current urls list to the sitemap, if file already exists it will be overwritten.
     * @param bMinimized Minimize the filesize by removing all whitespace
     * @param TabCharacter Character(s) to use as tabs, will default to \t
     */
    Write(bMinimized = false, TabCharacter = "\t") {
        let Content = `<?xml version="${this.XMLVersion}" encoding="${this.XMLEncoding}"?>`;

        let UrlsetContentString = "";
        for (const Property in this.UrlsetProperties) {
            UrlsetContentString += ` ${Property}="${this.UrlsetProperties[Property]}"`;
        }
        Content += `\n<urlset${UrlsetContentString}>\n`;

        // Sort urls list by prio
        this.Urls.sort((a, b) => ((a.Prio ? a.Prio : 0) < (b.Prio ? b.Prio : 0)) ? 1 : -1);

        // Add all urls
        this.Urls.forEach(Url => {
            Content += `${TabCharacter}${Url.ToXMLString(TabCharacter)}\n`;
        });

        Content += "</urlset>";

        // If bMinimized is true, remove all spaces
        if (bMinimized)
            Content = Content.replace(/\s*/g, "");

        fs.writeFileSync(this.Filepath, Content, { "encoding": "utf8" });
    }

}