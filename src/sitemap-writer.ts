import * as fs from 'fs';


class SitemapUrl {
    constructor(
        public Url: string,
        public LastMod?: Date,
        public Prio?: number
    ) { }

    /**
     * @param TabCharacter the character(s) to use as tabs
     * @returns This url group as an xml formatted string
     */
    ToXMLString(TabCharacter = "\t") {
        let Content = `\n${TabCharacter}${TabCharacter}`;

        // Add all tags
        for (let Item of [
            ["loc", this.Url],
            ["priority", this.Prio?.toFixed(2)],
            ["lastmod", this.LastMod?.toLocaleDateString()]
        ]) {
            // If a value is undefined, skip adding that tag
            if (Item[1] === undefined)
                continue;

            Content += `<${Item[0]}>${Item[1]}</${Item[0]}>\n${TabCharacter}${TabCharacter}`;
        }

        Content = Content.trimEnd() + `\n${TabCharacter}`;

        return `<url>${Content}</url>`;
    }

}


export class SitemapXmlWriter {
    // TODO: Parse XMLVersion & Encoding
    XMLVersion = 1.0;
    XMLEncoding = "UTF-8";
    Urls: SitemapUrl[] = [];

    /** Character(s) to use as tabs in the xml file */
    TabCharacter = "  ";

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
        const RawData = Content.match(/(?<=<url>)(.|\n)*?(?=<\/url>)/g);
        if (!RawData)
            return;

        // Avoid re-compiling the regex pattern for every loop by first creating regex variables 
        const LocRegexp = new RegExp("(?<=<loc>)(.|\n)*?(?=</loc>)", "g");
        const PrioRegexp = new RegExp("(?<=<priority>)(.|\n)*?(?=</priority>)", "g");
        const LastModRegexp = new RegExp("(?<=<lastmod>)(.|\n)*?(?=</lastmod>)", "g");

        // Loop through each <url>, extract all of the data and add it as an item to the Urls list
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

    /**
     * Add a new url item to the sitemap
     * @param Url The web url
     * @param LastMod Date when page was last modified
     * @param Prio The priority of the page
     */
    AddItem(Url: string, LastMod?: Date, Prio?: number) {
        this.Urls.push(new SitemapUrl(Url, LastMod, Prio));
    }

    /**
     * Remove an item from the sitemap
     * @param Url The URL of the item to remove
     */
    RemoveItem(Url: string) {
        //ToDo, use GetItem()
        this.Urls = this.Urls.filter(x => x.Url !== Url);
    }

    /**
     * Get a url item
     * @param Url The web url of the item
     * @returns pointer to a Url object that can be modified
     */
    GetItem(Url: string) {
        // ToDo: split at third /, so weither it includes www. etc, doesn't mather + last trailing slash
        const Index = this.Urls.findIndex((x => x.Url === Url));
        return this.Urls[Index];
    }

    /**
     * @returns The highest depth value any url in the sitemap has
     */
    GetCurrentMaxDepth() {
        let MaxDepth = -1;
        const FwdSlashRegexp = new RegExp("/", "g");

        this.Urls.forEach(Url => {
            // ToDo: Move this calculation, there should be a funciton of it since it's used in multiple locations
            const Depth = (Url.Url.slice(0, -1).match(FwdSlashRegexp) || [0, 0]).length - 2;
            if (Depth > MaxDepth)
                MaxDepth = Depth;
        });

        return MaxDepth;
    }

    /**
     * Write the current urls list to the sitemap, if file already exists it will be overwritten.
     * @param bMinimized Minimize the filesize by removing all whitespace
     */
    Write(bMinimized = false) {
        let Content = `<?xml version="${this.XMLVersion}" encoding="${this.XMLEncoding}"?>`;

        // ToDo: Make this line less hard coded & allow for more options than just xmlns
        Content += `\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        // Sort urls list by prio
        this.Urls.sort((a, b) => ((a.Prio ? a.Prio : 0) < (b.Prio ? b.Prio : 0)) ? 1 : -1);

        // Add all urls
        this.Urls.forEach(Url => {
            Content += `${this.TabCharacter}${Url.ToXMLString(this.TabCharacter)}\n`;
        });

        Content += "</urlset>";

        // If bMinimized is true, remove all spaces
        if (bMinimized)
            Content = Content.replace(/\s*/g, "");

        fs.writeFileSync(this.Filepath, Content, { "encoding": "utf8" });
    }

}