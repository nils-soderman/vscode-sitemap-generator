import * as fs from 'fs';

type ChangeFreqencyTypes = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

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

        // Add all tags
        for (let Item of [
            ["loc", this.Url],
            ["priority", this.Prio?.toFixed(2)],
            ["changefreq", this.ChangeFreq],
            ["lastmod", this.LastMod?.toLocaleDateString()]
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
        "xmlns": ["http://www.sitemaps.org/schemas/sitemap/0.9"]
    };
    Urls: SitemapUrl[] = [];

    /**
     * @param Filepath Absolute filepath to the sitemap
     * @param bParseSitemap Should current sitemap be parsed, won't be needed if e.g. it's about to be fully re-generated / overwritten
     */
    constructor(public readonly Filepath: string, bParseSitemap = true) {
        if (bParseSitemap) {
            if (!fs.statSync(Filepath).isFile())
                return;
            this._ParseContent(fs.readFileSync(Filepath).toString());
        }
    }

    /**
     * Parse the xml file content and populate the Urls list
     * @param Content file content
     */
    private _ParseContent(Content: string) {
        // Get all of the <url> tags

        // Find out xml version & encoding
        const WantedVersion = Content.match(/(?<=\?xml\s*version=")(.|\n)*?(?=")/);
        this.XMLVersion = WantedVersion ? WantedVersion[0] : this.XMLVersion;

        const WantedEncoding = Content.match(/(?<=encoding=")(.|\n)*?(?=")/);
        this.XMLEncoding = WantedEncoding ? WantedEncoding[0] : this.XMLEncoding;

        //const WantedEncoding = Content.match(/(?<=\<urlset")(.|\n)*?(?=\>)/);
        //this.XMLEncoding = WantedEncoding ? WantedEncoding[0] : this.XMLEncoding;


        const RawData = Content.match(/(?<=<url>)(.|\n)*?(?=<\/url>)/g);
        if (!RawData)
            return;

        // Avoid re-compiling the regex pattern for every loop by first creating regex variables 
        const LocRegexp = new RegExp("(?<=<loc>)(.|\n)*?(?=</loc>)", "g");
        const PrioRegexp = new RegExp("(?<=<priority>)(.|\n)*?(?=</priority>)", "g");
        const LastModRegexp = new RegExp("(?<=<lastmod>)(.|\n)*?(?=</lastmod>)", "g");
        const ChangefreqRegexp = new RegExp("(?<=<changefreq>)(.|\n)*?(?=</changefreq>)", "g");

        // Loop through each <url>, extract all of the data and add it as an item to the Urls list
        RawData.forEach(UrlItemRawData => {
            const Url = UrlItemRawData.match(LocRegexp);
            if (!Url)
                return;

            let Prio = UrlItemRawData.match(PrioRegexp);
            const PrioNumber = (Prio) ? Number(Prio[0]) : undefined;

            let LastMod = UrlItemRawData.match(LastModRegexp);
            const LastModDate = (LastMod) ? new Date(LastMod[0]) : undefined;

            let ChangeFreqRaw = UrlItemRawData.match(ChangefreqRegexp);
            const ChangeFreq = (ChangeFreqRaw) ? <ChangeFreqencyTypes>ChangeFreqRaw[0] : undefined;

            this.AddItem(Url[0], LastModDate, PrioNumber, ChangeFreq);
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
            UrlsetContentString += `${Property}=`;
            this.UrlsetProperties[Property].forEach((Url: string) => {
                UrlsetContentString += `"${Url}"`;
            });
        }
        Content += `\n<urlset ${UrlsetContentString}>\n`;

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